import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, description, category } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Classifying idea:', { title, category });

    const response = await fetch('https://lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp',
        messages: [
          {
            role: 'system',
            content: `Você é o GiraBot, IA da rede Cresci e Perdi. 
            Classifique ideias em UMA destas categorias:
            - "Inovação de Processo"
            - "Melhoria de Experiência"
            - "Sugestão de Comunicação"
            - "Proposta Operacional"
            - "Sugestão Cultural"
            
            Retorne APENAS o nome da categoria, nada mais.`
          },
          {
            role: 'user',
            content: `Título: ${title}\nDescrição: ${description}\nCategoria original: ${category}`
          }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const classification = data.choices[0].message.content.trim();

    console.log('Classification result:', classification);

    return new Response(
      JSON.stringify({ ai_category: classification }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in classify-idea:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});