import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { GraduationCap, Clock, Play, CheckCircle2, Trophy, Award, BookOpen, Bot } from 'lucide-react';
import { TrainingModule } from '@/components/training/TrainingModule';
import { GiraBotTutor } from '@/components/training/GiraBotTutor';

interface Module {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'pdf' | 'quiz' | 'task';
  content_url?: string;
  duration_minutes?: number;
  quiz?: any;
}

interface Training {
  id: string;
  title: string;
  description: string;
  category: string;
  duration_minutes: number;
  modules?: Module[];
  certificate_enabled?: boolean;
  min_score?: number;
  progress?: {
    completed: boolean;
    progress_percentage: number;
    score: number;
    current_module: number;
    modules_completed: string[];
  };
}

export default function Treinamentos() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [filteredTrainings, setFilteredTrainings] = useState<Training[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string>('colaborador');
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [showGiraBot, setShowGiraBot] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchTrainings();
    fetchCategories();
  }, []);

  useEffect(() => {
    filterTrainingsByRole();
  }, [selectedRole, trainings]);

  const filterTrainingsByRole = () => {
    const filtered = trainings.filter((training: any) => {
      if (!training.target_roles || training.target_roles.length === 0) {
        return true; // Mostrar treinamentos sem restrição de cargo
      }
      return training.target_roles.includes(selectedRole);
    });
    setFilteredTrainings(filtered);
  };

  const fetchTrainings = async () => {
    try {
      const { data: trainingsData, error } = await supabase
        .from('trainings')
        .select('*')
        .eq('is_published', true)
        .order('order_index', { ascending: true });

      if (error) throw error;

      // Fetch user progress
      if (user) {
        const { data: progressData } = await supabase
          .from('training_progress')
          .select('*')
          .eq('user_id', user.id);

        const trainingsWithProgress = (trainingsData || []).map((training: any) => {
          const progress = progressData?.find((p) => p.training_id === training.id);
          return {
            ...training,
            modules: (training.modules as Module[]) || [],
            progress: progress ? {
              completed: progress.completed,
              progress_percentage: progress.progress_percentage,
              score: progress.score || 0,
              current_module: progress.current_module || 0,
              modules_completed: (progress.modules_completed as string[]) || [],
            } : undefined,
          };
        });

        setTrainings(trainingsWithProgress);
      } else {
        setTrainings((trainingsData || []).map((t: any) => ({
          ...t,
          modules: (t.modules as Module[]) || [],
        })));
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar treinamentos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('training_categories')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
    }
  };

  const getCategoryInfo = (slug: string) => {
    return categories.find(cat => cat.slug === slug);
  };

  const handleStartTraining = (training: Training) => {
    setSelectedTraining(training);
  };

  const handleModuleComplete = async (moduleId: string, score?: number) => {
    if (!user || !selectedTraining) return;

    try {
      const currentProgress = selectedTraining.progress || {
        modules_completed: [],
        score: 0,
        current_module: 0,
      };

      const modulesCompleted = [...(currentProgress.modules_completed || []), moduleId];
      const totalModules = selectedTraining.modules?.length || 1;
      const progressPercentage = Math.round((modulesCompleted.length / totalModules) * 100);
      const isCompleted = progressPercentage === 100;

      const { error } = await supabase
        .from('training_progress')
        .upsert({
          training_id: selectedTraining.id,
          user_id: user.id,
          progress_percentage: progressPercentage,
          modules_completed: modulesCompleted,
          score: score || currentProgress.score,
          completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
        });

      if (error) throw error;

      // Generate certificate if training is completed and certificate is enabled
      if (isCompleted && selectedTraining.certificate_enabled) {
        const certificateCode = `CP-${Date.now()}-${user.id.substring(0, 8)}`;
        await supabase.from('training_certificates').insert({
          user_id: user.id,
          training_id: selectedTraining.id,
          certificate_code: certificateCode,
        });

        toast({
          title: '🎉 Parabéns!',
          description: 'Você concluiu o treinamento e ganhou um certificado!',
        });
      }

      fetchTrainings();
      setSelectedTraining(null);
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar progresso',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const completedCount = filteredTrainings.filter((t) => t.progress?.completed).length;
  const totalCount = filteredTrainings.length;
  const overallProgress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  // Show training modules view
  if (selectedTraining) {
    const modules = selectedTraining.modules || [];
    const completedModules = selectedTraining.progress?.modules_completed || [];
    
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <Button onClick={() => setSelectedTraining(null)} variant="outline" className="mb-6">
            ← Voltar para Treinamentos
          </Button>
          
          <Card className="mb-6 gradient-primary text-white">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                  <BookOpen className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold mb-1">{selectedTraining.title}</h1>
                  <p className="text-white/90">{selectedTraining.description}</p>
                </div>
              </div>
              <Progress 
                value={selectedTraining.progress?.progress_percentage || 0} 
                className="h-2 bg-white/20" 
              />
              <p className="text-sm text-white/90 mt-2">
                {completedModules.length} de {modules.length} módulos concluídos
              </p>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {modules.map((module, index) => (
              <TrainingModule
                key={module.id}
                module={module}
                index={index}
                isUnlocked={index === 0 || completedModules.includes(modules[index - 1]?.id)}
                isCompleted={completedModules.includes(module.id)}
                onComplete={handleModuleComplete}
                trainingId={selectedTraining.id}
              />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Universidade Cresci e Perdi</h1>
          <p className="text-muted-foreground">
            Desenvolva suas habilidades com nossos cursos
          </p>
        </div>

        <Tabs defaultValue="trainings" className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="trainings">
              <GraduationCap className="w-4 h-4 mr-2" />
              Meus Treinamentos
            </TabsTrigger>
            <TabsTrigger value="certificates">
              <Award className="w-4 h-4 mr-2" />
              Certificados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trainings" className="space-y-6">
            {/* ... keep existing code ... */}

        {/* Role Filter */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label htmlFor="role-filter">Cargo/Função *</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger id="role-filter">
                  <SelectValue placeholder="Selecione um cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="franqueado">Franqueado</SelectItem>
                  <SelectItem value="gestor_setor">Gestor de Setor</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Progress Overview */}
        <Card className="mb-8 gradient-primary text-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                <Trophy className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-1">Seu Progresso</h3>
                <p className="text-white/90 text-sm">
                  {completedCount} de {totalCount} treinamentos concluídos
                </p>
              </div>
            </div>
            <Progress value={overallProgress} className="h-2 bg-white/20" />
          </CardContent>
        </Card>

        {/* Trainings List */}
        <div className="space-y-4">
          {filteredTrainings.map((training) => (
            <Card key={training.id} className="card-elevated">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {(() => {
                        const categoryInfo = getCategoryInfo(training.category);
                        return categoryInfo ? (
                          <Badge 
                            variant="outline"
                            style={{
                              backgroundColor: `${categoryInfo.color}20`,
                              borderColor: categoryInfo.color,
                              color: categoryInfo.color,
                            }}
                          >
                            {categoryInfo.name}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{training.category}</Badge>
                        );
                      })()}
                      {training.progress?.completed && (
                        <Badge className="bg-green-500">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Concluído
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="mb-2">{training.title}</CardTitle>
                    <CardDescription>{training.description}</CardDescription>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {training.duration_minutes} min
                    </div>
                  </div>
                  <Button
                    onClick={() => handleStartTraining(training)}
                    disabled={training.progress?.completed}
                  >
                    {training.progress?.completed ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Concluído
                      </>
                    ) : training.progress ? (
                      'Continuar'
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Iniciar
                      </>
                    )}
                  </Button>
                </div>
                {training.progress && !training.progress.completed && (
                  <div className="mt-4">
                    <Progress value={training.progress.progress_percentage} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {training.progress.progress_percentage}% concluído
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

            {filteredTrainings.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <GraduationCap className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    Nenhum treinamento disponível para este cargo no momento
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="certificates">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Trophy className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center mb-2">
                  Seus certificados aparecerão aqui
                </p>
                <p className="text-sm text-muted-foreground text-center">
                  Complete as trilhas de treinamento para receber seus certificados
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* GiraBot Floating Button */}
      {!showGiraBot && (
        <Button
          onClick={() => setShowGiraBot(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
          size="icon"
        >
          <Bot className="h-6 w-6" />
        </Button>
      )}

      {/* GiraBot Chat Window */}
      {showGiraBot && (
        <div className="fixed bottom-6 right-6 w-[400px] shadow-2xl z-50">
          <GiraBotTutor
            trainingId={selectedTraining?.id}
            context={selectedTraining ? `Treinamento: ${selectedTraining.title}` : undefined}
            onClose={() => setShowGiraBot(false)}
          />
        </div>
      )}
    </AppLayout>
  );
}
