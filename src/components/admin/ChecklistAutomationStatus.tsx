import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Clock, CheckCircle, XCircle, RefreshCw, Activity } from "lucide-react";
import { toast } from "sonner";

export function ChecklistAutomationStatus() {
  const [cronStatus, setCronStatus] = useState<{
    isActive: boolean;
    lastRun?: string;
    nextRun?: string;
  }>({ isActive: true });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const testAutomation = async () => {
    try {
      setTesting(true);
      const { data, error } = await supabase.functions.invoke('check-checklist-compliance', {});

      if (error) throw error;

      const result = data as { alertsSent: number; message: string };
      toast.success(result.message || `Teste concluído! ${result.alertsSent} alerta(s) enviado(s).`);
    } catch (error: any) {
      toast.error('Erro ao testar automação: ' + error.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Status da Automação de Checklists
            </CardTitle>
            <CardDescription>
              Verificação automática a cada hora
            </CardDescription>
          </div>
          <Badge variant={cronStatus.isActive ? "default" : "secondary"} className="flex items-center gap-1">
            {cronStatus.isActive ? (
              <>
                <CheckCircle className="w-3 h-3" />
                Ativo
              </>
            ) : (
              <>
                <XCircle className="w-3 h-3" />
                Inativo
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Frequência</span>
            </div>
            <p className="text-2xl font-bold">1h</p>
            <p className="text-xs text-muted-foreground mt-1">A cada hora</p>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Próxima Execução</span>
            </div>
            <p className="text-lg font-bold">
              {new Date(Math.ceil(Date.now() / 3600000) * 3600000).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
              })}h
            </p>
            <p className="text-xs text-muted-foreground mt-1">Horário estimado</p>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Cron Job</span>
            </div>
            <p className="text-sm font-mono">0 * * * *</p>
            <p className="text-xs text-muted-foreground mt-1">Padrão cron</p>
          </div>
        </div>

        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary" />
            Como Funciona
          </h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>A cada hora, o sistema verifica todos os checklists ativos com horário limite configurado</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>Identifica unidades que não enviaram o checklist no prazo</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>Envia notificações push internas e/ou WhatsApp (se habilitado)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>Registra todos os alertas na tabela checklist_alerts para auditoria</span>
            </li>
          </ul>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={testAutomation} 
            disabled={testing}
            className="flex-1"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${testing ? 'animate-spin' : ''}`} />
            {testing ? 'Testando...' : 'Testar Agora'}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground p-3 bg-muted rounded">
          <strong>Nota:</strong> O cron job foi configurado automaticamente via pg_cron. 
          Para visualizar logs detalhados, acesse o painel do Supabase → Database → Cron Jobs.
        </div>
      </CardContent>
    </Card>
  );
}
