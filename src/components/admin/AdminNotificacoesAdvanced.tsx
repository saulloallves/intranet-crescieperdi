import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { NotificationTemplateEditor } from './NotificationTemplateEditor';
import {
  Bell,
  MessageSquare,
  Mail,
  Smartphone,
  TrendingUp,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  Send,
  Plus,
  RefreshCw,
} from 'lucide-react';

interface Stats {
  total_sent: number;
  total_read: number;
  read_rate: string;
  unread_count: number;
}

interface ChannelStats {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
}

export function AdminNotificacoesAdvanced() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [channelStats, setChannelStats] = useState<Record<string, ChannelStats>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Buscar estatísticas gerais
      const { data: notifications } = await supabase
        .from('notifications')
        .select('*')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (notifications) {
        const totalSent = notifications.length;
        const totalRead = notifications.filter(n => n.is_read).length;
        const readRate = totalSent > 0 ? ((totalRead / totalSent) * 100).toFixed(2) : '0';
        const unreadCount = totalSent - totalRead;

        setStats({
          total_sent: totalSent,
          total_read: totalRead,
          read_rate: readRate,
          unread_count: unreadCount,
        });

        // Calcular estatísticas por canal
        const channels = notifications.reduce((acc, n) => {
          const channel = n.channel || 'push';
          if (!acc[channel]) {
            acc[channel] = { total: 0, sent: 0, delivered: 0, failed: 0 };
          }
          acc[channel].total++;
          if (n.status === 'sent') acc[channel].sent++;
          if (n.status === 'delivered') acc[channel].delivered++;
          if (n.status === 'failed') acc[channel].failed++;
          return acc;
        }, {} as Record<string, ChannelStats>);

        setChannelStats(channels);
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar estatísticas',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    try {
      setGenerating(true);
      
      const { data, error } = await supabase.functions.invoke('notification-reports', {
        body: {
          period: 'weekly',
          send_notification: true,
          generate_insights: true,
        },
      });

      if (error) throw error;

      toast({
        title: 'Relatório gerado com sucesso',
        description: 'O relatório foi enviado para todos os administradores.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao gerar relatório',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return <MessageSquare className="w-4 h-4" />;
      case 'email':
        return <Mail className="w-4 h-4" />;
      default:
        return <Smartphone className="w-4 h-4" />;
    }
  };

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return 'WhatsApp';
      case 'email':
        return 'E-mail';
      default:
        return 'Push';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sistema de Notificações</h1>
          <p className="text-muted-foreground">
            Gerencie templates, monitore envios e analise métricas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchStats} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={generateReport} disabled={generating}>
            {generating ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <BarChart3 className="w-4 h-4 mr-2" />
                Gerar Relatório
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Enviado (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold">{stats?.total_sent || 0}</div>
              <Send className="w-8 h-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Leitura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold">{stats?.read_rate || 0}%</div>
              <TrendingUp className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold">{stats?.total_read || 0}</div>
              <CheckCircle2 className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Não Lidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold">{stats?.unread_count || 0}</div>
              <Bell className="w-8 h-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estatísticas por Canal */}
      <Card>
        <CardHeader>
          <CardTitle>Desempenho por Canal</CardTitle>
          <CardDescription>
            Análise de envio e entrega por canal de comunicação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(channelStats).map(([channel, data]) => (
              <Card key={channel} className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    {getChannelIcon(channel)}
                    <CardTitle className="text-sm font-medium">
                      {getChannelLabel(channel)}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <Badge variant="secondary">{data.total}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Enviados</span>
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-200">
                      {data.sent}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Entregues</span>
                    <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200">
                      {data.delivered}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Falharam</span>
                    <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-200">
                      {data.failed}
                    </Badge>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-xs text-muted-foreground">Taxa de sucesso</div>
                    <div className="text-lg font-bold">
                      {data.total > 0
                        ? (((data.sent + data.delivered) / data.total) * 100).toFixed(1)
                        : 0}%
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Abas de Conteúdo */}
      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="logs">Logs de Envio</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <NotificationTemplateEditor />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Envio</CardTitle>
              <CardDescription>
                Histórico de notificações enviadas e seus status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationLogs />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações Z-API</CardTitle>
              <CardDescription>
                Configure a integração com WhatsApp via Z-API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ZAPIConfig />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Componente auxiliar para logs
function NotificationLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(50);

      setLogs(data || []);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando logs...</div>;
  }

  return (
    <div className="space-y-2">
      {logs.map(log => (
        <div
          key={log.id}
          className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50"
        >
          <div className="flex-1">
            <div className="font-medium text-sm">{log.title}</div>
            <div className="text-xs text-muted-foreground">
              {log.profiles?.full_name} • {new Date(log.created_at).toLocaleString('pt-BR')}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={log.status === 'sent' ? 'default' : 'destructive'}>
              {log.status}
            </Badge>
            <Badge variant="outline">{log.channel || 'push'}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

// Componente auxiliar para configuração Z-API
function ZAPIConfig() {
  return (
    <div className="space-y-4">
      <div className="p-4 border rounded-lg bg-muted/50">
        <p className="text-sm text-muted-foreground">
          As credenciais Z-API são configuradas via Supabase Secrets e não podem ser
          visualizadas aqui por motivos de segurança.
        </p>
      </div>
      <div className="space-y-2">
        <div className="text-sm font-medium">Secrets Configurados:</div>
        <div className="space-y-1 text-sm text-muted-foreground">
          <div>• ZAPI_TOKEN</div>
          <div>• ZAPI_INSTANCE_ID</div>
          <div>• ZAPI_CLIENT_TOKEN</div>
        </div>
      </div>
    </div>
  );
}
