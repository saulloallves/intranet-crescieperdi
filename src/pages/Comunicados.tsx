import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Heart, Eye, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Announcement {
  id: string;
  title: string;
  content: string;
  author_id: string;
  media_url: string | null;
  media_type: string | null;
  views_count: number;
  likes_count: number;
  created_at: string;
  profiles: {
    full_name: string;
  } | null;
}

export default function Comunicados() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchAnnouncements();
    fetchUserLikes();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select(`
          *,
          profiles:author_id (full_name)
        `)
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar comunicados',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserLikes = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('announcement_likes')
        .select('announcement_id')
        .eq('user_id', user.id);

      if (data) {
        setLikedPosts(new Set(data.map(like => like.announcement_id)));
      }
    } catch (error) {
      console.error('Error fetching likes:', error);
    }
  };

  const handleLike = async (announcementId: string) => {
    if (!user) return;

    const isLiked = likedPosts.has(announcementId);

    try {
      if (isLiked) {
        await supabase
          .from('announcement_likes')
          .delete()
          .eq('announcement_id', announcementId)
          .eq('user_id', user.id);
        
        setLikedPosts(prev => {
          const newSet = new Set(prev);
          newSet.delete(announcementId);
          return newSet;
        });
      } else {
        await supabase
          .from('announcement_likes')
          .insert({ announcement_id: announcementId, user_id: user.id });
        
        setLikedPosts(prev => new Set(prev).add(announcementId));
      }

      // Refresh announcements to update counts
      fetchAnnouncements();
    } catch (error: any) {
      toast({
        title: 'Erro ao curtir',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const markAsViewed = async (announcementId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('announcement_views')
        .upsert(
          { announcement_id: announcementId, user_id: user.id },
          { onConflict: 'announcement_id,user_id' }
        );
    } catch (error) {
      console.error('Error marking as viewed:', error);
    }
  };

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
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Comunicados</h1>
          <p className="text-muted-foreground">
            Fique por dentro de todas as novidades da rede
          </p>
        </div>

        {announcements.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground text-center">
                Nenhum comunicado disponível no momento
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {announcements.map((announcement) => (
              <Card
                key={announcement.id}
                className="card-elevated"
                onClick={() => markAsViewed(announcement.id)}
              >
                <CardHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar>
                      <AvatarFallback className="gradient-primary text-white">
                        {announcement.profiles?.full_name?.charAt(0) || 'A'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold">
                        {announcement.profiles?.full_name || 'Administrador'}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDistanceToNow(new Date(announcement.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold">{announcement.title}</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground whitespace-pre-wrap mb-4">
                    {announcement.content}
                  </p>

                  {announcement.media_url && (
                    <div className="mb-4 rounded-lg overflow-hidden">
                      {announcement.media_type?.startsWith('image') ? (
                        <img
                          src={announcement.media_url}
                          alt={announcement.title}
                          className="w-full h-auto"
                        />
                      ) : announcement.media_type?.startsWith('video') ? (
                        <video
                          src={announcement.media_url}
                          controls
                          className="w-full"
                        />
                      ) : null}
                    </div>
                  )}

                  <div className="flex items-center gap-6 pt-4 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLike(announcement.id);
                      }}
                      className={likedPosts.has(announcement.id) ? 'text-red-500' : ''}
                    >
                      <Heart
                        className={`w-5 h-5 mr-2 ${
                          likedPosts.has(announcement.id) ? 'fill-current' : ''
                        }`}
                      />
                      {announcement.likes_count}
                    </Button>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Eye className="w-5 h-5" />
                      <span className="text-sm">{announcement.views_count}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
