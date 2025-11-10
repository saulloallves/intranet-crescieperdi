import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SmartAlert {
  type: 'anomaly' | 'reminder' | 'suggestion' | 'critical';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  module?: string;
  users: string[];
  channel?: 'push' | 'whatsapp' | 'email';
  metadata?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    console.log('🧠 Iniciando análise de padrões...');

    const alerts: SmartAlert[] = [];
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. DETECTAR PADRÕES ANÔMALOS - Usuários Inativos
    const { data: inactiveUsers } = await supabase
      .from('profiles')
      .select('id, full_name, email, last_login_at')
      .lt('last_login_at', oneWeekAgo.toISOString())
      .limit(10);

    if (inactiveUsers && inactiveUsers.length > 0) {
      console.log(`⚠️ ${inactiveUsers.length} usuários inativos detectados`);
      
      // Gerar alerta para gestores
      const { data: managers } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'gestor_setor']);

      if (managers && managers.length > 0) {
        alerts.push({
          type: 'anomaly',
          title: '⚠️ Usuários Inativos Detectados',
          message: `${inactiveUsers.length} colaboradores não acessam o sistema há mais de 7 dias. Recomendamos contato ou verificação.`,
          priority: 'medium',
          module: 'users',
          users: managers.map(m => m.id),
          channel: 'push',
          metadata: { inactive_count: inactiveUsers.length }
        });
      }
    }

    // 2. TREINAMENTOS COM BAIXA CONCLUSÃO
    const { data: lowCompletionTrainings } = await supabase
      .from('trainings' as any)
      .select(`
        id,
        title,
        progress:training_progress(count)
      `)
      .eq('is_published', true)
      .gte('created_at', oneWeekAgo.toISOString());

    if (lowCompletionTrainings) {
      for (const training of lowCompletionTrainings) {
        // Verificar se há baixa taxa de conclusão (menos de 30%)
        const totalUsers = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true });
        
        const completionRate = totalUsers.count ? (training.progress.length / totalUsers.count) * 100 : 0;
        
        if (completionRate < 30 && completionRate > 0) {
          const { data: admins } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'admin');

          if (admins && admins.length > 0) {
            alerts.push({
              type: 'suggestion',
              title: '📊 Baixa Adesão em Treinamento',
              message: `O treinamento "${training.title}" tem apenas ${completionRate.toFixed(0)}% de conclusão. Considere enviar lembretes ou revisar o conteúdo.`,
              priority: 'low',
              module: 'trainings',
              users: admins.map(a => a.id),
              channel: 'push'
            });
          }
        }
      }
    }

    // 3. CHECKLISTS ATRASADOS
    const { data: overdueChecklists } = await supabase
      .from('checklist_assignments' as any)
      .select(`
        id,
        checklist_id,
        user_id,
        due_date,
        checklist:checklists(title)
      `)
      .eq('status', 'pending')
      .lt('due_date', now.toISOString());

    if (overdueChecklists && overdueChecklists.length > 0) {
      console.log(`📋 ${overdueChecklists.length} checklists atrasados`);
      
      // Agrupar por usuário
      const userChecklists = new Map<string, any[]>();
      overdueChecklists.forEach(item => {
        if (!userChecklists.has(item.user_id)) {
          userChecklists.set(item.user_id, []);
        }
        userChecklists.get(item.user_id)!.push(item);
      });

      // Criar alertas individuais
      for (const [userId, items] of userChecklists) {
        alerts.push({
          type: 'reminder',
          title: '⏰ Checklists Pendentes',
          message: `Você tem ${items.length} checklist${items.length > 1 ? 's' : ''} atrasado${items.length > 1 ? 's' : ''}. Complete agora para manter suas atividades em dia!`,
          priority: 'high',
          module: 'checklists',
          users: [userId],
          channel: 'push'
        });
      }
    }

    // 4. IDEIAS SEM ANÁLISE
    const { data: pendingIdeas } = await supabase
      .from('ideas')
      .select('id, title, author_id, created_at')
      .eq('status', 'pending')
      .lt('created_at', oneWeekAgo.toISOString());

    if (pendingIdeas && pendingIdeas.length > 5) {
      const { data: managers } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'gestor_setor']);

      if (managers && managers.length > 0) {
        alerts.push({
          type: 'reminder',
          title: '💡 Ideias Aguardando Análise',
          message: `${pendingIdeas.length} ideias estão há mais de 7 dias sem análise. Priorize a curadoria para engajar os colaboradores.`,
          priority: 'medium',
          module: 'ideas',
          users: managers.map(m => m.id),
          channel: 'push'
        });
      }
    }

    // 5. BAIXO ENGAJAMENTO NO FEED
    const { data: recentPosts } = await supabase
      .from('feed_posts')
      .select('id, title, likes_count, comments_count, created_at')
      .gte('created_at', oneWeekAgo.toISOString())
      .eq('pinned', true);

    if (recentPosts) {
      const lowEngagementPosts = recentPosts.filter(
        post => post.likes_count < 5 && post.comments_count < 2
      );

      if (lowEngagementPosts.length > 3) {
        const { data: admins } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'admin');

        if (admins && admins.length > 0) {
          alerts.push({
            type: 'suggestion',
            title: '📉 Baixo Engajamento no Feed',
            message: `${lowEngagementPosts.length} posts fixados têm baixo engajamento esta semana. Revise o conteúdo ou ajuste a estratégia de comunicação.`,
            priority: 'low',
            module: 'feed',
            users: admins.map(a => a.id),
            channel: 'push'
          });
        }
      }
    }

    // 6. USAR IA PARA GERAR INSIGHTS ADICIONAIS (se disponível)
    if (LOVABLE_API_KEY && alerts.length > 0) {
      try {
        console.log('🤖 Gerando insights com IA...');
        
        const summary = alerts.map(a => `${a.type}: ${a.title}`).join('\n');
        
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'Você é um assistente de análise empresarial. Analise os alertas e forneça uma recomendação executiva em 2-3 frases.'
              },
              {
                role: 'user',
                content: `Alertas detectados:\n${summary}\n\nForneça uma recomendação executiva:`
              }
            ],
            max_tokens: 150
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const recommendation = aiData.choices[0].message.content;
          
          // Adicionar alerta com recomendação da IA
          const { data: admins } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'admin');

          if (admins && admins.length > 0) {
            alerts.push({
              type: 'suggestion',
              title: '🧠 Insight GiraBot',
              message: recommendation,
              priority: 'medium',
              module: 'girabot',
              users: admins.map(a => a.id),
              channel: 'push',
              metadata: { ai_generated: true }
            });
          }
        }
      } catch (aiError) {
        console.error('Erro ao gerar insights com IA:', aiError);
      }
    }

    // 7. ENVIAR ALERTAS
    console.log(`📤 Enviando ${alerts.length} alertas...`);
    
    let sentCount = 0;
    const sendPromises = [];

    for (const alert of alerts) {
      // Criar notificações no banco
      for (const userId of alert.users) {
        const notificationPromise = supabase
          .from('notifications')
          .insert({
            user_id: userId,
            title: alert.title,
            message: alert.message,
            type: alert.type === 'critical' ? 'system' : 'system',
            channel: alert.channel || 'push',
            module: alert.module,
            metadata: alert.metadata,
            is_read: false
          });
        
        sendPromises.push(notificationPromise);
      }

      // Se for WhatsApp e alta prioridade, enviar via Z-API
      if (alert.channel === 'whatsapp' && (alert.priority === 'high' || alert.priority === 'critical')) {
        const zapiToken = Deno.env.get('ZAPI_TOKEN');
        const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');

        if (zapiToken && zapiInstanceId) {
          for (const userId of alert.users) {
            const { data: user } = await supabase
              .from('profiles')
              .select('phone')
              .eq('id', userId)
              .single();

            if (user?.phone) {
              const whatsappPromise = fetch(`https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  phone: user.phone,
                  message: `${alert.title}\n\n${alert.message}`
                })
              }).catch(e => console.error('Erro ao enviar WhatsApp:', e));

              sendPromises.push(whatsappPromise);
            }
          }
        }
      }

      sentCount++;
    }

    await Promise.all(sendPromises);

    console.log(`✅ ${sentCount} alertas enviados com sucesso!`);

    return new Response(
      JSON.stringify({
        success: true,
        alerts_generated: alerts.length,
        alerts_sent: sentCount,
        summary: alerts.map(a => ({ type: a.type, title: a.title, priority: a.priority }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro em girabot-smart-alerts:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
