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

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('💡 Generating content suggestions...');

    // Buscar sugestões pendentes (não resolvidas)
    const { data: suggestions, error } = await supabaseClient
      .from('content_suggestions')
      .select('*')
      .eq('status', 'pending')
      .order('priority_score', { ascending: false })
      .limit(20);

    if (error) throw error;

    if (!suggestions || suggestions.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'Nenhuma lacuna de conteúdo identificada!',
          suggestions: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${suggestions.length} pending suggestions`);

    // Agrupar por tema usando IA
    const grouped = await groupSuggestionsByTheme(lovableApiKey, suggestions);

    // Gerar recomendações detalhadas para cada grupo
    const recommendations = await Promise.all(
      grouped.map(async (group) => {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{
              role: 'user',
              content: `Analise estas buscas sem resultado e sugira um conteúdo para criação:

📍 TERMO PRINCIPAL: "${group.mainTerm}"
🔄 VARIAÇÕES: ${group.variations.join(', ')}
📊 TOTAL DE BUSCAS: ${group.totalSearches}

Gere uma recomendação estruturada:

**Título Sugerido:**
[Título claro e objetivo]

**Tipo de Conteúdo:**
[manual | FAQ | treinamento | comunicado]

**Tópicos Principais:**
- [Tópico 1]
- [Tópico 2]
- [Tópico 3]

**Prioridade:**
[Alta | Média | Baixa] - Justifique

**Impacto Esperado:**
[Breve descrição de como isso ajudará os colaboradores]

Seja prático e objetivo (máx. 200 palavras).`
            }]
          })
        });

        if (!aiResponse.ok) {
          throw new Error(`AI API error: ${aiResponse.status}`);
        }

        const data = await aiResponse.json();
        return {
          theme: group.mainTerm,
          variations: group.variations,
          searchCount: group.totalSearches,
          suggestionIds: group.ids,
          aiRecommendation: data.choices[0].message.content
        };
      })
    );

    // Enviar notificação para admins
    await notifyAdmins(supabaseClient, recommendations.length);

    console.log(`✅ Generated ${recommendations.length} content recommendations`);

    return new Response(
      JSON.stringify({
        success: true,
        totalGaps: suggestions.length,
        recommendations
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in search-suggest-content:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Agrupar sugestões por tema similar
async function groupSuggestionsByTheme(
  apiKey: string,
  suggestions: any[]
): Promise<any[]> {
  if (suggestions.length === 0) return [];

  // Agrupar termos similares manualmente (simples)
  const groups = new Map<string, any>();

  for (const sug of suggestions) {
    const normalized = sug.term.toLowerCase().trim();
    let foundGroup = false;

    // Procurar grupo similar
    for (const [key, group] of groups.entries()) {
      if (areSimilarTerms(normalized, key)) {
        group.variations.push(sug.term);
        group.totalSearches += sug.search_count;
        group.ids.push(sug.id);
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) {
      groups.set(normalized, {
        mainTerm: sug.term,
        variations: [sug.term],
        totalSearches: sug.search_count,
        ids: [sug.id]
      });
    }
  }

  return Array.from(groups.values())
    .sort((a, b) => b.totalSearches - a.totalSearches)
    .slice(0, 10);
}

// Verificar se dois termos são similares
function areSimilarTerms(term1: string, term2: string): boolean {
  // Simples: verifica se compartilham palavras principais
  const words1 = term1.split(' ').filter(w => w.length > 3);
  const words2 = term2.split(' ').filter(w => w.length > 3);

  const commonWords = words1.filter(w => words2.includes(w));
  return commonWords.length >= Math.min(words1.length, words2.length) * 0.5;
}

// Notificar admins sobre sugestões geradas
async function notifyAdmins(supabase: any, count: number) {
  try {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('role', ['admin', 'gestor_setor']);

    if (!admins || admins.length === 0) return;

    const notifications = admins.map((admin: any) => ({
      user_id: admin.id,
      title: '💡 Novas Sugestões de Conteúdo',
      message: `${count} novas recomendações de conteúdo foram geradas pela IA com base nas buscas dos colaboradores.`,
      type: 'suggestion',
      reference_id: null
    }));

    await supabase.from('notifications').insert(notifications);
    console.log(`📬 Notified ${admins.length} admins`);
  } catch (error) {
    console.error('Error notifying admins:', error);
  }
}
