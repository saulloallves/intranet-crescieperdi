import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportRequest {
  period: 'weekly' | 'monthly';
  start_date?: string;
  end_date?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Verificar se é admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'gestor_setor'].includes(profile.role)) {
      throw new Error('Unauthorized: Admin access required');
    }

    const { period, start_date, end_date }: ReportRequest = await req.json();

    // Calcular datas
    const endDate = end_date ? new Date(end_date) : new Date();
    const startDate = start_date 
      ? new Date(start_date)
      : period === 'weekly' 
        ? new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
        : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    console.log('Generating report for period:', startDate, 'to', endDate);

    // 1. Total de usuários ativos em trilhas
    const { data: activeUsers, error: activeUsersError } = await supabaseClient
      .from('user_training_paths' as any)
      .select('user_id', { count: 'exact', head: false })
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString());

    if (activeUsersError) throw activeUsersError;

    const activeUsersCount = activeUsers?.length || 0;

    // 2. Taxa de conclusão
    const { data: completedPaths, error: completedError } = await supabaseClient
      .from('user_training_paths' as any)
      .select('id', { count: 'exact', head: false })
      .not('completed_at', 'is', null)
      .gte('completed_at', startDate.toISOString())
      .lte('completed_at', endDate.toISOString());

    if (completedError) throw completedError;

    const completedCount = completedPaths?.length || 0;

    // 3. Trilhas mais populares
    const { data: popularPaths, error: popularError } = await supabaseClient
      .from('user_training_paths' as any)
      .select(`
        path_id,
        training_paths:path_id (name)
      `, { count: 'exact' })
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString());

    if (popularError) throw popularError;

    // Contar trilhas
    const pathCounts: Record<string, { name: string; count: number }> = {};
    popularPaths?.forEach((item: any) => {
      const pathName = item.training_paths?.name || 'Desconhecida';
      if (!pathCounts[pathName]) {
        pathCounts[pathName] = { name: pathName, count: 0 };
      }
      pathCounts[pathName].count++;
    });

    const topPaths = Object.values(pathCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // 4. Unidades sem progresso
    const { data: allUnits } = await supabaseClient
      .from('profiles')
      .select('unit_code')
      .not('unit_code', 'is', null);

    const uniqueUnits = [...new Set(allUnits?.map(u => u.unit_code))];

    const { data: activeUnits } = await supabaseClient
      .from('user_training_paths' as any)
      .select(`
        user_id,
        profiles:user_id (unit_code)
      `)
      .gte('started_at', startDate.toISOString());

    const activeUnitCodes = new Set(
      activeUnits?.map((item: any) => item.profiles?.unit_code).filter(Boolean)
    );

    const inactiveUnits = uniqueUnits.filter(unit => !activeUnitCodes.has(unit));

    // 5. Taxa de aprovação em quizzes
    const { data: quizAttempts } = await supabaseClient
      .from('training_quiz_attempts' as any)
      .select('passed', { count: 'exact' })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const totalAttempts = quizAttempts?.length || 0;
    const passedAttempts = quizAttempts?.filter((a: any) => a.passed).length || 0;
    const passRate = totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : 0;

    // 6. Certificados emitidos
    const { data: certificates } = await supabaseClient
      .from('training_certificates' as any)
      .select('id', { count: 'exact' })
      .gte('issued_at', startDate.toISOString())
      .lte('issued_at', endDate.toISOString());

    const certificatesCount = certificates?.length || 0;

    // Gerar relatório com IA
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    let aiSummary = '';
    if (LOVABLE_API_KEY) {
      try {
        const reportData = {
          period: period === 'weekly' ? 'Semanal' : 'Mensal',
          activeUsers: activeUsersCount,
          completedPaths: completedCount,
          topPaths,
          passRate,
          certificatesIssued: certificatesCount,
          inactiveUnits: inactiveUnits.length,
          inactiveUnitsList: inactiveUnits.slice(0, 5),
        };

        const prompt = `Você é o GiraBot, assistente da Cresci e Perdi. Gere um relatório executivo de treinamentos.

Dados do período:
- Período: ${reportData.period}
- Usuários ativos: ${reportData.activeUsers}
- Trilhas concluídas: ${reportData.completedPaths}
- Taxa de aprovação em quizzes: ${reportData.passRate}%
- Certificados emitidos: ${reportData.certificatesIssued}
- Unidades sem atividade: ${reportData.inactiveUnits}

Trilhas mais acessadas:
${topPaths.map((p, i) => `${i + 1}. ${p.name} (${p.count} usuários)`).join('\n')}

${inactiveUnits.length > 0 ? `Unidades sem progresso: ${reportData.inactiveUnitsList.join(', ')}` : ''}

Forneça um relatório executivo em formato markdown com:
1. Título chamativo com emoji
2. Resumo dos principais números
3. Destaques positivos
4. Áreas de atenção
5. Recomendações práticas

Use emojis, bullet points e seja direto. Máximo 300 palavras.`;

        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'Você é GiraBot, assistente executivo da Cresci e Perdi.' },
              { role: 'user', content: prompt }
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          aiSummary = data.choices?.[0]?.message?.content || '';
        }
      } catch (error) {
        console.error('Error generating AI summary:', error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        period,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        metrics: {
          active_users: activeUsersCount,
          completed_paths: completedCount,
          completion_rate: activeUsersCount > 0 
            ? Math.round((completedCount / activeUsersCount) * 100) 
            : 0,
          pass_rate: passRate,
          certificates_issued: certificatesCount,
          inactive_units_count: inactiveUnits.length,
        },
        top_paths: topPaths,
        inactive_units: inactiveUnits.slice(0, 10),
        ai_summary: aiSummary,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error generating report:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
