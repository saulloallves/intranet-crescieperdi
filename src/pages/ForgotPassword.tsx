import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Digite seu e-mail');
      return;
    }

    setLoading(true);
    try {
      // Generate a random password
      const newPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);

      // Try to send via WhatsApp first
      const { data, error } = await supabase.functions.invoke('send-password-whatsapp', {
        body: { email, newPassword }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Nova senha enviada via WhatsApp!', {
          description: 'Verifique seu WhatsApp para ver a nova senha.',
        });
      } else {
        // Fallback to email
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });

        if (resetError) throw resetError;

        toast.success('E-mail de recuperação enviado!', {
          description: 'Verifique sua caixa de entrada para redefinir sua senha.',
        });
      }

      setTimeout(() => navigate('/auth'), 2000);
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Erro ao recuperar senha', {
        description: error.message || 'Não foi possível processar sua solicitação.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-20 h-20 rounded-full gradient-primary flex items-center justify-center mb-4">
            <span className="text-4xl font-bold text-white">CP</span>
          </div>
          <CardTitle className="text-2xl font-bold">Recuperar Senha</CardTitle>
          <CardDescription>
            Digite seu e-mail para receber uma nova senha
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail cadastrado</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Se você cadastrou um número de WhatsApp e ativou as notificações, 
                receberá sua nova senha por lá. Caso contrário, enviaremos por e-mail.
              </p>
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                'Recuperar Senha'
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => navigate('/auth')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
