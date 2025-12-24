import { Eye, Sparkles, Loader2, Code, Terminal, Gem, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Repository } from '@/types/repository';

interface RepoCardProps {
  repo: Repository;
  isGenerating: boolean;
  onGenerateDiagram: () => void;
  onViewDiagram: () => void;
}

const languageConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  TypeScript: { icon: Code, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  JavaScript: { icon: Terminal, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  Python: { icon: Gem, color: 'text-green-400', bg: 'bg-green-500/20' },
  default: { icon: FolderOpen, color: 'text-primary', bg: 'bg-primary/20' },
};

export function RepoCard({ repo, isGenerating, onGenerateDiagram, onViewDiagram }: RepoCardProps) {
  const fileCount = repo.file_tree?.filter(f => f.type === 'blob').length || 0;
  const language = 'TypeScript'; // Default, could be detected from repo
  const config = languageConfig[language] || languageConfig.default;
  const IconComponent = config.icon;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${config.bg}`}>
          <IconComponent className={`h-6 w-6 ${config.color}`} />
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {language}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-bold text-foreground">{repo.name}</h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {fileCount} files indexed • Updated {formatDate(repo.updated_at)}
        </p>
      </div>

      {/* Action Button */}
      <div className="mt-auto pt-2">
        {repo.diagram_code ? (
          <Button
            variant="outline"
            className="w-full gap-2 border-border hover:border-primary/50 hover:bg-primary/5"
            onClick={onViewDiagram}
          >
            <Eye className="h-4 w-4" />
            View Diagram
          </Button>
        ) : (
          <Button
            className="w-full gap-2"
            onClick={onGenerateDiagram}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Architecture
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
