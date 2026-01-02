// Forzando deploy
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Extract ONLY the Mermaid code block from AI response (handles reasoning + code format)
function extractMermaidCode(response: string): string {
  // Try to find ```mermaid ... ``` block first
  const mermaidBlockMatch = response.match(/```mermaid\s*([\s\S]*?)```/i);
  if (mermaidBlockMatch && mermaidBlockMatch[1]) {
    console.log("✅ Extracted Mermaid code from ```mermaid block");
    return mermaidBlockMatch[1].trim();
  }

  // Fallback: try to find any code block
  const codeBlockMatch = response.match(/```\s*([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    console.log("✅ Extracted code from generic ``` block");
    return codeBlockMatch[1].trim();
  }

  // Last resort: try to find graph TD or similar Mermaid starting patterns
  const graphMatch = response.match(/(graph\s+(?:TD|TB|LR|RL|BT)[\s\S]*)/i);
  if (graphMatch) {
    console.log("✅ Extracted Mermaid code from graph pattern match");
    return graphMatch[1].trim();
  }

  // Return cleaned response if no pattern found
  console.log("⚠️ No Mermaid block found, returning cleaned response");
  return response.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { github_repo_id } = await req.json();

    if (!github_repo_id) {
      console.error("❌ Missing github_repo_id");
      return new Response(JSON.stringify({ error: "github_repo_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`🚀 Starting diagram generation for repo ID: ${github_repo_id}`);

    // Connect to external Supabase
    const externalSupabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const externalSupabaseKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");

    if (!externalSupabaseUrl || !externalSupabaseKey) {
      console.error("❌ Missing external Supabase credentials");
      return new Response(JSON.stringify({ error: "External Supabase not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(externalSupabaseUrl, externalSupabaseKey);

    // Extract user from Authorization header
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      // Create a client with the user's token to get their identity
      const userSupabase = createClient(externalSupabaseUrl, Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") || externalSupabaseKey, {
        global: { headers: { Authorization: `Bearer ${token}` } }
      });
      const { data: { user }, error: userError } = await userSupabase.auth.getUser();

      if (user && !userError) {
        userId = user.id;
        console.log(`👤 User authenticated: ${userId}`);
      }
    }

    // Check usage limit if user is authenticated
    if (userId) {
      console.log(`📊 Checking usage limit for user ${userId} and repo ${github_repo_id}...`);
      const { data: limitCheck, error: limitError } = await supabase.rpc(
        "check_repo_generation_limit",
        { p_user_id: userId, p_github_repo_id: github_repo_id }
      );

      if (limitError) {
        console.error("❌ Error checking usage limit:", limitError);
        // Continue anyway - don't block if limit check fails
      } else if (limitCheck) {
        console.log(`📊 Limit check result:`, limitCheck);

        if (!limitCheck.allowed) {
          console.log(`🚫 User ${userId} has reached their generation limit`);
          return new Response(
            JSON.stringify({
              error: limitCheck.error || "Generation limit reached",
              remaining: 0,
              limit_reached: true,
            }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        console.log(`✅ User has ${limitCheck.remaining} repos remaining. Is existing repo: ${limitCheck.is_existing_repo}`);
      }
    } else {
      console.log("⚠️ No authenticated user found, skipping usage limit check");
    }


    // Fetch the repository with file_tree
    console.log("📥 Fetching repository from database...");
    const { data: repo, error: fetchError } = await supabase
      .from("repositories")
      .select("id, name, full_name, file_tree")
      .eq("github_repo_id", github_repo_id)
      .single();

    if (fetchError || !repo) {
      console.error("❌ Repository not found:", fetchError);
      return new Response(JSON.stringify({ error: "Repository not found", details: fetchError?.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`✅ Found repository: ${repo.full_name || repo.name}`);
    console.log(`📁 File tree items: ${Array.isArray(repo.file_tree) ? repo.file_tree.length : 0}`);

    if (!repo.file_tree || !Array.isArray(repo.file_tree) || repo.file_tree.length === 0) {
      return new Response(JSON.stringify({ error: "Repository has no file tree data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prepare file structure for AI analysis
    const fileTree = repo.file_tree
      .map((item: { path: string; type: string }) => `${item.type === "tree" ? "📁" : "📄"} ${item.path}`)
      .join("\n");

    console.log(`📝 Prepared file tree (${fileTree.length} chars)`);

    // --- CONFIGURACIÓN DE GEMINI ---
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.error("❌ GEMINI_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prompt blindado: Sin comentarios ni sintaxis compleja
    const systemPrompt = `<role>
You are a Senior Software Architect. Generate a Mermaid.js diagram.
</role>

<CRITICAL_RULES>
1. Start with "graph TD" (Top-Down) or "graph LR" (Left-Right).
2. IMPORTANT: DO NOT WRITE COMMENTS in the Mermaid code (no lines starting with %).
3. STRUCTURE:
   - Use 'subgraph' for grouping modules.
   - Close every 'subgraph' with the keyword 'end' ON ITS OWN LINE.
4. NODE STYLING:
   - User: id["👤 User Name"]
   - Service: id["📦 Service Name"]
   - Database: id[("🗄️ Database Name")] (Must use cylinder shape ( ) )
5. CONNECTIONS:
   - Define all connections at the very bottom of the code, outside subgraphs.
   - Syntax: NodeA -->|Action| NodeB
6. CLEANLINESS:
   - Node IDs must be simple alphanumeric (e.g., AuthServ, DB1), no spaces/symbols.
   - Text labels must always be inside quotes.
</CRITICAL_RULES>

<output_format>
Provide reasoning first, then the clean Mermaid code inside \`\`\`mermaid \`\`\`.
</output_format>`;

    // Build user prompt with dynamic placeholders
    const codeSummaries =
      "No code summaries available. Please infer architecture from file names and folder structure.";

    const userPrompt = `<input_data>
<file_tree>
${fileTree}
</file_tree>

<file_contents>
${codeSummaries}
</file_contents>
</input_data>`;

    // --- NUEVO BLOQUE: LLAMADA DIRECTA A GOOGLE GEMINI SDK ---
    console.log("🤖 Asking Gemini via Direct SDK (Bypassing Gateway)...");

    // 1. Inicializar el modelo con la SDK oficial
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    // Usamos 'gemini-1.5-flash' porque es rápido y estable para este caso
    // Usamos el modelo exacto que aparece en tu lista (Gemini 2.5 Flash)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 2. Ejecutar la generación (Unimos System Prompt + User Prompt)
    const result = await model.generateContent(systemPrompt + "\n\n" + userPrompt);
    const response = await result.response;
    const rawResponse = response.text();

    console.log(`📝 Raw AI response length: ${rawResponse.length} chars`);
    console.log(`🧠 AI Reasoning preview: ${rawResponse.substring(0, 300)}...`);

    // Extract ONLY the Mermaid code block (critical for rendering)
    const diagramCode = extractMermaidCode(rawResponse);

    console.log(`✅ Extracted diagram code (${diagramCode.length} chars)`);
    console.log(`📊 Diagram preview: ${diagramCode.substring(0, 150)}...`);

    // Save to database
    console.log("💾 Saving diagram to database...");
    const { error: updateError } = await supabase
      .from("repositories")
      .update({ diagram_code: diagramCode, updated_at: new Date().toISOString() })
      .eq("github_repo_id", github_repo_id);

    if (updateError) {
      console.error("❌ Failed to save diagram:", updateError);
      return new Response(JSON.stringify({ error: "Failed to save diagram", details: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("✅ Diagram saved successfully!");

    return new Response(
      JSON.stringify({
        success: true,
        diagram_code: diagramCode,
        repo_name: repo.full_name || repo.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
