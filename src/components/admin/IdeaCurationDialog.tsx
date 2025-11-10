import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface IdeaCurationDialogProps {
  idea: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function IdeaCurationDialog({ idea, open, onOpenChange, onSuccess }: IdeaCurationDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [action, setAction] = useState<'aprovada' | 'recusada' | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [viabilityLevel, setViabilityLevel] = useState('medio');
  const [impactLevel, setImpactLevel] = useState('medio');
  const [loading, setLoading] = useState(false);

  const handleCurate = async () => {
    if (!action) return;
    
    setLoading(true);
    try {
      // Atualizar ideia
      const { error: updateError } = await supabase
        .from('ideas')
        .update({
          status: action,
          feedback: feedbackText,
          viability_level: viabilityLevel,
          impact_level: impactLevel,
          curator_id: user?.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', idea.id);

      if (updateError) throw updateError;

      // Criar registro de feedback
      const { error: feedbackError } = await supabase
        .from('ideas_feedback')
        .insert({
          idea_id: idea.id,
          curator_id: user?.id,
          feedback_text: feedbackText,
          status_update: action,
        });

      if (feedbackError) throw feedbackError;

      // Criar notificação
      const { error: notifError } = await supabase
        .from('ideas_notifications')
        .insert({
          user_id: idea.submitted_by,
          idea_id: idea.id,
          message: `Sua ideia "${idea.title}" foi ${action}. ${feedbackText}`,
          type: 'status',
        });

      if (notifError) throw notifError;

      // Se aprovada, verificar se deve publicar no feed
      if (action === 'aprovada') {
        const { data: config } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'ideas_auto_publish_to_feed')
          .single();

        const autoPublish = typeof config?.value === 'object' && config.value !== null && 'enabled' in config.value ? config.value.enabled : false;
        if (autoPublish) {
          const mediaUrl = Array.isArray(idea.media_urls) && idea.media_urls.length > 0 ? idea.media_urls[0] : null;
          await supabase.from('feed_posts').insert({
            type: 'idea',
            title: `💡 Ideia Aprovada: ${idea.title}`,
            description: idea.description,
            reference_id: idea.id,
            created_by: user?.id,
            media_url: mediaUrl,
          });
        }
      }

      toast({
        title: 'Curadoria realizada',
        description: `Ideia ${action} com sucesso`,
      });

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: 'Erro ao curar ideia',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAction(null);
    setFeedbackText('');
    setViabilityLevel('medio');
    setImpactLevel('medio');
  };

  if (!idea) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Curadoria de Ideia</DialogTitle>
          <DialogDescription>Avalie e forneça feedback sobre a ideia</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informações da ideia */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{idea.code}</Badge>
              {idea.ai_category && (
                <Badge variant="secondary">🤖 {idea.ai_category}</Badge>
              )}
              <Badge>{idea.category}</Badge>
            </div>
            <h3 className="font-semibold text-lg">{idea.title}</h3>
            <p className="text-sm text-muted-foreground">{idea.description}</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>👍 {idea.votes_count} votos</span>
            </div>
          </div>

          {/* Ação */}
          <div className="space-y-2">
            <Label>Decisão *</Label>
            <div className="flex gap-2">
              <Button
                variant={action === 'aprovada' ? 'default' : 'outline'}
                onClick={() => setAction('aprovada')}
                className="flex-1"
              >
                <Check className="w-4 h-4 mr-2" />
                Aprovar
              </Button>
              <Button
                variant={action === 'recusada' ? 'destructive' : 'outline'}
                onClick={() => setAction('recusada')}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                Recusar
              </Button>
            </div>
          </div>

          {/* Avaliações */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Viabilidade</Label>
              <Select value={viabilityLevel} onValueChange={setViabilityLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixo">Baixa</SelectItem>
                  <SelectItem value="medio">Média</SelectItem>
                  <SelectItem value="alto">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Impacto</Label>
              <Select value={impactLevel} onValueChange={setImpactLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixo">Baixo</SelectItem>
                  <SelectItem value="medio">Médio</SelectItem>
                  <SelectItem value="alto">Alto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Feedback */}
          <div className="space-y-2">
            <Label htmlFor="feedback">Feedback ao autor *</Label>
            <Textarea
              id="feedback"
              placeholder="Explique o motivo da decisão e próximos passos..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={4}
            />
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCurate}
              disabled={!action || !feedbackText.trim() || loading}
            >
              {loading ? 'Salvando...' : 'Confirmar Curadoria'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}