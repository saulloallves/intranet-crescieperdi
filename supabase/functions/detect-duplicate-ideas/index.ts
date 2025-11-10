import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ideaId } = await req.json();
    
    if (!ideaId) {
      throw new Error('ideaId is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Duplicate Detection] Analisando ideia:', ideaId);

    // Buscar a ideia atual
    const { data: currentIdea } = await supabase
      .from('ideas')
      .select('title, description, category')
      .eq('id', ideaId)
      .single();

    if (!currentIdea) {
      throw new Error('Ideia não encontrada');
    }

    // Buscar ideias similares dos últimos 6 meses
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: recentIdeas } = await supabase
      .from('ideas')
      .select('id, code, title, description, category, status')
      .neq('id', ideaId)
      .gte('created_at', sixMonthsAgo.toISOString())
      .limit(50);

    if (!recentIdeas || recentIdeas.length === 0) {
      return new Response(
        JSON.stringify({
          isDuplicate: false,
          similarIdeas: [],
          reason: 'Nenhuma ideia recente encontrada para comparação'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Duplicate Detection] Comparando com ${recentIdeas.length} ideias recentes`);

    // Usar IA para detectar similaridade
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'system',
            content: `Você é um detector de ideias duplicadas para uma rede de franquias. 
            Compare a ideia atual com a lista de ideias recentes e identifique se há duplicatas ou ideias muito similares.
            
            Considere duplicata quando:
            - O objetivo/problema é o mesmo (mesmo que a solução seja diferente)
            - A categoria é a mesma e o tema é extremamente similar (>85% de similaridade)
            
            Retorne SEMPRE um JSON válido com esta estrutura:
            {
              "isDuplicate": boolean,
              "similarIdeas": [
                { 
                  "code": "IDEA-2025-001", 
                  "title": "título da ideia similar", 
                  "similarity": 95,
                  "reason": "Ambas tratam do mesmo problema de triagem"
                }
              ],
              "reason": "Explicação geral da análise"
            }
            
            Se não houver duplicatas, retorne isDuplicate: false e similarIdeas: []`
          },
          {
            role: 'user',
            content: `**Ideia atual:**
Título: ${currentIdea.title}
Descrição: ${currentIdea.description}
Categoria: ${currentIdea.category}

**Ideias recentes para comparar:**
${recentIdeas.map(i => `
[${i.code}] ${i.title}
Categoria: ${i.category}
Descrição: ${i.description}
Status: ${i.status}
`).join('\n---\n')}`
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.statusText}`);
    }

    const aiData = await response.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    console.log('[Duplicate Detection] Resultado:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Error]', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        isDuplicate: false,
        similarIdeas: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
