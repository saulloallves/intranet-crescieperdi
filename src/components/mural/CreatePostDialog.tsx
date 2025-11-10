import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { ImageUpload } from "./ImageUpload";

interface Category {
  id: string;
  key: string;
  name: string;
  icon: string;
  description: string;
}

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostCreated: () => void;
}

export function CreatePostDialog({ open, onOpenChange, onPostCreated }: CreatePostDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string | undefined>();

  useEffect(() => {
    if (open) {
      fetchCategories();
    }
  }, [open]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("mural_categories")
        .select("id, key, name, icon, description")
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      setCategories(data || []);
      
      // Selecionar primeira categoria por padrão
      if (data && data.length > 0 && !categoryId) {
        setCategoryId(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Por favor, escreva sua mensagem.",
        variant: "destructive"
      });
      return;
    }

    if (content.length < 10) {
      toast({
        title: "Mensagem muito curta",
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

      // 1. Anonimizar conteúdo
      const { data: anonymizeData, error: anonymizeError } = await supabase.functions.invoke('mural-anonymize', {
        body: { content: content.trim() }
      });

      if (anonymizeError) {
        console.error("Anonymization error:", anonymizeError);
        throw new Error("Erro ao processar conteúdo");
      }

      const anonymizedContent = anonymizeData?.anonymized_content || content.trim();

      // 2. Validar com IA
      const { data: validationData, error: validationError } = await supabase.functions.invoke('mural-ai-validate', {
        body: { 
          title: categories.find(c => c.id === categoryId)?.name || '',
          content: anonymizedContent 
        }
      });

      if (validationError) {
        console.error("Validation error:", validationError);
      }

      const quality = validationData?.quality || 'review';
      const aiReason = validationData?.reason || 'Validação automática';
      
      // 3. Determinar status inicial baseado na validação
      let initialStatus: "approved" | "pending" | "rejected" = "pending";
      let approvalSource: "ai" | null = null;
      let approvedAt: string | null = null;

      if (quality === 'approved') {
        initialStatus = "approved";
        approvalSource = "ai";
        approvedAt = new Date().toISOString();
      } else if (quality === 'rejected') {
        initialStatus = "rejected";
      } else {
        // Se for 'review', notificar moderadores
        try {
          await supabase.functions.invoke('mural-notify-moderators', {
            body: {
              content_type: 'post',
              content_id: 'temp',
              reason: aiReason,
              category_id: categoryId
            }
          });
        } catch (notifyError) {
          console.error('Erro ao notificar moderadores:', notifyError);
        }
      }

      // 4. Inserir post no banco
      const { data: postData, error } = await supabase
        .from("mural_posts")
        .insert([{
          content: anonymizedContent,
          category_id: categoryId,
          author_id: user.id,
          media_url: imageUrl,
          status: initialStatus,
          ai_reason: aiReason,
          approval_source: approvalSource,
          approved_at: approvedAt
        }])
        .select()
        .single();

      if (error) throw error;

      // 5. Se aprovado, integrar com Feed
      if (initialStatus === 'approved' && postData) {
        try {
          await supabase.functions.invoke('mural-feed-integration', {
            body: {
              post_id: postData.id,
              approval_source: 'ai'
            }
          });
        } catch (feedError) {
          console.error('Erro ao integrar com Feed:', feedError);
        }
      }

      // 6. Mensagem de feedback ao usuário
      if (initialStatus === 'approved') {
        toast({
          title: "Post aprovado e publicado! 🎉",
          description: "Sua mensagem foi aprovada pela IA e já está visível no mural!"
        });
      } else if (initialStatus === 'rejected') {
        toast({
          title: "Post rejeitado",
          description: "Sua mensagem não atende aos critérios de qualidade. Tente novamente com um conteúdo mais construtivo.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Post em revisão 🔍",
          description: "Sua mensagem está em análise manual. Você será notificado assim que for aprovada."
        });
      }

      setContent("");
      setCategoryId(categories[0]?.id || "");
      setImageUrl(undefined);
      onOpenChange(false);
      onPostCreated();
    } catch (error) {
      console.error("Error creating post:", error);
      toast({
        title: "Erro ao publicar",
        description: "Não foi possível enviar sua mensagem. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName];
    return Icon || LucideIcons.HelpCircle;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Pedir Ajuda Anonimamente
          </DialogTitle>
          <DialogDescription>
            Suas postagens são anônimas e moderadas pela IA GiraBot antes de serem publicadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Categoria *</Label>
            <RadioGroup value={categoryId} onValueChange={setCategoryId}>
              <div className="grid grid-cols-1 gap-2">
                {categories.map((cat) => {
                  const Icon = getIcon(cat.icon);
                  return (
                    <div key={cat.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={cat.id} id={cat.id} />
                      <Label
                        htmlFor={cat.id}
                        className="flex items-center gap-2 cursor-pointer flex-1 py-2"
                      >
                        <Icon className="h-4 w-4" />
                        <span className="font-medium">{cat.name}</span>
                        <span className="text-xs text-muted-foreground">
                          - {cat.description}
                        </span>
                      </Label>
                    </div>
                  );
                })}
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Sua mensagem *</Label>
            <Textarea
              id="content"
              name="content"
              data-testid="post-content-textarea"
              placeholder="Ex: Alguém conseguiu fornecedor de etiquetas térmicas mais baratas?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              maxLength={1000}
              disabled={loading}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Mínimo 10 caracteres</span>
              <span data-testid="char-count">{content.length}/1000</span>
            </div>
          </div>

          <ImageUpload 
            onImageUploaded={setImageUrl}
            currentImage={imageUrl}
            onRemoveImage={() => setImageUrl(undefined)}
          />

          <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-purple-700 dark:text-purple-300">
                  Moderação e Anonimização por IA
                </p>
                <p className="text-xs text-muted-foreground">
                  O GiraBot irá remover automaticamente nomes, CPFs, CNPJs, cidades e dados identificáveis.
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
            data-testid="cancel-button"
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading} data-testid="submit-button">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Publicando...
              </>
            ) : (
              "Publicar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
