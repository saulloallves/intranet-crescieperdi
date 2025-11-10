import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Users, FileText, Award, TrendingUp, Calendar, Building2, BarChart3, Activity } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalAnnouncements: 0,
    totalTrainings: 0,
    totalChecklists: 0,
    completionRate: 0,
  });
  const [period, setPeriod] = useState('30');
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [units, setUnits] = useState<any[]>([]);
  const [engagementData, setEngagementData] = useState<any[]>([]);
  const [moduleData, setModuleData] = useState<any[]>([]);
  const [unitActivity, setUnitActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUnits();
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [period, selectedUnit]);

  const fetchUnits = async () => {
    const { data } = await supabase
      .from('units')
      .select('code, name')
      .eq('is_active', true)
      .order('name');
    setUnits(data || []);
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchStats(),
        fetchEngagementData(),
        fetchModuleData(),
        fetchUnitActivity(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));

      let usersQuery = supabase.from('profiles').select('*', { count: 'exact', head: true });
      let activeUsersQuery = supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true);

      if (selectedUnit !== 'all') {
        usersQuery = usersQuery.eq('unit_code', selectedUnit);
        activeUsersQuery = activeUsersQuery.eq('unit_code', selectedUnit);
      }

      const [
        { count: usersCount },
        { count: activeUsersCount },
        { count: announcementsCount },
        { count: trainingsCount },
        { count: checklistsCount },
        { count: totalTrainingProgress },
        { count: completedTrainingProgress },
      ] = await Promise.all([
        usersQuery,
        activeUsersQuery,
        supabase.from('announcements').select('*', { count: 'exact', head: true }).eq('is_published', true),
        supabase.from('trainings').select('*', { count: 'exact', head: true }).eq('is_published', true),
        supabase.from('checklists').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('training_progress').select('*', { count: 'exact', head: true }),
        supabase.from('training_progress').select('*', { count: 'exact', head: true }).eq('completed', true),
      ]);

      setStats({
        totalUsers: usersCount || 0,
        activeUsers: activeUsersCount || 0,
        totalAnnouncements: announcementsCount || 0,
        totalTrainings: trainingsCount || 0,
        totalChecklists: checklistsCount || 0,
        completionRate: totalTrainingProgress ? Math.round(((completedTrainingProgress || 0) / totalTrainingProgress) * 100) : 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchEngagementData = async () => {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));

      const { data: announcements } = await supabase
        .from('announcements')
        .select('created_at, views_count, likes_count')
        .gte('created_at', startDate.toISOString())
        .order('created_at');

      const { data: trainings } = await supabase
        .from('training_progress')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at');

      // Group by day
      const dataByDay: Record<string, any> = {};
      
      announcements?.forEach(a => {
        const day = new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (!dataByDay[day]) {
          dataByDay[day] = { day, visualizacoes: 0, engajamento: 0, treinamentos: 0 };
        }
        dataByDay[day].visualizacoes += a.views_count || 0;
        dataByDay[day].engajamento += a.likes_count || 0;
      });

      trainings?.forEach(t => {
        const day = new Date(t.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (!dataByDay[day]) {
          dataByDay[day] = { day, visualizacoes: 0, engajamento: 0, treinamentos: 0 };
        }
        dataByDay[day].treinamentos += 1;
      });

      setEngagementData(Object.values(dataByDay));
    } catch (error) {
      console.error('Error fetching engagement data:', error);
    }
  };

  const fetchModuleData = async () => {
    try {
      const [
        { count: announcementsViews },
        { count: trainingsCompleted },
        { count: checklistsSubmitted },
        { count: ideasSubmitted },
        { count: recognitionsGiven },
      ] = await Promise.all([
        supabase.from('announcement_views').select('*', { count: 'exact', head: true }),
        supabase.from('training_progress').select('*', { count: 'exact', head: true }).eq('completed', true),
        supabase.from('checklist_responses').select('*', { count: 'exact', head: true }),
        supabase.from('ideas').select('*', { count: 'exact', head: true }),
        supabase.from('recognitions').select('*', { count: 'exact', head: true }),
      ]);

      setModuleData([
        { name: 'Comunicados', value: announcementsViews || 0 },
        { name: 'Treinamentos', value: trainingsCompleted || 0 },
        { name: 'Checklists', value: checklistsSubmitted || 0 },
        { name: 'Ideias', value: ideasSubmitted || 0 },
        { name: 'Reconhecimentos', value: recognitionsGiven || 0 },
      ]);
    } catch (error) {
      console.error('Error fetching module data:', error);
    }
  };

  const fetchUnitActivity = async () => {
    try {
      if (selectedUnit !== 'all') {
        setUnitActivity([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('unit_code')
        .not('unit_code', 'is', null);

      const unitCounts: Record<string, number> = {};
      profiles?.forEach(p => {
        unitCounts[p.unit_code] = (unitCounts[p.unit_code] || 0) + 1;
      });

      const unitsWithNames = await Promise.all(
        Object.entries(unitCounts).map(async ([code, count]) => {
          const unit = units.find(u => u.code === code);
          return {
            name: unit?.name || code,
            usuarios: count,
          };
        })
      );

      setUnitActivity(unitsWithNames.sort((a, b) => b.usuarios - a.usuarios).slice(0, 10));
    } catch (error) {
      console.error('Error fetching unit activity:', error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12">Carregando dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Dashboard Executivo</h2>
          <p className="text-muted-foreground">Análise completa de engajamento e performance</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="15">15 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="60">60 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todas as unidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Unidades</SelectItem>
              {units.map(unit => (
                <SelectItem key={unit.code} value={unit.code}>{unit.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Usuários</CardDescription>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-2xl">{stats.totalUsers}</CardTitle>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Usuários Ativos</CardDescription>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-500" />
              <CardTitle className="text-2xl text-green-500">{stats.activeUsers}</CardTitle>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Comunicados</CardDescription>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <CardTitle className="text-2xl text-blue-500">{stats.totalAnnouncements}</CardTitle>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Treinamentos</CardDescription>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-500" />
              <CardTitle className="text-2xl text-purple-500">{stats.totalTrainings}</CardTitle>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Checklists</CardDescription>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-orange-500" />
              <CardTitle className="text-2xl text-orange-500">{stats.totalChecklists}</CardTitle>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Taxa Conclusão</CardDescription>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <CardTitle className="text-2xl text-green-500">{stats.completionRate}%</CardTitle>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Engagement Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Engajamento ao Longo do Tempo</CardTitle>
          <CardDescription>Visualizações, engajamento e treinamentos concluídos</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={engagementData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="visualizacoes" stroke="#3b82f6" strokeWidth={2} name="Visualizações" />
              <Line type="monotone" dataKey="engajamento" stroke="#10b981" strokeWidth={2} name="Engajamento" />
              <Line type="monotone" dataKey="treinamentos" stroke="#8b5cf6" strokeWidth={2} name="Treinamentos" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Atividade por Módulo</CardTitle>
            <CardDescription>Distribuição de uso entre funcionalidades</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={moduleData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Module Distribution Pie */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Uso</CardTitle>
            <CardDescription>Percentual de engajamento por módulo</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={moduleData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {moduleData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Units */}
        {selectedUnit === 'all' && unitActivity.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Top 10 Unidades Mais Ativas</CardTitle>
              <CardDescription>Ranking de unidades por número de usuários</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={unitActivity} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={150} />
                  <Tooltip />
                  <Bar dataKey="usuarios" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}