import { useEffect, useState } from 'react';
// IMPORTANTE: Ajusta esta ruta si tu cliente supabase está en otro lado. 
// Según tu foto, está en 'integrations/supabase'
import { supabase } from "@/integrations/supabase/client";
import MermaidDiagram from "@/components/MermaidDiagram";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Diagram {
  id: string;
  mermaid_code: string;
  explanation_markdown: string;
  created_at: string;
  pr_number: number;
  repositories: { full_name: string } | null;
}

const Index = () => {
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDiagrams();
  }, []);

  const fetchDiagrams = async () => {
    try {
      console.log("Cargando diagramas...");
      const { data, error } = await supabase
        .from('architecture_diagrams')
        .select(`
          *,
          repositories (full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      console.log("Diagramas encontrados:", data);
      setDiagrams(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">MIVNA Dashboard</h1>
            <p className="text-slate-500 mt-2">Architecture Intelligence for your Repositories</p>
          </div>
          <div className="bg-white px-4 py-2 rounded-full shadow-sm border text-sm font-medium">
            🟢 System Online
          </div>
        </div>

        {/* Lista de Diagramas */}
        {loading ? (
          <div className="text-center py-20 text-slate-400">Cargando inteligencia... 🧠</div>
        ) : diagrams.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed">
            <h3 className="text-lg font-medium">No hay diagramas aún</h3>
            <p className="text-sm text-slate-500">Haz un Pull Request para ver la magia.</p>
          </div>
        ) : (
          <div className="grid gap-8">
            {diagrams.map((item) => (
              <Card key={item.id} className="overflow-hidden border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="bg-slate-100/50 border-b border-slate-100 pb-4">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      📁 {item.repositories?.full_name || "Unknown Repo"}
                    </CardTitle>
                    <span className="text-xs font-mono bg-slate-200 text-slate-700 px-2 py-1 rounded">
                      PR #{item.pr_number}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(item.created_at).toLocaleString()}
                  </div>
                </CardHeader>
                
                <CardContent className="p-6 space-y-6">
                  {/* El Diagrama */}
                  <div className="bg-white rounded-lg border border-slate-100 shadow-inner">
                    <MermaidDiagram chart={item.mermaid_code} />
                  </div>

                  {/* La Explicación */}
                  <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                    <h4 className="text-xs font-bold text-blue-800 uppercase mb-2 tracking-wider">AI Analysis</h4>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {item.explanation_markdown}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
