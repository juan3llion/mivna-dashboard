import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { github_repo_id, node_label } = await req.json();
    
    console.log('🎯 Explaining node:', { github_repo_id, node_label });

    if (!github_repo_id || !node_label) {
      return new Response(
        JSON.stringify({ error: 'github_repo_id and node_label are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Supabase client to fetch repo data
    const supabaseUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
    const supabaseKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Fetch repository data
    const { data: repo, error: repoError } = await supabase
      .from('repositories')
      .select('name, file_tree, diagram_code')
      .eq('github_repo_id', github_repo_id)
      .maybeSingle();
    
    if (repoError) {
      console.error('Error fetching repository:', repoError);
      throw new Error('Failed to fetch repository data');
    }
    
    if (!repo) {
      return new Response(
        JSON.stringify({ error: 'Repository not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📦 Repository found:', repo.name);

    // Call Lovable AI to explain the node
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an expert software architect. Your task is to explain a specific component from an architecture diagram.

You have access to:
- The component/node name from the diagram
- The repository's file tree structure
- The full diagram code (Mermaid syntax)

Analyze this context and provide:
1. A clear 2-3 sentence explanation of what this component does
2. The likely technologies/frameworks used
3. The probable file paths where this component's code lives

Be specific and practical. Base your analysis on the actual file tree when identifying files.`;

    const userPrompt = `Explain this architecture component: "${node_label}"

Repository: ${repo.name}

File Tree:
${JSON.stringify(repo.file_tree, null, 2) || 'Not available'}

Diagram Code:
${repo.diagram_code || 'Not available'}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'explain_node',
              description: 'Provide detailed explanation of an architecture component',
              parameters: {
                type: 'object',
                properties: {
                  description: { 
                    type: 'string', 
                    description: '2-3 sentence explanation of what this component does and its role in the architecture' 
                  },
                  tech_stack: { 
                    type: 'array', 
                    items: { type: 'string' },
                    description: 'List of technologies, frameworks, or libraries used by this component'
                  },
                  probable_files: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of file paths that likely contain this component\'s implementation'
                  }
                },
                required: ['description', 'tech_stack', 'probable_files'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'explain_node' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error('AI API request failed');
    }

    const aiData = await aiResponse.json();
    console.log('🤖 AI response received');

    // Extract the tool call arguments
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'explain_node') {
      throw new Error('Invalid AI response format');
    }

    const nodeExplanation = JSON.parse(toolCall.function.arguments);
    console.log('✅ Node explanation:', nodeExplanation);

    return new Response(
      JSON.stringify(nodeExplanation),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('🔥 Error in explain-node:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
