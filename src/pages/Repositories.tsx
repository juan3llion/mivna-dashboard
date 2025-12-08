import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GitBranch, Plus, Search, FolderGit2 } from 'lucide-react';

export default function Repositories() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Repositories</h1>
          <p className="text-muted-foreground">Manage your connected repositories</p>
        </div>
        {/* BOTÓN SUPERIOR ENLAZADO */}
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
          />
        </div>
      </div>

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
            {/* BOTÓN CENTRAL ENLAZADO */}
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
    </div>
  );
}