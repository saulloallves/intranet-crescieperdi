import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

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

    console.log('Checking for inactive users in training...');

    // Data limite: 30 dias atrás
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Buscar progressos de treinamento sem atualização há 30 dias
    const { data: inactiveProgress, error } = await supabase
      .from('training_progress' as any)
      .select(`
        user_id,
        training_id,
        updated_at,
        progress_percent,
        trainings:training_id (title)
      `)
      .eq('status', 'in_progress')
      .lt('updated_at', thirtyDaysAgo.toISOString());

    if (error) throw error;

    if (!inactiveProgress || inactiveProgress.length === 0) {
      console.log('No inactive users found');
      return new Response(
        JSON.stringify({ message: 'No inactive users found', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${inactiveProgress.length} inactive training progress records`);

    // Criar notificações para usuários inativos
    const notifications = inactiveProgress.map((progress: any) => ({
      user_id: progress.user_id,
      title: '⏰ Você tem um treinamento em andamento',
      message: `Notamos que faz mais de 30 dias que você não avança no treinamento "${progress.trainings?.title || 'seu treinamento'}". Você está em ${progress.progress_percent}% - que tal continuar hoje?`,
      type: 'reminder',
      reference_id: progress.training_id,
      is_read: false,
    }));

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notificationError) throw notificationError;

    console.log(`Created ${notifications.length} inactivity notifications`);

    // Buscar trilhas sem progresso há 30 dias
    const { data: inactivePaths } = await supabase
      .from('user_training_paths' as any)
      .select(`
        user_id,
        path_id,
        updated_at,
        progress_percentage,
        training_paths:path_id (name)
      `)
      .is('completed_at', null)
      .lt('updated_at', thirtyDaysAgo.toISOString());

    if (inactivePaths && inactivePaths.length > 0) {
      const pathNotifications = inactivePaths.map((path: any) => ({
        user_id: path.user_id,
        title: '📚 Continue sua jornada de aprendizado',
        message: `Sua trilha "${path.training_paths?.name || 'Trilha de treinamento'}" está esperando por você! Você já completou ${path.progress_percentage}%.`,
        type: 'reminder',
        reference_id: path.path_id,
        is_read: false,
      }));

      await supabase.from('notifications').insert(pathNotifications);
      console.log(`Created ${pathNotifications.length} path inactivity notifications`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        training_alerts: notifications.length,
        path_alerts: inactivePaths?.length || 0,
        total: notifications.length + (inactivePaths?.length || 0)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error checking inactive users:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
