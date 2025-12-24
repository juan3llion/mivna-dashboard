import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MermaidRenderer } from '@/components/diagrams/MermaidRenderer';
import type { Repository } from '@/types/repository';

interface DiagramViewerModalProps {
  repo: Repository | null;
  onClose: () => void;
}

export function DiagramViewerModal({ repo, onClose }: DiagramViewerModalProps) {
  return (
    <Dialog open={repo !== null} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {repo?.name} — Architecture Diagram
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto min-h-[500px] rounded-lg border border-border bg-background/50">
          {repo?.diagram_code && <MermaidRenderer content={repo.diagram_code} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
