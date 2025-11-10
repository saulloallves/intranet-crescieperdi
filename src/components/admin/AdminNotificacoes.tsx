import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Bell, CheckCircle, Send, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SendNotificationDialog } from './SendNotificationDialog';
import { Button } from '@/components/ui/button';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export function AdminNotificacoes() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    unread: 0,
    today: 0,
  });

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      const notifs = data || [];
      setNotifications(notifs);
      
      const today = new Date().toDateString();
      setStats({
        total: notifs.length,
        unread: notifs.filter(n => !n.is_read).length,
        today: notifs.filter(n => new Date(n.created_at).toDateString() === today).length,
      });
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12">Carregando notificações...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Gerenciar Notificações</h2>
          <p className="text-muted-foreground">Envie notificações e acompanhe o histórico de envios</p>
        </div>
        <SendNotificationDialog />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Total de Notificações</CardDescription>
              <Bell className="w-4 h-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-3xl font-bold">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Não Lidas</CardDescription>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-3xl font-bold text-orange-500">{stats.unread}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Enviadas Hoje</CardDescription>
              <Send className="w-4 h-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-3xl font-bold text-green-500">{stats.today}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4">
        {notifications.map((notification) => (
          <Card key={notification.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Bell className="w-5 h-5" />
                    <CardTitle className="text-base">{notification.title}</CardTitle>
                    <Badge variant="outline">{notification.type}</Badge>
                    {notification.is_read && <CheckCircle className="w-4 h-4 text-green-500" />}
                  </div>
                  <CardDescription>{notification.message}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {new Date(notification.created_at).toLocaleString('pt-BR')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
