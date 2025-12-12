import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Copy, Download, Share2 } from 'lucide-react';
import { MermaidRenderer } from '@/components/diagrams/MermaidRenderer';
import { toast } from '@/hooks/use-toast';

const SAMPLE_DIAGRAM = `graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[Deploy]
    E --> F[🚀 Success!]`;

export default function Diagrams() {
  const [content, setContent] = useState(SAMPLE_DIAGRAM);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast({ title: 'Copied!', description: 'Diagram code copied to clipboard' });
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.mmd';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded!', description: 'Diagram saved as diagram.mmd' });
  };

  return (
    <div className="p-6 space-y-6 h-[calc(100vh-2rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Diagrams</h1>
          <p className="text-muted-foreground">Create diagrams with Mermaid.js syntax</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100%-6rem)]">
        <Card className="border-border bg-card flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Editor
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter Mermaid diagram syntax..."
              className="h-full min-h-[400px] font-mono text-sm resize-none bg-background"
            />
          </CardContent>
        </Card>

        <Card className="border-border bg-card flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Preview</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            <div className="h-full min-h-[400px] rounded-md border border-border bg-background overflow-hidden">
              <MermaidRenderer content={content} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
