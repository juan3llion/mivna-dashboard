import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import type { Repository } from '@/types/repository';

interface DocsModalProps {
  repo: Repository | null;
  isOpen: boolean;
  onClose: () => void;
  onDocumentationGenerated: (repoId: string, documentation: string) => void;
}

export function DocsModal({ repo, isOpen, onClose, onDocumentationGenerated }: DocsModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateDocs = async () => {
    if (!repo?.github_repo_id) return;

    setIsGenerating(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-documentation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ github_repo_id: repo.github_repo_id }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate documentation');
      }

      const { documentation } = await response.json();
      onDocumentationGenerated(repo.id, documentation);
      toast.success('Documentation generated successfully!');
    } catch (error) {
      console.error('Error generating documentation:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate documentation');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col bg-[#1a1a1e] border-[#232f48]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground font-space-grotesk">
            <FileText className="h-5 w-5 text-primary" />
            Repository Documentation
            {repo && <span className="text-[#92a4c9] font-normal">— {repo.name}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          {repo?.documentation_md ? (
            <ScrollArea className="h-full pr-4">
              <div className="prose prose-invert prose-sm max-w-none 
                prose-headings:text-foreground prose-headings:font-space-grotesk
                prose-p:text-[#92a4c9] prose-p:font-noto-sans
                prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                prose-code:text-primary prose-code:bg-[#232f48] prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                prose-pre:bg-[#111722] prose-pre:border prose-pre:border-[#232f48]
                prose-strong:text-foreground
                prose-ul:text-[#92a4c9] prose-ol:text-[#92a4c9]
                prose-li:marker:text-primary">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {repo.documentation_md}
                </ReactMarkdown>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-6">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground font-space-grotesk">
                  No Documentation Yet
                </h3>
                <p className="max-w-sm text-sm text-[#92a4c9] font-noto-sans">
                  Generate comprehensive documentation for this repository using AI.
                  It will analyze the file structure and architecture to create detailed docs.
                </p>
              </div>
              <Button
                onClick={handleGenerateDocs}
                disabled={isGenerating}
                className="gap-2"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generating Documentation...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Generate Documentation
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
