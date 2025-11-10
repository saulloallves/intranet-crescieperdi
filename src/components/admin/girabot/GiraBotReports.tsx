import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  RefreshCw, 
  Calendar,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DOMPurify from 'dompurify';

interface Report {
  id: string;
  report_type: string;
  report_data: {
    checklist_compliance: {
      total_units: number;
      completed_on_time: number;
      late_units: string[];
      recurring_late_units: string[];
    };
    module_engagement: Array<{
      module: string;
      interactions: number;
      trend: 'up' | 'down' | 'stable';
    }>;
    training_progress: {
      total_trainings: number;
      completion_rate: number;
      bottlenecks: string[];
    };
    feed_activity: {
      posts_today: number;
      engagement_rate: number;
      top_content_types: string[];
    };
  };
  ai_insights: string;
  generated_at: string;
}

export function GiraBotReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('girabot_reports')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      setReports((data as unknown) as Report[] || []);
      
      // Select most recent report by default
      if (data && data.length > 0 && !selectedReport) {
        setSelectedReport((data[0] as unknown) as Report);
      }
    } catch (error: any) {
      console.error('Error fetching reports:', error);
      toast({
        title: 'Erro ao carregar relatórios',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('girabot-reports', {
        body: { report_type: 'manual' }
      });

      if (error) throw error;

      toast({
        title: 'Relatório gerado com sucesso',
        description: 'Um novo relatório inteligente foi criado.'
      });

      await fetchReports();
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast({
        title: 'Erro ao gerar relatório',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setGenerating(false);
    }
  };

  const formatAIInsights = (insights: string) => {
    // Convert markdown-style formatting to HTML
    let formatted = insights
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br />');
    
    return DOMPurify.sanitize(formatted, {
      ALLOWED_TAGS: ['strong', 'br', 'p', 'ul', 'li'],
      ALLOWED_ATTR: []
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">Relatórios Inteligentes</h3>
          <p className="text-muted-foreground">
            Análises automáticas e insights gerados por IA
          </p>
        </div>
        <Button onClick={generateReport} disabled={generating}>
          {generating ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Gerar Novo Relatório
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report List */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-muted-foreground">
            Histórico de Relatórios
          </h4>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {reports.map((report) => (
              <Card
                key={report.id}
                className={`cursor-pointer transition-colors ${
                  selectedReport?.id === report.id
                    ? 'border-primary bg-accent'
                    : 'hover:bg-accent/50'
                }`}
                onClick={() => setSelectedReport(report)}
              >
                <CardHeader className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Relatório {report.report_type === 'daily' ? 'Diário' : 'Manual'}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {format(new Date(report.generated_at), "dd 'de' MMMM 'às' HH:mm", {
                          locale: ptBR
                        })}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(
                        (report.report_data.checklist_compliance.completed_on_time /
                          report.report_data.checklist_compliance.total_units) * 100
                      )}%
                    </Badge>
                  </div>
                </CardHeader>
              </Card>
            ))}

            {reports.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Nenhum relatório disponível. Gere o primeiro relatório!
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Report Details */}
        <div className="lg:col-span-2 space-y-4">
          {selectedReport ? (
            <>
              {/* AI Insights */}
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Análise Inteligente do GiraBot
                  </CardTitle>
                  <CardDescription>
                    Gerado em {format(new Date(selectedReport.generated_at), "dd/MM/yyyy 'às' HH:mm")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: formatAIInsights(selectedReport.ai_insights || 'Sem insights disponíveis')
                    }}
                  />
                </CardContent>
              </Card>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Checklist Compliance */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Compliance de Checklists
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">No Prazo</span>
                      <Badge variant="default">
                        {selectedReport.report_data.checklist_compliance.completed_on_time}/
                        {selectedReport.report_data.checklist_compliance.total_units}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Com Atraso</span>
                      <Badge variant="destructive">
                        {selectedReport.report_data.checklist_compliance.late_units.length}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Atrasos Recorrentes</span>
                      <Badge variant="outline" className="border-orange-500 text-orange-500">
                        {selectedReport.report_data.checklist_compliance.recurring_late_units.length}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Module Engagement */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-500" />
                      Engajamento de Módulos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {selectedReport.report_data.module_engagement.slice(0, 5).map((module, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm capitalize">{module.module}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{module.interactions}</span>
                          {module.trend === 'up' && <TrendingUp className="w-3 h-3 text-green-500" />}
                          {module.trend === 'down' && <TrendingDown className="w-3 h-3 text-red-500" />}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Training Progress */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-500" />
                      Progresso de Treinamentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total de Treinamentos</span>
                      <Badge>{selectedReport.report_data.training_progress.total_trainings}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Taxa de Conclusão</span>
                      <Badge variant="secondary">
                        {selectedReport.report_data.training_progress.completion_rate.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Gargalos</span>
                      <Badge variant="outline">
                        {selectedReport.report_data.training_progress.bottlenecks.length}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Feed Activity */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-pink-500" />
                      Atividade no Feed
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Posts Hoje</span>
                      <Badge>{selectedReport.report_data.feed_activity.posts_today}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Engajamento Médio</span>
                      <Badge variant="secondary">
                        {selectedReport.report_data.feed_activity.engagement_rate.toFixed(1)}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-muted-foreground">Tipos Populares</span>
                      <div className="flex gap-1 flex-wrap">
                        {selectedReport.report_data.feed_activity.top_content_types.map((type, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Alert Section */}
              {selectedReport.report_data.checklist_compliance.recurring_late_units.length > 0 && (
                <Card className="border-orange-500">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-500" />
                      Atenção: Unidades com Atrasos Recorrentes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {selectedReport.report_data.checklist_compliance.recurring_late_units.map((unit, idx) => (
                        <Badge key={idx} variant="outline" className="border-orange-500 text-orange-500">
                          {unit}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-24 text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Selecione um Relatório</h3>
                <p className="text-muted-foreground">
                  Escolha um relatório da lista para visualizar os detalhes
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
