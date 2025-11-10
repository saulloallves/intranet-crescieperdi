import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format, isToday, isYesterday, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bell, BellOff, Check, Search, Filter, MessageSquare, Smartphone, Mail, Brain, TrendingUp, AlertTriangle, Lightbulb, Clock } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  channel?: string;
  module?: string;
  status?: string;
}

const ITEMS_PER_PAGE = 10;

const getChannelIcon = (channel?: string) => {
  switch (channel) {
    case 'whatsapp':
      return <MessageSquare className="w-3 h-3" />;
    case 'email':
      return <Mail className="w-3 h-3" />;
    default:
      return <Smartphone className="w-3 h-3" />;
  }
};

const getChannelLabel = (channel?: string) => {
  switch (channel) {
    case 'whatsapp':
      return 'WhatsApp';
    case 'email':
      return 'E-mail';
    default:
      return 'Push';
  }
};

const getTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    training: 'bg-blue-500/10 text-blue-700 border-blue-200',
    announcement: 'bg-purple-500/10 text-purple-700 border-purple-200',
    recognition: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
    campaign: 'bg-green-500/10 text-green-700 border-green-200',
    system: 'bg-gray-500/10 text-gray-700 border-gray-200',
    checklist: 'bg-cyan-500/10 text-cyan-700 border-cyan-200',
    anomaly: 'bg-red-500/10 text-red-700 border-red-200',
    suggestion: 'bg-indigo-500/10 text-indigo-700 border-indigo-200',
    reminder: 'bg-orange-500/10 text-orange-700 border-orange-200',
  };
  return colors[type] || colors.system;
};

const getAlertIcon = (type: string) => {
  switch (type) {
    case 'anomaly':
      return <AlertTriangle className="w-4 h-4" />;
    case 'suggestion':
      return <Lightbulb className="w-4 h-4" />;
    case 'reminder':
      return <Clock className="w-4 h-4" />;
    default:
      return <Bell className="w-4 h-4" />;
  }
};

const isGiraBotAlert = (notification: Notification) => {
  return ['anomaly', 'suggestion', 'reminder'].includes(notification.type) || 
         notification.module === 'girabot';
};

