import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Users, 
  ThermometerSun,
  MapPin,
  Calendar
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export function ClimateDashboard() {
  const { data: weeklyScores } = useQuery({
    queryKey: ["weekly-climate-scores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("answers, created_at")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      const weeklyData: Record<string, { total: number; count: number }> = {};
      
      data.forEach((response: any) => {
        const week = new Date(response.created_at).toLocaleDateString("pt-BR", {
          month: "short",
          day: "numeric",
        });
        
        const firstAnswer = Object.values(response.answers)[0] as string;
        const score = Number(firstAnswer) || 0;
        
        if (!weeklyData[week]) {
          weeklyData[week] = { total: 0, count: 0 };
        }
        weeklyData[week].total += score;
        weeklyData[week].count += 1;
      });

      return Object.entries(weeklyData).map(([week, data]) => ({
        week,
        média: (data.total / data.count).toFixed(1),
      }));
    },
  });

  const { data: unitScores } = useQuery({
    queryKey: ["unit-climate-scores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("answers, unit_code, profiles(unit_code)")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      const unitData: Record<string, { total: number; count: number }> = {};
      
      data.forEach((response: any) => {
        const unit = response.unit_code || response.profiles?.unit_code || "Sem Unidade";
        const firstAnswer = Object.values(response.answers)[0] as string;
        const score = Number(firstAnswer) || 0;
        
        if (!unitData[unit]) {
          unitData[unit] = { total: 0, count: 0 };
        }
        unitData[unit].total += score;
        unitData[unit].count += 1;
      });

      return Object.entries(unitData)
        .map(([unit, data]) => ({
          unidade: unit,
          média: Number((data.total / data.count).toFixed(1)),
          respostas: data.count,
        }))
        .sort((a, b) => a.média - b.média);
    },
  });

  const { data: alerts } = useQuery({
    queryKey: ["climate-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("climate_alerts")
        .select("*")
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["climate-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("answers, created_at")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          currentAvg: 0,
          previousAvg: 0,
          totalResponses: 0,
          trend: 0,
        };
      }

      const now = Date.now();
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
      const twoWeeksAgo = weekAgo - 7 * 24 * 60 * 60 * 1000;

      let currentTotal = 0;
      let currentCount = 0;
      let previousTotal = 0;
      let previousCount = 0;

      data.forEach((response: any) => {
        const timestamp = new Date(response.created_at).getTime();
        const firstAnswer = Object.values(response.answers)[0] as string;
        const score = Number(firstAnswer) || 0;

        if (timestamp >= weekAgo) {
          currentTotal += score;
          currentCount += 1;
        } else if (timestamp >= twoWeeksAgo) {
          previousTotal += score;
          previousCount += 1;
        }
      });

      const currentAvg = currentCount > 0 ? currentTotal / currentCount : 0;
      const previousAvg = previousCount > 0 ? previousTotal / previousCount : 0;
      const trend = currentAvg - previousAvg;

      return {
        currentAvg: Number(currentAvg.toFixed(1)),
        previousAvg: Number(previousAvg.toFixed(1)),
        totalResponses: currentCount,
        trend: Number(trend.toFixed(1)),
      };
    },
  });

  const getClimateEmoji = (score: number) => {
    if (score >= 8) return "😄";
    if (score >= 6) return "🙂";
    if (score >= 4) return "😐";
    return "😞";
  };

  const getClimateColor = (score: number) => {
    if (score >= 8) return "text-green-600";
    if (score >= 6) return "text-yellow-600";
    if (score >= 4) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold flex items-center gap-2">
          <ThermometerSun className="h-8 w-8 text-primary" />
          Termômetro de Clima Organizacional
        </h2>
        <p className="text-muted-foreground">
          Monitore o engajamento e satisfação da rede em tempo real
        </p>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Clima Atual</CardDescription>
            <CardTitle className="text-4xl flex items-center gap-2">
              <span className={getClimateColor(stats?.currentAvg || 0)}>
                {stats?.currentAvg || 0}
              </span>
              <span className="text-2xl">{getClimateEmoji(stats?.currentAvg || 0)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              {stats && stats.trend > 0 ? (
                <>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-green-600">+{stats.trend} vs semana anterior</span>
                </>
              ) : stats && stats.trend < 0 ? (
                <>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span className="text-red-600">{stats.trend} vs semana anterior</span>
                </>
              ) : (
                <span className="text-muted-foreground">Sem variação</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Respostas (7 dias)</CardDescription>
            <CardTitle className="text-4xl flex items-center gap-2">
              <Users className="h-8 w-8 text-primary" />
              {stats?.totalResponses || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Colaboradores participaram
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Alertas Ativos</CardDescription>
            <CardTitle className="text-4xl flex items-center gap-2">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
              {alerts?.length || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Unidades com clima crítico
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Meta Semanal</CardDescription>
            <CardTitle className="text-4xl">
              {stats && stats.currentAvg >= 7 ? "✅" : "⚠️"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Meta: ≥ 7.0 pontos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Tendência Semanal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Evolução do Clima (Últimos 30 dias)
          </CardTitle>
          <CardDescription>
            Média semanal de motivação da rede
          </CardDescription>
        </CardHeader>
        <CardContent>
          {weeklyScores && weeklyScores.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyScores}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="média"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  dot={{ fill: "hsl(var(--primary))", r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Sem dados para exibir
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ranking de Unidades */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Clima por Unidade (Últimos 7 dias)
          </CardTitle>
          <CardDescription>
            Unidades com menor clima precisam de atenção
          </CardDescription>
        </CardHeader>
        <CardContent>
          {unitScores && unitScores.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={unitScores} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 10]} />
                <YAxis type="category" dataKey="unidade" width={120} />
                <Tooltip />
                <Legend />
                <Bar dataKey="média" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground">
              Sem dados para exibir
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alertas Ativos */}
      {alerts && alerts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <AlertTriangle className="h-5 w-5" />
              Alertas de Clima Crítico
            </CardTitle>
            <CardDescription>
              Unidades que requerem atenção imediata
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((alert: any) => (
              <div key={alert.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{alert.message}</p>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    {alert.unit_code && (
                      <Badge variant="outline">{alert.unit_code}</Badge>
                    )}
                    <span>Média: {alert.metric_value}/10</span>
                    <span>•</span>
                    <span>{new Date(alert.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                <Badge
                  variant={alert.severity === "critical" ? "destructive" : "secondary"}
                >
                  {alert.severity === "critical" ? "Crítico" : "Atenção"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
