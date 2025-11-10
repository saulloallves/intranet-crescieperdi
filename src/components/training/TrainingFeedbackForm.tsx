import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare } from "lucide-react";

interface TrainingFeedbackFormProps {
  trainingPathId: string;
  trainingPathName: string;
  onComplete: () => void;
}

export function TrainingFeedbackForm({ 
  trainingPathId, 
  trainingPathName, 
  onComplete 
}: TrainingFeedbackFormProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [wasClear, setWasClear] = useState<string>("");
  const [feelsPrepared, setFeelsPrepared] = useState<string>("");
  const [additionalComments, setAdditionalComments] = useState("");

  const handleSubmit = async () => {
    if (!wasClear || !feelsPrepared) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, responda todas as perguntas.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("training_feedback" as any)
        .insert({
          user_id: user.id,
          training_path_id: trainingPathId,
          was_clear: parseInt(wasClear),
          feels_prepared: parseInt(feelsPrepared),
          additional_comments: additionalComments.trim() || null
        });

      if (error) throw error;

      toast({
        title: "Feedback enviado!",
        description: "Obrigado por compartilhar sua opinião."
      });

      onComplete();
    } catch (error: any) {
      console.error("Error submitting feedback:", error);
      toast({
        title: "Erro ao enviar feedback",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const ratingOptions = [
    { value: "1", label: "1 - Discordo totalmente" },
    { value: "2", label: "2 - Discordo" },
    { value: "3", label: "3 - Neutro" },
    { value: "4", label: "4 - Concordo" },
    { value: "5", label: "5 - Concordo totalmente" }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Feedback do Treinamento
        </CardTitle>
        <CardDescription>
          Sua opinião é muito importante para melhorarmos nossos treinamentos: {trainingPathName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label className="text-base">O treinamento foi claro e fácil de entender?</Label>
          <RadioGroup value={wasClear} onValueChange={setWasClear}>
            {ratingOptions.map(option => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={`clear-${option.value}`} />
                <Label htmlFor={`clear-${option.value}`} className="font-normal cursor-pointer">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-3">
          <Label className="text-base">Você se sente preparada para executar a função?</Label>
          <RadioGroup value={feelsPrepared} onValueChange={setFeelsPrepared}>
            {ratingOptions.map(option => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={`prepared-${option.value}`} />
                <Label htmlFor={`prepared-${option.value}`} className="font-normal cursor-pointer">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-3">
          <Label htmlFor="comments" className="text-base">
            Comentários adicionais (opcional)
          </Label>
          <Textarea
            id="comments"
            placeholder="Compartilhe suas sugestões, dúvidas ou comentários sobre o treinamento..."
            value={additionalComments}
            onChange={(e) => setAdditionalComments(e.target.value)}
            rows={4}
          />
        </div>

        <Button 
          onClick={handleSubmit} 
          disabled={submitting || !wasClear || !feelsPrepared}
          className="w-full"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enviar Feedback
        </Button>
      </CardContent>
    </Card>
  );
}
