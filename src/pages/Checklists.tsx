import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ClipboardCheck, CheckCircle2, Clock } from 'lucide-react';
import { GiraBotContextualHelp } from '@/components/girabot/GiraBotContextualHelp';

interface Question {
  id: string;
  question: string;
  type: string;
}

interface Checklist {
  id: string;
  title: string;
  description: string;
  type: string;
  questions: Question[];
}

export default function Checklists() {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [responses, setResponses] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchChecklists();
  }, []);

  const fetchChecklists = async () => {
    try {
      const { data, error } = await supabase
        .from('checklists')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const mappedData = (data || []).map((item) => ({
        ...item,
        questions: (item.questions as unknown as Question[]) || [],
      }));
      
      setChecklists(mappedData);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar checklists',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = (checklistId: string, questionId: string, checked: boolean) => {
    setResponses((prev) => ({
      ...prev,
      [checklistId]: {
        ...prev[checklistId],
        [questionId]: checked,
      },
    }));
  };

  const handleSubmit = async (checklist: Checklist) => {
    if (!user) return;

    const checklistResponses = responses[checklist.id] || {};
    const allAnswered = checklist.questions.every(
      (q) => q.type === 'photo' || checklistResponses[q.id] !== undefined
    );

    if (!allAnswered) {
      toast({
        title: 'Checklist incompleto',
        description: 'Por favor, responda todas as perguntas',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.from('checklist_responses').insert({
        checklist_id: checklist.id,
        user_id: user.id,
        unit_code: profile?.unit_code,
        responses: checklistResponses,
        status: 'completed',
      });

      if (error) throw error;

      toast({
        title: 'Checklist enviado!',
        description: 'Suas respostas foram registradas',
      });

      // Clear responses for this checklist
      setResponses((prev) => {
        const newResponses = { ...prev };
        delete newResponses[checklist.id];
        return newResponses;
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar checklist',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      abertura: 'Abertura',
      fechamento: 'Fechamento',
      vitrine: 'Vitrine',
      limpeza: 'Limpeza',
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
          <h1 className="text-3xl font-bold mb-2">Checklists e Rotinas</h1>
          <p className="text-muted-foreground">
            Garanta a execução das rotinas diárias da loja
          </p>
        </div>

        {checklists.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ClipboardCheck className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                Nenhum checklist disponível no momento
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {checklists.map((checklist) => {
              const checklistResponses = responses[checklist.id] || {};
              const completedCount = Object.keys(checklistResponses).length;
              const totalCount = checklist.questions.filter((q) => q.type !== 'photo').length;

              return (
                <Card key={checklist.id} className="card-elevated">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge>{getTypeLabel(checklist.type)}</Badge>
                          <Badge variant="outline">
                            <Clock className="w-3 h-3 mr-1" />
                            Diário
                          </Badge>
                        </div>
                        <CardTitle>{checklist.title}</CardTitle>
                        <CardDescription>{checklist.description}</CardDescription>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                        <ClipboardCheck className="w-6 h-6 text-green-600" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 mb-6">
                      {checklist.questions.map((question) => (
                        <div key={question.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          {question.type === 'boolean' ? (
                            <>
                              <Checkbox
                                id={`${checklist.id}-${question.id}`}
                                checked={checklistResponses[question.id] || false}
                                onCheckedChange={(checked) =>
                                  handleCheckboxChange(checklist.id, question.id, checked as boolean)
                                }
                              />
                              <label
                                htmlFor={`${checklist.id}-${question.id}`}
                                className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {question.question}
                              </label>
                              <GiraBotContextualHelp
                                fieldName={question.question}
                                fieldType="checkbox"
                                module="checklist"
                                formData={{ checklist_title: checklist.title, checklist_type: checklist.type }}
                              />
                            </>
                          ) : (
                            <div className="flex-1 flex items-start gap-2">
                              <div className="flex-1">
                                <p className="text-sm font-medium mb-2">{question.question}</p>
                                <Button variant="outline" size="sm">
                                  📷 Tirar foto
                                </Button>
                              </div>
                              <GiraBotContextualHelp
                                fieldName={question.question}
                                fieldType="photo"
                                module="checklist"
                                formData={{ checklist_title: checklist.title, checklist_type: checklist.type }}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        {completedCount} de {totalCount} itens concluídos
                      </div>
                      <Button onClick={() => handleSubmit(checklist)}>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Enviar Checklist
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
