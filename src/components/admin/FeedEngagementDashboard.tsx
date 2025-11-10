import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TrendingUp, Sparkles, Target, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface EngagementData {
  top_posts: any[];
  recommendations: Array<{
    title: string;
    reason: string;
    action: string;
  }>;
  insights: string;
  content_suggestions: string[];
  analyzed_at?: string;
}

export function FeedEngagementDashboard() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<EngagementData | null>(null);

  const analyzeEngagement = async () => {
    try {
      setLoading(true);
      console.log('📊 Analyzing feed engagement...');

      const { data: result, error } = await supabase.functions.invoke('analyze-feed-engagement');

      if (error) {
        console.error('Error analyzing engagement:', error);
        throw error;
      }

      setData(result);
      toast.success('Análise de engajamento concluída!');
      console.log('✅ Analysis complete:', result);

    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao analisar engajamento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Análise de Engajamento do Feed
              </CardTitle>
              <CardDescription>
                IA GiraBot identifica posts com alto engajamento e recomenda destaque
              </CardDescription>
            </div>
            <Button onClick={analyzeEngagement} disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Analisar Agora
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {data && !loading && (
        <>
          {/* Insights Gerais */}
          {data.insights && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Insights da IA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground/90">{data.insights}</p>
                {data.analyzed_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Analisado em: {new Date(data.analyzed_at).toLocaleString('pt-BR')}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Posts Recomendados para Destaque */}
          {data.recommendations && data.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Posts Recomendados para Destaque
                </CardTitle>
                <CardDescription>
                  Posts com alto engajamento que merecem destaque na cultura organizacional
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.recommendations.map((rec, idx) => (
                    <Card key={idx} className="border-l-4 border-l-primary">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h4 className="font-semibold mb-2">{rec.title}</h4>
                            <p className="text-sm text-muted-foreground mb-2">
                              <strong>Motivo:</strong> {rec.reason}
                            </p>
                            <p className="text-sm text-primary">
                              <strong>Ação:</strong> {rec.action}
                            </p>
                          </div>
                          <Badge variant="secondary">Top {idx + 1}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Posts por Engajamento */}
          {data.top_posts && data.top_posts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Posts por Engajamento</CardTitle>
                <CardDescription>Últimos 7 dias</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.top_posts.map((post, idx) => (
                    <div
                      key={post.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            #{idx + 1}
                          </Badge>
                          <span className="font-medium">{post.title}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>👍 {post.total_reactions}</span>
                          <span>💬 {post.comments_count}</span>
                          <span>📊 Score: {post.weighted_engagement_score}</span>
                          <span>⏱️ {Math.round(post.hours_since_posted)}h atrás</span>
                        </div>
                      </div>
                      <Badge variant={post.type === 'training' ? 'default' : 'secondary'}>
                        {post.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sugestões de Conteúdo */}
          {data.content_suggestions && data.content_suggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Sugestões de Conteúdo</CardTitle>
                <CardDescription>
                  Tipos de conteúdo similares para manter o engajamento alto
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.content_suggestions.map((suggestion, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span className="text-sm">{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!data && !loading && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Clique em "Analisar Agora" para ver insights de engajamento com IA</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
