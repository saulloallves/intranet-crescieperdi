import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { GraduationCap, Trophy, Target, TrendingUp, Users, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DashboardStats {
  totalTrainings: number;
  activeUsers: number;
  certificatesIssued: number;
  avgCompletionRate: number;
  trainingsByCategory: Array<{
    category: string;
    count: number;
    completion: number;
  }>;
  recentActivity: Array<{
    user_name: string;
    training_title: string;
    completed_at: string;
    score: number;
  }>;
}

export function TrainingDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      // Fetch total trainings
      const { count: totalTrainings } = await supabase
        .from('trainings')
        .select('*', { count: 'exact', head: true })
        .eq('is_published', true);

      // Fetch active users (users with progress)
      const { count: activeUsers } = await supabase
        .from('training_progress')
        .select('user_id', { count: 'exact', head: true });

      // Fetch certificates issued
      const { count: certificatesIssued } = await supabase
        .from('training_certificates')
        .select('*', { count: 'exact', head: true });

      // Fetch trainings by category with completion rates
      const { data: trainings } = await supabase
        .from('trainings')
        .select(`
          category,
          id,
          training_progress (
            completed
          )
        `)
        .eq('is_published', true);

      const categoryStats: Record<string, { count: number; completed: number; total: number }> = {};
      trainings?.forEach((training: any) => {
        if (!categoryStats[training.category]) {
          categoryStats[training.category] = { count: 0, completed: 0, total: 0 };
        }
        categoryStats[training.category].count += 1;
        training.training_progress?.forEach((progress: any) => {
          categoryStats[training.category].total += 1;
          if (progress.completed) {
            categoryStats[training.category].completed += 1;
          }
        });
      });

      const trainingsByCategory = Object.entries(categoryStats).map(([category, data]) => ({
        category,
        count: data.count,
        completion: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      }));

      // Calculate average completion rate
      const totalProgress = trainingsByCategory.reduce((sum, cat) => sum + cat.completion, 0);
      const avgCompletionRate = trainingsByCategory.length > 0 
        ? Math.round(totalProgress / trainingsByCategory.length) 
        : 0;

      setStats({
        totalTrainings: totalTrainings || 0,
        activeUsers: activeUsers || 0,
        certificatesIssued: certificatesIssued || 0,
        avgCompletionRate,
        trainingsByCategory,
        recentActivity: [], // Would need joins with profiles
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Dashboard de Treinamentos</h2>
        <p className="text-muted-foreground">Acompanhe o progresso da rede</p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Treinamentos Ativos</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTrainings}</div>
            <p className="text-xs text-muted-foreground">Cursos disponíveis</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">Em treinamento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Certificados</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.certificatesIssued}</div>
            <p className="text-xs text-muted-foreground">Emitidos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conclusão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgCompletionRate}%</div>
            <p className="text-xs text-muted-foreground">Média geral</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Treinamentos por Categoria</CardTitle>
          <CardDescription>Taxa de conclusão por categoria</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.trainingsByCategory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="hsl(var(--primary))" name="Treinamentos" />
              <Bar dataKey="completion" fill="hsl(var(--chart-2))" name="Conclusão %" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category Details */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.trainingsByCategory.map((category) => (
              <div key={category.category} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium capitalize">{category.category}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {category.count} {category.count === 1 ? 'treinamento' : 'treinamentos'}
                    </span>
                  </div>
                  <Badge variant="secondary">{category.completion}%</Badge>
                </div>
                <Progress value={category.completion} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}