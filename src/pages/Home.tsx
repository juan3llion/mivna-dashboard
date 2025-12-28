import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search, Filter, Loader2, FolderX, RefreshCw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { externalSupabase } from "@/integrations/external-supabase/client";
import { useGenerateDiagram } from "@/hooks/useGenerateDiagram";
import { RepoCard } from "@/components/dashboard/RepoCard";
import { DiagramViewerModal } from "@/components/dashboard/DiagramViewerModal";
import { DocsModal } from "@/components/dashboard/DocsModal";
import { Input } from "@/components/ui/input";
import type { Repository } from "@/types/repository";

export default function Home() {
  const { user, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const displayName = user?.email?.split("@")[0] || "Developer";
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const { generateDiagram, isGenerating } = useGenerateDiagram();
  const [generatingRepoId, setGeneratingRepoId] = useState<number | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [docsModalRepo, setDocsModalRepo] = useState<Repository | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const GITHUB_APP_INSTALL_URL = "https://github.com/apps/mivna-architect-bot";

  // --- AQUÍ ESTÁ LA CORRECCIÓN APLICADA ---
  const handleSyncRepositories = async () => {
    setIsSyncing(true);

    try {
      // 1. Obtener la sesión explícitamente para asegurar que tenemos el token
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("Session error:", sessionError);
        toast.error("Failed to retrieve session. Please try again.");
        return;
      }

      if (!session) {
        toast.error("Please log in to sync repositories");
        return;
      }

      // 2. Verificar que el token de GitHub existe
      const githubToken = session.provider_token;

      if (!githubToken) {
        console.warn("⚠️ GitHub provider_token is missing! Forcing re-authentication...");
        toast.error("GitHub connection expired. Please log in again.");

        // Si no hay token, cerramos sesión para forzar al usuario a conectar de nuevo
        await signOut();
        return;
      }

      console.log("🔄 Starting repository sync with valid token...");

      // 3. Llamar a la Edge Function enviando EXACTAMENTE lo que pide el backend
      const { data, error } = await supabase.functions.invoke("sync-repos", {
        body: {
          github_access_token: githubToken,
          user_id: session.user.id,
        },
      });

      if (error) throw error;

      console.log("✅ Sync complete:", data);
      toast.success(`Success! Synchronized ${data.synced_count} repositories.`);

      // Recargar la lista de repositorios
      await fetchRepositories();
    } catch (error: any) {
      console.error("❌ Sync error:", error);
      toast.error(error.message || "Failed to sync repositories");
    } finally {
      setIsSyncing(false);
    }
  };
  // ----------------------------------------

  // Handle GitHub app installation callback
  useEffect(() => {
    const handleInstallation = async () => {
      const installationId = searchParams.get("installation_id");
      const setupAction = searchParams.get("setup_action");

      if (installationId && setupAction === "install") {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) return;

          const { error } = await (supabase.from("user_installations" as any) as any).insert({
            user_id: user.id,
            installation_id: parseInt(installationId),
          });

          if (error) {
            if (error.code !== "23505") throw error;
          }

          toast.success("¡Repositorios conectados correctamente!");
          window.history.replaceState({}, "", "/dashboard");
        } catch (error: any) {
          console.error("Error linking:", error);
          toast.error("Error al vincular repositorios");
        }
      }
    };

    handleInstallation();
  }, [searchParams]);

  // Fetch repositories on mount
  useEffect(() => {
    fetchRepositories();
  }, []);

  const fetchRepositories = async () => {
    setLoadingRepos(true);
    const { data, error } = await externalSupabase
      .from("repositories")
      .select("id, github_repo_id, name, file_tree, diagram_code, user_id, created_at, updated_at, documentation_md")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching repositories:", error);
    } else {
      setRepositories(data || []);
    }
    setLoadingRepos(false);
  };

  const handleGenerateDiagram = async (repo: Repository) => {
    if (!repo.github_repo_id) return;

    setGeneratingRepoId(repo.github_repo_id);
    const diagramCode = await generateDiagram(repo.github_repo_id);

    if (diagramCode) {
      setRepositories((prev) =>
        prev.map((r) => (r.github_repo_id === repo.github_repo_id ? { ...r, diagram_code: diagramCode } : r)),
      );
    }
    setGeneratingRepoId(null);
  };

  const handleDocumentationGenerated = (repoId: string, documentation: string) => {
    setRepositories((prev) => prev.map((r) => (r.id === repoId ? { ...r, documentation_md: documentation } : r)));
    // Update the modal's repo as well
    setDocsModalRepo((prev) => (prev?.id === repoId ? { ...prev, documentation_md: documentation } : prev));
  };

  const diagramCount = repositories.filter((r) => r.diagram_code).length;

  const filteredRepos = repositories.filter((repo) => repo.name?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-full bg-[#101622] p-6 lg:p-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        {/* Welcome Panel - ArchGen Feature Banner */}
        <div className="flex flex-col gap-6 rounded-2xl border border-[#324467] bg-gradient-to-r from-[#111722] to-[#1a2333] p-6 shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold text-foreground font-space-grotesk">Welcome back, {displayName}! 👋</h2>
            <p className="max-w-xl text-[#92a4c9] font-noto-sans">
              You have <span className="font-semibold text-primary">{diagramCount}</span> generated
              {diagramCount === 1 ? " architecture" : " architectures"} ready for review.
              {repositories.length > diagramCount && (
                <> Generate diagrams for your remaining {repositories.length - diagramCount} repositories.</>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleSyncRepositories}
              disabled={isSyncing}
              className="gap-2 whitespace-nowrap border-[#232f48] text-[#92a4c9] hover:text-foreground hover:bg-[#232f48]"
            >
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {isSyncing ? "Syncing..." : "Sync Repos"}
            </Button>
            <Button onClick={() => (window.location.href = GITHUB_APP_INSTALL_URL)} className="gap-2 whitespace-nowrap">
              <PlusCircle className="h-4 w-4" />
              Import New Repo
            </Button>
          </div>
        </div>

        {/* Repositories Section */}
        <div className="flex flex-col gap-5">
          {/* Header with Search */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xl font-bold text-foreground font-space-grotesk">Your Repositories</h3>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#92a4c9]" />
                <Input
                  type="text"
                  placeholder="Search repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 sm:w-64 bg-[#1a1a1e] border-[#232f48] text-foreground placeholder-[#92a4c9] focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Repository Grid */}
          {loadingRepos ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-[#92a4c9]" />
            </div>
          ) : filteredRepos.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredRepos.map((repo) => (
                <RepoCard
                  key={repo.id}
                  repo={repo}
                  isGenerating={isGenerating && generatingRepoId === repo.github_repo_id}
                  onGenerateDiagram={() => handleGenerateDiagram(repo)}
                  onOpenDocs={() => setDocsModalRepo(repo)}
                />
              ))}
            </div>
          ) : repositories.length > 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#232f48] py-16">
              <Search className="mb-4 h-12 w-12 text-[#92a4c9]/50" />
              <p className="text-lg font-medium text-foreground font-space-grotesk">No matching repositories</p>
              <p className="mt-1 text-sm text-[#92a4c9] font-noto-sans">Try adjusting your search query</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#232f48] py-16">
              <FolderX className="mb-4 h-12 w-12 text-[#92a4c9]/50" />
              <p className="text-lg font-medium text-foreground font-space-grotesk">No repositories connected</p>
              <p className="mt-1 text-sm text-[#92a4c9] font-noto-sans">Import your first repository to get started</p>
              <Button onClick={() => (window.location.href = GITHUB_APP_INSTALL_URL)} className="mt-6 gap-2">
                <PlusCircle className="h-4 w-4" />
                Import Repository
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Diagram Viewer Modal */}
      <DiagramViewerModal repo={selectedRepo} onClose={() => setSelectedRepo(null)} />

      {/* Documentation Modal */}
      <DocsModal
        repo={docsModalRepo}
        isOpen={!!docsModalRepo}
        onClose={() => setDocsModalRepo(null)}
        onDocumentationGenerated={handleDocumentationGenerated}
      />
    </div>
  );
}
