import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, Users, Target, CheckCircle2, Clock, Lightbulb } from 'lucide-react';

interface Analytics {
  totalIdeas: number;
  inVoting: number;
  approvalRate: number;
  implementationRate: number;
  topCategories: Array<{ category: string; count: number }>;
  topUnits: Array<{ unit: string; count: number }>;
  engagementByAudience: {
    colaboradores: number;
    franqueados: number;
    ambos: number;
  };
  funnel: {
    enviadas: number;
    aprovadas_votacao: number;
    aprovadas_comunidade: number;
    implementadas: number;
  };
}

export function IdeasDashboard() {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<Analytics>({
    totalIdeas: 0,
    inVoting: 0,
    approvalRate: 0,
    implementationRate: 0,
    topCategories: [],
    topUnits: [],
    engagementByAudience: {
      colaboradores: 0,
      franqueados: 0,
      ambos: 0,
    },
    funnel: {
      enviadas: 0,
      aprovadas_votacao: 0,
      aprovadas_comunidade: 0,
      implementadas: 0,
    },
  });

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const startDate = new Date();
      
      if (period === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
      } else {
        startDate.setMonth(startDate.getMonth() - 3);
      }

      // Buscar ideias do período
      const { data: ideas } = await supabase
        .from('ideas')
        .select('*, profiles!submitted_by(unit_code)')
        .gte('created_at', startDate.toISOString());

      if (!ideas) return;

      const totalIdeas = ideas.length;
      const inVoting = ideas.filter(i => i.status === 'em_votacao').length;
      const aprovadas = ideas.filter(i => ['aprovada', 'em_implementacao', 'implementada'].includes(i.status));
      const implementadas = ideas.filter(i => i.status === 'implementada');

      const approvalRate = totalIdeas > 0 ? (aprovadas.length / totalIdeas) * 100 : 0;
      const implementationRate = aprovadas.length > 0 ? (implementadas.length / aprovadas.length) * 100 : 0;

      // Top categorias
      const categoryCounts = ideas.reduce((acc, idea) => {
        acc[idea.category] = (acc[idea.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topCategories = Object.entries(categoryCounts)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Top unidades
      const unitCounts = ideas.reduce((acc, idea) => {
        const unit = idea.profiles?.unit_code || 'Sem unidade';
        acc[unit] = (acc[unit] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topUnits = Object.entries(unitCounts)
        .map(([unit, count]) => ({ unit, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Engajamento por público
      const engagementByAudience = {
        colaboradores: ideas.filter(i => i.target_audience === 'colaboradores').length,
        franqueados: ideas.filter(i => i.target_audience === 'franqueados').length,
        ambos: ideas.filter(i => i.target_audience === 'ambos').length,
      };

      // Funil
      const funnel = {
        enviadas: totalIdeas,
        aprovadas_votacao: ideas.filter(i => 
          ['em_votacao', 'aprovada', 'em_implementacao', 'implementada'].includes(i.status)
        ).length,
        aprovadas_comunidade: aprovadas.length,
        implementadas: implementadas.length,
      };

      setAnalytics({
        totalIdeas,
        inVoting,
        approvalRate,
        implementationRate,
        topCategories,
        topUnits,
        engagementByAudience,
        funnel,
      });
    } catch (error) {
      console.error('Erro ao buscar analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePercentage = (value: number, total: number) => {
    return total > 0 ? ((value / total) * 100).toFixed(0) : '0';
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12">Carregando analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Filtro de período */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Dashboard de Inovação</CardTitle>
            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Última Semana</SelectItem>
                <SelectItem value="month">Último Mês</SelectItem>
                <SelectItem value="quarter">Último Trimestre</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Métricas principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Total de Ideias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analytics.totalIdeas}</div>
            <p className="text-xs text-muted-foreground mt-1">no período</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4" />
              Taxa de Aprovação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analytics.approvalRate.toFixed(0)}%</div>
            <Progress value={analytics.approvalRate} className="mt-2" />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Em Votação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analytics.inVoting}</div>
            <p className="text-xs text-muted-foreground mt-1">ideias ativas</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Taxa de Implementação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analytics.implementationRate.toFixed(0)}%</div>
            <Progress value={analytics.implementationRate} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Gráficos e tabelas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Categorias */}
        <Card>
          <CardHeader>
            <CardTitle>Categorias Mais Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topCategories.map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">{cat.category}</span>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={(cat.count / analytics.totalIdeas) * 100} 
                      className="w-24 h-2" 
                    />
                    <Badge variant="outline">{cat.count}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Unidades */}
        <Card>
          <CardHeader>
            <CardTitle>Unidades Mais Participativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topUnits.map((unit, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{unit.unit}</span>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={(unit.count / analytics.totalIdeas) * 100} 
                      className="w-24 h-2" 
                    />
                    <Badge variant="outline">{unit.count}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Engajamento por Público */}
        <Card>
          <CardHeader>
            <CardTitle>Engajamento por Público</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Colaboradores</span>
                <Badge>{analytics.engagementByAudience.colaboradores}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Franqueados</span>
                <Badge>{analytics.engagementByAudience.franqueados}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Ambos</span>
                <Badge>{analytics.engagementByAudience.ambos}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Funil de Conversão */}
        <Card>
          <CardHeader>
            <CardTitle>Funil de Ideias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Enviadas</span>
                  <span className="text-sm font-semibold">100%</span>
                </div>
                <Progress value={100} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Aprovadas para Votação</span>
                  <span className="text-sm font-semibold">
                    {calculatePercentage(analytics.funnel.aprovadas_votacao, analytics.funnel.enviadas)}%
                  </span>
                </div>
                <Progress 
                  value={parseInt(calculatePercentage(analytics.funnel.aprovadas_votacao, analytics.funnel.enviadas))} 
                  className="h-2" 
                />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Aprovadas pela Comunidade</span>
                  <span className="text-sm font-semibold">
                    {calculatePercentage(analytics.funnel.aprovadas_comunidade, analytics.funnel.enviadas)}%
                  </span>
                </div>
                <Progress 
                  value={parseInt(calculatePercentage(analytics.funnel.aprovadas_comunidade, analytics.funnel.enviadas))} 
                  className="h-2" 
                />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Implementadas</span>
                  <span className="text-sm font-semibold">
                    {calculatePercentage(analytics.funnel.implementadas, analytics.funnel.enviadas)}%
                  </span>
                </div>
                <Progress 
                  value={parseInt(calculatePercentage(analytics.funnel.implementadas, analytics.funnel.enviadas))} 
                  className="h-2" 
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Relatório IA Placeholder */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Insights da Rede</CardTitle>
            <Button variant="outline" size="sm" disabled>
              🤖 Gerar Relatório IA
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertTitle>Resumo do Período</AlertTitle>
            <AlertDescription>
              {analytics.totalIdeas} ideias enviadas, {analytics.inVoting} em votação ativa. 
              Taxa de aprovação de {analytics.approvalRate.toFixed(1)}%.
              {analytics.topCategories.length > 0 && ` Categoria mais ativa: ${analytics.topCategories[0].category}.`}
              {analytics.topUnits.length > 0 && ` Unidade destaque: ${analytics.topUnits[0].unit}.`}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
