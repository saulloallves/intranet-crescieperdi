import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2 } from 'lucide-react';

interface Idea {
  id: string;
  title: string;
  description: string;
  submitted_by: string;
  media_urls?: string[];
}

interface MarkAsImplementedDialogProps {
  idea: Idea | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function MarkAsImplementedDialog({ idea, open, onOpenChange, onSuccess }: MarkAsImplementedDialogProps) {
  const { toast } = useToast();
  const [feedback, setFeedback] = useState('');
  const [publishToFeed, setPublishToFeed] = useState(true);
  const [loading, setLoading] = useState(false);

  if (!idea) return null;

  const handleComplete = async () => {
    setLoading(true);

    try {
      const { error } = await supabase
        .from('ideas')
        .update({
          status: 'implementada',
          feedback: feedback || null,
        })
        .eq('id', idea.id);

      if (error) throw error;

      // Notificar autor
      await supabase.from('ideas_notifications').insert({
        user_id: idea.submitted_by,
        idea_id: idea.id,
        type: 'status',
        message: `🎉 Sua ideia "${idea.title}" foi implementada com sucesso! ${feedback ? '\n\n' + feedback : ''}`,
      });

      // Publicar no feed se configurado
      if (publishToFeed) {
        const mediaUrl = Array.isArray(idea.media_urls) && idea.media_urls.length > 0 
          ? idea.media_urls[0] 
          : null;

        await supabase.from('feed_posts').insert({
          type: 'idea',
          title: `🚀 Ideia Implementada com Sucesso`,
          description: `"${idea.title}" foi implementada e já está ativa em toda a rede!\n\n${idea.description}${feedback ? '\n\n**Resultado:** ' + feedback : ''}`,
          reference_id: idea.id,
          created_by: idea.submitted_by,
          media_url: mediaUrl,
          audience_roles: [],
          audience_units: [],
          pinned: true,
        });
      }

      toast({ 
        title: '✅ Ideia marcada como implementada!',
        description: publishToFeed ? 'Post criado no feed.' : ''
      });
      
      onSuccess();
      onOpenChange(false);
      setFeedback('');
    } catch (error: any) {
      toast({
        title: 'Erro ao finalizar implementação',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Marcar como Implementada</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>{idea.title}</AlertTitle>
            <AlertDescription className="mt-2">
              Ao confirmar, a ideia será marcada como implementada e o autor será notificado.
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <Label htmlFor="feedback">Feedback da implementação (opcional)</Label>
            <Textarea
              id="feedback"
              placeholder="Descreva os resultados da implementação, impacto gerado, etc."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
            />
          </div>
          
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="publish-feed">Publicar no Feed Institucional</Label>
              <p className="text-sm text-muted-foreground">
                Cria um post fixado celebrando a implementação
              </p>
            </div>
            <Switch
              id="publish-feed"
              checked={publishToFeed}
              onCheckedChange={setPublishToFeed}
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleComplete} disabled={loading}>
              {loading ? 'Finalizando...' : 'Marcar como Implementada'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
