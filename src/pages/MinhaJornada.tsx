import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  GraduationCap, 
  CheckCircle2, 
  Lock, 
  Play, 
  Clock, 
  Trophy,
  BookOpen,
  Target
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TrainingPath {
  id: string;
  name: string;
  description: string;
  target_role: string;
  icon: string;
  color: string;
  estimated_duration_hours: number;
  progress?: {
    progress_percentage: number;
    current_item_id: string | null;
    completed_at: string | null;
  };
  items?: PathItem[];
}

interface PathItem {
  id: string;
  training_id: string;
  order_index: number;
  is_required: boolean;
  unlock_after: string | null;
  training: {
    id: string;
    title: string;
    description: string;
    duration_minutes: number;
    category: string;
  };
}

export default function MinhaJornada() {
  const [paths, setPaths] = useState<TrainingPath[]>([]);
  const [selectedPath, setSelectedPath] = useState<TrainingPath | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchMyPaths();
  }, [profile]);

  const fetchMyPaths = async () => {
    if (!user || !profile) return;

    try {
      // Map profile role to training path target roles
      const roleMap: Record<string, string[]> = {
        'colaborador': ['avaliadora', 'operador_caixa', 'social_midia'],
        'gerente': ['gerente'],
        'franqueado': ['franqueado'],
        'gestor_setor': ['gerente', 'suporte'],
        'admin': ['gerente', 'franqueado', 'suporte'],
      };

      const targetRoles = roleMap[profile.role] || ['avaliadora'];

      // Fetch paths for user's role
      const { data: pathsData, error: pathsError } = await supabase
        .from('training_paths' as any)
        .select('*')
        .in('target_role', targetRoles)
        .eq('is_active', true)
        .order('order_index');

      if (pathsError) throw pathsError;

      // Fetch user progress for each path
      const pathsWithProgress = await Promise.all(
        (pathsData || []).map(async (path: any) => {
          const { data: progressData } = await supabase
            .from('user_training_paths' as any)
            .select('*')
            .eq('user_id', user.id)
            .eq('path_id', path.id)
            .maybeSingle();

          return {
            ...path,
            progress: progressData || undefined,
          };
        })
      );

      setPaths(pathsWithProgress as any);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar trilhas',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPathDetails = async (pathId: string) => {
    try {
      // Fetch path items with training details
      const { data: itemsData, error: itemsError } = await supabase
        .from('training_path_items' as any)
        .select(`
          *,
          training:trainings (
            id,
            title,
            description,
            duration_minutes,
            category
          )
        `)
        .eq('path_id', pathId)
        .order('order_index');

      if (itemsError) throw itemsError;

      // Fetch user's training progress
      const trainingIds = ((itemsData as any[]) || []).map((item: any) => item.training?.id).filter(Boolean);
      const { data: progressData } = await supabase
        .from('training_progress')
        .select('training_id, completed')
        .eq('user_id', user!.id)
        .in('training_id', trainingIds);

      const completedIds = new Set(
        progressData?.filter(p => p.completed).map(p => p.training_id) || []
      );

      // Check if each item is unlocked
      const itemsWithStatus = ((itemsData as any[]) || []).map((item: any, index: number) => {
        const training = item.training || {};
        const isCompleted = completedIds.has(training.id);
        
        // First item is always unlocked, or if no unlock_after is set
        let isUnlocked = index === 0 || !item.unlock_after;
        
        // If has unlock_after, check if that item is completed
        if (item.unlock_after) {
          const previousItem = ((itemsData as any[]) || []).find((i: any) => i.id === item.unlock_after);
          if (previousItem && previousItem.training) {
            isUnlocked = completedIds.has(previousItem.training.id);
          }
        }

        return {
          ...item,
          training,
          isCompleted,
          isUnlocked,
        };
      });

      const path = paths.find(p => p.id === pathId);
      if (path) {
        setSelectedPath({
          ...path,
          items: itemsWithStatus,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar detalhes',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleStartPath = async (path: TrainingPath) => {
    if (!path.progress) {
      // Create progress record
      try {
        const { error } = await supabase
          .from('user_training_paths' as any)
          .insert({
            user_id: user!.id,
            path_id: path.id,
            progress_percentage: 0,
          });

        if (error) throw error;
      } catch (error: any) {
        toast({
          title: 'Erro ao iniciar trilha',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }
    }

    await fetchPathDetails(path.id);
  };

  const handleStartTraining = (trainingId: string) => {
    navigate(`/treinamentos?training=${trainingId}`);
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

  // Path details view
  if (selectedPath && selectedPath.items) {
    const completedCount = selectedPath.items.filter((item: any) => item.isCompleted).length;
    const totalCount = selectedPath.items.length;
    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return (
      <AppLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl pb-nav-safe">
          <Button onClick={() => setSelectedPath(null)} variant="outline" className="mb-4 sm:mb-6">
            ← Voltar para Minhas Trilhas
          </Button>

          {/* Path Header */}
          <Card className="mb-4 sm:mb-6 fade-in" style={{ background: `linear-gradient(135deg, ${selectedPath.color}20, ${selectedPath.color}10)` }}>
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-3xl sm:text-4xl transition-transform hover:scale-110" style={{ backgroundColor: `${selectedPath.color}30` }}>
                  {selectedPath.icon}
                </div>
                <div className="flex-1">
                  <h1 className="text-xl sm:text-2xl font-bold mb-1">{selectedPath.name}</h1>
                  <p className="text-sm sm:text-base text-muted-foreground">{selectedPath.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>{selectedPath.estimated_duration_hours}h estimadas</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Target className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>{completedCount}/{totalCount} módulos</span>
                </div>
              </div>
              <Progress value={progress} className="h-2 transition-all duration-500" />
              <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                {progress}% concluído
              </p>
            </CardContent>
          </Card>

          {/* Training Modules */}
          <div className="space-y-4">
            {selectedPath.items.map((item: any, index: number) => (
              <Card 
                key={item.id} 
                className={`transition-all duration-300 slide-up ${!item.isUnlocked ? 'opacity-60' : 'hover:shadow-md hover-scale'}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader>
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex-1 w-full">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge variant="outline" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center p-0 text-xs sm:text-sm">
                          {index + 1}
                        </Badge>
                        {item.isCompleted && (
                          <Badge className="bg-green-500 text-xs sm:text-sm">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Concluído
                          </Badge>
                        )}
                        {!item.isUnlocked && (
                          <Badge variant="secondary" className="text-xs sm:text-sm">
                            <Lock className="w-3 h-3 mr-1" />
                            Bloqueado
                          </Badge>
                        )}
                        {item.is_required && (
                          <Badge variant="outline" className="text-xs sm:text-sm">Obrigatório</Badge>
                        )}
                      </div>
                      <CardTitle className="text-base sm:text-lg mb-1">{item.training.title}</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">{item.training.description}</CardDescription>
                    </div>
                    <div 
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300"
                      style={{ 
                        backgroundColor: item.isCompleted ? '#10b98120' : `${selectedPath.color}20`,
                        color: item.isCompleted ? '#10b981' : selectedPath.color
                      }}
                    >
                      {item.isCompleted ? (
                        <CheckCircle2 className="w-6 h-6" />
                      ) : (
                        <BookOpen className="w-6 h-6" />
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                      <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                      {item.training.duration_minutes} minutos
                    </div>
                    <Button
                      onClick={() => handleStartTraining(item.training.id)}
                      disabled={!item.isUnlocked}
                      className="w-full sm:w-auto transition-all duration-200"
                      style={{ 
                        backgroundColor: item.isUnlocked && !item.isCompleted ? selectedPath.color : undefined 
                      }}
                      size="sm"
                    >
                      {item.isCompleted ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Revisar
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Iniciar
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  // Paths list view
  return (
    <AppLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl pb-nav-safe">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Minha Jornada de Aprendizado</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Trilhas personalizadas para o seu desenvolvimento profissional
          </p>
        </div>

        {/* Overview */}
        <Card className="mb-6 sm:mb-8 gradient-primary text-white fade-in">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/20 flex items-center justify-center">
                <Trophy className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg sm:text-xl font-bold mb-1">Seu Progresso Geral</h3>
                <p className="text-white/90 text-xs sm:text-sm">
                  {paths.filter(p => p.progress?.completed_at).length} de {paths.length} trilhas concluídas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Paths List */}
        <div className="space-y-4">
          {paths.map((path, idx) => {
            const isStarted = !!path.progress;
            const isCompleted = !!path.progress?.completed_at;
            const progress = path.progress?.progress_percentage || 0;

            return (
              <Card 
                key={path.id} 
                className="card-elevated hover-scale slide-up"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {isCompleted && (
                          <Badge className="bg-green-500">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Concluída
                          </Badge>
                        )}
                        {isStarted && !isCompleted && (
                          <Badge style={{ backgroundColor: path.color }}>
                            Em andamento
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl">{path.icon}</span>
                        <CardTitle className="text-xl">{path.name}</CardTitle>
                      </div>
                      <CardDescription>{path.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {path.estimated_duration_hours}h
                      </div>
                      <div className="flex items-center gap-1">
                        <GraduationCap className="w-4 h-4" />
                        Certificado incluído
                      </div>
                    </div>

                     {isStarted && !isCompleted && (
                      <div className="transition-all duration-300">
                        <Progress value={progress} className="h-2 mb-2" />
                        <p className="text-xs text-muted-foreground">
                          {progress}% concluído
                        </p>
                      </div>
                    )}

                    <Button
                      onClick={() => handleStartPath(path)}
                      className="w-full transition-all duration-200"
                      style={{ backgroundColor: !isCompleted ? path.color : undefined }}
                      variant={isCompleted ? 'outline' : 'default'}
                    >
                      {isCompleted ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Revisar Trilha
                        </>
                      ) : isStarted ? (
                        'Continuar Trilha'
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Iniciar Trilha
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {paths.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <GraduationCap className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                Nenhuma trilha disponível para o seu perfil no momento
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