export default function Notificacoes() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchNotifications();

    if (!user) return;

    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [notifications, searchQuery, typeFilter, channelFilter, statusFilter]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar notificações',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...notifications];

    // Filtro de busca
    if (searchQuery) {
      filtered = filtered.filter(
        n =>
          n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.message.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filtro de tipo
    if (typeFilter !== 'all') {
      filtered = filtered.filter(n => n.type === typeFilter);
    }

    // Filtro de canal
    if (channelFilter !== 'all') {
      filtered = filtered.filter(n => (n.channel || 'push') === channelFilter);
    }

    // Filtro de status
    if (statusFilter === 'unread') {
      filtered = filtered.filter(n => !n.is_read);
    } else if (statusFilter === 'read') {
      filtered = filtered.filter(n => n.is_read);
    }

    setFilteredNotifications(filtered);
    setCurrentPage(1);
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );
    } catch (error: any) {
      toast({
        title: 'Erro ao marcar como lida',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setNotifications(prev =>
        prev.map(notif => ({ ...notif, is_read: true }))
      );

      toast({
        title: 'Sucesso',
        description: 'Todas as notificações foram marcadas como lidas',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const groupNotificationsByDate = (notifs: Notification[]) => {
    const groups: Record<string, Notification[]> = {};

    notifs.forEach(notif => {
      const date = new Date(notif.created_at);
      let label: string;

      if (isToday(date)) {
        label = 'Hoje';
      } else if (isYesterday(date)) {
        label = 'Ontem';
      } else if (date >= startOfWeek(new Date()) && date <= endOfWeek(new Date())) {
        label = 'Esta semana';
      } else {
        label = format(date, 'MMMM yyyy', { locale: ptBR });
      }

      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(notif);
    });

    return groups;
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const totalPages = Math.ceil(filteredNotifications.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedNotifications = filteredNotifications.slice(startIndex, endIndex);
  const groupedNotifications = groupNotificationsByDate(paginatedNotifications);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Notificações</h1>
            <p className="text-muted-foreground">
              {unreadCount > 0
                ? `Você tem ${unreadCount} notificação${unreadCount > 1 ? 'ões' : ''} não lida${unreadCount > 1 ? 's' : ''}`
                : 'Todas as notificações lidas'}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button onClick={markAllAsRead} variant="outline" size="sm">
              <Check className="w-4 h-4 mr-2" />
              Marcar todas como lidas
            </Button>
          )}
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtros</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="training">Treinamento</SelectItem>
                  <SelectItem value="announcement">Comunicado</SelectItem>
                  <SelectItem value="recognition">Reconhecimento</SelectItem>
                  <SelectItem value="campaign">Campanha</SelectItem>
                  <SelectItem value="system">Sistema</SelectItem>
                  <SelectItem value="checklist">Checklist</SelectItem>
                  <SelectItem value="anomaly">🧠 Alerta</SelectItem>
                  <SelectItem value="suggestion">🧠 Sugestão</SelectItem>
                  <SelectItem value="reminder">🧠 Lembrete</SelectItem>
                </SelectContent>
              </Select>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os canais</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="unread">Não lidas</SelectItem>
                  <SelectItem value="read">Lidas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Card de Resumo GiraBot */}
        {notifications.filter(isGiraBotAlert).length > 0 && (
          <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    🧠 Alertas Inteligentes GiraBot
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    O GiraBot identificou {notifications.filter(isGiraBotAlert).length} pontos de atenção baseados em análise de padrões e tendências do sistema.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <div>
                        <div className="text-xs text-muted-foreground">Alertas</div>
                        <div className="font-semibold">
                          {notifications.filter(n => n.type === 'anomaly').length}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-indigo-500" />
                      <div>
                        <div className="text-xs text-muted-foreground">Sugestões</div>
                        <div className="font-semibold">
                          {notifications.filter(n => n.type === 'suggestion').length}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-orange-500" />
                      <div>
                        <div className="text-xs text-muted-foreground">Lembretes</div>
                        <div className="font-semibold">
                          {notifications.filter(n => n.type === 'reminder').length}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notificações */}
        {filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BellOff className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                {searchQuery || typeFilter !== 'all' || channelFilter !== 'all' || statusFilter !== 'all'
                  ? 'Nenhuma notificação encontrada com os filtros selecionados'
                  : 'Você não tem notificações no momento'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedNotifications).map(([dateLabel, notifs]) => (
              <div key={dateLabel}>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 px-2">
                  {dateLabel}
                </h2>
                <div className="space-y-3">
                  {notifs.map((notification) => (
                        <Card
                          key={notification.id}
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            isGiraBotAlert(notification)
                              ? 'border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-transparent'
                              : !notification.is_read
                              ? 'border-l-4 border-l-primary bg-primary/5'
                              : 'hover:bg-accent/50'
                          }`}
                          onClick={() => !notification.is_read && markAsRead(notification.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                  isGiraBotAlert(notification)
                                    ? 'bg-primary text-primary-foreground'
                                    : !notification.is_read
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {isGiraBotAlert(notification) ? (
                                  <Brain className="w-5 h-5" />
                                ) : (
                                  <Bell className="w-5 h-5" />
                                )}
                              </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h3 className="font-semibold text-sm">
                                {notification.title}
                              </h3>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatDistanceToNow(new Date(notification.created_at), {
                                  addSuffix: true,
                                  locale: ptBR,
                                })}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={getTypeColor(notification.type)}>
                                <span className="flex items-center gap-1">
                                  {getAlertIcon(notification.type)}
                                  {notification.type}
                                </span>
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {getChannelIcon(notification.channel)}
                                <span className="ml-1">{getChannelLabel(notification.channel)}</span>
                              </Badge>
                              {notification.module && (
                                <Badge variant="secondary" className="text-xs">
                                  {notification.module}
                                </Badge>
                              )}
                              {isGiraBotAlert(notification) && (
                                <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
                                  <Brain className="w-3 h-3 mr-1" />
                                  GiraBot
                                </Badge>
                              )}
                              {!notification.is_read && (
                                <Badge className="text-xs">
                                  Novo
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próxima
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
