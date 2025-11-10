import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompletionEvent {
  user_id: string;
  training_id?: string;
  training_path_id?: string;
  module_id?: string;
  event_type: 'module_completion' | 'training_completion' | 'path_completion';
  score?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id, training_id, training_path_id, module_id, event_type, score }: CompletionEvent = await req.json();

    console.log(`Processing ${event_type} for user ${user_id}`);

    // Buscar dados do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, unit_code')
      .eq('id', user_id)
      .single();

    if (!profile) {
      throw new Error('Perfil não encontrado');
    }

    // Processar com base no tipo de evento
    switch (event_type) {
      case 'module_completion':
        await handleModuleCompletion(supabase, user_id, training_id!, module_id!, profile);
        break;
      
      case 'training_completion':
        await handleTrainingCompletion(supabase, user_id, training_id!, score, profile);
        break;
      
      case 'path_completion':
        await handlePathCompletion(supabase, user_id, training_path_id!, score, profile);
        break;
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Event processed successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error processing completion event:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleModuleCompletion(
  supabase: any, 
  user_id: string, 
  training_id: string, 
  module_id: string,
  profile: any
) {
  console.log('Handling module completion...');

  // Buscar dados do treinamento
  const { data: training } = await supabase
    .from('trainings' as any)
    .select('title')
    .eq('id', training_id)
    .single();

  // Usar sistema centralizado de notificações
  await supabase.functions.invoke('send-notification-advanced', {
    body: {
      recipients: [{
        user_id,
        phone: profile.phone,
        email: null,
      }],
      title: '✅ Módulo concluído!',
      message: `Parabéns! Você completou um módulo de "${training?.title || 'treinamento'}". Continue assim!`,
      type: 'training',
      reference_id: training_id,
      channels: ['push'],
      priority: 'normal',
    }
  });

  console.log('Module completion notification sent');
}

async function handleTrainingCompletion(
  supabase: any,
  user_id: string,
  training_id: string,
  score: number | undefined,
  profile: any
) {
  console.log('Handling training completion...');

  const { data: training } = await supabase
    .from('trainings' as any)
    .select('title, certificate_enabled')
    .eq('id', training_id)
    .single();

  if (!training) return;

  // Usar sistema centralizado de notificações
  await supabase.functions.invoke('send-notification-advanced', {
    body: {
      recipients: [{
        user_id,
        phone: profile.phone,
        email: null,
      }],
      title: '🎉 Treinamento concluído!',
      message: `Parabéns por concluir "${training.title}"! ${score ? `Sua nota: ${score}%` : ''}`,
      type: 'training',
      reference_id: training_id,
      channels: ['push', 'whatsapp'],
      priority: 'normal',
    }
  });

  // Se certificado habilitado e nota suficiente, gerar certificado
  if (training.certificate_enabled && score && score >= 70) {
    console.log('Triggering certificate generation...');
    // A geração do certificado será feita pelo usuário através da UI
  }

  console.log('Training completion processed');
}

async function handlePathCompletion(
  supabase: any,
  user_id: string,
  training_path_id: string,
  score: number | undefined,
  profile: any
) {
  console.log('Handling path completion...');

  const { data: path } = await supabase
    .from('training_paths' as any)
    .select('name')
    .eq('id', training_path_id)
    .single();

  if (!path) return;

  // Notificar usuário usando sistema centralizado
  await supabase.functions.invoke('send-notification-advanced', {
    body: {
      recipients: [{
        user_id,
        phone: profile.phone,
        email: null,
      }],
      title: '🏆 Trilha completa!',
      message: `Incrível! Você completou toda a trilha "${path.name}"! ${score ? `Pontuação final: ${score}%` : ''}`,
      type: 'training',
      reference_id: training_path_id,
      channels: ['push', 'whatsapp'],
      priority: 'high',
    }
  });

  // Buscar gerente da unidade para notificar
  const { data: managers } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .eq('unit_code', profile.unit_code)
    .in('role', ['gerente', 'admin']);

  if (managers && managers.length > 0) {
    // Notificar gestores usando sistema centralizado
    await supabase.functions.invoke('send-notification-advanced', {
      body: {
        recipients: managers.map((m: any) => ({
          user_id: m.id,
          phone: m.phone,
          email: null,
        })),
        title: '📚 Colaborador concluiu trilha',
        message: `${profile.full_name} concluiu a trilha "${path.name}" ${score ? `com ${score}% de aproveitamento` : ''}.`,
        type: 'training',
        reference_id: training_path_id,
        channels: ['push', 'whatsapp'],
        priority: 'normal',
      }
    });
  }

  console.log('Path completion processed');
}

// Função antiga removida - agora usa send-notification-advanced
async function sendZAPINotification(
  supabase: any,
  managers: any[],
  profile: any,
  path: any,
  score: number | undefined
) {
  // Esta função não é mais necessária - mantida por compatibilidade
  console.log('sendZAPINotification: Deprecated - use send-notification-advanced instead');
}
