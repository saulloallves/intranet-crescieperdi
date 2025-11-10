import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const typebotToken = Deno.env.get('TYPEBOT_API_TOKEN');
    const workspaceId = Deno.env.get('TYPEBOT_WORKSPACE_ID');

    if (!typebotToken || !workspaceId) {
      throw new Error('Typebot credentials not configured');
    }

    console.log('Fetching Typebot results...');

    // Fetch results from Typebot API
    const typebotResponse = await fetch(
      `https://typebot.io/api/v1/workspaces/${workspaceId}/typebots/results`,
      {
        headers: {
          'Authorization': `Bearer ${typebotToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!typebotResponse.ok) {
      throw new Error(`Typebot API error: ${typebotResponse.statusText}`);
    }

    const { results } = await typebotResponse.json();
    console.log(`Fetched ${results?.length || 0} results from Typebot`);

    let syncStats = {
      support: { new: 0, updated: 0 },
      girabot: { new: 0, updated: 0 },
      media: { new: 0, updated: 0 },
    };

    // Process each result
    for (const result of results || []) {
      const typebotId = result.typebotId;
      const answers = result.answers || [];

      // Determine the type based on typebot ID or answers
      const resultType = determineResultType(typebotId, answers);

      if (resultType === 'support') {
        const processed = await processSupportTicket(supabaseClient, result);
        if (processed.isNew) syncStats.support.new++;
        else syncStats.support.updated++;
      } else if (resultType === 'girabot') {
        const processed = await processGiraBotInteraction(supabaseClient, result);
        if (processed.isNew) syncStats.girabot.new++;
        else syncStats.girabot.updated++;
      } else if (resultType === 'media') {
        const processed = await processMediaRequest(supabaseClient, result);
        if (processed.isNew) syncStats.media.new++;
        else syncStats.media.updated++;
      }
    }

    console.log('Sync completed:', syncStats);

    return new Response(
      JSON.stringify({
        success: true,
        stats: syncStats,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in typebot-sync:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

function determineResultType(typebotId: string, answers: any[]): string {
  // Logic to determine if it's support, girabot, or media
  // This is a simplified version - adjust based on your actual typebot IDs
  if (typebotId.includes('support') || typebotId.includes('suporte')) {
    return 'support';
  } else if (typebotId.includes('girabot') || typebotId.includes('chat')) {
    return 'girabot';
  } else if (typebotId.includes('media') || typebotId.includes('midia')) {
    return 'media';
  }

  // Fallback: check answer content
  const content = JSON.stringify(answers).toLowerCase();
  if (content.includes('ticket') || content.includes('problema')) {
    return 'support';
  } else if (content.includes('pergunta') || content.includes('ajuda')) {
    return 'girabot';
  } else if (content.includes('video') || content.includes('imagem')) {
    return 'media';
  }

  return 'girabot'; // default
}

async function processSupportTicket(supabase: any, result: any) {
  const answers = result.answers || [];
  
  // Extract data from answers
  const subject = findAnswer(answers, ['assunto', 'subject', 'titulo']) || 'Sem assunto';
  const description = findAnswer(answers, ['descricao', 'description', 'problema']) || '';
  const category = findAnswer(answers, ['categoria', 'category']) || 'geral';
  const userEmail = findAnswer(answers, ['email']) || '';
  const userName = findAnswer(answers, ['nome', 'name']) || 'Usuário';

  // Find user by email
  const { data: user } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', userEmail)
    .single();

  // Check if ticket already exists
  const { data: existing } = await supabase
    .from('support_tickets')
    .select('id')
    .eq('typebot_result_id', result.id)
    .single();

  if (existing) {
    // Update existing
    await supabase
      .from('support_tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    return { isNew: false };
  }

  // Create new ticket
  await supabase
    .from('support_tickets')
    .insert({
      typebot_result_id: result.id,
      user_id: user?.id,
      user_name: userName,
      user_email: userEmail,
      subject,
      category,
      description,
      status: 'open',
      priority: 'medium',
    });

  return { isNew: true };
}

async function processGiraBotInteraction(supabase: any, result: any) {
  const answers = result.answers || [];
  
  const question = findAnswer(answers, ['pergunta', 'question', 'duvida']) || '';
  const answer = findAnswer(answers, ['resposta', 'answer']) || '';
  const category = findAnswer(answers, ['categoria', 'category', 'topico']) || '';
  const userEmail = findAnswer(answers, ['email']) || '';
  const userName = findAnswer(answers, ['nome', 'name']) || 'Usuário';

  const { data: user } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', userEmail)
    .single();

  const { data: existing } = await supabase
    .from('girabot_interactions')
    .select('id')
    .eq('typebot_result_id', result.id)
    .single();

  if (existing) {
    return { isNew: false };
  }

  await supabase
    .from('girabot_interactions')
    .insert({
      typebot_result_id: result.id,
      user_id: user?.id,
      user_name: userName,
      question,
      answer,
      category,
      helpful: null,
    });

  return { isNew: true };
}

async function processMediaRequest(supabase: any, result: any) {
  const answers = result.answers || [];
  
  const title = findAnswer(answers, ['titulo', 'title', 'nome']) || 'Sem título';
  const description = findAnswer(answers, ['descricao', 'description', 'detalhes']) || '';
  const requestType = findAnswer(answers, ['tipo', 'type']) || 'outros';
  const deadline = findAnswer(answers, ['prazo', 'deadline', 'data']) || null;
  const userEmail = findAnswer(answers, ['email']) || '';
  const userName = findAnswer(answers, ['nome', 'name']) || 'Usuário';

  const { data: user } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', userEmail)
    .single();

  const { data: existing } = await supabase
    .from('media_requests')
    .select('id')
    .eq('typebot_result_id', result.id)
    .single();

  if (existing) {
    await supabase
      .from('media_requests')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    return { isNew: false };
  }

  await supabase
    .from('media_requests')
    .insert({
      typebot_result_id: result.id,
      user_id: user?.id,
      user_name: userName,
      user_email: userEmail,
      title,
      description,
      request_type: requestType,
      deadline: deadline ? new Date(deadline) : null,
      status: 'pending',
    });

  return { isNew: true };
}

function findAnswer(answers: any[], keys: string[]): string | null {
  for (const answer of answers) {
    const questionLower = (answer.question || '').toLowerCase();
    for (const key of keys) {
      if (questionLower.includes(key)) {
        return answer.value || answer.text || '';
      }
    }
  }
  return null;
}