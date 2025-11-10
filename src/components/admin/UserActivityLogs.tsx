import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Search, Filter, Clock, User, Activity, AlertCircle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  module: string;
  timestamp: string;
  ip_address: string;
  device: string;
  result: 'success' | 'error';
  metadata: Record<string, any>;
}

export function UserActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [logs, searchTerm, moduleFilter, resultFilter, startDate, endDate]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('user-activity-monitoring', {
        body: {
          action: 'get_user_logs',
          limit: 500,
        }
      });

      if (error) throw error;
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Error loading logs:', error);
      toast({
        title: "Erro ao carregar logs",
        description: "Não foi possível carregar os logs de atividade.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log =>
        log.action.toLowerCase().includes(term) ||
        log.module.toLowerCase().includes(term) ||
        log.user_id.toLowerCase().includes(term)
      );
    }

    // Module filter
    if (moduleFilter !== "all") {
      filtered = filtered.filter(log => log.module === moduleFilter);
    }

    // Result filter
    if (resultFilter !== "all") {
      filtered = filtered.filter(log => log.result === resultFilter);
    }

    // Date range filter
    if (startDate) {
      filtered = filtered.filter(log => new Date(log.timestamp) >= new Date(startDate));
    }
    if (endDate) {
      filtered = filtered.filter(log => new Date(log.timestamp) <= new Date(endDate));
    }

    setFilteredLogs(filtered);
  };

  const exportLogs = async () => {
    try {
      setExporting(true);
      const { data, error } = await supabase.functions.invoke('user-activity-monitoring', {
        body: {
          action: 'export_logs',
          start_date: startDate,
          end_date: endDate,
          module: moduleFilter !== 'all' ? moduleFilter : undefined,
        }
      });

      if (error) throw error;

      // Create download link
      const blob = new Blob([data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity_logs_${new Date().toISOString()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export concluído",
        description: "Logs exportados com sucesso.",
      });
    } catch (error) {
      console.error('Error exporting logs:', error);
      toast({
        title: "Erro ao exportar",
        description: "Não foi possível exportar os logs.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const getUniqueModules = () => {
    return Array.from(new Set(logs.map(log => log.module))).sort();
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Logs de Atividade</CardTitle>
            <CardDescription>
              Histórico de ações dos usuários no sistema
            </CardDescription>
          </div>
          <Button onClick={exportLogs} disabled={exporting} variant="outline">
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Exportar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Módulo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os módulos</SelectItem>
              {getUniqueModules().map(module => (
                <SelectItem key={module} value={module}>
                  {module}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={resultFilter} onValueChange={setResultFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Resultado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="success">Sucesso</SelectItem>
              <SelectItem value="error">Erro</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="Data inicial"
          />

          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="Data final"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{filteredLogs.length}</p>
                  <p className="text-sm text-muted-foreground">Total de Atividades</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {filteredLogs.filter(l => l.result === 'success').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Sucessos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {filteredLogs.filter(l => l.result === 'error').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Erros</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum log encontrado
            </div>
          ) : (
            filteredLogs.map((log) => (
              <Card key={log.id} className="hover:bg-muted/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={log.result === 'success' ? 'default' : 'destructive'}>
                          {log.result === 'success' ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <AlertCircle className="h-3 w-3 mr-1" />
                          )}
                          {log.result}
                        </Badge>
                        <Badge variant="outline">{log.module}</Badge>
                        <span className="text-sm font-medium">{log.action}</span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span className="font-mono text-xs">{log.user_id.slice(0, 8)}...</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            {format(new Date(log.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          </span>
                        </div>
                      </div>

                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <details className="text-xs text-muted-foreground mt-2">
                          <summary className="cursor-pointer hover:text-foreground">
                            Ver detalhes
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1 text-right">
                      <div className="font-mono">{log.ip_address}</div>
                      <div className="max-w-[200px] truncate" title={log.device}>
                        {log.device}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
