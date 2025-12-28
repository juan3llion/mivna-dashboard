import { Plus, Minus, Maximize2, Download, Code } from "lucide-react";
import { useControls, useTransformComponent } from "react-zoom-pan-pinch";

type DiagramToolbarProps = {
  onDownloadPNG: () => void;
  onCopyMermaid: () => void;
  minScale?: number;
  maxScale?: number;
  zoomMultiplier?: number;
  animationTime?: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function DiagramToolbar({
  onDownloadPNG,
  onCopyMermaid,
  minScale = 0.1,
  maxScale = 64,
  zoomMultiplier = 1.8,
  animationTime = 200,
}: DiagramToolbarProps) {
  const { setTransform, resetTransform } = useControls();

  const { scale, positionX, positionY } = useTransformComponent(({ state }) => state);

  const handleZoomIn = () => {
    setTransform(positionX, positionY, clamp(scale * zoomMultiplier, minScale, maxScale), animationTime);
  };

  const handleZoomOut = () => {
    setTransform(positionX, positionY, clamp(scale / zoomMultiplier, minScale, maxScale), animationTime);
  };

  const handleReset = () => {
    resetTransform(animationTime);
  };

  return (
    <div className="absolute top-4 left-4 z-20 flex items-center gap-2 p-1.5 bg-[#161b26]/90 backdrop-blur-sm rounded-xl border border-[#232f48] shadow-xl">
      <button
        onClick={handleZoomIn}
        className="p-2 rounded-lg hover:bg-[#232f48] transition-colors"
        title="Zoom In"
        aria-label="Zoom in"
        type="button"
      >
        <Plus className="w-5 h-5 text-[#92a4c9]" />
      </button>
      <button
        onClick={handleZoomOut}
        className="p-2 rounded-lg hover:bg-[#232f48] transition-colors"
        title="Zoom Out"
        aria-label="Zoom out"
        type="button"
      >
        <Minus className="w-5 h-5 text-[#92a4c9]" />
      </button>
      <button
        onClick={handleReset}
        className="p-2 rounded-lg hover:bg-[#232f48] transition-colors"
        title="Reset View"
        aria-label="Reset view"
        type="button"
      >
        <Maximize2 className="w-5 h-5 text-[#92a4c9]" />
      </button>

      <div className="px-2 text-xs text-[#92a4c9] tabular-nums min-w-14 text-center" title="Current zoom">
        {Math.round(scale * 100)}%
      </div>

      <div className="w-px h-6 bg-[#232f48]" />

      <button
        onClick={onDownloadPNG}
        className="p-2 rounded-lg hover:bg-[#232f48] transition-colors"
        title="Download PNG"
        aria-label="Download PNG"
        type="button"
      >
        <Download className="w-5 h-5 text-[#92a4c9]" />
      </button>
      <button
        onClick={onCopyMermaid}
        className="p-2 rounded-lg hover:bg-[#232f48] transition-colors"
        title="Copy Mermaid Code"
        aria-label="Copy Mermaid code"
        type="button"
      >
        <Code className="w-5 h-5 text-[#92a4c9]" />
      </button>
    </div>
  );
}
