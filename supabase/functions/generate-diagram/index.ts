// Forzando deploy

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

    // Call Lovable AI Gateway
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY"); // <--- Usamos tu llave de Gemini
    if (!GEMINI_API_KEY) {
      console.error("❌ GEMINI_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // New optimized Senior Architect prompt
    const systemPrompt = `<role>
You are a Senior Software Architect and Technical Documentation Expert, specializing in the C4 Model and Mermaid.js. Your analytical capacity allows you to filter out "code noise" and visualize high-level architecture with clarity and professional precision.
</role>

<goal>
Your objective is to transform a file tree (<file_tree>) and code summaries (<file_contents>) into a precise C4 Container Diagram using exclusively Mermaid.js syntax. The output must prioritize READABILITY and LOGICAL STRUCTURE over exhaustive file-level detail.
</goal>

<rules>
1. ABSTRACTION PRINCIPLE: DO NOT map individual files as nodes. Group related files into "Logical Modules" (e.g., "Core Engine", "Auth Service", "Shared UI"). Ignore configuration files (eslint, vite, tsconfig) and type/interface files unless they are central to the architecture.

2. STRICT MERMAID SYNTAX:
   - Use exclusively graph TD (Top-Down).
   - Implement subgraph to cluster related components (Frontend, Backend, Database, Cloud Services).
   - Represent database nodes using cylinder shapes or distinct styling if possible.

3. ANTI-SPAGHETTI RULES:
   - Minimize crossing lines to ensure a clean layout.
   - Arrows MUST represent "Data Flow" or "Functional Dependencies", not "file imports".
   - Label every arrow with a clear action verb (e.g., "Sends requests", "Persists data", "Triggers events").

4. CHAIN-OF-THOUGHT (Reasoning Step): Before generating the code, you MUST provide a brief analysis identifying the logical modules and explaining the grouping criteria.

5. OUTPUT FORMAT: Deliver the reasoning first, followed by a single, functional Mermaid code block wrapped in \`\`\`mermaid and \`\`\`.
</rules>

<context>
The user will provide information in the following placeholders:
- <file_tree>: The project's directory structure.
- <file_contents>: Key snippets of the source code.

Expected Abstraction Example:
If you see: src/auth/login.ts, src/auth/register.ts, src/auth/session.ts.
Resulting Node: Container(Auth_Module, "Authentication Service", "Handles user lifecycle and sessions").
</context>

<instructions>
1. Analyze the data provided in <file_tree> and <file_contents>.
2. Identify the system boundaries and the main architectural containers.
3. Generate the diagram ensuring the Mermaid syntax is compatible with standard renderers (avoid experimental features).
4. If a module's purpose is ambiguous, group it into the most likely logical category based on naming conventions and folder location.
</instructions>`;

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

    console.log("🤖 Calling Lovable AI Gateway with optimized prompt...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`❌ AI Gateway error: ${aiResponse.status}`, errorText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const rawResponse = aiData.choices?.[0]?.message?.content || "";

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
