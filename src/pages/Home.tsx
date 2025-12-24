import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GitBranch, Share2, Activity, Zap, Github, Plus, Sparkles, Loader2, FileCode } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { externalSupabase } from '@/integrations/external-supabase/client';
import { MermaidRenderer } from '@/components/diagrams/MermaidRenderer';
import { useGenerateDiagram } from '@/hooks/useGenerateDiagram';
import type { Repository } from '@/types/repository';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const displayName = user?.email?.split('@')[0] || 'Developer';
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const { generateDiagram, isGenerating } = useGenerateDiagram();
  const [generatingRepoId, setGeneratingRepoId] = useState<number | null>(null);
  
  const GITHUB_APP_INSTALL_URL = "https://github.com/apps/mivna-architect-bot";

  useEffect(() => {
    const handleInstallation = async () => {
      const installationId = searchParams.get("installation_id");
      const setupAction = searchParams.get("setup_action");

      if (installationId && setupAction === "install") {
        try {
          const { data: { user } } = await supabase.auth.getUser();
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

  useEffect(() => {
    fetchRepositories();
  }, []);

  const fetchRepositories = async () => {
    setLoadingRepos(true);
    const { data, error } = await externalSupabase
      .from('repositories')
      .select('id, github_repo_id, name, file_tree, diagram_code, user_id, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching repositories:', error);
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
      setRepositories(prev => 
        prev.map(r => 
          r.github_repo_id === repo.github_repo_id 
            ? { ...r, diagram_code: diagramCode }
            : r
        )
      );
    }
    setGeneratingRepoId(null);
  };

  const fileCount = (repo: Repository) => 
    repo.file_tree?.filter(f => f.type === 'blob').length || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">
          Welcome back, {displayName}
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening with your projects today.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Repositories</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{repositories.length}</div>
            <p className="text-xs text-muted-foreground">
              {repositories.length === 0 ? 'No repositories connected' : 'Connected repositories'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Diagrams</CardTitle>
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {repositories.filter(r => r.diagram_code).length}
            </div>
            <p className="text-xs text-muted-foreground">Generated diagrams</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">No recent activity</p>
          </CardContent>
        </Card>
      </div>

      {loadingRepos ? (
        <Card className="border-border bg-card">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : repositories.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Connected Repositories</h2>
          {repositories.map((repo) => (
            <Card key={repo.id} className="border-border bg-card">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <GitBranch className="h-5 w-5" />
                      {repo.name}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1">
                        <FileCode className="h-4 w-4" />
                        {fileCount(repo)} files
                      </span>
                    </CardDescription>
                  </div>
                  {!repo.diagram_code && (
                    <Button
                      onClick={() => handleGenerateDiagram(repo)}
                      disabled={isGenerating && generatingRepoId === repo.github_repo_id}
                    >
                      {isGenerating && generatingRepoId === repo.github_repo_id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Architecture
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              {repo.diagram_code && (
                <CardContent>
                  <div className="rounded-lg border border-border bg-background/50 min-h-[400px]">
                    <MermaidRenderer content={repo.diagram_code} />
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Get started with your workflow</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2"
              onClick={() => window.location.href = GITHUB_APP_INSTALL_URL}
            >
              <Plus className="h-4 w-4" />
              <Github className="h-4 w-4" />
              Conectar Repositorio
            </Button>

            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/diagrams')}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Create Diagram
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest actions and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Zap className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground">No recent activity</p>
              <p className="text-xs text-muted-foreground mt-1">
                Start by connecting a repository or creating a diagram
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
