import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, BarChart3, Download, Eye, EyeOff, Trash2, TrendingUp } from "lucide-react";
import { CreateSurveyDialog } from "./CreateSurveyDialog";
import { ClimateDashboard } from "./ClimateDashboard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface Survey {
  id: string;
  title: string;
  description: string;
  target_audience: string;
  questions: any[];
  is_active: boolean;
  show_results: boolean;
  created_at: string;
}

export function AdminPesquisas() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: surveys, isLoading } = useQuery({
    queryKey: ["admin-surveys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("surveys")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Survey[];
    },
  });

  const { data: responses } = useQuery({
    queryKey: ["survey-responses", selectedSurvey],
    queryFn: async () => {
      if (!selectedSurvey) return null;

      const { data, error } = await supabase
        .from("survey_responses")
        .select("*, profiles(full_name, role)")
        .eq("survey_id", selectedSurvey);

      if (error) throw error;
      return data;
    },
    enabled: !!selectedSurvey,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("surveys")
        .update({ is_active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-surveys"] });
      toast({ title: "Status atualizado com sucesso" });
    },
  });

  const toggleResultsMutation = useMutation({
    mutationFn: async ({ id, show_results }: { id: string; show_results: boolean }) => {
      const { error } = await supabase
        .from("surveys")
        .update({ show_results })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-surveys"] });
      toast({ title: "Visibilidade dos resultados atualizada" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("surveys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-surveys"] });
      toast({ title: "Pesquisa excluída com sucesso" });
      if (selectedSurvey) setSelectedSurvey(null);
    },
  });

  const exportToCSV = (survey: Survey) => {
    if (!responses) return;

    const headers = ["Nome", "Perfil", "Data"];
    survey.questions.forEach((q: any, idx: number) => {
      headers.push(`Pergunta ${idx + 1}: ${q.question}`);
    });

    const rows = responses.map((r: any) => {
      const row = [
        r.profiles?.full_name || "Anônimo",
        r.profiles?.role || "-",
        new Date(r.created_at).toLocaleString("pt-BR"),
      ];

      survey.questions.forEach((q: any, idx: number) => {
        row.push(r.answers[idx] || "-");
      });

      return row;
    });

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${survey.title.replace(/\s+/g, "_")}.csv`;
    a.click();
  };

  const getChartData = (survey: Survey) => {
    if (!responses || responses.length === 0) return [];

    return survey.questions.map((q: any, idx: number) => {
      if (q.type === "scale") {
        const counts: any = {};
        responses.forEach((r: any) => {
          const answer = r.answers[idx];
          if (answer) {
            counts[answer] = (counts[answer] || 0) + 1;
          }
        });

        return {
          question: q.question,
          data: Object.keys(counts)
            .sort((a, b) => Number(a) - Number(b))
            .map((key) => ({
              name: key,
              value: counts[key],
            })),
        };
      } else if (q.type === "multiple") {
        const counts: any = {};
        responses.forEach((r: any) => {
          const answer = r.answers[idx];
          if (answer) {
            counts[answer] = (counts[answer] || 0) + 1;
          }
        });

        return {
          question: q.question,
          data: Object.keys(counts).map((key) => ({
            name: key,
            value: counts[key],
          })),
        };
      }
      return null;
    }).filter(Boolean);
  };

  const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--muted))"];

  const selectedSurveyData = surveys?.find((s) => s.id === selectedSurvey);

  if (isLoading) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">📊 Termômetro & Pesquisas Internas</h2>
          <p className="text-muted-foreground">Monitore o clima e gerencie pesquisas da rede</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Pesquisa
        </Button>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Dashboard de Clima
          </TabsTrigger>
          <TabsTrigger value="surveys" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Gerenciar Pesquisas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <ClimateDashboard />
        </TabsContent>

        <TabsContent value="surveys" className="mt-6">

      <div className="grid gap-4">
        {surveys?.map((survey) => (
          <Card key={survey.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    {survey.title}
                    <Badge variant={survey.target_audience === "colaborador" ? "default" : "secondary"}>
                      {survey.target_audience}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{survey.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleResultsMutation.mutate({ id: survey.id, show_results: !survey.show_results })}
                  >
                    {survey.show_results ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(survey.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Ativa:</span>
                    <Switch
                      checked={survey.is_active}
                      onCheckedChange={(checked) =>
                        toggleActiveMutation.mutate({ id: survey.id, is_active: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Mostrar resultados:</span>
                    <Switch
                      checked={survey.show_results}
                      onCheckedChange={(checked) =>
                        toggleResultsMutation.mutate({ id: survey.id, show_results: checked })
                      }
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSurvey(selectedSurvey === survey.id ? null : survey.id)}
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    {selectedSurvey === survey.id ? "Ocultar" : "Ver Resultados"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToCSV(survey)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Exportar CSV
                  </Button>
                </div>
              </div>

              {selectedSurvey === survey.id && (
                <div className="mt-6 space-y-6">
                  <div className="text-sm text-muted-foreground">
                    Total de respostas: {responses?.length || 0}
                  </div>

                  {getChartData(survey).map((chartData: any, idx: number) => (
                    <div key={idx} className="space-y-2">
                      <h4 className="font-semibold">{chartData.question}</h4>
                      {selectedSurveyData?.questions[idx]?.type === "scale" ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={chartData.data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="value" fill="hsl(var(--primary))" name="Respostas" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={chartData.data}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label
                            >
                              {chartData.data.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
        </TabsContent>
      </Tabs>

      <CreateSurveyDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}
