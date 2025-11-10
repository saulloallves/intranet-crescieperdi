import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { FileText, Calendar, TrendingUp, AlertTriangle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ChecklistReport {
  id: string;
  report_type: string;
  period_start: string;
  period_end: string;
  content: string;
  metrics: any;
  generated_at: string;
}

export default function AdminChecklistReports() {
  const [reports, setReports] = useState<ChecklistReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('checklist_reports')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setReports(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar relatórios: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (type: 'daily' | 'weekly') => {
    try {
      setGenerating(true);
      const { data, error } = await supabase.functions.invoke('generate-checklist-report', {
        body: { reportType: type }
      });

      if (error) throw error;
      toast.success('Relatório gerado com sucesso!');
      fetchReports();
    } catch (error: any) {
      toast.error('Erro ao gerar relatório: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const checkCompliance = async () => {
    try {
      setChecking(true);
      const { data, error } = await supabase.functions.invoke('check-checklist-compliance', {});

      if (error) throw error;
      
      const result = data as { alertsSent: number; details: any[] };
      toast.success(`Verificação concluída! ${result.alertsSent} alerta(s) enviado(s).`);
    } catch (error: any) {
      toast.error('Erro ao verificar cumprimento: ' + error.message);
    } finally {
      setChecking(false);
    }
  };

  const dailyReports = reports.filter(r => r.report_type === 'daily');
  const weeklyReports = reports.filter(r => r.report_type === 'weekly');

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Relatórios de Cumprimento</h2>
          <p className="text-muted-foreground">
            Acompanhe o desempenho das unidades nos checklists
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={checkCompliance}
            disabled={checking}
            variant="outline"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Verificando...' : 'Verificar Agora'}
          </Button>
          <Button
            onClick={() => generateReport('daily')}
            disabled={generating}
            variant="outline"
          >
            <FileText className="w-4 h-4 mr-2" />
            Gerar Diário
          </Button>
          <Button
            onClick={() => generateReport('weekly')}
            disabled={generating}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Gerar Semanal
          </Button>
        </div>
      </div>

      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="daily">Relatórios Diários</TabsTrigger>
          <TabsTrigger value="weekly">Relatórios Semanais</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          {dailyReports.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum relatório diário ainda</p>
                <Button onClick={() => generateReport('daily')} className="mt-4" disabled={generating}>
                  Gerar Primeiro Relatório
                </Button>
              </CardContent>
            </Card>
          ) : (
            dailyReports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))
          )}
        </TabsContent>

        <TabsContent value="weekly" className="space-y-4">
          {weeklyReports.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum relatório semanal ainda</p>
                <Button onClick={() => generateReport('weekly')} className="mt-4" disabled={generating}>
                  Gerar Primeiro Relatório
                </Button>
              </CardContent>
            </Card>
          ) : (
            weeklyReports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportCard({ report }: { report: ChecklistReport }) {
  const { metrics } = report;
  const avgCompliance = metrics.checklistStats.length > 0
    ? (metrics.checklistStats.reduce((sum, s) => sum + parseFloat(s.compliance), 0) / metrics.checklistStats.length).toFixed(1)
    : '0';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Relatório {report.report_type === 'daily' ? 'Diário' : 'Semanal'}
            </CardTitle>
            <CardDescription>
              {new Date(report.period_start).toLocaleDateString('pt-BR')} - {new Date(report.period_end).toLocaleDateString('pt-BR')}
            </CardDescription>
          </div>
          <Badge variant={parseFloat(avgCompliance) >= 80 ? 'default' : 'destructive'}>
            {avgCompliance}% cumprimento
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <TrendingUp className="w-8 h-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total de Envios</p>
              <p className="text-2xl font-bold">{metrics.totalResponses}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <AlertTriangle className="w-8 h-8 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">Alertas Enviados</p>
              <p className="text-2xl font-bold">{metrics.totalAlerts}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <RefreshCw className="w-8 h-8 text-warning" />
            <div>
              <p className="text-sm text-muted-foreground">Lojas em Atraso</p>
              <p className="text-2xl font-bold">{metrics.recurringLateUnits.length}</p>
            </div>
          </div>
        </div>

        <div className="prose prose-sm max-w-none">
          <div className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
            {report.content}
          </div>
        </div>

        {metrics.recurringLateUnits.length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-2">Lojas com Atraso Recorrente:</p>
            <div className="flex flex-wrap gap-2">
              {metrics.recurringLateUnits.map((unit, idx) => (
                <Badge key={idx} variant="destructive">
                  {unit}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {metrics.checklistStats.length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-2">Desempenho por Checklist:</p>
            <div className="space-y-2">
              {metrics.checklistStats.map((stat, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded">
                  <span className="text-sm">{stat.title}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{stat.responses} envios</span>
                    <Badge variant={parseFloat(stat.compliance) >= 80 ? 'default' : 'secondary'}>
                      {stat.compliance}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
