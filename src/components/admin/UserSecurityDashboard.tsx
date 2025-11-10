import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Shield,
  AlertTriangle,
  Activity,
  Lock,
  Unlock,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface SecurityReport {
  period: { start: string; end: string };
  total_logins: number;
  failed_logins: number;
  password_resets: number;
  accounts_locked: number;
  unique_users: number;
  unique_ips: number;
  top_failed_users: Array<{ user_id: string; failed_attempts: number }>;
  suspicious_ips: Array<{ ip_address: string; failed_attempts: number }>;
}

interface SuspiciousActivity {
  type: string;
  user_id?: string;
  count?: number;
  ip_count?: number;
  severity: string;
}

export function UserSecurityDashboard() {
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [suspicious, setSuspicious] = useState<SuspiciousActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState(30); // days
  const { toast } = useToast();

  useEffect(() => {
    loadSecurityData();
  }, [dateRange]);

  const loadSecurityData = async () => {
    try {
      setLoading(true);

      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000).toISOString();

      // Load security report
      const { data: reportData, error: reportError } = await supabase.functions.invoke('user-security-monitoring', {
        body: {
          action: 'get_security_report',
          start_date: startDate,
          end_date: endDate,
        }
      });

      if (reportError) throw reportError;
      setReport(reportData.report);

      // Detect suspicious activities
      const { data: suspiciousData, error: suspiciousError } = await supabase.functions.invoke('user-activity-monitoring', {
        body: {
          action: 'detect_suspicious',
          hours: dateRange * 24,
          threshold: 100,
        }
      });

      if (suspiciousError) throw suspiciousError;
      setSuspicious(suspiciousData.suspicious || []);

    } catch (error) {
      console.error('Error loading security data:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar o dashboard de segurança.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSecurityData();
    setRefreshing(false);
    toast({
      title: "Dados atualizados",
      description: "Dashboard de segurança atualizado com sucesso.",
    });
  };

  const handleBlockUser = async (userId: string) => {
    if (!confirm('Tem certeza que deseja bloquear este usuário?')) return;

    try {
      const { error } = await supabase.functions.invoke('user-security-monitoring', {
        body: {
          action: 'block_user',
          user_id: userId,
          reason: 'Atividade suspeita detectada pelo sistema',
        }
      });

      if (error) throw error;

      toast({
        title: "Usuário bloqueado",
        description: "O usuário foi bloqueado com sucesso.",
      });

      loadSecurityData();
    } catch (error) {
      console.error('Error blocking user:', error);
      toast({
        title: "Erro ao bloquear",
        description: "Não foi possível bloquear o usuário.",
        variant: "destructive",
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return 'Desconhecida';
    }
  };

  const getActivityTypeLabel = (type: string) => {
    switch (type) {
      case 'excessive_failures': return 'Excesso de Falhas';
      case 'excessive_requests': return 'Excesso de Requisições';
      case 'multiple_ips': return 'Múltiplos IPs';
      default: return type;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum dado disponível
        </CardContent>
      </Card>
    );
  }

  const failureRate = report.total_logins > 0 
    ? (report.failed_logins / report.total_logins * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Dashboard de Segurança
          </h2>
          <p className="text-muted-foreground">
            Últimos {dateRange} dias • {format(new Date(report.period.start), "dd/MM/yyyy")} - {format(new Date(report.period.end), "dd/MM/yyyy")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setDateRange(7)}>
            7 dias
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDateRange(30)}>
            30 dias
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDateRange(90)}>
            90 dias
          </Button>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{report.total_logins}</p>
                <p className="text-sm text-muted-foreground">Total de Logins</p>
              </div>
              <Activity className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-500">{report.failed_logins}</p>
                <p className="text-sm text-muted-foreground">Tentativas Falhadas</p>
                <p className="text-xs text-muted-foreground">{failureRate}% taxa de falha</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{report.unique_users}</p>
                <p className="text-sm text-muted-foreground">Usuários Únicos</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-yellow-500">{report.accounts_locked}</p>
                <p className="text-sm text-muted-foreground">Contas Bloqueadas</p>
              </div>
              <Lock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Suspicious Activities */}
      {suspicious.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Atividades Suspeitas Detectadas
            </CardTitle>
            <CardDescription>
              {suspicious.length} atividade(s) suspeita(s) encontrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {suspicious.map((activity, index) => (
              <Card key={index} className="border-l-4 border-l-red-500">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getSeverityColor(activity.severity)}>
                          {getSeverityLabel(activity.severity)}
                        </Badge>
                        <Badge variant="outline">
                          {getActivityTypeLabel(activity.type)}
                        </Badge>
                      </div>
                      <div className="text-sm space-y-1">
                        {activity.user_id && (
                          <p><span className="font-medium">Usuário:</span> {activity.user_id.slice(0, 8)}...</p>
                        )}
                        {activity.count && (
                          <p><span className="font-medium">Contagem:</span> {activity.count}</p>
                        )}
                        {activity.ip_count && (
                          <p><span className="font-medium">IPs diferentes:</span> {activity.ip_count}</p>
                        )}
                      </div>
                    </div>
                    {activity.user_id && activity.severity === 'high' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleBlockUser(activity.user_id!)}
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        Bloquear
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Top Failed Users */}
      {report.top_failed_users.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Usuários com Mais Falhas de Login</CardTitle>
            <CardDescription>Top 10 usuários com tentativas falhadas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {report.top_failed_users.map((user, index) => (
                <div key={user.user_id} className="flex items-center justify-between p-3 rounded border">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">#{index + 1}</Badge>
                    <span className="font-mono text-sm">{user.user_id.slice(0, 12)}...</span>
                  </div>
                  <Badge variant="destructive">{user.failed_attempts} falhas</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suspicious IPs */}
      {report.suspicious_ips.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>IPs Suspeitos</CardTitle>
            <CardDescription>IPs com múltiplas tentativas falhadas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {report.suspicious_ips.map((ip, index) => (
                <div key={ip.ip_address} className="flex items-center justify-between p-3 rounded border">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">#{index + 1}</Badge>
                    <span className="font-mono text-sm">{ip.ip_address}</span>
                  </div>
                  <Badge variant="destructive">{ip.failed_attempts} tentativas</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
