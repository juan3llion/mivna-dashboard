import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GitBranch, Plus, Search, FolderGit2, Sparkles, Loader2, FileCode } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { MermaidRenderer } from '@/components/diagrams/MermaidRenderer';
import { useGenerateDiagram } from '@/hooks/useGenerateDiagram';

interface Repository {
  id: string;
  github_repo_id: number;
  name: string;
  full_name: string;
  file_tree: { path: string; type: string }[] | null;
  diagram_code: string | null;
}

// External Supabase client for fetching repos
const externalSupabase = createClient(
  'https://awocsqhjcsmetezjqibo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3b2NzcWhqY3NtZXRlempxaWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MTY2NTAsImV4cCI6MjA2NTQ5MjY1MH0.57F0zg0lWpKLJ6N8vEpHLSUIkvcOXV5bF7O06AWrjXw'
);

export default function Repositories() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { generateDiagram, isGenerating } = useGenerateDiagram();
  const [generatingRepoId, setGeneratingRepoId] = useState<number | null>(null);

  useEffect(() => {
    fetchRepositories();
  }, []);

  const fetchRepositories = async () => {
    setLoading(true);
    const { data, error } = await externalSupabase
      .from('repositories')
      .select('id, github_repo_id, name, full_name, file_tree, diagram_code')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching repositories:', error);
    } else {
      setRepositories(data || []);
    }
    setLoading(false);
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

  const filteredRepos = repositories.filter(repo => 
    (repo.full_name || repo.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fileCount = (repo: Repository) => 
    repo.file_tree?.filter(f => f.type === 'blob').length || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Repositories</h1>
          <p className="text-muted-foreground">Manage your connected repositories</p>
        </div>
        <a 
          href="https://github.com/apps/mivna-architect-bot" 
          target="_blank" 
          rel="noopener noreferrer"
        >
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Connect Repository
          </Button>
        </a>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search repositories..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <Card className="border-border bg-card">
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : filteredRepos.length === 0 ? (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Connected Repositories
            </CardTitle>
            <CardDescription>
              Your GitHub repositories will appear here once connected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted/50 p-6 mb-6">
                <FolderGit2 className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No repositories connected
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                Connect your GitHub repositories to start visualizing your codebase and generating diagrams automatically.
              </p>
              <a 
                href="https://github.com/apps/mivna-architect-bot" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Connect your first repository
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {filteredRepos.map((repo) => (
            <Card key={repo.id} className="border-border bg-card">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <GitBranch className="h-5 w-5" />
                      {repo.full_name || repo.name}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1">
                        <FileCode className="h-4 w-4" />
                        {fileCount(repo)} files
                      </span>
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => handleGenerateDiagram(repo)}
                    disabled={isGenerating && generatingRepoId === repo.github_repo_id}
                    variant={repo.diagram_code ? "outline" : "default"}
                  >
                    {isGenerating && generatingRepoId === repo.github_repo_id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        {repo.diagram_code ? 'Regenerate Diagram' : 'Generate Architecture Diagram'}
                      </>
                    )}
                  </Button>
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
      )}
    </div>
  );
}
