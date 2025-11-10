import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Idea {
  id: string;
  title: string;
  description: string;
  code: string;
}

interface ApproveForVotingDialogProps {
  idea: Idea | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface SimilarIdea {
  code: string;
  title: string;
  similarity: number;
  reason: string;
}

export function ApproveForVotingDialog({ idea, open, onOpenChange, onSuccess }: ApproveForVotingDialogProps) {
  const { toast } = useToast();
  const [votingDays, setVotingDays] = useState('7');
  const [loading, setLoading] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicates, setDuplicates] = useState<SimilarIdea[]>([]);
  const [duplicateCheckDone, setDuplicateCheckDone] = useState(false);

  if (!idea) return null;

  const handleCheckDuplicates = async () => {
    setCheckingDuplicates(true);
    setDuplicateCheckDone(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('detect-duplicate-ideas', {
        body: { ideaId: idea.id }
      });
      
      if (error) throw error;

      setDuplicateCheckDone(true);

      if (data.isDuplicate && data.similarIdeas?.length > 0) {
        setDuplicates(data.similarIdeas);
        toast({
          title: '⚠️ Possíveis duplicatas encontradas',
          description: data.reason,
          variant: 'destructive',
        });
      } else {
        setDuplicates([]);
        toast({
          title: '✅ Nenhuma duplicata encontrada',
          description: 'Esta ideia parece ser única!',
        });
      }
    } catch (error: any) {
      console.error('Erro ao verificar duplicatas:', error);
      toast({
        title: 'Erro ao verificar duplicatas',
        description: error.message,
        variant: 'destructive',
      });
      setDuplicateCheckDone(true);
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const handleApprove = async () => {
    setLoading(true);

    try {
      const voteStart = new Date();
      const voteEnd = new Date();
      voteEnd.setDate(voteEnd.getDate() + parseInt(votingDays));

      const { error } = await supabase
        .from('ideas')
        .update({
          status: 'em_votacao',
          vote_start: voteStart.toISOString(),
          vote_end: voteEnd.toISOString(),
          evaluating_at: new Date().toISOString(),
        })
        .eq('id', idea.id);

      if (error) throw error;

      // Notificar autor
      await supabase.from('ideas_notifications').insert({
        user_id: (await supabase.from('ideas').select('submitted_by').eq('id', idea.id).single()).data?.submitted_by,
        idea_id: idea.id,
        type: 'status',
        message: `Sua ideia "${idea.title}" foi aprovada para votação pública! Votação aberta até ${voteEnd.toLocaleDateString('pt-BR')}.`,
      });

      toast({ 
        title: '✅ Ideia aprovada para votação!',
        description: `Votação aberta por ${votingDays} dias.`
      });
      
      onSuccess();
      onOpenChange(false);
      setDuplicates([]);
      setDuplicateCheckDone(false);
    } catch (error: any) {
      toast({
        title: 'Erro ao aprovar ideia',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aprovar para Votação Pública</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Informações da ideia */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle className="font-semibold">{idea.code}: {idea.title}</AlertTitle>
            <AlertDescription className="mt-2 text-sm">{idea.description}</AlertDescription>
          </Alert>
          
          {/* Duração da votação */}
          <div className="space-y-2">
            <Label htmlFor="voting-duration">Duração da votação *</Label>
            <Select value={votingDays} onValueChange={setVotingDays}>
              <SelectTrigger id="voting-duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="10">10 dias</SelectItem>
                <SelectItem value="14">14 dias</SelectItem>
                <SelectItem value="21">21 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Verificar duplicatas */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleCheckDuplicates}
              disabled={checkingDuplicates || loading}
              className="flex-1"
            >
              {checkingDuplicates ? '🔍 Verificando...' : '🔍 Verificar Duplicatas (IA)'}
            </Button>
            {duplicateCheckDone && duplicates.length === 0 && (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
            {duplicates.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {duplicates.length} possível(is) duplicata(s)
              </Badge>
            )}
          </div>
          
          {/* Lista de duplicatas */}
          {duplicates.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Ideias similares encontradas:</AlertTitle>
              <AlertDescription className="mt-2">
                <ul className="list-disc pl-4 space-y-2">
                  {duplicates.map((dup, idx) => (
                    <li key={idx} className="text-sm">
                      <strong>{dup.code}</strong>: {dup.title}
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant="outline">{dup.similarity}% similar</Badge>
                        <span className="text-xs text-muted-foreground">{dup.reason}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm font-medium">
                  ⚠️ Recomendamos revisar as ideias similares antes de aprovar.
                </p>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Ações */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button 
              onClick={handleApprove} 
              disabled={loading || checkingDuplicates || (duplicates.length > 0 && !duplicateCheckDone)}
            >
              {loading ? 'Aprovando...' : 'Aprovar para Votação'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
