import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contentText, numQuestions = 3 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!contentText) {
      throw new Error('Texto do conteúdo é obrigatório');
    }

    console.log('[Quiz Generator] Gerando perguntas para texto...');

    // Usar IA para gerar perguntas
    const response = await fetch('https://api.lovable.dev/v1/chat/completions', {
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
            content: `Você é um gerador de questões objetivas para avaliação de compreensão de texto.
            
            REGRAS:
            - Gere ${numQuestions} perguntas objetivas com 4 alternativas cada
            - Apenas 1 alternativa correta por pergunta
            - Foque nos pontos principais e conceitos-chave
            - Perguntas claras e diretas
            - Evite pegadinhas ou ambiguidades
            
            Retorne APENAS um JSON válido no formato:
            {
              "questions": [
                {
                  "question": "Texto da pergunta?",
                  "options": ["Opção A", "Opção B", "Opção C", "Opção D"],
                  "correct_answer": "Opção correta (deve ser uma das options)",
                  "explanation": "Por que esta é a resposta correta"
                }
              ]
            }`
          },
          {
            role: 'user',
            content: `Gere ${numQuestions} perguntas objetivas sobre o seguinte texto:\n\n${contentText}`
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit excedido. Tente novamente em alguns minutos.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('[Quiz Generator] Erro da IA:', response.status, errorText);
      throw new Error('Erro ao gerar perguntas com IA');
    }

    const aiData = await response.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    console.log(`[Quiz Generator] ${result.questions.length} perguntas geradas com sucesso`);

    return new Response(
      JSON.stringify({ success: true, questions: result.questions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Quiz Generator Error]', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
