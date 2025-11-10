import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Award, Heart, Trophy, Star, Medal } from 'lucide-react';

interface Recognition {
  id: string;
  title: string;
  description: string;
  type: string;
  month: string | null;
  year: number | null;
  likes_count: number;
  profiles: {
    full_name: string;
  } | null;
}

export default function Reconhecimento() {
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [likedRecognitions, setLikedRecognitions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchRecognitions();
    fetchUserLikes();
  }, []);

  const fetchRecognitions = async () => {
    try {
      const { data, error } = await supabase
        .from('recognitions')
        .select(`
          *,
          profiles!recognitions_user_id_fkey (full_name)
        `)
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const mappedData = (data || []).map((item) => ({
        ...item,
        profiles: item.profiles as { full_name: string } | null,
      }));
      
      setRecognitions(mappedData);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar reconhecimentos',
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
        .from('recognition_likes')
        .select('recognition_id')
        .eq('user_id', user.id);

      if (data) {
        setLikedRecognitions(new Set(data.map((like) => like.recognition_id)));
      }
    } catch (error) {
      console.error('Error fetching likes:', error);
    }
  };

  const handleLike = async (recognitionId: string) => {
    if (!user) return;

    const isLiked = likedRecognitions.has(recognitionId);

    try {
      if (isLiked) {
        await supabase
          .from('recognition_likes')
          .delete()
          .eq('recognition_id', recognitionId)
          .eq('user_id', user.id);

        setLikedRecognitions((prev) => {
          const newSet = new Set(prev);
          newSet.delete(recognitionId);
          return newSet;
        });
      } else {
        await supabase
          .from('recognition_likes')
          .insert({ recognition_id: recognitionId, user_id: user.id });

        setLikedRecognitions((prev) => new Set(prev).add(recognitionId));
      }

      fetchRecognitions();
    } catch (error: any) {
      toast({
        title: 'Erro ao curtir',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'destaque_mes':
        return <Star className="w-6 h-6" />;
      case 'meta_batida':
        return <Trophy className="w-6 h-6" />;
      case 'melhor_avaliacao':
        return <Medal className="w-6 h-6" />;
      default:
        return <Award className="w-6 h-6" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      destaque_mes: 'Destaque do Mês',
      meta_batida: 'Meta Batida',
      melhor_avaliacao: 'Melhor Avaliação',
      reconhecimento_geral: 'Reconhecimento',
    };
    return types[type] || type;
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
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Reconhecimento e Cultura</h1>
          <p className="text-muted-foreground">
            Celebre as conquistas da nossa equipe
          </p>
        </div>

        {/* Hero Card */}
        <Card className="mb-8 gradient-primary text-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                <Trophy className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">Cultura de Reconhecimento</h3>
                <p className="text-white/90 text-sm">
                  Valorize e inspire com reconhecimentos públicos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recognitions List */}
        {recognitions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Award className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                Nenhum reconhecimento publicado ainda
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {recognitions.map((recognition) => (
              <Card key={recognition.id} className="card-elevated">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center flex-shrink-0 text-white">
                      {getTypeIcon(recognition.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-yellow-500">
                          {getTypeLabel(recognition.type)}
                        </Badge>
                        {recognition.month && recognition.year && (
                          <Badge variant="outline">
                            {recognition.month}/{recognition.year}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="mb-2">{recognition.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="gradient-secondary text-white">
                        {recognition.profiles?.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{recognition.profiles?.full_name}</p>
                      <p className="text-xs text-muted-foreground">Reconhecido</p>
                    </div>
                  </div>
                  <p className="text-foreground mb-4">{recognition.description}</p>
                  <div className="flex items-center gap-4 pt-4 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLike(recognition.id)}
                      className={likedRecognitions.has(recognition.id) ? 'text-red-500' : ''}
                    >
                      <Heart
                        className={`w-5 h-5 mr-2 ${
                          likedRecognitions.has(recognition.id) ? 'fill-current' : ''
                        }`}
                      />
                      {recognition.likes_count}
                    </Button>
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
