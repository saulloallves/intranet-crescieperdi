import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Sparkles, TrendingDown, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function BottlenecksAnalysis() {
  const { toast } = useToast();
  const [periodDays, setPeriodDays] = useState<string>("30");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-learning-bottlenecks', {
        body: { period_days: parseInt(periodDays) }
      });

      if (error) throw error;

      setAnalysis(data);
      toast({
        title: "Análise concluída!",
        description: `${data.bottlenecks.length} gargalos identificados.`
      });
    } catch (error: any) {
      console.error('Error analyzing bottlenecks:', error);
      toast({
        title: "Erro ao analisar",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={periodDays} onValueChange={setPeriodDays}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>

        <Button 
          onClick={handleAnalyze}
          disabled={analyzing}
          className="w-full sm:w-auto"
        >
          {analyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Analisar Gargalos com IA
            </>
          )}
        </Button>
      </div>

      {analysis && (
        <>
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertDescription className="whitespace-pre-wrap">
              {analysis.analysis}
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Módulos Analisados</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analysis.total_modules_analyzed}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gargalos Detectados</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analysis.bottlenecks.length}</div>
                <p className="text-xs text-muted-foreground">
                  {analysis.bottlenecks.length === 0 ? 'Excelente!' : 'Requer atenção'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ações Prioritárias</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analysis.recommendations.filter((r: any) => r.priority === 'high').length}
                </div>
                <p className="text-xs text-muted-foreground">Alta prioridade</p>
              </CardContent>
            </Card>
          </div>

          {analysis.bottlenecks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Módulos com Dificuldades</CardTitle>
                <CardDescription>
                  Módulos onde os colaboradores têm mais dificuldade
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analysis.bottlenecks.map((bottleneck: any, index: number) => (
                    <div key={index} className="border-l-4 border-destructive pl-4 py-2">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold">{bottleneck.training_title}</h4>
                          <p className="text-sm text-muted-foreground">Módulo {bottleneck.module_id}</p>
                        </div>
                        <Badge variant="destructive">
                          {bottleneck.failure_rate.toFixed(1)}% reprovação
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Média:</span>
                          <span className="font-medium ml-1">{bottleneck.avg_score.toFixed(0)}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tentativas:</span>
                          <span className="font-medium ml-1">{bottleneck.total_attempts}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Usuários:</span>
                          <span className="font-medium ml-1">{bottleneck.unique_users}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {analysis.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recomendações de Ação</CardTitle>
                <CardDescription>
                  Ações sugeridas para melhorar o aprendizado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analysis.recommendations.map((rec: any, index: number) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                      <Badge variant={getPriorityColor(rec.priority)}>
                        {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Média' : 'Baixa'}
                      </Badge>
                      <div className="flex-1">
                        <p className="font-medium">Módulo {rec.module_id}</p>
                        <p className="text-sm text-muted-foreground">{rec.suggested_action}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!analysis && !analyzing && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Clique em "Analisar Gargalos" para identificar módulos com dificuldades
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
