import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, MessageSquare, Sparkles, TrendingUp, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function TrainingFeedbackDashboard() {
  const { toast } = useToast();
  const [selectedPath, setSelectedPath] = useState<string>("all");
  const [periodDays, setPeriodDays] = useState<string>("30");
  const [generatingReport, setGeneratingReport] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  // Fetch training paths
  const { data: trainingPaths } = useQuery({
    queryKey: ['training-paths-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_paths' as any)
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data as any[];
    }
  });

  // Fetch feedback data
  const { data: feedbackData, isLoading } = useQuery({
    queryKey: ['training-feedback', selectedPath, periodDays],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(periodDays));

      let query = supabase
        .from('training_feedback' as any)
        .select(`
          *,
          profiles!training_feedback_user_id_fkey(nome_completo, cargo, unidade),
          training_paths!training_feedback_training_path_id_fkey(name)
        `)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (selectedPath !== 'all') {
        query = query.eq('training_path_id', selectedPath);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    }
  });

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    setAiReport(null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-training-feedback', {
        body: {
          training_path_id: selectedPath === 'all' ? null : selectedPath,
          period_days: parseInt(periodDays)
        }
      });

      if (error) throw error;

      setAiReport(data.summary);
      toast({
        title: "Relatório gerado!",
        description: "Análise com IA concluída com sucesso."
      });
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast({
        title: "Erro ao gerar relatório",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setGeneratingReport(false);
    }
  };

  // Calculate metrics
  const metrics = feedbackData ? {
    total: feedbackData.length,
    avgClarity: feedbackData.reduce((sum, f) => sum + f.was_clear, 0) / feedbackData.length || 0,
    avgPreparedness: feedbackData.reduce((sum, f) => sum + f.feels_prepared, 0) / feedbackData.length || 0,
  } : null;

  // Prepare chart data by role
  const chartData = feedbackData ? Object.entries(
    feedbackData.reduce((acc, feedback: any) => {
      const role = feedback.profiles?.cargo || 'Não especificado';
      if (!acc[role]) {
        acc[role] = { role, clarity: 0, preparedness: 0, count: 0 };
      }
      acc[role].clarity += feedback.was_clear;
      acc[role].preparedness += feedback.feels_prepared;
      acc[role].count++;
      return acc;
    }, {} as Record<string, { role: string; clarity: number; preparedness: number; count: number }>)
  ).map(([_, data]: [string, any]) => ({
    cargo: data.role,
    clareza: (data.clarity / data.count).toFixed(1),
    preparacao: (data.preparedness / data.count).toFixed(1),
    respostas: data.count
  })) : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={selectedPath} onValueChange={setSelectedPath}>
          <SelectTrigger className="w-full sm:w-[250px]">
            <SelectValue placeholder="Filtrar por trilha" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as trilhas</SelectItem>
            {trainingPaths?.map(path => (
              <SelectItem key={path.id} value={path.id}>{path.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

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
          onClick={handleGenerateReport}
          disabled={generatingReport || !feedbackData || feedbackData.length === 0}
          className="w-full sm:w-auto"
        >
          {generatingReport ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Gerar Relatório com IA
            </>
          )}
        </Button>
      </div>

      {aiReport && (
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertDescription className="whitespace-pre-wrap">{aiReport}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Respostas</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clareza Média</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.avgClarity.toFixed(1) || '0.0'}/5</div>
            <p className="text-xs text-muted-foreground">
              {metrics && metrics.avgClarity >= 4 ? '✅ Excelente' : metrics && metrics.avgClarity >= 3 ? '⚠️ Bom' : '❌ Precisa melhorar'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Preparação Média</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.avgPreparedness.toFixed(1) || '0.0'}/5</div>
            <p className="text-xs text-muted-foreground">
              {metrics && metrics.avgPreparedness >= 4 ? '✅ Excelente' : metrics && metrics.avgPreparedness >= 3 ? '⚠️ Bom' : '❌ Precisa melhorar'}
            </p>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Feedback por Cargo</CardTitle>
            <CardDescription>Média de clareza e preparação por função</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="cargo" />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="clareza" fill="hsl(var(--primary))" name="Clareza" />
                <Bar dataKey="preparacao" fill="hsl(var(--secondary))" name="Preparação" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {feedbackData && feedbackData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Comentários Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {feedbackData
                .filter(f => f.additional_comments)
                .slice(0, 10)
                .map(feedback => (
                  <div key={feedback.id} className="border-l-2 border-primary pl-4 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{feedback.profiles?.nome_completo || 'Anônimo'}</span>
                      <span className="text-sm text-muted-foreground">
                        {feedback.profiles?.cargo || 'N/A'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        • {new Date(feedback.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{feedback.additional_comments}</p>
                    <div className="flex gap-4 mt-2 text-xs">
                      <span>Clareza: {feedback.was_clear}/5</span>
                      <span>Preparação: {feedback.feels_prepared}/5</span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(!feedbackData || feedbackData.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum feedback encontrado no período selecionado.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
