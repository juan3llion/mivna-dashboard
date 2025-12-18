import { useState } from 'react';
import { toast } from 'sonner';

interface GenerateDiagramResult {
  success: boolean;
  diagram_code: string;
  repo_name: string;
}

export function useGenerateDiagram() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateDiagram = async (githubRepoId: number): Promise<string | null> => {
    setIsGenerating(true);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-diagram`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ github_repo_id: githubRepoId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 429) {
          toast.error('Rate limit exceeded. Please try again later.');
        } else if (response.status === 402) {
          toast.error('AI credits exhausted. Please add funds.');
        } else {
          toast.error(errorData.error || 'Failed to generate diagram');
        }
        return null;
      }

      const data: GenerateDiagramResult = await response.json();
      toast.success('Architecture diagram generated!');
      return data.diagram_code;
      
    } catch (error) {
      console.error('Error generating diagram:', error);
      toast.error('Failed to connect to AI service');
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  return { generateDiagram, isGenerating };
}
