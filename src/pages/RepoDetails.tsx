import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { 
  LayoutGrid, Folder, Settings2, Plus, Minus, Maximize2, 
  Download, Code, Bell, X, Info, Activity, Cpu, Server, 
  Shield, FolderOpen, ExternalLink, Sparkles, ArrowLeft,
  ChevronRight, Circle
} from 'lucide-react';
import { toast } from 'sonner';
import { externalSupabase } from '@/integrations/external-supabase/client';
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

  const handleZoomIn = () => transformRef.current?.zoomIn();
  const handleZoomOut = () => transformRef.current?.zoomOut();
  const handleResetView = () => transformRef.current?.resetTransform();

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
                  <MermaidRenderer content={repository.diagram_code} />
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
              <h2 className="font-space-grotesk font-semibold text-foreground">Component Details</h2>
              <button 
                onClick={() => setIsPanelOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[#232f48] transition-colors"
              >
                <X className="w-4 h-4 text-[#92a4c9]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Component Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-primary" />
                  <h3 className="font-space-grotesk font-semibold text-foreground">API Gateway</h3>
                </div>
                
                <div className="space-y-2">
                  <span className="text-xs font-medium text-[#92a4c9] uppercase tracking-wider">Description</span>
                  <p className="text-sm text-[#92a4c9] leading-relaxed">
                    The central entry point for all client requests. It handles routing, composition, and protocol translation.
                  </p>
                </div>
              </div>

              {/* Live Metrics */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-[#92a4c9] uppercase tracking-wider">Live Metrics</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-[#101622] border border-[#232f48]">
                    <span className="text-xs text-[#92a4c9]">Latency (p99)</span>
                    <p className="font-space-grotesk font-bold text-lg text-foreground">45ms</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#101622] border border-[#232f48]">
                    <span className="text-xs text-[#92a4c9]">Requests/sec</span>
                    <p className="font-space-grotesk font-bold text-lg text-foreground">1,240</p>
                  </div>
                </div>
              </div>

              {/* AI-Inferred Stack */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-[#92a4c9] uppercase tracking-wider">AI-Inferred Stack</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#101622] border border-[#232f48]">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-foreground">Nginx</span>
                    </div>
                    <span className="text-xs text-emerald-400">98% conf.</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#101622] border border-[#232f48]">
                    <div className="flex items-center gap-2">
                      <Code className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm text-foreground">Lua Scripts</span>
                    </div>
                    <span className="text-xs text-yellow-400">85% conf.</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#101622] border border-[#232f48]">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-red-400" />
                      <span className="text-sm text-foreground">ModSecurity</span>
                    </div>
                    <span className="text-xs text-[#92a4c9]">Low conf.</span>
                  </div>
                </div>
              </div>

              {/* Defined In */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-[#92a4c9] uppercase tracking-wider">Defined In</span>
                </div>
                
                <button className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[#101622] border border-[#232f48] hover:border-primary/50 transition-colors group">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-[#92a4c9]" />
                    <span className="text-sm text-foreground font-mono">src/gateway/nginx.conf</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#92a4c9] group-hover:text-primary transition-colors" />
                </button>
              </div>
            </div>

            {/* Panel Footer */}
            <div className="p-4 border-t border-[#232f48] space-y-2">
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => toast.info('View logs coming soon!')}
              >
                <Info className="w-4 h-4 mr-2" />
                View Logs
              </Button>
              <p className="text-xs text-center text-[#92a4c9]">Last updated 2m ago</p>
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
