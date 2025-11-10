import { Search, Settings, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

export function TopBar() {
  const { profile, isAdmin, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notifications count
  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      
      setUnreadCount(count || 0);
    };

    fetchUnreadCount();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border">
      <div className="flex items-center justify-between px-4 py-3 max-w-screen-xl mx-auto">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
            <span className="text-lg font-bold text-white">CP</span>
          </div>
          <div className="hidden sm:block">
            <h2 className="text-sm font-semibold">Cresci e Perdi</h2>
            <p className="text-xs text-muted-foreground">
              Olá, {profile?.full_name?.split(' ')[0] || 'Usuário'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/busca">
            <Button variant="ghost" size="icon">
              <Search className="w-5 h-5" />
            </Button>
          </Link>
          <Link to="/notificacoes">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <Badge 
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  variant="destructive"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Button>
          </Link>
          {isAdmin && (
            <Link to="/admin">
              <Button variant="ghost" size="icon">
                <Settings className="w-5 h-5" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
