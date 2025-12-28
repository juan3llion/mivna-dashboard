import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { github_access_token, user_id } = await req.json();

    if (!github_access_token) {
      console.error("❌ Missing github_access_token");
      return new Response(
        JSON.stringify({ error: "GitHub access token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!user_id) {
      console.error("❌ Missing user_id");
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("🔄 Fetching repositories from GitHub...");

    // Fetch all repos the user has access to
    const repos: GitHubRepo[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await fetch(
        `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated`,
        {
          headers: {
            Authorization: `Bearer ${github_access_token}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "ArchGen-Sync",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ GitHub API error:", response.status, errorText);
        return new Response(
          JSON.stringify({ error: `GitHub API error: ${response.status}` }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const pageRepos: GitHubRepo[] = await response.json();
      repos.push(...pageRepos);

      console.log(`📦 Fetched page ${page}: ${pageRepos.length} repos`);

      if (pageRepos.length < perPage) break;
      page++;
    }

    console.log(`✅ Total repos fetched: ${repos.length}`);

    // Connect to external Supabase (where repositories table lives)
    const externalSupabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const externalSupabaseKey = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY");

    if (!externalSupabaseUrl || !externalSupabaseKey) {
      console.error("❌ Missing external Supabase credentials");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const externalSupabase = createClient(externalSupabaseUrl, externalSupabaseKey);

    // Upsert repositories
    const reposToUpsert = repos.map((repo) => ({
      github_repo_id: repo.id,
      name: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      user_id: user_id,
      updated_at: new Date().toISOString(),
    }));

    let syncedCount = 0;

    for (const repoData of reposToUpsert) {
      // Check if repo already exists
      const { data: existing } = await externalSupabase
        .from("repositories")
        .select("id")
        .eq("github_repo_id", repoData.github_repo_id)
        .eq("user_id", user_id)
        .single();

      if (existing) {
        // Update existing
        const { error } = await externalSupabase
          .from("repositories")
          .update({
            name: repoData.name,
            description: repoData.description,
            url: repoData.url,
            updated_at: repoData.updated_at,
          })
          .eq("id", existing.id);

        if (error) {
          console.error(`⚠️ Error updating repo ${repoData.name}:`, error);
        } else {
          syncedCount++;
        }
      } else {
        // Insert new
        const { error } = await externalSupabase
          .from("repositories")
          .insert(repoData);

        if (error) {
          console.error(`⚠️ Error inserting repo ${repoData.name}:`, error);
        } else {
          syncedCount++;
        }
      }
    }

    console.log(`✅ Synced ${syncedCount} repositories`);

    return new Response(
      JSON.stringify({
        success: true,
        synced_count: syncedCount,
        total_fetched: repos.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("🔥 Sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
