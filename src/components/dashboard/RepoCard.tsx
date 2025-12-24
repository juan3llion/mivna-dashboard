import { useNavigate } from 'react-router-dom';
import { Eye, Sparkles, Loader2, Code, Terminal, Gem, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Repository } from '@/types/repository';

interface RepoCardProps {
  repo: Repository;
  isGenerating: boolean;
  onGenerateDiagram: () => void;
}

const languageConfig: Record<string, { icon: React.ElementType; color: string; bg: string; ring: string }> = {
  TypeScript: { icon: Code, color: 'text-blue-400', bg: 'bg-blue-400/10', ring: 'ring-blue-400/20' },
  JavaScript: { icon: Terminal, color: 'text-yellow-400', bg: 'bg-yellow-400/10', ring: 'ring-yellow-400/20' },
  Python: { icon: Gem, color: 'text-green-400', bg: 'bg-green-400/10', ring: 'ring-green-400/20' },
  default: { icon: FolderOpen, color: 'text-primary', bg: 'bg-primary/10', ring: 'ring-primary/20' },
};

export function RepoCard({ repo, isGenerating, onGenerateDiagram }: RepoCardProps) {
  const navigate = useNavigate();
  const fileCount = repo.file_tree?.filter(f => f.type === 'blob').length || 0;
  const language = 'TypeScript'; // Default, could be detected from repo
  const config = languageConfig[language] || languageConfig.default;
  const IconComponent = config.icon;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="group flex flex-col gap-4 rounded-xl border border-[#232f48] bg-[#1a1a1e] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${config.bg}`}>
          <IconComponent className={`h-6 w-6 ${config.color}`} />
        </div>
        {/* Language Badge - ArchGen Design System */}
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${config.bg} ${config.color} ${config.ring}`}>
          {language}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-bold text-foreground font-space-grotesk">{repo.name}</h3>
        <p className="line-clamp-2 text-sm text-[#92a4c9] font-noto-sans">
          {fileCount} files indexed • Updated {formatDate(repo.updated_at)}
        </p>
      </div>

      {/* Action Button */}
      <div className="mt-auto pt-2">
        {repo.diagram_code ? (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => navigate(`/repo/${repo.id}`)}
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