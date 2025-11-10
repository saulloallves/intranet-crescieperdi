import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnrichmentRequest {
  type: string;
  title: string;
  description: string;
  context?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      console.warn('OpenAI API key not configured, returning original content');
      const payload: EnrichmentRequest = await req.json();
      return new Response(
        JSON.stringify({ 
          title: payload.title,
          description: payload.description,
          enriched: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: EnrichmentRequest = await req.json();
    console.log('🎨 Enriching feed post:', payload.type);

    // Definir prompts específicos por tipo de conteúdo
    const typePrompts: Record<string, string> = {
      training: 'Você é um especialista em educação corporativa. Crie uma descrição envolvente para um treinamento que incentive os colaboradores a participar.',
      checklist: 'Você é um especialista em processos operacionais. Crie uma descrição clara e prática para uma rotina de checklist.',
      manual: 'Você é um especialista em documentação técnica. Crie uma descrição útil e objetiva para um manual.',
      campaign: 'Você é um especialista em engajamento. Crie uma descrição motivadora para uma campanha ou desafio.',
      recognition: 'Você é um especialista em cultura organizacional. Crie uma descrição celebrativa para um reconhecimento.',
      idea: 'Você é um especialista em inovação. Crie uma descrição inspiradora para uma ideia implementada.',
      media: 'Você é um especialista em comunicação visual. Crie uma descrição atrativa para conteúdo multimídia.',
      survey: 'Você é um especialista em pesquisa. Crie uma descrição convidativa para uma pesquisa.',
      announcement: 'Você é um especialista em comunicação interna. Crie uma descrição clara e impactante para um comunicado.'
    };

    const systemPrompt = typePrompts[payload.type] || 'Você é um assistente de comunicação interna.';
    
    const userPrompt = `
Título original: ${payload.title}
Descrição original: ${payload.description}
${payload.context ? `Contexto adicional: ${payload.context}` : ''}

TAREFA: 
1. Mantenha o título EXATAMENTE como está (não modifique)
2. Melhore a descrição tornando-a mais envolvente, clara e motivadora
3. Use até 150 caracteres
4. Use linguagem acessível e próxima dos colaboradores
5. Adicione emojis relevantes (máximo 2)
6. Destaque benefícios ou call-to-action

Retorne APENAS em formato JSON:
{
  "title": "título original sem modificações",
  "description": "descrição melhorada"
}
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON response
    let enrichedContent;
    try {
      enrichedContent = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      enrichedContent = {
        title: payload.title,
        description: payload.description
      };
    }

    console.log('✅ Content enriched successfully');

    return new Response(
      JSON.stringify({ 
        ...enrichedContent,
        enriched: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-enrich-feed-post function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
