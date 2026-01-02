import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { github_repo_id } = await req.json();

    if (!github_repo_id) {
      console.error("Missing github_repo_id");
      return new Response(
        JSON.stringify({ error: "github_repo_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generating documentation for repo:", github_repo_id);

    // Connect to external Supabase to fetch repo data
    const externalSupabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const externalSupabaseKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");

    if (!externalSupabaseUrl || !externalSupabaseKey) {
      console.error("Missing external Supabase credentials");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const externalSupabase = createClient(externalSupabaseUrl, externalSupabaseKey);

    // Fetch the repository data
    const { data: repo, error: repoError } = await externalSupabase
      .from("repositories")
      .select("id, name, file_tree, diagram_code")
      .eq("github_repo_id", github_repo_id)
      .single();

    if (repoError || !repo) {
      console.error("Repository not found:", repoError);
      return new Response(
        JSON.stringify({ error: "Repository not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found repository:", repo.name);

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
      const { data: limitCheck, error: limitError } = await externalSupabase.rpc(
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

    // Prepare file tree for AI prompt
    const fileTreeText = repo.file_tree
      ? repo.file_tree.map((f: { path: string; type: string }) => `${f.type === 'tree' ? '📁' : '📄'} ${f.path}`).join("\n")
      : "No file tree available";

    // Generate documentation using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a technical documentation expert. Generate comprehensive, well-structured markdown documentation for a software repository.

Your documentation should include:
1. **Project Overview** - What the project does and its purpose
2. **Architecture** - High-level architecture based on the file structure
3. **Directory Structure** - Explain the purpose of key directories
4. **Key Components** - Describe major components/modules
5. **Getting Started** - Setup and installation guidance
6. **Usage** - How to use the project
7. **API Reference** (if applicable) - Key APIs or endpoints

Use proper markdown formatting with headers, code blocks, and bullet points. Be concise but informative.`;

    const userPrompt = `Generate documentation for the "${repo.name}" repository.

**File Structure:**
\`\`\`
${fileTreeText}
\`\`\`

${repo.diagram_code ? `**Architecture Diagram (Mermaid):**
\`\`\`mermaid
${repo.diagram_code}
\`\`\`` : ""}

Please generate comprehensive markdown documentation based on this information.`;

    console.log("Calling Lovable AI for documentation generation...");

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
      console.error("AI API error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const documentation = aiData.choices?.[0]?.message?.content;

    if (!documentation) {
      console.error("No documentation generated from AI");
      return new Response(
        JSON.stringify({ error: "Failed to generate documentation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Documentation generated successfully, saving to database...");

    // Save documentation to database
    const { error: updateError } = await externalSupabase
      .from("repositories")
      .update({ documentation_md: documentation })
      .eq("github_repo_id", github_repo_id);

    if (updateError) {
      console.error("Failed to save documentation:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to save documentation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Documentation saved successfully");

    return new Response(
      JSON.stringify({ documentation }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-documentation:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
