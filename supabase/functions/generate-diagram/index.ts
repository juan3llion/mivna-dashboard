import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { github_repo_id } = await req.json();
    
    if (!github_repo_id) {
      console.error("❌ Missing github_repo_id");
      return new Response(
        JSON.stringify({ error: "github_repo_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🚀 Starting diagram generation for repo ID: ${github_repo_id}`);

    // Connect to external Supabase
    const externalSupabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const externalSupabaseKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");

    if (!externalSupabaseUrl || !externalSupabaseKey) {
      console.error("❌ Missing external Supabase credentials");
      return new Response(
        JSON.stringify({ error: "External Supabase not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      return new Response(
        JSON.stringify({ error: "Repository not found", details: fetchError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Found repository: ${repo.full_name || repo.name}`);
    console.log(`📁 File tree items: ${Array.isArray(repo.file_tree) ? repo.file_tree.length : 0}`);

    if (!repo.file_tree || !Array.isArray(repo.file_tree) || repo.file_tree.length === 0) {
      return new Response(
        JSON.stringify({ error: "Repository has no file tree data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare file structure for AI analysis
    const fileStructure = repo.file_tree
      .map((item: { path: string; type: string }) => `${item.type === "tree" ? "📁" : "📄"} ${item.path}`)
      .join("\n");

    console.log(`📝 Prepared file structure (${fileStructure.length} chars)`);

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("❌ LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a Senior Software Architect. Analyze this file structure (file names and paths). 
Infer the technology stack, key components, and data flow. 
Generate a Mermaid.js C4 Architecture Diagram code representing this project.
Return ONLY the raw Mermaid code string, no markdown code blocks, no explanations, no backticks.
Start directly with the diagram type (e.g., "graph TD" or "C4Context").`;

    const userPrompt = `Analyze this repository file structure and generate a Mermaid architecture diagram:\n\n${fileStructure}`;

    console.log("🤖 Calling Lovable AI Gateway...");
    
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
    let diagramCode = aiData.choices?.[0]?.message?.content || "";
    
    // Clean up the response - remove markdown code blocks if present
    diagramCode = diagramCode
      .replace(/^```mermaid\n?/i, "")
      .replace(/^```\n?/, "")
      .replace(/\n?```$/g, "")
      .trim();

    console.log(`✅ AI generated diagram (${diagramCode.length} chars)`);
    console.log(`📊 Diagram preview: ${diagramCode.substring(0, 100)}...`);

    // Save to database
    console.log("💾 Saving diagram to database...");
    const { error: updateError } = await supabase
      .from("repositories")
      .update({ diagram_code: diagramCode, updated_at: new Date().toISOString() })
      .eq("github_repo_id", github_repo_id);

    if (updateError) {
      console.error("❌ Failed to save diagram:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to save diagram", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Diagram saved successfully!");

    return new Response(
      JSON.stringify({ 
        success: true, 
        diagram_code: diagramCode,
        repo_name: repo.full_name || repo.name 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
