import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuizFailure {
  user_id: string;
  training_id: string;
  module_id: string;
  score: number;
  answers: Record<string, string>;
  questions: any[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id, training_id, module_id, score, answers, questions }: QuizFailure = await req.json();

    console.log(`Processing quiz failure for user ${user_id}, score: ${score}%`);

    // Identificar questões erradas
    const incorrectQuestions = questions.filter((q: any) => 
      answers[q.id] !== q.correct_answer
    );

    if (incorrectQuestions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No incorrect answers to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Gerar explicação complementar com IA
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurado');
    }

    const questionsText = incorrectQuestions.map((q: any, index: number) => 
      `${index + 1}. ${q.question}
   Sua resposta: ${answers[q.id]}
   Resposta correta: ${q.correct_answer}
   Feedback: ${q.feedback || 'N/A'}`
    ).join('\n\n');

    const aiPrompt = `Você é GiraBot, tutor da Cresci e Perdi.

Um colaborador não foi bem no quiz (${score}% de acertos). Analise os erros e gere uma explicação complementar pedagógica:

Questões incorretas:
${questionsText}

Gere:
1. Mensagem encorajadora (1 frase)
2. Explicação simples dos conceitos que causaram dúvida
3. Dica prática para revisar o conteúdo
4. Sugestão de material de apoio

Use emojis e seja encorajador. Máximo 200 palavras.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é GiraBot, tutor pedagógico da Cresci e Perdi.' },
          { role: 'user', content: aiPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI API error:', aiResponse.status, await aiResponse.text());
      throw new Error('Erro ao gerar explicação com IA');
    }

    const aiData = await aiResponse.json();
    const explanation = aiData.choices?.[0]?.message?.content;

    if (!explanation) {
      throw new Error('No explanation generated');
    }

    // Buscar dados do treinamento
    const { data: training } = await supabase
      .from('trainings' as any)
      .select('title')
      .eq('id', training_id)
      .single();

    // Criar notificação com a explicação
    await supabase.from('notifications').insert({
      user_id,
      title: '💡 Material de reforço do GiraBot',
      message: `Quiz de "${training?.title || 'treinamento'}" - Módulo ${module_id}\n\n${explanation}`,
      type: 'training',
      reference_id: training_id,
      is_read: false,
    });

    console.log('Quiz failure explanation sent to user');

    return new Response(
      JSON.stringify({ 
        success: true, 
        explanation,
        incorrect_count: incorrectQuestions.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error processing quiz failure:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
