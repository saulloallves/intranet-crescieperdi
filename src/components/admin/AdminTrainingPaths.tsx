import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GraduationCap, Settings, ListChecks, BarChart3, Video, MessageSquare, Brain, Zap, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrainingPathManager } from './training-paths/TrainingPathManager';
import { QuizEditor } from './training-paths/QuizEditor';
import { VideoUploader } from './training-paths/VideoUploader';
import { ProgressDashboard } from './training-paths/ProgressDashboard';
import { TrainingFeedbackDashboard } from './training-paths/TrainingFeedbackDashboard';
import { BottlenecksAnalysis } from '../admin/BottlenecksAnalysis';
import { IntegrationsSettings } from '../admin/IntegrationsSettings';
import { ManagerDashboard } from '../admin/ManagerDashboard';

export function AdminTrainingPaths() {
  const [loading, setLoading] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkSetup();
  }, []);

  const checkSetup = async () => {
    try {
      // Check if tables exist by trying to query them
      const { error } = await supabase
        .from('training_paths' as any)
        .select('count')
        .limit(1);
      
      setSetupComplete(!error);
    } catch (error) {
      setSetupComplete(false);
    }
  };

  const setupDatabase = async () => {
    setLoading(true);
    try {
      // Execute the SQL to create tables
      const sql = `
-- Create training_paths table (Trilhas de Treinamento)
CREATE TABLE IF NOT EXISTS public.training_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  target_role TEXT NOT NULL,
  icon TEXT DEFAULT '🎓',
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  estimated_duration_hours INTEGER DEFAULT 40,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create training_path_items table
CREATE TABLE IF NOT EXISTS public.training_path_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id UUID REFERENCES public.training_paths(id) ON DELETE CASCADE,
  training_id UUID REFERENCES public.trainings(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  is_required BOOLEAN DEFAULT true,
  unlock_after UUID REFERENCES public.training_path_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(path_id, training_id)
);

-- Create user_training_paths table
CREATE TABLE IF NOT EXISTS public.user_training_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id UUID REFERENCES public.training_paths(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  progress_percentage INTEGER DEFAULT 0,
  current_item_id UUID REFERENCES public.training_path_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, path_id)
);

-- Enable RLS
ALTER TABLE public.training_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_path_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_training_paths ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view active training paths" ON public.training_paths;
CREATE POLICY "Users can view active training paths"
  ON public.training_paths FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage training paths" ON public.training_paths;
CREATE POLICY "Admins can manage training paths"
  ON public.training_paths FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Insert sample paths
INSERT INTO public.training_paths (name, description, target_role, icon, color, order_index, estimated_duration_hours)
VALUES
('Trilha de Avaliadora', 'Programa completo de capacitação para avaliadora', 'avaliadora', '👩‍⚕️', '#10b981', 1, 40),
('Trilha de Gerente', 'Desenvolvimento de habilidades gerenciais e liderança', 'gerente', '👔', '#3b82f6', 2, 60),
('Trilha de Social Mídia', 'Estratégias de marketing digital e gestão de redes sociais', 'social_midia', '📱', '#ec4899', 3, 30),
('Trilha de Operador de Caixa', 'Processos operacionais e atendimento ao cliente', 'operador_caixa', '💰', '#f59e0b', 4, 20),
('Trilha de Franqueado', 'Gestão completa da franquia Cresci e Perdi', 'franqueado', '🏢', '#8b5cf6', 5, 80),
('Trilha de Suporte', 'Atendimento técnico e suporte operacional', 'suporte', '🎧', '#06b6d4', 6, 35)
ON CONFLICT DO NOTHING;
      `;

      // Note: We can't execute raw SQL from the client
      // This needs to be done via Supabase Dashboard > SQL Editor
      // or via migration files

      toast({
        title: 'Instruções de Configuração',
        description: 'Por favor, execute o SQL fornecido no Supabase Dashboard > SQL Editor',
      });

      // Show SQL in console for easy copy-paste
      console.log('SQL para configurar Trilhas de Treinamento:');
      console.log(sql);

    } catch (error: any) {
      toast({
        title: 'Erro na configuração',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!setupComplete) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Trilhas de Treinamento
          </CardTitle>
          <CardDescription>
            Sistema de jornadas personalizadas por cargo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Settings className="h-4 w-4" />
            <AlertDescription>
              As tabelas de trilhas de treinamento ainda não foram configuradas.
              Execute o SQL abaixo no Supabase Dashboard {'>'} SQL Editor para configurar:
            </AlertDescription>
          </Alert>

          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm font-mono text-muted-foreground mb-2">
              Abra o console do navegador (F12) para copiar o SQL completo
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={setupDatabase} disabled={loading}>
              {loading ? 'Preparando...' : 'Ver SQL de Configuração'}
            </Button>
            <Button variant="outline" onClick={checkSetup}>
              Verificar Configuração
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="manager" className="w-full">
      <TabsList className="grid w-full grid-cols-8">
        <TabsTrigger value="manager" className="gap-1 text-xs sm:text-sm">
          <Users className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Gestor</span>
        </TabsTrigger>
        <TabsTrigger value="paths" className="gap-1 text-xs sm:text-sm">
          <ListChecks className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Trilhas</span>
        </TabsTrigger>
        <TabsTrigger value="quiz" className="gap-1 text-xs sm:text-sm">
          <GraduationCap className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Quiz</span>
        </TabsTrigger>
        <TabsTrigger value="videos" className="gap-1 text-xs sm:text-sm">
          <Video className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Vídeos</span>
        </TabsTrigger>
        <TabsTrigger value="dashboard" className="gap-1 text-xs sm:text-sm">
          <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </TabsTrigger>
        <TabsTrigger value="feedback" className="gap-1 text-xs sm:text-sm">
          <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Feedback</span>
        </TabsTrigger>
        <TabsTrigger value="intelligence" className="gap-1 text-xs sm:text-sm">
          <Brain className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">IA</span>
        </TabsTrigger>
        <TabsTrigger value="integrations" className="gap-1 text-xs sm:text-sm">
          <Zap className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Config</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="manager" className="mt-6">
        <ManagerDashboard />
      </TabsContent>

      <TabsContent value="paths" className="mt-6">
        <TrainingPathManager />
      </TabsContent>

      <TabsContent value="quiz" className="mt-6">
        <QuizEditor
          onSave={(questions, minScore, maxAttempts) => {
            console.log('Quiz saved:', { questions, minScore, maxAttempts });
          }}
        />
      </TabsContent>

      <TabsContent value="videos" className="mt-6">
        <VideoUploader
          onVideoUploaded={(url) => {
            console.log('Video uploaded:', url);
          }}
        />
      </TabsContent>

      <TabsContent value="dashboard" className="mt-6">
        <ProgressDashboard />
      </TabsContent>

      <TabsContent value="feedback" className="mt-6">
        <TrainingFeedbackDashboard />
      </TabsContent>

      <TabsContent value="intelligence" className="mt-6">
        <BottlenecksAnalysis />
      </TabsContent>

      <TabsContent value="integrations" className="mt-6">
        <IntegrationsSettings />
      </TabsContent>
    </Tabs>
  );
}
