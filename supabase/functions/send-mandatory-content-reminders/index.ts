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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Reminders] Iniciando envio de lembretes...');

    // Buscar conteúdos ativos
    const { data: contents, error: contentsError } = await supabase
      .from('mandatory_contents')
      .select('*')
      .eq('active', true);

    if (contentsError) {
      console.error('[Reminders] Erro ao buscar conteúdos:', contentsError);
      throw contentsError;
    }

    let totalReminders = 0;

    for (const content of contents || []) {
      // Buscar usuários ativos
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role')
        .eq('is_active', true);

      if (!profiles) continue;

      // Filtrar por público-alvo
      const targetUsers = profiles.filter(p => {
        if (content.target_audience === 'ambos') return true;
        if (content.target_audience === 'colaboradores' && p.role === 'colaborador') return true;
        if (content.target_audience === 'franqueados' && p.role === 'franqueado') return true;
        return false;
      });

      console.log(`[Reminders] ${targetUsers.length} usuários alvo para "${content.title}"`);

      for (const user of targetUsers) {
        // Verificar se já completou
        const { data: signature } = await supabase
          .from('mandatory_content_signatures')
          .select('id, success')
          .eq('content_id', content.id)
          .eq('user_id', user.id)
          .eq('success', true)
          .single();

        if (signature) {
          console.log(`[Reminders] ${user.full_name} já completou "${content.title}"`);
          continue;
        }

        // Contar lembretes já enviados
        const { count } = await supabase
          .from('mandatory_content_reminders')
          .select('id', { count: 'exact', head: true })
          .eq('content_id', content.id)
          .eq('user_id', user.id);

        // Buscar limite de lembretes
        const { data: maxRemindersConfig } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'mandatory_content_max_reminders')
          .single();

        const maxReminders = maxRemindersConfig?.value ? parseInt(maxRemindersConfig.value) : 5;

        if (count && count >= maxReminders) {
          console.log(`[Reminders] Limite atingido para ${user.full_name} (${count}/${maxReminders})`);
          continue;
        }

        // Enviar notificação usando sistema centralizado
        try {
          await supabase.functions.invoke('send-notification-advanced', {
            body: {
              recipients: [{
                user_id: user.id,
                phone: user.phone,
                email: null,
              }],
              title: '🛑 Conteúdo Obrigatório Pendente',
              message: `Você tem um conteúdo obrigatório pendente: "${content.title}". Complete-o para continuar usando o sistema.`,
              type: 'mandatory_content',
              reference_id: content.id,
              channels: ['push', 'whatsapp'],
              priority: 'high',
              template_id: 'mandatory_content_reminder',
              variables: {
                nome: user.full_name,
                titulo: content.title,
              }
            }
          });

          console.log(`[Reminders] Notificação enviada para ${user.full_name}`);
        } catch (notifError) {
          console.error(`[Reminders] Erro ao enviar notificação para ${user.full_name}:`, notifError);
        }

        // Registrar lembrete
        const { error: reminderError } = await supabase.from('mandatory_content_reminders').insert({
          content_id: content.id,
          user_id: user.id,
          channel: user.phone ? 'whatsapp' : 'push',
          message_template: content.title,
          delivered: true,
        });

        if (reminderError) {
          console.error(`[Reminders] Erro ao registrar lembrete:`, reminderError);
        }

        totalReminders++;
      }
    }

    console.log(`[Reminders] ${totalReminders} lembretes enviados com sucesso`);

    return new Response(
      JSON.stringify({ success: true, sent: totalReminders }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Reminders Error]', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
