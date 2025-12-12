import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  chart: string;
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    // Configuración inicial de Mermaid
    mermaid.initialize({ 
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'inherit'
    });

    const renderDiagram = async () => {
      if (containerRef.current && chart) {
        try {
          setIsError(false);
          // Creamos un ID único para este diagrama
          const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
          containerRef.current.innerHTML = ''; // Limpiar anterior
          
          // Renderizamos
          const { svg } = await mermaid.render(id, chart);
          containerRef.current.innerHTML = svg;
        } catch (error) {
          console.error('Error renderizando Mermaid:', error);
          setIsError(true);
          // Si falla, mostramos el código crudo para debug
          containerRef.current!.innerText = 'Error visualizando diagrama. Código recibido:\n' + chart;
        }
      }
    };

    renderDiagram();
  }, [chart]);

  if (isError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded text-xs font-mono text-red-600 overflow-auto">
        Error al dibujar. Revisa la consola.
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto p-4 bg-white rounded-lg border border-gray-100 flex justify-center">
      <div ref={containerRef} className="mermaid" />
    </div>
  );
};

export default MermaidDiagram;
