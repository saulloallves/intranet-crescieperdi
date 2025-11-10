import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { reportType = 'daily' } = await req.json();

    // Calculate period
    const now = new Date();
    let periodStart: Date, periodEnd: Date;

    if (reportType === 'daily') {
      periodStart = new Date(now.setHours(0, 0, 0, 0));
      periodEnd = new Date(now.setHours(23, 59, 59, 999));
    } else {
      // weekly
      const dayOfWeek = now.getDay();
      periodStart = new Date(now.setDate(now.getDate() - dayOfWeek));
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 6);
      periodEnd.setHours(23, 59, 59, 999);
    }

    // Get checklist data
    const { data: checklists } = await supabase
      .from('checklists')
      .select('*')
      .eq('is_active', true);

    const { data: responses } = await supabase
      .from('checklist_responses')
      .select('*')
      .gte('submitted_at', periodStart.toISOString())
      .lte('submitted_at', periodEnd.toISOString());

    const { data: alerts } = await supabase
      .from('checklist_alerts')
      .select('*')
      .gte('sent_at', periodStart.toISOString())
      .lte('sent_at', periodEnd.toISOString());

    const { data: units } = await supabase
      .from('units')
      .select('*')
      .eq('is_active', true);

    // Calculate metrics
    const totalUnits = units?.length || 0;
    const totalResponses = responses?.length || 0;
    const totalAlerts = alerts?.length || 0;
    
    const checklistStats = checklists?.map(c => {
      const checklistResponses = responses?.filter(r => r.checklist_id === c.id) || [];
      const checklistAlerts = alerts?.filter(a => a.checklist_id === c.id) || [];
      const uniqueUnits = new Set(checklistResponses.map(r => r.unit_code)).size;
      const complianceRate = totalUnits > 0 ? (uniqueUnits / totalUnits) * 100 : 0;

      return {
        title: c.title,
        responses: checklistResponses.length,
        compliance: complianceRate.toFixed(1),
        alerts: checklistAlerts.length,
      };
    }) || [];

    // Get recurring late units
    const unitAlertCounts = alerts?.reduce((acc, a) => {
      acc[a.unit_code] = (acc[a.unit_code] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    const recurringLateUnits = Object.entries(unitAlertCounts)
      .filter(([_, count]) => (count as number) >= 2)
      .map(([code, count]) => {
        const unit = units?.find(u => u.code === code);
        return `${unit?.name || code} (${count}x)`;
      });

    // Generate AI report using Lovable AI
    let aiContent = '';
    
    if (lovableApiKey) {
      const prompt = `Gere um relatório ${reportType === 'daily' ? 'diário' : 'semanal'} de cumprimento de checklists com os seguintes dados:

Total de lojas: ${totalUnits}
Total de envios: ${totalResponses}
Total de alertas: ${totalAlerts}

Estatísticas por checklist:
${checklistStats.map(s => `- ${s.title}: ${s.responses} envios, ${s.compliance}% de cumprimento, ${s.alerts} alertas`).join('\n')}

${recurringLateUnits.length > 0 ? `Lojas com atraso recorrente:\n${recurringLateUnits.join(', ')}` : 'Nenhuma loja com atraso recorrente.'}

Crie um resumo executivo em português brasileiro, destacando os pontos principais e sugerindo ações.`;

      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'Você é um analista de dados que gera relatórios executivos claros e objetivos.' },
              { role: 'user', content: prompt },
            ],
          }),
        });

        const aiData = await aiResponse.json();
        aiContent = aiData.choices?.[0]?.message?.content || '';
      } catch (error) {
        console.error('Error generating AI report:', error);
      }
    }

    // Fallback to template if AI fails
    if (!aiContent) {
      if (reportType === 'daily') {
        aiContent = `📊 Relatório de Rotinas — ${new Date().toLocaleDateString('pt-BR')}\n\n`;
        aiContent += `Das ${totalUnits} lojas, ${totalResponses} enviaram checklists hoje.\n`;
        if (totalAlerts > 0) {
          aiContent += `🔴 ${totalAlerts} alertas foram enviados.\n`;
        }
        if (recurringLateUnits.length > 0) {
          aiContent += `⚠️ Lojas com atraso recorrente: ${recurringLateUnits.join(', ')}.\n`;
        }
      } else {
        const avgCompliance = checklistStats.reduce((sum, s) => sum + parseFloat(s.compliance), 0) / (checklistStats.length || 1);
        aiContent = `🧭 Relatório Semanal\n\n`;
        aiContent += `Taxa média de cumprimento: ${avgCompliance.toFixed(1)}%.\n`;
        if (recurringLateUnits.length > 0) {
          aiContent += `Lojas com atraso recorrente: ${recurringLateUnits.join(', ')}.\n`;
        }
      }
    }

    // Save report
    const { data: report, error: reportError } = await supabase
      .from('checklist_reports')
      .insert({
        report_type: reportType,
        period_start: periodStart.toISOString().split('T')[0],
        period_end: periodEnd.toISOString().split('T')[0],
        content: aiContent,
        metrics: {
          totalUnits,
          totalResponses,
          totalAlerts,
          checklistStats,
          recurringLateUnits,
        },
      })
      .select()
      .single();

    if (reportError) throw reportError;

    return new Response(
      JSON.stringify({
        success: true,
        report,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-checklist-report:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
