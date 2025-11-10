import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Video, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import DOMPurify from 'dompurify';

interface MandatoryContent {
  id: string;
  title: string;
  type: 'video' | 'text';
  content_url: string | null;
  content_text: string | null;
  quiz_questions: any;
  target_audience: string;
}

interface Question {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}

export default function ConteudosObrigatorios() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [pendingContent, setPendingContent] = useState<MandatoryContent | null>(null);
  const [videoWatched, setVideoWatched] = useState(false);
  const [textScrolledToEnd, setTextScrolledToEnd] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResults, setQuizResults] = useState<{ correct: boolean; questionIndex: number }[]>([]);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (user && profile) {
      checkPendingContent();
    }
  }, [user, profile]);

  const checkPendingContent = async () => {
    try {
      // Buscar conteúdos ativos para o público-alvo do usuário
      const { data: contents, error: contentsError } = await supabase
        .from('mandatory_contents')
        .select('*')
        .eq('active', true)
        .or(`target_audience.eq.ambos,target_audience.eq.${profile?.role === 'franqueado' ? 'franqueados' : 'colaboradores'}`);

      if (contentsError) throw contentsError;

      // Verificar se já completou algum
      for (const content of contents || []) {
        const { data: signature } = await supabase
          .from('mandatory_content_signatures')
          .select('success')
          .eq('content_id', content.id)
          .eq('user_id', user!.id)
          .eq('success', true)
          .single();

        if (!signature) {
          // Encontrou um pendente
          setPendingContent(content as MandatoryContent);
          setLoading(false);
          return;
        }
      }

      // Nenhum pendente, liberar acesso
      setLoading(false);
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Erro ao verificar conteúdos:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível verificar conteúdos obrigatórios.',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  const handleVideoEnded = () => {
    console.log('[Video] Assistido até o fim');
    setVideoWatched(true);
  };

  const handleTextScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const scrolledToBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 10;
    if (scrolledToBottom && !textScrolledToEnd) {
      console.log('[Text] Rolado até o fim');
      setTextScrolledToEnd(true);
    }
  };

  const handleQuizSubmit = () => {
    if (!pendingContent?.quiz_questions?.questions) return;

    const questions: Question[] = pendingContent.quiz_questions.questions;
    const results = questions.map((q, index) => ({
      questionIndex: index,
      correct: quizAnswers[index] === q.correct_answer,
    }));

    setQuizResults(results);
    setQuizSubmitted(true);

    const allCorrect = results.every(r => r.correct);
    if (!allCorrect) {
      toast({
        title: 'Algumas respostas incorretas',
        description: 'Revise as explicações e tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleConfirmSignature = async () => {
    if (!pendingContent || !user) return;

    setConfirming(true);
    try {
      const ip = await fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => data.ip)
        .catch(() => 'unknown');

      const score = pendingContent.type === 'text' && quizResults.length > 0
        ? Math.round((quizResults.filter(r => r.correct).length / quizResults.length) * 100)
        : 100;

      const { error } = await supabase.from('mandatory_content_signatures').insert({
        content_id: pendingContent.id,
        user_id: user.id,
        score: score,
        confirmed: true,
        confirmation_text: `Confirmo que ${pendingContent.type === 'video' ? 'assisti integralmente' : 'li, entendi'} e estou ciente das informações acima.`,
        ip_address: ip,
        success: true,
      });

      if (error) throw error;

      toast({
        title: '✅ Confirmação registrada!',
        description: 'Sua ciência foi registrada. Você pode continuar usando o sistema.',
      });

      // Aguardar 2 segundos e redirecionar
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error: any) {
      console.error('Erro ao confirmar:', error);
      toast({
        title: 'Erro ao registrar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setConfirming(false);
    }
  };

  const canProceed = () => {
    if (pendingContent?.type === 'video') {
      return videoWatched;
    }
    if (pendingContent?.type === 'text') {
      return textScrolledToEnd && quizResults.every(r => r.correct);
    }
    return false;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!pendingContent) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header de aviso */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>🛑 Você possui um conteúdo obrigatório pendente.</strong>
            <br />
            É necessário {pendingContent.type === 'video' ? 'assistir' : 'ler'} e confirmar a ciência antes de continuar.
          </AlertDescription>
        </Alert>

        {/* Card do conteúdo */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              {pendingContent.type === 'video' ? (
                <Video className="w-6 h-6 text-primary" />
              ) : (
                <FileText className="w-6 h-6 text-primary" />
              )}
              <div className="flex-1">
                <CardTitle>{pendingContent.title}</CardTitle>
                <CardDescription>
                  Tipo: <Badge variant="outline">{pendingContent.type === 'video' ? 'Vídeo' : 'Texto'}</Badge>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Conteúdo: Vídeo */}
            {pendingContent.type === 'video' && pendingContent.content_url && (
              <div className="space-y-3">
                <video
                  src={pendingContent.content_url}
                  controls
                  controlsList="nodownload"
                  onEnded={handleVideoEnded}
                  className="w-full rounded-lg"
                />
                {videoWatched && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      ✅ Vídeo assistido até o final. Você pode prosseguir.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Conteúdo: Texto */}
            {pendingContent.type === 'text' && pendingContent.content_text && (
              <div className="space-y-4">
                <div
                  className="p-4 border rounded-lg max-h-96 overflow-y-auto bg-background"
                  onScroll={handleTextScroll}
                >
                  <div 
                    className="prose prose-sm max-w-none" 
                    dangerouslySetInnerHTML={{ 
                      __html: DOMPurify.sanitize(pendingContent.content_text, {
                        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote'],
                        ALLOWED_ATTR: []
                      }) 
                    }} 
                  />
                </div>

                {textScrolledToEnd && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      ✅ Você rolou até o fim do texto. Agora responda às perguntas abaixo.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Quiz */}
                {textScrolledToEnd && pendingContent.quiz_questions?.questions && (
                  <div className="space-y-6 mt-6">
                    <div className="border-t pt-6">
                      <h3 className="text-lg font-semibold mb-4">Avaliação de Compreensão</h3>
                      <p className="text-sm text-muted-foreground mb-6">
                        Responda corretamente todas as perguntas para prosseguir.
                      </p>

                      {pendingContent.quiz_questions.questions.map((q: Question, index: number) => (
                        <Card key={index} className="mb-4">
                          <CardHeader>
                            <CardTitle className="text-base">
                              {index + 1}. {q.question}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <RadioGroup
                              value={quizAnswers[index]}
                              onValueChange={(value) => setQuizAnswers({ ...quizAnswers, [index]: value })}
                              disabled={quizSubmitted}
                            >
                              {q.options.map((option, optIndex) => (
                                <div key={optIndex} className="flex items-center space-x-2 mb-2">
                                  <RadioGroupItem value={option} id={`q${index}-opt${optIndex}`} />
                                  <Label htmlFor={`q${index}-opt${optIndex}`} className="cursor-pointer">
                                    {option}
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>

                            {quizSubmitted && (
                              <Alert className={`mt-4 ${quizResults[index]?.correct ? 'border-green-500' : 'border-red-500'}`}>
                                <AlertDescription>
                                  {quizResults[index]?.correct ? (
                                    <span className="text-green-600 font-semibold">✅ Correto!</span>
                                  ) : (
                                    <span className="text-red-600 font-semibold">❌ Incorreto</span>
                                  )}
                                  <p className="mt-2 text-sm">{q.explanation}</p>
                                </AlertDescription>
                              </Alert>
                            )}
                          </CardContent>
                        </Card>
                      ))}

                      {!quizSubmitted && (
                        <Button
                          onClick={handleQuizSubmit}
                          disabled={Object.keys(quizAnswers).length !== pendingContent.quiz_questions.questions.length}
                          className="w-full"
                        >
                          Enviar Respostas
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Botão de confirmação */}
            {canProceed() && (
              <div className="border-t pt-6 space-y-4">
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription className="font-medium">
                    Ao clicar em "Confirmar Ciência", você declara que:
                    <ul className="list-disc pl-6 mt-2 space-y-1">
                      <li>{pendingContent.type === 'video' ? 'Assistiu integralmente o vídeo' : 'Leu e compreendeu o conteúdo'}</li>
                      <li>Está ciente das informações apresentadas</li>
                      <li>Concorda com os termos e procedimentos descritos</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={handleConfirmSignature}
                  disabled={confirming}
                  className="w-full"
                  size="lg"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Confirmar Ciência
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
