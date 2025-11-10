import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, BarChart3, Heart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";

interface Survey {
  id: string;
  title: string;
  description: string;
  target_audience: string;
  questions: any[];
  show_results: boolean;
  anonymous?: boolean;
  audience_units?: string[];
}

export default function Pesquisas() {
  const { profile } = useAuth();
  const [selectedSurvey, setSelectedSurvey] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: surveys, isLoading } = useQuery({
    queryKey: ["surveys", profile?.role, profile?.unit_code],
    queryFn: async () => {
      let query = supabase
        .from("surveys")
        .select("*")
        .eq("is_active", true)
        .or(`target_audience.eq.${profile?.role},target_audience.eq.ambos`)
        .order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      
      // Filtrar por unidade se aplicável
      return (data as Survey[]).filter((survey) => {
        if (!survey.audience_units || survey.audience_units.length === 0) return true;
        return survey.audience_units.includes(profile?.unit_code || "");
      });
    },
  });

  const { data: myResponses } = useQuery({
    queryKey: ["my-survey-responses"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("survey_responses")
        .select("survey_id")
        .eq("user_id", user.id);

      if (error) throw error;
      return data.map((r) => r.survey_id);
    },
  });

  const { data: surveyStats } = useQuery({
    queryKey: ["survey-stats", selectedSurvey],
    queryFn: async () => {
      if (!selectedSurvey) return null;

      const { data, error } = await supabase
        .from("survey_responses")
        .select("answers")
        .eq("survey_id", selectedSurvey);

      if (error) throw error;
      return data;
    },
    enabled: !!selectedSurvey,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const survey = surveys?.find(s => s.id === selectedSurvey);

      const { error } = await supabase.from("survey_responses").insert({
        survey_id: selectedSurvey,
        user_id: survey?.anonymous ? null : user.id,
        unit_code: profile?.unit_code,
        answers,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-survey-responses"] });
      queryClient.invalidateQueries({ queryKey: ["survey-stats"] });
      toast({ 
        title: "Obrigado por participar! 💛",
        description: "Sua voz ajuda a Cresci e Perdi a evoluir.",
      });
      setSelectedSurvey(null);
      setAnswers({});
    },
    onError: () => {
      toast({ title: "Erro ao enviar resposta", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    const survey = surveys?.find((s) => s.id === selectedSurvey);
    if (!survey) return;

    if (Object.keys(answers).length !== survey.questions.length) {
      toast({ title: "Responda todas as perguntas", variant: "destructive" });
      return;
    }

    submitMutation.mutate();
  };

  const getResultStats = (questionIndex: number) => {
    if (!surveyStats || !selectedSurvey) return null;

    const survey = surveys?.find((s) => s.id === selectedSurvey);
    if (!survey) return null;

    const question = survey.questions[questionIndex];
    const counts: Record<string, number> = {};
    let total = 0;

    surveyStats.forEach((response: any) => {
      const answer = response.answers[questionIndex];
      if (answer) {
        counts[answer] = (counts[answer] || 0) + 1;
        total++;
      }
    });

    if (question.type === "scale") {
      const sum = Object.entries(counts).reduce((acc, [key, value]) => acc + Number(key) * value, 0);
      const average = total > 0 ? (sum / total).toFixed(1) : "0.0";
      return { average, total, distribution: counts };
    }

    return { total, distribution: counts };
  };

  const currentSurvey = surveys?.find((s) => s.id === selectedSurvey);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto py-6">Carregando...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            📊 Termômetro & Pesquisas
          </h1>
          <p className="text-muted-foreground">Sua opinião é importante! Ajude-nos a construir um ambiente melhor</p>
        </div>

        {!selectedSurvey ? (
          <div className="grid gap-4">
            {surveys?.map((survey) => {
              const hasResponded = myResponses?.includes(survey.id);

              return (
                <Card key={survey.id} className={hasResponded ? "opacity-60" : ""}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {survey.title}
                          {hasResponded && (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Respondida
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>{survey.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setSelectedSurvey(survey.id)}
                        disabled={hasResponded}
                      >
                        {hasResponded ? "Já Respondida" : "Responder Pesquisa"}
                      </Button>
                      {survey.show_results && (
                        <Button
                          variant="outline"
                          onClick={() => setSelectedSurvey(survey.id)}
                        >
                          <BarChart3 className="mr-2 h-4 w-4" />
                          Ver Resultados
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {surveys?.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  Nenhuma pesquisa disponível no momento
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{currentSurvey?.title}</CardTitle>
              <CardDescription>{currentSurvey?.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {currentSurvey?.questions.map((question: any, idx: number) => {
                const stats = getResultStats(idx);
                const hasResponded = myResponses?.includes(selectedSurvey);

                return (
                  <div key={idx} className="space-y-3">
                    <Label className="text-base font-semibold">
                      {idx + 1}. {question.question}
                    </Label>

                    {!hasResponded && (
                      <>
                        {question.type === "scale" ? (
                          <RadioGroup
                            value={answers[idx]}
                            onValueChange={(v) => setAnswers({ ...answers, [idx]: v })}
                          >
                            <div className="flex flex-wrap gap-2">
                              {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => {
                                const emoji = num <= 3 ? "😞" : num <= 5 ? "😐" : num <= 7 ? "🙂" : "😄";
                                return (
                                  <div key={num} className="flex flex-col items-center gap-1">
                                    <div className="relative">
                                      <RadioGroupItem value={String(num)} id={`q${idx}-${num}`} className="peer" />
                                      <Label 
                                        htmlFor={`q${idx}-${num}`} 
                                        className="absolute -top-6 left-1/2 -translate-x-1/2 text-xl opacity-0 peer-data-[state=checked]:opacity-100 transition-opacity"
                                      >
                                        {emoji}
                                      </Label>
                                    </div>
                                    <Label htmlFor={`q${idx}-${num}`} className="text-xs cursor-pointer">
                                      {num}
                                    </Label>
                                  </div>
                                );
                              })}
                            </div>
                          </RadioGroup>
                        ) : (
                          <RadioGroup
                            value={answers[idx]}
                            onValueChange={(v) => setAnswers({ ...answers, [idx]: v })}
                          >
                            {question.options?.map((option: string, optIdx: number) => (
                              <div key={optIdx} className="flex items-center gap-2">
                                <RadioGroupItem value={option} id={`q${idx}-opt${optIdx}`} />
                                <Label htmlFor={`q${idx}-opt${optIdx}`}>{option}</Label>
                              </div>
                            ))}
                          </RadioGroup>
                        )}
                      </>
                    )}

                    {currentSurvey.show_results && stats && (
                      <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-2">
                        <p className="text-sm font-medium">Resultados ({stats.total} respostas):</p>
                        {question.type === "scale" && stats.average && (
                          <p className="text-2xl font-bold">Média: {stats.average}/10</p>
                        )}
                        {Object.entries(stats.distribution).map(([key, value]: [string, any]) => (
                          <div key={key} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>{key}</span>
                              <span>{((value / stats.total) * 100).toFixed(1)}%</span>
                            </div>
                            <Progress value={(value / stats.total) * 100} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => { setSelectedSurvey(null); setAnswers({}); }}>
                  Voltar
                </Button>
                {!myResponses?.includes(selectedSurvey) && (
                  <Button onClick={handleSubmit} disabled={submitMutation.isPending}>
                    {submitMutation.isPending ? "Enviando..." : "Enviar Respostas"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
