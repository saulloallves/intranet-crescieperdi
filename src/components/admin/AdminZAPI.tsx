import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send, Loader2, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

export function AdminZAPI() {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('Olá! Esta é uma mensagem de teste do GiraBot.');
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [apiStatus, setApiStatus] = useState<{
    connected: boolean;
    message: string;
    lastChecked?: Date;
  } | null>(null);

  const checkAPIStatus = async () => {
    setCheckingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-zapi-status');

      if (error) throw error;

      setApiStatus({
        connected: data.connected,
        message: data.message,
        lastChecked: new Date(),
      });

      if (!data.connected) {
        toast.warning("Z-API está desconectado!", {
          description: data.message,
        });
      }
    } catch (error: any) {
      console.error("Erro ao verificar status:", error);
      setApiStatus({
        connected: false,
        message: "Erro ao verificar status",
        lastChecked: new Date(),
      });
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    checkAPIStatus();
    // Check status every 5 minutes
    const interval = setInterval(checkAPIStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSendTest = async () => {
    if (!phone || !message) {
      toast.error('Preencha todos os campos');
      return;
    }

    setLoading(true);
    try {
      console.log('Enviando mensagem de teste...');
      const { data, error } = await supabase.functions.invoke('test-zapi', {
        body: {
          phone: phone,
          message: message,
        },
      });

      if (error) {
        console.error('Erro ao enviar:', error);
        toast.error('Erro ao enviar mensagem: ' + error.message);
        return;
      }

      console.log('Resposta:', data);
      toast.success('Mensagem enviada com sucesso!');
      
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Z-API WhatsApp</h2>
        <p className="text-muted-foreground">Configuração e testes da integração WhatsApp</p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Status da Conexão</CardTitle>
              <CardDescription>
                Monitoramento em tempo real da Z-API
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={checkAPIStatus}
              disabled={checkingStatus}
            >
              {checkingStatus ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Atualizar
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {apiStatus ? (
            <div className="flex items-center gap-4">
              {apiStatus.connected ? (
                <>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <div className="flex-1">
                    <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                      Conectado
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      {apiStatus.message}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-8 w-8 text-destructive" />
                  <div className="flex-1">
                    <Badge variant="destructive">Desconectado</Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      {apiStatus.message}
                    </p>
                  </div>
                </>
              )}
              {apiStatus.lastChecked && (
                <p className="text-xs text-muted-foreground">
                  Última verificação: {apiStatus.lastChecked.toLocaleTimeString('pt-BR')}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Verificando status...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Message Card */}
      <Card>
        <CardHeader>
          <CardTitle>Enviar Mensagem de Teste</CardTitle>
          <CardDescription>
            Teste o envio de mensagens via WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Número do WhatsApp</Label>
            <Input
              id="phone"
              placeholder="5511999999999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Digite o número com código do país e DDD, sem espaços ou caracteres especiais
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              placeholder="Digite sua mensagem..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
              rows={4}
            />
          </div>

          <Button
            onClick={handleSendTest}
            disabled={loading || !apiStatus?.connected}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar Mensagem de Teste
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
