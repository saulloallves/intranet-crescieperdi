import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, Trophy, Sparkles, Loader2 } from 'lucide-react';

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  feedback: string;
}

interface Quiz {
  questions: Question[];
  min_score: number;
  max_attempts?: number;
}

interface TrainingQuizProps {
  quiz: Quiz;
  moduleId: string;
  trainingId: string;
  onComplete: (score: number) => void;
  onCancel: () => void;
}

export function TrainingQuiz({ quiz, moduleId, trainingId, onComplete, onCancel }: TrainingQuizProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [loadingAiFeedback, setLoadingAiFeedback] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string>('');
  const [usedAiFeedback, setUsedAiFeedback] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Carregar número de tentativas
  useEffect(() => {
    loadAttemptCount();
  }, []);

  const loadAttemptCount = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('training_quiz_attempts' as any)
        .select('attempt_number')
        .eq('user_id', user.id)
        .eq('training_id', trainingId)
        .eq('module_id', moduleId)
        .order('attempt_number', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        setAttemptNumber((data[0] as any).attempt_number + 1);
      }
    } catch (error) {
      console.error('Error loading attempt count:', error);
    }
  };

  const question = quiz.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;

  const handleAnswerSelect = (value: string) => {
    setAnswers({ ...answers, [question.id]: value });
  };

  const handleNext = () => {
    setShowFeedback(true);
    setAiFeedback('');
  };

  const handleGetAiFeedback = async () => {
    if (!answers[question.id] || isCorrect) return;

    setLoadingAiFeedback(true);
    setUsedAiFeedback(true);

    try {
      const { data, error } = await supabase.functions.invoke('quiz-ai-feedback', {
        body: {
          question: question.question,
          userAnswer: answers[question.id],
          correctAnswer: question.correct_answer,
          context: question.feedback,
        }
      });

      if (error) throw error;

      if (data?.feedback) {
        setAiFeedback(data.feedback);
      } else if (data?.fallback) {
        setAiFeedback(data.fallback);
        toast({
          title: 'Aviso',
          description: data.error || 'Usando feedback padrão.',
          variant: 'default',
        });
      }
    } catch (error: any) {
      console.error('Error getting AI feedback:', error);
      setAiFeedback(question.feedback);
      toast({
        title: 'Erro ao buscar feedback da IA',
        description: 'Usando feedback padrão.',
        variant: 'destructive',
      });
    } finally {
      setLoadingAiFeedback(false);
    }
  };

  const handleContinue = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setShowFeedback(false);
    } else {
      calculateFinalScore();
    }
  };

  const calculateFinalScore = async () => {
    let correct = 0;
    quiz.questions.forEach((q) => {
      if (answers[q.id] === q.correct_answer) {
        correct++;
      }
    });
    const score = Math.round((correct / quiz.questions.length) * 100);
    setFinalScore(score);
    setQuizComplete(true);

    // Save quiz attempt
    if (user) {
      try {
        await supabase.from('training_quiz_attempts' as any).insert({
          user_id: user.id,
          training_id: trainingId,
          module_id: moduleId,
          attempt_number: attemptNumber,
          score,
          answers,
          passed: score >= quiz.min_score,
          feedback_used: usedAiFeedback,
        });
      } catch (error) {
        console.error('Error saving quiz attempt:', error);
      }
    }
  };

  const isCorrect = answers[question.id] === question.correct_answer;
  const passed = finalScore >= quiz.min_score;
  const maxAttempts = quiz.max_attempts || 3;
  const hasAttemptsLeft = attemptNumber < maxAttempts;

  if (quizComplete) {
    return (
      <Card className="fade-in">
        <CardHeader>
          <div className="flex flex-col items-center text-center space-y-4">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 scale-in ${
              passed ? 'bg-green-100 dark:bg-green-950/20' : 'bg-red-100 dark:bg-red-950/20'
            }`}>
              {passed ? (
                <Trophy className="w-10 h-10 text-green-600" />
              ) : (
                <XCircle className="w-10 h-10 text-red-600" />
              )}
            </div>
            <CardTitle>
              {passed ? '🎉 Parabéns!' : '📚 Quase lá!'}
            </CardTitle>
            <CardDescription className="text-lg">
              Sua pontuação: <span className="font-bold text-foreground">{finalScore}%</span>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>Tentativa {attemptNumber} de {maxAttempts}</span>
            {usedAiFeedback && (
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="w-3 h-3" />
                Feedback IA usado
              </Badge>
            )}
          </div>

          {passed ? (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-900">
                Você foi aprovado! Nota mínima: {quiz.min_score}%
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertDescription className="text-amber-900">
                Você precisa de pelo menos {quiz.min_score}% para ser aprovado.
                {hasAttemptsLeft ? (
                  <> Revise o conteúdo e tente novamente! Você tem {maxAttempts - attemptNumber} tentativa(s) restante(s).</>
                ) : (
                  <> Você atingiu o número máximo de tentativas. Entre em contato com seu gestor.</>
                )}
              </AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button onClick={onCancel} variant="outline" className="flex-1">
              Voltar
            </Button>
            {passed ? (
              <Button onClick={() => onComplete(finalScore)} className="flex-1">
                Continuar
              </Button>
            ) : hasAttemptsLeft ? (
              <Button onClick={() => window.location.reload()} className="flex-1">
                Tentar Novamente ({maxAttempts - attemptNumber} restantes)
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Questão {currentQuestion + 1} de {quiz.questions.length}
            </CardTitle>
            <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2 transition-all duration-300" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="fade-in">
          <h3 className="text-lg font-medium mb-4">{question.question}</h3>
          <RadioGroup
            value={answers[question.id]}
            onValueChange={handleAnswerSelect}
            disabled={showFeedback}
            className="space-y-3"
          >
            {question.options.map((option, index) => (
              <div
                key={index}
                className={`flex items-center space-x-2 p-4 rounded-lg border-2 transition-all duration-300 ${
                  showFeedback && option === question.correct_answer
                    ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                    : showFeedback && answers[question.id] === option && !isCorrect
                    ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                    : 'border-border hover:border-primary hover:bg-muted/50'
                }`}
              >
                <RadioGroupItem value={option} id={`option-${index}`} />
                <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                  {option}
                </Label>
                {showFeedback && option === question.correct_answer && (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                )}
              </div>
            ))}
          </RadioGroup>
        </div>

        {showFeedback && (
          <div className="space-y-3 fade-in">
            <Alert className={`${isCorrect ? 'bg-green-50 border-green-200 dark:bg-green-950/20' : 'bg-amber-50 border-amber-200 dark:bg-amber-950/20'} transition-all duration-300`}>
              <AlertDescription className={isCorrect ? 'text-green-900 dark:text-green-100' : 'text-amber-900 dark:text-amber-100'}>
                <strong>{isCorrect ? '✓ Correto!' : '✗ Resposta incorreta'}</strong>
                <p className="mt-1">{question.feedback}</p>
              </AlertDescription>
            </Alert>

            {!isCorrect && (
              <div className="space-y-2">
                {!aiFeedback && !loadingAiFeedback && (
                  <Button
                    onClick={handleGetAiFeedback}
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Pedir explicação do GiraBot
                  </Button>
                )}

                {loadingAiFeedback && (
                  <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>GiraBot está analisando sua resposta...</span>
                  </div>
                )}

                {aiFeedback && (
                  <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 fade-in">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <AlertDescription className="text-blue-900 dark:text-blue-100">
                      <strong>💡 GiraBot explica:</strong>
                      <p className="mt-1">{aiFeedback}</p>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={onCancel} variant="outline">
            Cancelar
          </Button>
          {showFeedback ? (
            <Button onClick={handleContinue} className="flex-1">
              {currentQuestion < quiz.questions.length - 1 ? 'Próxima' : 'Ver Resultado'}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!answers[question.id]}
              className="flex-1"
            >
              Responder
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}