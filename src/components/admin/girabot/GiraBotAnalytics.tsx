import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Bot, 
  MessageSquare, 
  TrendingUp, 
  Clock, 
  Zap, 
  RefreshCw,
  BarChart3,
  ThumbsUp,
  Activity
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

interface SessionStats {
  total_sessions: number;
  today_sessions: number;
  avg_response_time: number;
  total_tokens: number;
  avg_satisfaction: number;
  module_breakdown: Array<{ module: string; count: number }>;
  top_questions: Array<{ question: string; count: number }>;
  hourly_distribution: Array<{ hour: string; count: number }>;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

export function GiraBotAnalytics() {
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const daysAgo = period === 'day' ? 1 : period === 'week' ? 7 : 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

      // Fetch sessions
      const { data: sessions, error } = await supabase
        .from('ai_sessions')
        .select('*')
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate today's sessions
      const today = new Date().toDateString();
      const todaySessions = sessions?.filter(
        s => new Date(s.created_at).toDateString() === today
      ).length || 0;

      // Calculate module breakdown
      const moduleCount: Record<string, number> = {};
      sessions?.forEach(s => {
        moduleCount[s.module] = (moduleCount[s.module] || 0) + 1;
      });

      const moduleBreakdown = Object.entries(moduleCount).map(([module, count]) => ({
        module,
        count
      }));

      // Calculate top questions (group similar questions)
      const questionCount: Record<string, number> = {};
      sessions?.forEach(s => {
        const question = s.question.substring(0, 100); // Truncate for grouping
        questionCount[question] = (questionCount[question] || 0) + 1;
      });

      const topQuestions = Object.entries(questionCount)
        .map(([question, count]) => ({ question, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Calculate hourly distribution
      const hourlyCount: Record<string, number> = {};
      sessions?.forEach(s => {
        const hour = new Date(s.created_at).getHours();
        const hourLabel = `${hour.toString().padStart(2, '0')}:00`;
        hourlyCount[hourLabel] = (hourlyCount[hourLabel] || 0) + 1;
      });

      const hourlyDistribution = Object.entries(hourlyCount)
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour.localeCompare(b.hour));

      // Calculate averages
      const totalTokens = sessions?.reduce((sum, s) => sum + (s.tokens_used || 0), 0) || 0;
      const totalResponseTime = sessions?.reduce((sum, s) => sum + (s.response_time_ms || 0), 0) || 0;
      const avgResponseTime = sessions?.length ? Math.round(totalResponseTime / sessions.length) : 0;

      // Calculate satisfaction
      const ratedSessions = sessions?.filter(s => s.feedback_rating) || [];
      const avgSatisfaction = ratedSessions.length
        ? ratedSessions.reduce((sum, s) => sum + (s.feedback_rating || 0), 0) / ratedSessions.length
        : 0;

      setStats({
        total_sessions: sessions?.length || 0,
        today_sessions: todaySessions,
        avg_response_time: avgResponseTime,
        total_tokens: totalTokens,
        avg_satisfaction: avgSatisfaction,
        module_breakdown: moduleBreakdown,
        top_questions: topQuestions,
        hourly_distribution: hourlyDistribution
      });

    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      toast({
        title: 'Erro ao carregar analytics',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">Analytics do GiraBot</h3>
          <p className="text-muted-foreground">Métricas detalhadas de uso e desempenho</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={period === 'day' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('day')}
          >
            Hoje
          </Button>
          <Button
            variant={period === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('week')}
          >
            7 Dias
          </Button>
          <Button
            variant={period === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('month')}
          >
            30 Dias
          </Button>
          <Button variant="ghost" size="sm" onClick={fetchAnalytics}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Total de Sessões</CardDescription>
              <MessageSquare className="w-4 h-4 text-blue-500" />
            </div>
            <CardTitle className="text-3xl text-blue-500">{stats.total_sessions}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Sessões Hoje</CardDescription>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <CardTitle className="text-3xl text-green-500">{stats.today_sessions}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Tempo Médio</CardDescription>
              <Clock className="w-4 h-4 text-purple-500" />
            </div>
            <CardTitle className="text-3xl text-purple-500">{stats.avg_response_time}ms</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Tokens Usados</CardDescription>
              <Zap className="w-4 h-4 text-orange-500" />
            </div>
            <CardTitle className="text-3xl text-orange-500">
              {(stats.total_tokens / 1000).toFixed(1)}k
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Satisfação Média</CardDescription>
              <ThumbsUp className="w-4 h-4 text-pink-500" />
            </div>
            <CardTitle className="text-3xl text-pink-500">
              {stats.avg_satisfaction.toFixed(1)}/5
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Uso por Módulo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.module_breakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ module, count }) => `${module}: ${count}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {stats.module_breakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hourly Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Distribuição por Horário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.hourly_distribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Questions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Perguntas Mais Frequentes
          </CardTitle>
          <CardDescription>
            Top 10 perguntas mais feitas no período selecionado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.top_questions.map((item, index) => (
              <div key={index} className="flex items-start justify-between gap-4 pb-3 border-b last:border-0">
                <div className="flex-1">
                  <Badge variant="secondary" className="mb-2">
                    #{index + 1}
                  </Badge>
                  <p className="text-sm">{item.question}</p>
                </div>
                <Badge variant="outline">{item.count}x</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
