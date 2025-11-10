import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Users, Target, Clock, Award, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#f59e0b', '#10b981'];

export function ManagerDashboard() {
  const [selectedUnit, setSelectedUnit] = useState<string>("all");
  const [selectedPath, setSelectedPath] = useState<string>("all");

  // Buscar estatísticas gerais
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['manager-training-stats', selectedUnit],
    queryFn: async () => {
      let query = supabase
        .from('training_progress' as any)
        .select(`
          *,
          profiles!training_progress_user_id_fkey(nome_completo, cargo, unidade),
          trainings:training_id(title)
        `);

      if (selectedUnit !== 'all') {
        query = query.eq('profiles.unidade', selectedUnit);
      }

      const { data, error } = await query;
      if (error) throw error;

      const total = data?.length || 0;
      const completed = data?.filter((p: any) => p.status === 'completed').length || 0;
      const inProgress = data?.filter((p: any) => p.status === 'in_progress').length || 0;
      const avgProgress = data?.reduce((sum: number, p: any) => sum + p.progress_percent, 0) / total || 0;

      return {
        total,
        completed,
        inProgress,
        avgProgress: Math.round(avgProgress)
      };
    }
  });

  // Buscar certificados emitidos
  const { data: certificates } = useQuery({
    queryKey: ['manager-certificates', selectedUnit],
    queryFn: async () => {
      let query = supabase
        .from('training_certificates' as any)
        .select(`
          *,
          profiles!training_certificates_user_id_fkey(nome_completo, cargo, unidade, avatar_url)
        `)
        .order('issued_at', { ascending: false });

      if (selectedUnit !== 'all') {
        query = query.eq('profiles.unidade', selectedUnit);
      }

      const { data, error } = await query.limit(10);
      if (error) throw error;
      return data;
    }
  });

  // Buscar progresso por trilha
  const { data: pathProgress } = useQuery({
    queryKey: ['manager-path-progress', selectedUnit, selectedPath],
    queryFn: async () => {
      let query = supabase
        .from('user_training_paths' as any)
        .select(`
          *,
          training_paths:path_id(name),
          profiles!user_training_paths_user_id_fkey(unidade)
        `);

      if (selectedUnit !== 'all') {
        query = query.eq('profiles.unidade', selectedUnit);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Agrupar por trilha
      const grouped = data?.reduce((acc: any, item: any) => {
        const pathName = item.training_paths?.name || 'Desconhecido';
        if (!acc[pathName]) {
          acc[pathName] = { name: pathName, total: 0, completed: 0, avgProgress: 0 };
        }
        acc[pathName].total++;
        if (item.completed_at) acc[pathName].completed++;
        acc[pathName].avgProgress += item.progress_percentage || 0;
        return acc;
      }, {});

      return Object.values(grouped || {}).map((path: any) => ({
        ...path,
        avgProgress: Math.round(path.avgProgress / path.total)
      }));
    }
  });

  // Buscar pendências por cargo
  const { data: pendingByRole } = useQuery({
    queryKey: ['manager-pending-by-role', selectedUnit],
    queryFn: async () => {
      let query = supabase
        .from('training_progress' as any)
        .select(`
          *,
          profiles!training_progress_user_id_fkey(cargo, unidade),
          trainings:training_id(title, role)
        `)
        .in('status', ['not_started', 'in_progress']);

      if (selectedUnit !== 'all') {
        query = query.eq('profiles.unidade', selectedUnit);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Agrupar por cargo
      const grouped = data?.reduce((acc: any, item: any) => {
        const role = item.profiles?.cargo || 'Não especificado';
        if (!acc[role]) {
          acc[role] = { role, count: 0, users: new Set() };
        }
        acc[role].count++;
        acc[role].users.add(item.user_id);
        return acc;
      }, {});

      return Object.values(grouped || {}).map((item: any) => ({
        role: item.role,
        pending: item.count,
        users: item.users.size
      }));
    }
  });

  // Dados para gráfico de pizza (status)
  const statusChartData = stats ? [
    { name: 'Concluídos', value: stats.completed },
    { name: 'Em Progresso', value: stats.inProgress },
    { name: 'Não Iniciados', value: stats.total - stats.completed - stats.inProgress }
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={selectedUnit} onValueChange={setSelectedUnit}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrar unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as unidades</SelectItem>
            <SelectItem value="001">Unidade 001</SelectItem>
            <SelectItem value="002">Unidade 002</SelectItem>
            <SelectItem value="003">Unidade 003</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="pending">Pendências</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Cards de estatísticas */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total em Treinamento</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.total || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.completed || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.total ? Math.round((stats.completed / stats.total) * 100) : 0}% do total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Em Progresso</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.inProgress || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Progresso Médio</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.avgProgress || 0}%</div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Progresso por Trilha</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={pathProgress}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="completed" fill="hsl(var(--primary))" name="Concluídos" />
                    <Bar dataKey="total" fill="hsl(var(--muted))" name="Total" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status dos Treinamentos</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ranking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Top Colaboradores Certificados
              </CardTitle>
              <CardDescription>Últimos 10 certificados emitidos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {certificates?.map((cert: any, index: number) => (
                  <div key={cert.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                        {index + 1}
                      </div>
                      <Avatar>
                        <AvatarFallback>
                          {cert.profiles?.nome_completo?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{cert.profiles?.nome_completo}</p>
                        <p className="text-sm text-muted-foreground">
                          {cert.profiles?.cargo} - {cert.profiles?.unidade}
                        </p>
                      </div>
                    </div>
                    <Badge variant={cert.score >= 90 ? "default" : "secondary"}>
                      {cert.score}%
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      {new Date(cert.issued_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Treinamentos Pendentes por Cargo
              </CardTitle>
              <CardDescription>
                Colaboradores que ainda não concluíram os treinamentos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingByRole?.map((item: any) => (
                  <div key={item.role} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.role}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.users} colaborador(es) • {item.pending} treinamento(s) pendente(s)
                        </p>
                      </div>
                      <Badge variant="destructive">{item.pending}</Badge>
                    </div>
                    <Progress value={(item.pending / (item.pending + 10)) * 100} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
