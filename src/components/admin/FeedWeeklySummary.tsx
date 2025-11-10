import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Sparkles, TrendingUp, Calendar } from "lucide-react";
import { toast } from "sonner";

interface WeeklySummaryData {
  summary: string;
  ai_insights?: string;
  stats: {
    total: number;
    by_type: Record<string, number>;
    engagement: number;
    top_post: {
      title: string;
      likes: number;
      comments: number;
    };
  };
  period: {
    start: string;
    end: string;
  };
}

export function FeedWeeklySummary() {
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<WeeklySummaryData | null>(null);

  const generateSummary = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('feed-weekly-summary');

      if (error) throw error;

      setSummaryData(data);
      toast.success("Resumo semanal gerado!");
    } catch (error: any) {
      console.error("Error generating summary:", error);
      toast.error("Erro ao gerar resumo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Resumo Semanal
            </CardTitle>
            <CardDescription>
              Análise automática dos últimos 7 dias de conteúdo
            </CardDescription>
          </div>
          <Button onClick={generateSummary} disabled={loading}>
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Gerando...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Gerar Resumo
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {summaryData && (
        <CardContent className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Publicado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{summaryData.stats.total}</div>
                <p className="text-xs text-muted-foreground mt-1">conteúdos</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Engajamento Médio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold flex items-center gap-2">
                  {summaryData.stats.engagement}
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">interações/post</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Post Mais Popular
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm font-medium line-clamp-2">
                  {summaryData.stats.top_post.title}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summaryData.stats.top_post.likes} curtidas • {summaryData.stats.top_post.comments} comentários
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Text Summary */}
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription className="whitespace-pre-line">
              {summaryData.summary}
            </AlertDescription>
          </Alert>

          {/* AI Insights */}
          {summaryData.ai_insights && (
            <Alert className="bg-primary/5 border-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
              <AlertDescription>
                <div className="font-semibold mb-2">💡 Insights da IA (GiraBot)</div>
                <div className="text-sm whitespace-pre-line">{summaryData.ai_insights}</div>
              </AlertDescription>
            </Alert>
          )}

          {/* Type Breakdown */}
          <div>
            <h4 className="font-semibold mb-3">📊 Distribuição por Tipo</h4>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(summaryData.stats.by_type).map(([type, count]) => (
                <div key={type} className="flex justify-between items-center p-3 rounded-lg bg-muted">
                  <span className="text-sm capitalize">{type}</span>
                  <span className="font-bold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
