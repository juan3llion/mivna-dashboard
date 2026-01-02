import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, FileText, RefreshCw, Download, Copy, Check } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Repository } from '@/types/repository';

interface DocsModalProps {
  repo: Repository | null;
  isOpen: boolean;
  onClose: () => void;
  onDocumentationGenerated: (repoId: string, documentation: string) => void;
}

export function DocsModal({ repo, isOpen, onClose, onDocumentationGenerated }: DocsModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const handleCopyMarkdown = async () => {
    if (!repo?.documentation_md) return;

    await navigator.clipboard.writeText(repo.documentation_md);
    setHasCopied(true);
    toast.success('Markdown copied to clipboard!');

    setTimeout(() => setHasCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    if (!repo?.documentation_md) return;

    const blob = new Blob([repo.documentation_md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${repo.name}-README.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Documentation downloaded!');
  };

  const handleGenerateDocs = async () => {
    if (!repo?.github_repo_id) {
      console.error('❌ No github_repo_id available on repo:', repo);
      toast.error('Repository is missing GitHub ID');
      return;
    }

    setIsGenerating(true);
    try {
      // Debug logging before the call
      console.log('🚀 Invoking generate-documentation with:', {
        github_repo_id: repo.github_repo_id,
        repo_name: repo.name,
        supabase_id: repo.id // This is NOT what we send, just for debug
      });

      const { data, error } = await supabase.functions.invoke('generate-documentation', {
        body: { github_repo_id: repo.github_repo_id }
      });

      if (error) {
        console.error('🔥 Supabase function error:', error);

        // Check if this is a limit reached error
        if (error.message?.includes('limit') || (error as any).context?.limit_reached) {
          toast.error('You have reached your 3 repo limit. Upgrade your plan to generate more documentation.');
          return;
        }

        throw error;
      }

      console.log('✅ Generation success:', data);

      // Check for limit_reached in response data
      if (data?.limit_reached) {
        toast.error('You have reached your 3 repo limit. Upgrade your plan to generate more documentation.');
        return;
      }

      if (data?.documentation) {
        onDocumentationGenerated(repo.id, data.documentation);
        toast.success(repo?.documentation_md ? 'Documentation updated!' : 'Documentation generated successfully!');
      } else {
        throw new Error('No documentation returned from API');
      }
    } catch (error) {
      console.error('🔥 Error generating docs:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to generate documentation'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col bg-[#1a1a1e] border-[#232f48]">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-2 text-foreground font-space-grotesk">
              <FileText className="h-5 w-5 text-primary" />
              Repository Documentation
              {repo && <span className="text-[#92a4c9] font-normal">— {repo.name}</span>}
            </DialogTitle>

            {repo?.documentation_md && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateDocs}
                  disabled={isGenerating}
                  className="gap-1.5 border-[#232f48] text-[#92a4c9] hover:text-white hover:bg-[#232f48]"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {isGenerating ? 'Regenerating...' : 'Regenerate'}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadMarkdown}
                  disabled={isGenerating}
                  className="gap-1.5 border-[#232f48] text-[#92a4c9] hover:text-white hover:bg-[#232f48]"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyMarkdown}
                  disabled={isGenerating}
                  className="gap-1.5 border-[#232f48] text-[#92a4c9] hover:text-white hover:bg-[#232f48]"
                >
                  {hasCopied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {hasCopied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            )}
          </div>
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
