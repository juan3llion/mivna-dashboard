import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { 
  LayoutGrid, Folder, Plus, Minus, Maximize2, 
  Download, Code, Bell, X, Info, Sparkles, ArrowLeft,
  ChevronRight, Circle, Loader2, FileCode
} from 'lucide-react';
import { toast } from 'sonner';
import { externalSupabase } from '@/integrations/external-supabase/client';
import { supabase } from '@/integrations/supabase/client';
import { MermaidRenderer } from '@/components/diagrams/MermaidRenderer';
import { useGenerateDiagram } from '@/hooks/useGenerateDiagram';
import { Repository } from '@/types/repository';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

export default function RepoDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  
  const [repository, setRepository] = useState<Repository | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const { generateDiagram, isGenerating } = useGenerateDiagram();
  
  // Interactive node state
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [nodeInfo, setNodeInfo] = useState<{
    description: string;
    tech_stack: string[];
    probable_files: string[];
  } | null>(null);
  const [isAnalyzingNode, setIsAnalyzingNode] = useState(false);

  useEffect(() => {
    const fetchRepository = async () => {
      if (!id) return;
      
      try {
        const { data, error } = await externalSupabase
          .from('repositories')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setRepository(data as Repository);
        }
      } catch (error) {
        console.error('Error fetching repository:', error);
        toast.error('Failed to load repository');
      } finally {
        setLoading(false);
      }
    };

    fetchRepository();
  }, [id]);

  // Zoom controls with increased step for more noticeable zoom
  const ZOOM_STEP = 0.5;
  const ZOOM_ANIMATION_TIME = 200;
  
  const handleZoomIn = () => transformRef.current?.zoomIn(ZOOM_STEP, ZOOM_ANIMATION_TIME);
  const handleZoomOut = () => transformRef.current?.zoomOut(ZOOM_STEP, ZOOM_ANIMATION_TIME);
  const handleResetView = () => transformRef.current?.resetTransform(ZOOM_ANIMATION_TIME);

  const handleCopyMermaid = () => {
    if (repository?.diagram_code) {
      navigator.clipboard.writeText(repository.diagram_code);
      toast.success('Mermaid code copied to clipboard!');
    }
  };

  const handleDownloadPNG = () => {
    toast.info('PNG download coming soon!');
  };

  const handleReAnalyze = async () => {
    if (repository?.github_repo_id) {
      const newCode = await generateDiagram(repository.github_repo_id);
      if (newCode) {
        setRepository(prev => prev ? { ...prev, diagram_code: newCode } : null);
      }
    }
  };

  const handleNodeClick = async (nodeLabel: string) => {
    console.log('🎯 Node clicked:', nodeLabel);
    setSelectedNode(nodeLabel);
    setNodeInfo(null);
    setIsAnalyzingNode(true);
    setIsPanelOpen(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('explain-node', {
        body: { 
          github_repo_id: repository?.github_repo_id,
          node_label: nodeLabel
        }
      });
      
      if (error) throw error;
      console.log('✅ Node explanation:', data);
      setNodeInfo(data);
    } catch (error) {
      console.error('🔥 Error explaining node:', error);
      toast.error('Failed to analyze component');
      setNodeInfo(null);
    } finally {
      setIsAnalyzingNode(false);
    }
  };

  const handleClearSelection = () => {
    setSelectedNode(null);
    setNodeInfo(null);
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#101622] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Skeleton className="h-12 w-12 rounded-full mx-auto" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    );
  }

  if (!repository) {
    return (
      <div className="h-screen bg-[#101622] flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-[#92a4c9]">Repository not found</p>
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#101622] overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-[#161b26]/90 backdrop-blur-md border-b border-[#232f48] flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg hover:bg-[#232f48] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#92a4c9]" />
          </button>
          
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-sm">
            <span className="text-[#92a4c9]">Repositories</span>
            <ChevronRight className="w-4 h-4 text-[#92a4c9]" />
            <span className="text-foreground font-medium">{repository.name}</span>
          </nav>
          
          {/* Live Status */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Circle className="w-2 h-2 fill-emerald-400 text-emerald-400" />
            <span className="text-xs text-emerald-400 font-medium">LIVE</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-lg hover:bg-[#232f48] transition-colors relative">
            <Bell className="w-5 h-5 text-[#92a4c9]" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full"></span>
          </button>
          <Avatar className="h-8 w-8">
            <AvatarImage src="" />
            <AvatarFallback className="bg-[#232f48] text-foreground text-xs">U</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Floating Toolbar */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 p-1.5 bg-[#161b26]/90 backdrop-blur-sm rounded-xl border border-[#232f48] shadow-xl">
          <button 
            onClick={handleZoomIn}
            className="p-2 rounded-lg hover:bg-[#232f48] transition-colors"
            title="Zoom In"
          >
            <Plus className="w-5 h-5 text-[#92a4c9]" />
          </button>
          <button 
            onClick={handleZoomOut}
            className="p-2 rounded-lg hover:bg-[#232f48] transition-colors"
            title="Zoom Out"
          >
            <Minus className="w-5 h-5 text-[#92a4c9]" />
          </button>
          <button 
            onClick={handleResetView}
            className="p-2 rounded-lg hover:bg-[#232f48] transition-colors"
            title="Reset View"
          >
            <Maximize2 className="w-5 h-5 text-[#92a4c9]" />
          </button>
          
          <div className="w-px h-6 bg-[#232f48]" />
          
          <button 
            onClick={handleDownloadPNG}
            className="p-2 rounded-lg hover:bg-[#232f48] transition-colors"
            title="Download PNG"
          >
            <Download className="w-5 h-5 text-[#92a4c9]" />
          </button>
          <button 
            onClick={handleCopyMermaid}
            className="p-2 rounded-lg hover:bg-[#232f48] transition-colors"
            title="Copy Mermaid Code"
          >
            <Code className="w-5 h-5 text-[#92a4c9]" />
          </button>
        </div>

        {/* Canvas Area */}
        <div 
          className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
          style={{
            backgroundImage: 'radial-gradient(#282e39 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        >
          {repository.diagram_code ? (
            <TransformWrapper
              ref={transformRef}
              initialScale={1}
              minScale={0.25}
              maxScale={4}
              centerOnInit
              limitToBounds={false}
            >
              <TransformComponent
                wrapperStyle={{ width: '100%', height: '100%' }}
                contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <div className="p-8">
                  <MermaidRenderer 
                    content={repository.diagram_code} 
                    onNodeClick={handleNodeClick}
                  />
                </div>
              </TransformComponent>
            </TransformWrapper>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-4">
                <LayoutGrid className="w-16 h-16 text-[#92a4c9] mx-auto opacity-50" />
                <p className="text-[#92a4c9]">No diagram generated yet</p>
                <Button onClick={handleReAnalyze} disabled={isGenerating}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  {isGenerating ? 'Generating...' : 'Generate Diagram'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Details Panel */}
        {isPanelOpen && (
          <aside className="w-96 bg-[#161b26] border-l border-[#232f48] flex flex-col overflow-hidden flex-shrink-0">
            {/* Panel Header */}
            <div className="p-4 border-b border-[#232f48] flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedNode && (
                  <button 
                    onClick={handleClearSelection}
                    className="p-1 rounded hover:bg-[#232f48] transition-colors"
                    title="Back to overview"
                  >
                    <ArrowLeft className="w-4 h-4 text-[#92a4c9]" />
                  </button>
                )}
                <h2 className="font-space-grotesk font-semibold text-foreground">
                  {selectedNode || 'Repo Overview'}
                </h2>
                {isAnalyzingNode && (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                )}
              </div>
              <button 
                onClick={() => setIsPanelOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[#232f48] transition-colors"
              >
                <X className="w-4 h-4 text-[#92a4c9]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {isAnalyzingNode ? (
                /* Loading skeleton */
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-24 bg-[#232f48]" />
                    <Skeleton className="h-16 w-full bg-[#232f48]" />
                  </div>
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-20 bg-[#232f48]" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-16 rounded-full bg-[#232f48]" />
                      <Skeleton className="h-6 w-20 rounded-full bg-[#232f48]" />
                      <Skeleton className="h-6 w-14 rounded-full bg-[#232f48]" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-24 bg-[#232f48]" />
                    <Skeleton className="h-10 w-full bg-[#232f48]" />
                    <Skeleton className="h-10 w-full bg-[#232f48]" />
                  </div>
                </div>
              ) : selectedNode && nodeInfo ? (
                /* AI-generated node info */
                <div className="space-y-6">
                  {/* Description */}
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-[#92a4c9] uppercase tracking-wider">Description</span>
                    <p className="text-sm text-[#92a4c9] leading-relaxed">
                      {nodeInfo.description}
                    </p>
                  </div>

                  {/* Tech Stack */}
                  <div className="space-y-3">
                    <span className="text-xs font-medium text-[#92a4c9] uppercase tracking-wider">Tech Stack</span>
                    <div className="flex flex-wrap gap-2">
                      {nodeInfo.tech_stack.map((tech, idx) => (
                        <span 
                          key={idx}
                          className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-400/10 text-blue-400 ring-1 ring-inset ring-blue-400/20"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Related Files */}
                  <div className="space-y-3">
                    <span className="text-xs font-medium text-[#92a4c9] uppercase tracking-wider">Related Files</span>
                    <div className="space-y-2">
                      {nodeInfo.probable_files.map((file, idx) => (
                        <div 
                          key={idx}
                          className="flex items-center gap-2 p-2.5 rounded-lg bg-[#101622] border border-[#232f48]"
                        >
                          <FileCode className="w-4 h-4 text-[#92a4c9] flex-shrink-0" />
                          <span className="text-sm font-mono text-foreground truncate">{file}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Default static content - Repo Overview */
                <div className="space-y-6">
                  <div className="p-4 rounded-lg bg-[#101622] border border-[#232f48]">
                    <div className="flex items-center gap-3 mb-3">
                      <LayoutGrid className="w-5 h-5 text-primary" />
                      <h3 className="font-space-grotesk font-semibold text-foreground">{repository?.name}</h3>
                    </div>
                    <p className="text-sm text-[#92a4c9] leading-relaxed">
                      {repository?.description || 'No description available. Click on any node in the diagram to see AI-generated details about that component.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                    <div className="flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-foreground font-medium mb-1">Interactive Architecture</p>
                        <p className="text-xs text-[#92a4c9]">
                          Click on any node in the diagram to get AI-powered insights about that component.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Panel Footer */}
            <div className="p-4 border-t border-[#232f48] space-y-2">
              {selectedNode ? (
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={handleClearSelection}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Overview
                </Button>
              ) : (
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => toast.info('View logs coming soon!')}
                >
                  <Info className="w-4 h-4 mr-2" />
                  View Logs
                </Button>
              )}
            </div>
          </aside>
        )}

        {/* Toggle Panel Button (when closed) */}
        {!isPanelOpen && (
          <button
            onClick={() => setIsPanelOpen(true)}
            className="absolute top-4 right-4 z-20 p-2 bg-[#161b26]/90 backdrop-blur-sm rounded-lg border border-[#232f48] hover:bg-[#232f48] transition-colors"
          >
            <Info className="w-5 h-5 text-[#92a4c9]" />
          </button>
        )}

        {/* Re-Analyze FAB */}
        <button
          onClick={handleReAnalyze}
          disabled={isGenerating}
          className="absolute bottom-6 right-6 z-20 flex items-center gap-2 px-5 py-3 bg-primary hover:bg-primary/90 text-white font-semibold rounded-full shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ right: isPanelOpen ? 'calc(24rem + 1.5rem)' : '1.5rem' }}
        >
          <Sparkles className="w-5 h-5" />
          {isGenerating ? 'Re-Analyzing...' : 'Re-Analyze with AI'}
        </button>
      </div>
    </div>
  );
}
