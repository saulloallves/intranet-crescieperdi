import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnonymizeRequest {
  content: string;
  post_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, post_id }: AnonymizeRequest = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🔒 Anonimizando conteúdo${post_id ? ` do post ${post_id}` : ''}`);

    // Buscar configurações de prompt personalizadas
    const { data: settingsData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'mural_ai_prompt_filter')
      .single();

    const customPrompt = settingsData?.value as string;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurado');
    }

    const defaultPrompt = `Você é o GiraBot, moderador do Mural de pedidos de ajuda anônimos.

CONTEÚDO ORIGINAL:
${content}

Sua tarefa é ANONIMIZAR o texto removendo TODAS as informações identificáveis:

🚫 REMOVER/SUBSTITUIR:
- Nomes completos de pessoas (ex: "João Silva" → "um colaborador")
- CPF (ex: "123.456.789-00" → "[removido]")
- CNPJ (ex: "12.345.678/0001-90" → "[removido]")
- Nomes de cidades específicas (ex: "São Paulo", "Belo Horizonte" → "uma cidade", "a região")
- Códigos/números de unidades (ex: "unidade XYZ789", "loja 123" → "uma unidade")
- Endereços completos (ex: "Rua ABC, 123" → "uma loja")
- Telefones e emails
- Placas de veículos
- Números de conta/documento
- Qualquer dado que possa identificar uma pessoa ou local específico

✅ MANTER:
- A essência da mensagem
- O contexto e problema descrito
- Categorias gerais (fornecedores, eventos, sistemas)
- Estados (SP, MG) podem ser mantidos se não identificar diretamente

IMPORTANTE:
- NÃO adicione explicações ou comentários
- Retorne APENAS o texto anonimizado
- Mantenha o tom e estrutura original
- Se a mensagem não tiver dados pessoais, retorne igual

Exemplo:
ANTES: "Sou o João Silva, CPF 123.456.789-00, da unidade de São Paulo (loja XYZ789). Alguém tem fornecedor de etiquetas?"
DEPOIS: "Trabalho em uma unidade de SP. Alguém tem fornecedor de etiquetas?"`;

    const aiPrompt = customPrompt || defaultPrompt;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um assistente de anonimização. Retorne APENAS o texto anonimizado, sem explicações.' },
          { role: 'user', content: aiPrompt.replace('${content}', content) }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      // Fallback: retornar conteúdo original se IA falhar
      return new Response(
        JSON.stringify({ 
          original_content: content,
          anonymized_content: content,
          warning: 'IA indisponível, conteúdo não foi anonimizado',
          fallback: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const anonymizedContent = aiData.choices?.[0]?.message?.content?.trim();
    
    if (!anonymizedContent) {
      throw new Error('Nenhum conteúdo gerado pela IA');
    }

    console.log('✅ Conteúdo anonimizado com sucesso');
    console.log(`Original (${content.length} chars) → Anonimizado (${anonymizedContent.length} chars)`);

    // Se post_id foi fornecido, atualizar no banco
    if (post_id) {
      const { error: updateError } = await supabase
        .from('mural_posts')
        .update({ content_clean: anonymizedContent })
        .eq('id', post_id);

      if (updateError) {
        console.error('Erro ao atualizar post:', updateError);
      } else {
        console.log(`✅ Post ${post_id} atualizado com conteúdo anonimizado`);
      }
    }

    return new Response(
      JSON.stringify({ 
        original_content: content,
        anonymized_content: anonymizedContent,
        changes_made: content !== anonymizedContent,
        post_updated: !!post_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in mural-anonymize:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        original_content: null,
        anonymized_content: null,
        fallback: true
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
