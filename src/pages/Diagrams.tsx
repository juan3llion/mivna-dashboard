import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Download, Save, Plus, Trash2, FolderOpen } from 'lucide-react';
import { MermaidRenderer } from '@/components/diagrams/MermaidRenderer';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const SAMPLE_DIAGRAM = `graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[Deploy]
    E --> F[🚀 Success!]`;

interface SavedDiagram {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export default function Diagrams() {
  const { user } = useAuth();
  const [content, setContent] = useState(SAMPLE_DIAGRAM);
  const [title, setTitle] = useState('Untitled Diagram');
  const [currentDiagramId, setCurrentDiagramId] = useState<string | null>(null);
  const [savedDiagrams, setSavedDiagrams] = useState<SavedDiagram[]>([]);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchDiagrams();
    }
  }, [user]);

  const fetchDiagrams = async () => {
    const { data, error } = await supabase
      .from('diagrams')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching diagrams:', error);
      return;
    }
    setSavedDiagrams(data || []);
  };

  const handleSave = async () => {
    if (!user) {
      toast({ 
        title: 'Sign in required', 
        description: 'Please sign in to save diagrams',
        variant: 'destructive'
      });
      return;
    }

    setIsSaving(true);
    try {
      if (currentDiagramId) {
        // Update existing diagram
        const { error } = await supabase
          .from('diagrams')
          .update({ title, content, updated_at: new Date().toISOString() })
          .eq('id', currentDiagramId);

        if (error) throw error;
        toast({ title: 'Saved!', description: 'Diagram updated successfully' });
      } else {
        // Create new diagram
        const { data, error } = await supabase
          .from('diagrams')
          .insert({ title, content, user_id: user.id })
          .select()
          .single();

        if (error) throw error;
        setCurrentDiagramId(data.id);
        toast({ title: 'Saved!', description: 'Diagram created successfully' });
      }
      fetchDiagrams();
    } catch (error) {
      console.error('Error saving diagram:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to save diagram',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoad = (diagram: SavedDiagram) => {
    setContent(diagram.content);
    setTitle(diagram.title);
    setCurrentDiagramId(diagram.id);
    setIsLoadDialogOpen(false);
    toast({ title: 'Loaded!', description: `"${diagram.title}" loaded` });
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('diagrams').delete().eq('id', id);
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete diagram', variant: 'destructive' });
      return;
    }
    
    if (currentDiagramId === id) {
      handleNew();
    }
    fetchDiagrams();
    toast({ title: 'Deleted', description: 'Diagram removed' });
  };

  const handleNew = () => {
    setContent(SAMPLE_DIAGRAM);
    setTitle('Untitled Diagram');
    setCurrentDiagramId(null);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast({ title: 'Copied!', description: 'Diagram code copied to clipboard' });
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}.mmd`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded!', description: `Saved as ${title}.mmd` });
  };

  return (
    <div className="p-6 space-y-6 h-[calc(100vh-2rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-bold bg-transparent border-none p-0 h-auto focus-visible:ring-0"
            placeholder="Diagram title..."
          />
          <p className="text-muted-foreground">Create diagrams with Mermaid.js syntax</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            New
          </Button>
          <Dialog open={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!user}>
                <FolderOpen className="h-4 w-4 mr-2" />
                Load
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Your Diagrams</DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[300px] pr-4">
                {savedDiagrams.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No saved diagrams yet</p>
                ) : (
                  <div className="space-y-2">
                    {savedDiagrams.map((diagram) => (
                      <div
                        key={diagram.id}
                        onClick={() => handleLoad(diagram)}
                        className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent cursor-pointer group"
                      >
                        <div>
                          <p className="font-medium">{diagram.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(diagram.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                          onClick={(e) => handleDelete(diagram.id, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving || !user}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100%-6rem)]">
        <Card className="border-border bg-card flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Editor</CardTitle>
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
