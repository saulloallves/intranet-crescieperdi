import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FeedbackRequest {
  question: string;
  userAnswer: string;
  correctAnswer: string;
  context?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, userAnswer, correctAnswer, context }: FeedbackRequest = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurado');
    }

    const systemPrompt = `Você é GiraBot, assistente de treinamento da Cresci e Perdi.
Sua função é dar feedback pedagógico sobre respostas de quiz.
Seja gentil, instrutivo e específico. Use emojis para tornar o feedback amigável.
Explique por que a resposta está incorreta e oriente o colaborador sobre o conceito correto.
Mantenha o feedback em 2-3 frases curtas.`;

    const userPrompt = `Questão: ${question}
Resposta do colaborador: ${userAnswer}
Resposta correta: ${correctAnswer}
${context ? `Contexto adicional: ${context}` : ''}

Dê um feedback construtivo explicando o erro e orientando sobre o conceito correto.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'Limite de uso excedido. Tente novamente em alguns instantes.',
            fallback: 'Sua resposta não está correta. Revise o conteúdo e tente novamente.' 
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: 'Créditos insuficientes. Entre em contato com o administrador.',
            fallback: 'Sua resposta não está correta. Revise o conteúdo e tente novamente.' 
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const feedback = data.choices?.[0]?.message?.content;

    if (!feedback) {
      throw new Error('No feedback generated');
    }

    return new Response(
      JSON.stringify({ feedback }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error generating feedback:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        fallback: 'Não foi possível gerar feedback personalizado. Tente novamente.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
