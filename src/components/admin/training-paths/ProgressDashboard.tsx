import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Users, Target, TrendingUp, Award, Search, Download, FileText, Loader2, BarChart3, PieChart, Clock, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell } from 'recharts';
import DOMPurify from 'dompurify';

interface UserProgress {
  user_id: string;
  user_name: string;
  unit: string;
  path_name: string;
  progress_percentage: number;
  started_at: string;
  completed_at: string | null;
  target_role: string;
}

export function ProgressDashboard() {
  const [progressData, setProgressData] = useState<UserProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [aiReport, setAiReport] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUnit, setFilterUnit] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('30');
  const { toast } = useToast();

  useEffect(() => {
    fetchProgressData();
  }, []);

  const fetchProgressData = async () => {
    try {
      const { data, error } = await supabase
        .from('user_training_paths' as any)
        .select(`
          *,
          path:training_paths!user_training_paths_path_id_fkey (
            name,
            target_role
          ),
          profile:profiles!user_training_paths_user_id_fkey (
            full_name,
            unit
          )
        `)
        .order('started_at', { ascending: false });

      if (error) throw error;

      const formattedData: UserProgress[] = (data || []).map((item: any) => ({
        user_id: item.user_id,
        user_name: item.profile?.full_name || 'Usuário sem nome',
        unit: item.profile?.unit || 'Sem unidade',
        path_name: item.path?.name || 'Trilha desconhecida',
        progress_percentage: item.progress_percentage || 0,
        started_at: item.started_at,
        completed_at: item.completed_at,
        target_role: item.path?.target_role || 'desconhecido',
      }));

      setProgressData(formattedData);
    } catch (error) {
      console.error('Error fetching progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = progressData.filter((item) => {
    const matchesSearch = item.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.path_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesUnit = filterUnit === 'all' || item.unit === filterUnit;
    const matchesRole = filterRole === 'all' || item.target_role === filterRole;
    return matchesSearch && matchesUnit && matchesRole;
  });

  const stats = {
    totalUsers: new Set(progressData.map(p => p.user_id)).size,
    completedPaths: progressData.filter(p => p.completed_at).length,
    avgProgress: progressData.length > 0
      ? Math.round(progressData.reduce((sum, p) => sum + p.progress_percentage, 0) / progressData.length)
      : 0,
    inProgress: progressData.filter(p => !p.completed_at).length,
  };

  const units = Array.from(new Set(progressData.map(p => p.unit)));
  const roles = Array.from(new Set(progressData.map(p => p.target_role)));

  // Gráficos de dados
  const pathsData = progressData.reduce((acc: Record<string, number>, item) => {
    acc[item.path_name] = (acc[item.path_name] || 0) + 1;
    return acc;
  }, {});

  const chartData = Object.entries(pathsData)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const statusData = [
    { name: 'Concluídas', value: stats.completedPaths, color: '#10b981' },
    { name: 'Em Andamento', value: stats.inProgress, color: '#f59e0b' },
  ];

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-training-report', {
        body: {
          period: filterPeriod === '7' ? 'weekly' : 'monthly',
          start_date: new Date(Date.now() - parseInt(filterPeriod) * 24 * 60 * 60 * 1000).toISOString(),
          end_date: new Date().toISOString(),
        },
      });

      if (error) throw error;

      if (data?.success && data?.ai_summary) {
        setAiReport(data.ai_summary);
        toast({
          title: 'Relatório gerado!',
          description: 'O relatório executivo foi gerado com sucesso.',
        });
      } else {
        throw new Error('Erro ao gerar relatório');
      }
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast({
        title: 'Erro ao gerar relatório',
        description: error.message || 'Não foi possível gerar o relatório.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingReport(false);
    }
  };

  const exportToCSV = () => {
    const csv = [
      ['Nome', 'Unidade', 'Trilha', 'Cargo', 'Progresso', 'Iniciado em', 'Concluído em'].join(','),
      ...filteredData.map(item => [
        item.user_name,
        item.unit,
        item.path_name,
        item.target_role,
        `${item.progress_percentage}%`,
        format(new Date(item.started_at), 'dd/MM/yyyy', { locale: ptBR }),
        item.completed_at ? format(new Date(item.completed_at), 'dd/MM/yyyy', { locale: ptBR }) : 'Em andamento'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-treinamentos-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold mb-2">Dashboard de Progresso</h3>
          <p className="text-sm text-muted-foreground">Acompanhe o desempenho dos colaboradores</p>
        </div>
        <Button onClick={handleGenerateReport} disabled={generatingReport} className="gap-2">
          {generatingReport ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Gerar Relatório com IA
            </>
          )}
        </Button>
      </div>

      {aiReport && (
        <Alert className="bg-blue-50 border-blue-200">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            <div className="prose prose-sm max-w-none">
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: DOMPurify.sanitize(aiReport.replace(/\n/g, '<br />'), {
                    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote'],
                    ALLOWED_ATTR: []
                  }) 
                }} 
              />
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Em treinamento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trilhas Concluídas</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedPaths}</div>
            <p className="text-xs text-muted-foreground">Total de conclusões</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground">Trilhas ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progresso Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgProgress}%</div>
            <p className="text-xs text-muted-foreground">Taxa geral</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou trilha..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterPeriod} onValueChange={setFilterPeriod}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterUnit} onValueChange={setFilterUnit}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filtrar por unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as unidades</SelectItem>
                {units.map(unit => (
                  <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filtrar por cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os cargos</SelectItem>
                {roles.map(role => (
                  <SelectItem key={role} value={role}>{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={exportToCSV} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Trilhas Mais Acessadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={12} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Status das Trilhas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RePieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Progress Table */}
      <Card>
        <CardHeader>
          <CardTitle>Progresso dos Colaboradores</CardTitle>
          <CardDescription>
            {filteredData.length} resultado{filteredData.length !== 1 ? 's' : ''} encontrado{filteredData.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredData.map((item, index) => (
              <div key={`${item.user_id}-${index}`} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{item.user_name}</h4>
                      <Badge variant="outline">{item.unit}</Badge>
                      <Badge variant="secondary">{item.target_role}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.path_name}</p>
                  </div>
                  {item.completed_at ? (
                    <Badge className="bg-green-500">
                      <Award className="w-3 h-3 mr-1" />
                      Concluído
                    </Badge>
                  ) : (
                    <Badge variant="secondary">{item.progress_percentage}%</Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <Progress value={item.progress_percentage} className="h-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Iniciado em {format(new Date(item.started_at), "dd 'de' MMM, yyyy", { locale: ptBR })}</span>
                    {item.completed_at && (
                      <span>Concluído em {format(new Date(item.completed_at), "dd 'de' MMM, yyyy", { locale: ptBR })}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {filteredData.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum resultado encontrado</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
