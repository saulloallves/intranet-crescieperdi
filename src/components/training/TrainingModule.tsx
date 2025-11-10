import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, FileText, Play, Lock, Award, Brain, Loader2 } from 'lucide-react';
import { TrainingQuiz } from './TrainingQuiz';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Module {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'pdf' | 'quiz' | 'task';
  content_url?: string;
  duration_minutes?: number;
  quiz?: {
    questions: Array<{
      id: string;
      question: string;
      options: string[];
      correct_answer: string;
      feedback: string;
    }>;
    min_score: number;
  };
}

interface TrainingModuleProps {
  module: Module;
  index: number;
  isUnlocked: boolean;
  isCompleted: boolean;
  onComplete: (moduleId: string, score?: number) => void;
  trainingId: string;
}

export function TrainingModule({ 
  module, 
  index, 
  isUnlocked, 
  isCompleted,
  onComplete,
  trainingId 
}: TrainingModuleProps) {
  const [showContent, setShowContent] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showGiraBotHelp, setShowGiraBotHelp] = useState(false);
  const [giraBotHelp, setGiraBotHelp] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGetHelp = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('girabot-universal', {
        body: {
          message: `Explique este módulo de treinamento: "${module.title}". ${module.description}. Forneça dicas de estudo e conceitos importantes.`,
          module: 'training',
          context: {
            module_id: module.id,
            module_type: module.type,
            training_id: trainingId
          }
        }
      });

      if (error) throw error;
      
      setGiraBotHelp(data.response || 'Ajuda não disponível.');
      setShowGiraBotHelp(true);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível obter ajuda do GiraBot.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartModule = () => {
    if (module.type === 'quiz') {
      setShowQuiz(true);
    } else {
      setShowContent(true);
    }
  };

  const handleQuizComplete = (score: number) => {
    onComplete(module.id, score);
    setShowQuiz(false);
  };

  const getModuleIcon = () => {
    switch (module.type) {
      case 'video':
        return <Play className="w-5 h-5" />;
      case 'pdf':
        return <FileText className="w-5 h-5" />;
      case 'quiz':
        return <Award className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  if (showQuiz && module.quiz) {
    return (
      <TrainingQuiz
        quiz={module.quiz}
        moduleId={module.id}
        trainingId={trainingId}
        onComplete={handleQuizComplete}
        onCancel={() => setShowQuiz(false)}
      />
    );
  }

  if (showContent && module.content_url) {
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getModuleIcon()}
            {module.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {module.type === 'video' && (
            <div className="aspect-video rounded-lg overflow-hidden bg-muted">
              {module.content_url.includes('youtube.com') || module.content_url.includes('youtu.be') ? (
                <iframe
                  src={module.content_url.replace('watch?v=', 'embed/')}
                  className="w-full h-full"
                  allowFullScreen
                />
              ) : (
                <video
                  src={module.content_url}
                  controls
                  className="w-full h-full"
                />
              )}
            </div>
          )}
          {module.type === 'pdf' && (
            <div className="flex flex-col items-center gap-4">
              <FileText className="w-12 h-12 text-primary" />
              <a
                href={module.content_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Abrir documento
              </a>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={() => setShowContent(false)} variant="outline">
              Voltar
            </Button>
            <Button onClick={() => onComplete(module.id)} className="flex-1">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Marcar como Concluído
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`mb-4 ${!isUnlocked ? 'opacity-60' : ''}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center p-0">
                {index + 1}
              </Badge>
              {isCompleted && (
                <Badge className="bg-green-500">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Concluído
                </Badge>
              )}
              {!isUnlocked && (
                <Badge variant="secondary">
                  <Lock className="w-3 h-3 mr-1" />
                  Bloqueado
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg mb-1">{module.title}</CardTitle>
            <CardDescription>{module.description}</CardDescription>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
            {getModuleIcon()}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {showGiraBotHelp && (
          <div className="mb-4 p-4 bg-secondary/10 rounded-lg border border-secondary/20">
            <div className="flex items-start gap-2 mb-2">
              <Brain className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-secondary">GiraBot explica:</p>
            </div>
            <p className="text-sm whitespace-pre-wrap">{giraBotHelp}</p>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          {module.duration_minutes && (
            <span className="text-sm text-muted-foreground">
              {module.duration_minutes} minutos
            </span>
          )}
          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGetHelp}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Ajuda IA
                </>
              )}
            </Button>
            <Button
              onClick={handleStartModule}
              disabled={!isUnlocked || isCompleted}
            >
              {isCompleted ? 'Concluído' : 'Iniciar'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}