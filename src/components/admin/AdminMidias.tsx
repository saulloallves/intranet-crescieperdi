import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Image, Video, FileText, RefreshCw, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MediaRequest {
  id: string;
  title: string;
  description: string;
  request_type: string;
  status: string;
  deadline: string | null;
  user_name: string;
  user_email: string;
  created_at: string;
}

export function AdminMidias() {
  const [requests, setRequests] = useState<MediaRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0, urgent: 0 });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('media_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const urgentCount = data?.filter(r => {
        if (!r.deadline) return false;
        const deadline = new Date(r.deadline);
        const now = new Date();
        const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 3 && r.status !== 'completed';
      }).length || 0;

      setRequests(data || []);
      setStats({
        total: data?.length || 0,
        pending: data?.filter(r => r.status === 'pending').length || 0,
        completed: data?.filter(r => r.status === 'completed').length || 0,
        urgent: urgentCount,
      });
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncTypebot = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('typebot-sync');

      if (error) throw error;

      toast({
        title: 'Sincronização Concluída',
        description: `${data.stats.media.new} novas requisições importadas`,
      });

      await fetchRequests();
    } catch (error: any) {
      toast({
        title: 'Erro na Sincronização',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const updateRequestStatus = async (requestId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('media_requests')
        .update({ 
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({ title: 'Status Atualizado!' });
      await fetchRequests();
    } catch (error: any) {
      toast({
        title: 'Erro ao Atualizar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getTypeIcon = (type: string) => {
    if (type.includes('video')) return <Video className="w-5 h-5" />;
    if (type.includes('imagem') || type.includes('image')) return <Image className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12">Carregando requisições...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Requisições de Mídia</h2>
          <p className="text-muted-foreground">Solicitações de materiais de marketing via Typebot</p>
        </div>
        <Button onClick={syncTypebot} disabled={syncing}>
          {syncing ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sincronizando...</>
          ) : (
            <><RefreshCw className="w-4 h-4 mr-2" /> Sincronizar</>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Total Requisições</CardDescription>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Pendentes</CardDescription>
              <Clock className="w-4 h-4 text-orange-500" />
            </div>
            <CardTitle className="text-3xl text-orange-500">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Urgentes</CardDescription>
              <Clock className="w-4 h-4 text-red-500" />
            </div>
            <CardTitle className="text-3xl text-red-500">{stats.urgent}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Concluídas</CardDescription>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <CardTitle className="text-3xl text-green-500">{stats.completed}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4">
        {requests.map((request) => {
          const deadline = request.deadline ? new Date(request.deadline) : null;
          const isUrgent = deadline && Math.ceil((deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= 3;

          return (
            <Card key={request.id} className={isUrgent && request.status !== 'completed' ? 'border-red-500' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getTypeIcon(request.request_type)}
                      <CardTitle className="text-base">{request.title}</CardTitle>
                      <Badge variant="outline">{request.request_type}</Badge>
                      {isUrgent && request.status !== 'completed' && (
                        <Badge variant="destructive">Urgente</Badge>
                      )}
                    </div>
                    <CardDescription className="mb-2">{request.description}</CardDescription>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{request.user_name} ({request.user_email})</span>
                      {deadline && (
                        <span>Prazo: {deadline.toLocaleDateString('pt-BR')}</span>
                      )}
                      <span>Criado: {new Date(request.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                  <Select
                    value={request.status}
                    onValueChange={(value) => updateRequestStatus(request.id, value)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="in_progress">Em Progresso</SelectItem>
                      <SelectItem value="completed">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
            </Card>
          );
        })}

        {requests.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Image className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Nenhuma requisição encontrada. Clique em "Sincronizar" para importar do Typebot.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}