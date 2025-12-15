import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GitBranch, Share2, Activity, Zap, Github, Plus } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const displayName = user?.email?.split('@')[0] || 'Developer';
  
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
          window.history.replaceState({}, "", "/");
          
        } catch (error: any) {
          console.error("Error linking:", error);
          toast.error("Error al vincular repositorios");
        }
      }
    };

    handleInstallation();
  }, [searchParams]);

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

      {/* Grid de Estadísticas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Repositories</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">No repositories connected</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Diagrams</CardTitle>
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">No diagrams created</p>
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

      <div className="grid gap-4 md:grid-cols-2">
        {/* Quick Actions Card */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Get started with your workflow</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            
            {/* BOTÓN 1: Connect Repository */}
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2"
              onClick={() => window.location.href = GITHUB_APP_INSTALL_URL}
            >
              <Plus className="h-4 w-4" />
              <Github className="h-4 w-4" />
              Conectar Repositorio
            </Button>

            {/* BOTÓN 2: Create Diagram (Navegación interna) */}
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