import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles } from "lucide-react";

interface CreateResponseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  onResponseCreated: () => void;
}

export function CreateResponseDialog({ 
  open, 
  onOpenChange, 
  postId,
  onResponseCreated 
}: CreateResponseDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState("");

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Por favor, escreva sua resposta.",
        variant: "destructive"
      });
      return;
    }

    if (content.length < 10) {
      toast({
        title: "Resposta muito curta",
        description: "Por favor, escreva pelo menos 10 caracteres.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      // 1. Anonimizar conteúdo antes de salvar
      const { data: anonymizeData, error: anonymizeError } = await supabase.functions.invoke('mural-anonymize', {
        body: { content: content.trim() }
      });

      if (anonymizeError) {
        console.error("Anonymization error:", anonymizeError);
        throw new Error("Erro ao processar conteúdo");
      }

      const anonymizedContent = anonymizeData?.anonymized_content || content.trim();

      // 2. Buscar contexto do post original
      const { data: postData } = await supabase
        .from("mural_posts")
        .select("content, category")
        .eq("id", postId)
        .single();

      // 3. Moderar resposta com IA
      const { data: moderationData, error: moderationError } = await supabase.functions.invoke('mural-moderate-response', {
        body: { 
          response_id: "temp",
          content: anonymizedContent,
          post_id: postId
        }
      });

      if (moderationError) {
        console.error("Moderation error:", moderationError);
      }

      const action = moderationData?.action || 'review';
      const aiReason = moderationData?.reason || 'Moderação automática';

      // 4. Determinar status inicial
      let initialStatus: "approved" | "pending" | "rejected" = "pending";
      let approvalSource: "ai" | null = null;
      let approvedAt: string | null = null;

      if (action === 'approve') {
        initialStatus = "approved";
        approvalSource = "ai";
        approvedAt = new Date().toISOString();
      } else if (action === 'reject') {
        initialStatus = "rejected";
      } else {
        // Se for 'review', notificar moderadores
        try {
          await supabase.functions.invoke('mural-notify-moderators', {
            body: {
              content_type: 'response',
              content_id: 'temp',
              reason: aiReason
            }
          });
        } catch (notifyError) {
          console.error('Erro ao notificar moderadores:', notifyError);
        }
      }

      // 5. Inserir resposta
      const { error } = await supabase
        .from("mural_responses")
        .insert({
          post_id: postId,
          content: anonymizedContent,
          responder_id: user.id,
          status: initialStatus,
          ai_reason: aiReason,
          approval_source: approvalSource,
          approved_at: approvedAt
        });

      if (error) throw error;

      // 6. Se aprovada, notificar o autor do post original
      if (initialStatus === 'approved') {
        try {
          // Verificar se notificações estão habilitadas
          const { data: configData } = await supabase
            .from('automation_settings')
            .select('value')
            .eq('key', 'mural_notify_on_reply')
            .single();
          
          const notifyEnabled = configData?.value !== 'false';
          
          if (notifyEnabled) {
            const { data: originalPost } = await supabase
              .from('mural_posts')
              .select('author_id')
              .eq('id', postId)
              .single();

            if (originalPost?.author_id && originalPost.author_id !== user.id) {
              // Chamar edge function que cria notificação + WhatsApp
              await supabase.functions.invoke('mural-send-notification', {
                body: {
                  user_id: originalPost.author_id,
                  title: '🧩 Resposta no Mural',
                  message: 'O seu pedido de ajuda recebeu uma resposta no Mural Cresci e Perdi.',
                  type: 'mural_response',
                  reference_id: postId,
                  send_whatsapp: true
                }
              });
            }
          }
        } catch (notifError) {
          console.error('Erro ao enviar notificação:', notifError);
          // Não falhar a criação da resposta por erro de notificação
        }
      }

      // 7. Feedback ao usuário
      if (initialStatus === 'approved') {
        toast({
          title: "Resposta aprovada e publicada! 🎉",
          description: "Sua resposta foi aprovada pela IA e já está visível!"
        });
      } else if (initialStatus === 'rejected') {
        toast({
          title: "Resposta rejeitada",
          description: "Sua resposta não atende aos critérios. Tente novamente com um conteúdo mais construtivo.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Resposta em revisão 🔍",
          description: "Sua resposta está em análise manual."
        });
      }

      setContent("");
      onOpenChange(false);
      onResponseCreated();
    } catch (error) {
      console.error("Error creating response:", error);
      toast({
        title: "Erro ao enviar",
        description: "Não foi possível enviar sua resposta. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Responder post
          </DialogTitle>
          <DialogDescription>
            Sua resposta será <strong>anônima</strong>, anonimizada e moderada pela IA antes de ser publicada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="response-content">Sua resposta *</Label>
            <Textarea
              id="response-content"
              name="response"
              data-testid="response-textarea"
              placeholder="Escreva palavras de apoio, conselhos ou compartilhe sua experiência..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              maxLength={1000}
              disabled={loading}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Mínimo 10 caracteres</span>
              <span data-testid="response-char-count">{content.length}/1000</span>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-purple-700 dark:text-purple-300">
                  Anonimização e Moderação por IA
                </p>
                <p className="text-xs text-muted-foreground">
                  O GiraBot irá remover informações pessoais (nomes, CNPJs, cidades, códigos) e revisar sua resposta para garantir um ambiente profissional e respeitoso.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            data-testid="response-cancel-button"
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading} data-testid="response-submit-button">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar Resposta"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
