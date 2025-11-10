import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ResetPasswordDialogProps {
  userId: string;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResetPasswordDialog({ userId, userName, open, onOpenChange }: ResetPasswordDialogProps) {
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const { toast } = useToast();

  const handleReset = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({
        title: 'Erro',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'resetPassword',
          userData: {
            userId,
            newPassword,
          },
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Senha redefinida',
        description: `A senha de ${userName} foi alterada com sucesso.`,
      });

      setNewPassword('');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({
        title: 'Erro ao redefinir senha',
        description: error.message || 'Não foi possível redefinir a senha.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Redefinir Senha</DialogTitle>
          <DialogDescription>
            Defina uma nova senha para {userName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="new_password">Nova Senha *</Label>
            <Input
              id="new_password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div className="bg-muted p-3 rounded-lg text-sm">
            <p className="font-medium mb-1">⚠️ Importante:</p>
            <p className="text-muted-foreground">
              O usuário deverá usar esta nova senha no próximo login. Certifique-se de comunicá-la de forma segura.
            </p>
          </div>

          <Button onClick={handleReset} disabled={loading} className="w-full">
            {loading ? 'Redefinindo...' : 'Redefinir Senha'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
