import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidRendererProps {
  content: string;
  onNodeClick?: (nodeLabel: string) => void;
}

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  themeVariables: {
    primaryColor: '#3b82f6',
    primaryTextColor: '#f8fafc',
    primaryBorderColor: '#475569',
    lineColor: '#64748b',
    secondaryColor: '#1e293b',
    tertiaryColor: '#0f172a',
    background: '#0f172a',
    mainBkg: '#1e293b',
    nodeBorder: '#475569',
    clusterBkg: '#1e293b',
    titleColor: '#f8fafc',
    edgeLabelBackground: '#1e293b',
  },
  fontFamily: 'Inter, sans-serif',
});

export function MermaidRenderer({ content, onNodeClick }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!containerRef.current || !content.trim()) {
        return;
      }

      try {
        setError(null);
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, content);
        containerRef.current.innerHTML = svg;

        // Ensure the SVG keeps its intrinsic size so parent transforms (zoom) are visible.
        const svgEl = containerRef.current.querySelector('svg');
        if (svgEl) {
          svgEl.style.maxWidth = 'none';
          svgEl.style.width = 'auto';
          svgEl.style.height = 'auto';
          svgEl.style.display = 'block';
        }

        // Attach click listeners to nodes if onNodeClick is provided
        if (onNodeClick) {
          const nodes = containerRef.current.querySelectorAll('.node, .nodeLabel, [class*="node"]');
          nodes.forEach(node => {
            (node as HTMLElement).style.cursor = 'pointer';
            node.addEventListener('click', (e) => {
              e.stopPropagation();
              // Try to extract the label from different possible locations
              const labelElement = node.querySelector('.nodeLabel') || 
                                   node.querySelector('text') ||
                                   node.querySelector('span');
              const label = labelElement?.textContent?.trim() || 
                            (node as HTMLElement).textContent?.trim() || '';
              if (label) {
                onNodeClick(label);
              }
            });
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
      }
    };

    renderDiagram();
  }, [content, onNodeClick]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive">
        <div className="text-center p-4">
          <p className="font-medium mb-2">Syntax Error</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!content.trim()) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Enter Mermaid syntax to see the diagram</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="inline-block overflow-visible p-4 [&>svg]:max-w-none [&>svg]:w-auto [&>svg]:h-auto"
    />
  );
}
