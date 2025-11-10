import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Users, CheckCircle, XCircle, AlertTriangle, Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function MandatoryContentDashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [contents, setContents] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    completed: 0,
    pending: 0,
    completionRate: 0,
  });
  const [userDetails, setUserDetails] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Buscar conteúdos ativos
      const { data: contentData, error: contentError } = await supabase
        .from('mandatory_contents')
        .select('*')
        .eq('active', true);

      if (contentError) throw contentError;
      setContents(contentData || []);

      // Buscar todos os perfis ativos
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, unit_code')
        .eq('is_active', true);

      if (!profiles) return;

      const totalUsers = profiles.length;
      let completedCount = 0;
      let pendingCount = 0;

      const detailsPromises = profiles.map(async (profile) => {
        let userCompleted = 0;
        let userPending = 0;
        let applicableContents = 0;

        for (const content of contentData || []) {
          // Filtrar por público-alvo
          if (content.target_audience === 'colaboradores' && profile.role !== 'colaborador') continue;
          if (content.target_audience === 'franqueados' && profile.role !== 'franqueado') continue;

          applicableContents++;

          const { data: signature } = await supabase
            .from('mandatory_content_signatures')
            .select('success, score')
            .eq('content_id', content.id)
            .eq('user_id', profile.id)
            .single();

          if (signature && signature.success) {
            userCompleted++;
            completedCount++;
          } else {
            userPending++;
            pendingCount++;
          }
        }

        return {
          ...profile,
          completed: userCompleted,
          pending: userPending,
          total: applicableContents,
          status: userPending > 0 ? 'pending' : userCompleted > 0 ? 'completed' : 'not_started',
        };
      });

      const details = await Promise.all(detailsPromises);

      setStats({
        totalUsers,
        completed: completedCount,
        pending: pendingCount,
        completionRate: totalUsers > 0 ? Math.round((completedCount / (completedCount + pendingCount)) * 100) : 0,
      });

      setUserDetails(details);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar dados',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const csv = [
      ['Nome', 'E-mail', 'Cargo', 'Unidade', 'Concluídos', 'Pendentes', 'Total Aplicável', 'Status'],
      ...userDetails.map(u => [
        u.full_name,
        u.email,
        u.role,
        u.unit_code || 'N/A',
        u.completed,
        u.pending,
        u.total,
        u.status,
      ]),
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conformidade-conteudos-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard de Conformidade</h2>
          <p className="text-muted-foreground">Acompanhe quem concluiu os conteúdos obrigatórios</p>
        </div>
        <Button onClick={handleExportCSV} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Métricas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="w-8 h-8 text-muted-foreground" />
              <div className="text-3xl font-bold">{stats.totalUsers}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
              <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conclusão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold">{stats.completionRate}%</div>
              <Progress value={stats.completionRate} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Detalhamento */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Usuário</CardTitle>
          <CardDescription>Visualize o status individual de cada colaborador</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Concluídos</TableHead>
                <TableHead>Pendentes</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userDetails.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.role}</Badge>
                  </TableCell>
                  <TableCell>{user.unit_code || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant="default">{user.completed}/{user.total}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{user.pending}</Badge>
                  </TableCell>
                  <TableCell>
                    {user.status === 'completed' ? (
                      <Badge className="bg-green-500">
                        <CheckCircle className="w-3 h-3 mr-1" /> Concluído
                      </Badge>
                    ) : user.status === 'pending' ? (
                      <Badge variant="destructive">
                        <XCircle className="w-3 h-3 mr-1" /> Pendente
                      </Badge>
                    ) : (
                      <Badge variant="outline">Não iniciado</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
