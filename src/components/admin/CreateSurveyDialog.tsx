import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

interface CreateSurveyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Question {
  question: string;
  type: "scale" | "multiple";
  options?: string[];
}

export function CreateSurveyDialog({ open, onOpenChange }: CreateSurveyDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState<"colaborador" | "franqueado" | "ambos">("colaborador");
  const [anonymous, setAnonymous] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [questions, setQuestions] = useState<Question[]>([
    { question: "", type: "scale" },
  ]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units")
        .select("code, name")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("surveys").insert({
        title,
        description,
        target_audience: targetAudience,
        questions: questions as any,
        created_by: user.id,
        anonymous,
        show_results: showResults,
        audience_units: selectedUnits.length > 0 ? selectedUnits : null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-surveys"] });
      toast({ title: "Pesquisa criada com sucesso" });
      resetForm();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Erro ao criar pesquisa", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setTargetAudience("colaborador");
    setAnonymous(false);
    setShowResults(false);
    setSelectedUnits([]);
    setQuestions([{ question: "", type: "scale" }]);
  };

  const addQuestion = () => {
    setQuestions([...questions, { question: "", type: "scale" }]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    
    // Se mudar para múltipla escolha, adicionar array de opções vazio
    if (field === "type" && value === "multiple" && !updated[index].options) {
      updated[index].options = [""];
    }
    
    setQuestions(updated);
  };

  const addOption = (questionIndex: number) => {
    const updated = [...questions];
    if (!updated[questionIndex].options) {
      updated[questionIndex].options = [];
    }
    updated[questionIndex].options!.push("");
    setQuestions(updated);
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const updated = [...questions];
    updated[questionIndex].options![optionIndex] = value;
    setQuestions(updated);
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const updated = [...questions];
    updated[questionIndex].options = updated[questionIndex].options!.filter((_, i) => i !== optionIndex);
    setQuestions(updated);
  };

  const handleSubmit = () => {
    if (!title || questions.some((q) => !q.question)) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Pesquisa Interna</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Pesquisa de Satisfação 2025"
            />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o objetivo da pesquisa"
            />
          </div>

          <div>
            <Label>Público-alvo *</Label>
            <Select value={targetAudience} onValueChange={(v: any) => setTargetAudience(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="colaborador">Colaboradores</SelectItem>
                <SelectItem value="franqueado">Franqueados</SelectItem>
                <SelectItem value="ambos">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="anonymous">Respostas Anônimas</Label>
              <Switch
                id="anonymous"
                checked={anonymous}
                onCheckedChange={setAnonymous}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Se ativado, as respostas não serão vinculadas aos usuários
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="show-results">Mostrar Resultados aos Participantes</Label>
              <Switch
                id="show-results"
                checked={showResults}
                onCheckedChange={setShowResults}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Permite que colaboradores vejam estatísticas em tempo real
            </p>
          </div>

          {units && units.length > 0 && (
            <div>
              <Label>Unidades (opcional)</Label>
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
                {units.map((unit: any) => (
                  <div key={unit.code} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`unit-${unit.code}`}
                      checked={selectedUnits.includes(unit.code)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUnits([...selectedUnits, unit.code]);
                        } else {
                          setSelectedUnits(selectedUnits.filter(u => u !== unit.code));
                        }
                      }}
                      className="rounded"
                    />
                    <Label htmlFor={`unit-${unit.code}`} className="cursor-pointer font-normal">
                      {unit.name}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Deixe vazio para enviar a todas as unidades
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Perguntas *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Pergunta
              </Button>
            </div>

            {questions.map((question, idx) => (
              <div key={idx} className="space-y-2 p-4 border rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={question.question}
                      onChange={(e) => updateQuestion(idx, "question", e.target.value)}
                      placeholder={`Pergunta ${idx + 1}`}
                    />

                    <Select
                      value={question.type}
                      onValueChange={(v: any) => updateQuestion(idx, "type", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scale">Escala 1-10</SelectItem>
                        <SelectItem value="multiple">Múltipla Escolha</SelectItem>
                      </SelectContent>
                    </Select>

                    {question.type === "multiple" && (
                      <div className="space-y-2 pl-4">
                        <Label className="text-sm">Opções:</Label>
                        {question.options?.map((option, optIdx) => (
                          <div key={optIdx} className="flex gap-2">
                            <Input
                              value={option}
                              onChange={(e) => updateOption(idx, optIdx, e.target.value)}
                              placeholder={`Opção ${optIdx + 1}`}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeOption(idx, optIdx)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addOption(idx)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Adicionar Opção
                        </Button>
                      </div>
                    )}
                  </div>

                  {questions.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQuestion(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Criando..." : "Criar Pesquisa"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
