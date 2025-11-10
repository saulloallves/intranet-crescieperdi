import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  MessageSquare, 
  BarChart3,
  Settings,
  Sparkles,
  Shield,
  Users,
  TrendingUp,
  AlertTriangle,
  History,
  PieChart
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { MuralCategoryManager } from "./MuralCategoryManager";

interface MuralPost {
  id: string;
  content: string;
  category_id: string;
  status: string;
  author_id: string;
  created_at: string;
  response_count: number;
  ai_reason?: string;
  approval_source?: string;
  profiles: {
    full_name: string;
    unit_code: string;
  };
  mural_categories?: {
    name: string;
    key: string;
  };
}

interface MuralResponse {
  id: string;
  post_id: string;
  content: string;
  status: string;
  responder_id: string;
  created_at: string;
  ai_reason?: string;
  profiles: {
    full_name: string;
  };
}

interface MuralSettings {
  auto_approve: boolean;
  ai_moderation: boolean;
  auto_integrate_feed: boolean;
  min_approval_confidence: number;
  forbidden_words: string[];
}

interface Stats {
  total_posts: number;
  approved_posts: number;
  pending_posts: number;
  rejected_posts: number;
  total_responses: number;
  auto_approved: number;
  manual_approved: number;
}

interface AILog {
  id: string;
  content: string;
  category_id?: string;
  category_name?: string;
  status: string;
  ai_reason?: string;
  approval_source?: string;
  created_at: string;
  approved_at?: string;
  type: 'post' | 'response';
  author_name: string;
}

interface CategoryStat {
  category: string;
  count: number;
  percentage: number;
}

interface TrendData {
  date: string;
  posts: number;
  responses: number;
  auto_approved: number;
}

export function AdminMural() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pendingPosts, setPendingPosts] = useState<MuralPost[]>([]);
  const [approvedPosts, setApprovedPosts] = useState<MuralPost[]>([]);
  const [rejectedPosts, setRejectedPosts] = useState<MuralPost[]>([]);
  const [pendingResponses, setPendingResponses] = useState<MuralResponse[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [aiLogs, setAiLogs] = useState<AILog[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [settings, setSettings] = useState<MuralSettings>({
    auto_approve: true,
    ai_moderation: true,
    auto_integrate_feed: true,
    min_approval_confidence: 0.7,
    forbidden_words: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchPendingPosts(),
        fetchApprovedPosts(),
        fetchRejectedPosts(),
        fetchPendingResponses(),
        fetchStats(),
        fetchSettings(),
        fetchAILogs(),
        fetchCategoryStats(),
        fetchTrendData()
      ]);
    } catch (error) {
      console.error("Error fetching mural data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados do mural.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingPosts = async () => {
    const { data, error } = await supabase
      .from("mural_posts")
      .select(`
        id,
        content,
        category_id,
        status,
        author_id,
        created_at,
        response_count,
        ai_reason,
        approval_source,
        profiles!mural_posts_author_id_fkey (full_name, unit_code),
        mural_categories(name, key)
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    setPendingPosts(data as any || []);
  };

  const fetchApprovedPosts = async () => {
    const { data, error } = await supabase
      .from("mural_posts")
      .select(`
        id,
        content,
        category_id,
        status,
        author_id,
        created_at,
        response_count,
        ai_reason,
        approval_source,
        profiles!mural_posts_author_id_fkey (full_name, unit_code),
        mural_categories(name, key)
      `)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    setApprovedPosts(data as any || []);
  };

  const fetchRejectedPosts = async () => {
    const { data, error } = await supabase
      .from("mural_posts")
      .select(`
        id,
        content,
        category_id,
        status,
        author_id,
        created_at,
        response_count,
        ai_reason,
        approval_source,
        profiles!mural_posts_author_id_fkey (full_name, unit_code),
        mural_categories(name, key)
      `)
      .eq("status", "rejected")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    setRejectedPosts(data as any || []);
  };

  const fetchPendingResponses = async () => {
    const { data, error } = await supabase
      .from("mural_responses")
      .select(`
        id,
        post_id,
        content,
        status,
        responder_id,
        created_at,
        ai_reason,
        profiles!mural_responses_responder_id_fkey (full_name)
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;
    setPendingResponses(data as any || []);
  };

  const fetchStats = async () => {
    const { data: posts } = await supabase
      .from("mural_posts")
      .select("status, approval_source");

    const { data: responses } = await supabase
      .from("mural_responses")
      .select("status");

    if (posts) {
      const stats: Stats = {
        total_posts: posts.length,
        approved_posts: posts.filter(p => p.status === "approved").length,
        pending_posts: posts.filter(p => p.status === "pending").length,
        rejected_posts: posts.filter(p => p.status === "rejected").length,
        total_responses: responses?.length || 0,
        auto_approved: posts.filter(p => p.approval_source === "ai").length,
        manual_approved: posts.filter(p => p.approval_source === "manual").length
      };
      setStats(stats);
    }
  };

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("mural_settings")
      .select("*");

    if (data) {
      const settingsObj: any = {};
      data.forEach(setting => {
        settingsObj[setting.key] = setting.value;
      });
      
      setSettings({
        auto_approve: settingsObj.auto_approve?.enabled || false,
        ai_moderation: settingsObj.ai_moderation?.enabled || false,
        auto_integrate_feed: settingsObj.auto_integrate_feed?.enabled || false,
        min_approval_confidence: settingsObj.auto_approve?.min_confidence || 0.7,
        forbidden_words: settingsObj.forbidden_words?.words || []
      });
    }
  };

  const fetchAILogs = async () => {
    // Fetch posts with AI approval
    const { data: posts } = await supabase
      .from("mural_posts")
      .select(`
        id,
        content,
        category_id,
        status,
        ai_reason,
        approval_source,
        created_at,
        approved_at,
        profiles!mural_posts_author_id_fkey (full_name),
        mural_categories(name)
      `)
      .eq("approval_source", "ai")
      .order("approved_at", { ascending: false })
      .limit(50);

    // Fetch responses with AI approval
    const { data: responses } = await supabase
      .from("mural_responses")
      .select(`
        id,
        content,
        status,
        ai_reason,
        approval_source,
        created_at,
        approved_at,
        profiles!mural_responses_responder_id_fkey (full_name)
      `)
      .eq("approval_source", "ai")
      .order("approved_at", { ascending: false })
      .limit(50);

    const logs: AILog[] = [
      ...(posts || []).map(p => ({
        id: p.id,
        content: p.content,
        category_id: p.category_id,
        category_name: (p.mural_categories as any)?.name,
        status: p.status,
        ai_reason: p.ai_reason,
        approval_source: p.approval_source,
        created_at: p.created_at,
        approved_at: p.approved_at,
        type: 'post' as const,
        author_name: (p.profiles as any)?.full_name || 'Anônimo'
      })),
      ...(responses || []).map(r => ({
        id: r.id,
        content: r.content,
        status: r.status,
        ai_reason: r.ai_reason,
        approval_source: r.approval_source,
        created_at: r.created_at,
        approved_at: r.approved_at,
        type: 'response' as const,
        author_name: (r.profiles as any)?.full_name || 'Anônimo'
      }))
    ].sort((a, b) => {
      const dateA = new Date(a.approved_at || a.created_at);
      const dateB = new Date(b.approved_at || b.created_at);
      return dateB.getTime() - dateA.getTime();
    });

    setAiLogs(logs);
  };

  const fetchCategoryStats = async () => {
    const { data: posts } = await supabase
      .from("mural_posts")
      .select(`
        category_id,
        status,
        mural_categories(name)
      `)
      .eq("status", "approved");

    if (posts) {
      const categoryCounts: Record<string, number> = {};
      posts.forEach(post => {
        const categoryName = (post.mural_categories as any)?.name || 'Sem categoria';
        categoryCounts[categoryName] = (categoryCounts[categoryName] || 0) + 1;
      });

      const total = posts.length;
      const stats: CategoryStat[] = Object.entries(categoryCounts)
        .map(([category, count]) => ({
          category,
          count,
          percentage: Math.round((count / total) * 100)
        }))
        .sort((a, b) => b.count - a.count);

      setCategoryStats(stats);
    }
  };

  const fetchTrendData = async () => {
    const { data: posts } = await supabase
      .from("mural_posts")
      .select("created_at, status, approval_source");

    const { data: responses } = await supabase
      .from("mural_responses")
      .select("created_at, status");

    if (posts && responses) {
      // Group by date (last 30 days)
      const trends: Record<string, TrendData> = {};
      const today = new Date();
      
      // Initialize last 30 days
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = format(date, "yyyy-MM-dd");
        trends[dateStr] = {
          date: dateStr,
          posts: 0,
          responses: 0,
          auto_approved: 0
        };
      }

      // Count posts
      posts.forEach(post => {
        const dateStr = format(new Date(post.created_at), "yyyy-MM-dd");
        if (trends[dateStr]) {
          trends[dateStr].posts++;
          if (post.approval_source === "ai" && post.status === "approved") {
            trends[dateStr].auto_approved++;
          }
        }
      });

      // Count responses
      responses.forEach(response => {
        const dateStr = format(new Date(response.created_at), "yyyy-MM-dd");
        if (trends[dateStr]) {
          trends[dateStr].responses++;
        }
      });

      setTrendData(Object.values(trends));
    }
  };

  const moderatePost = async (postId: string, status: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("mural_posts")
        .update({
          status,
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          approved_at: status === "approved" ? new Date().toISOString() : null,
          approval_source: "manual"
        })
        .eq("id", postId);

      if (error) throw error;

      // Integrar com Feed quando aprovado manualmente
      if (status === "approved") {
        try {
          const { error: feedError } = await supabase.functions.invoke('mural-feed-integration', {
            body: {
              post_id: postId,
              approval_source: 'admin'
            }
          });

          if (feedError) {
            console.error('Erro ao integrar com Feed:', feedError);
          }

          // Criar notificação para o autor do post
          const { data: post } = await supabase
            .from('mural_posts')
            .select('author_id')
            .eq('id', postId)
            .single();

          if (post?.author_id) {
            await supabase.from('notifications').insert({
              user_id: post.author_id,
              title: '✅ Sua postagem foi aprovada',
              message: 'Seu pedido no Mural Cresci e Perdi foi aprovado e está visível para todos.',
              type: 'mural_approved',
              reference_id: postId,
              is_read: false
            });
          }
        } catch (feedIntegrationError) {
          console.error('Falha na integração com Feed:', feedIntegrationError);
        }
      }

      toast({
        title: status === "approved" ? "Post aprovado e publicado no Feed" : "Post rejeitado",
        description: status === "approved" 
          ? "O post foi aprovado e está visível no Mural e no Feed." 
          : "O post foi rejeitado."
      });

      fetchData();
    } catch (error) {
      console.error("Error moderating post:", error);
      toast({
        title: "Erro",
        description: "Não foi possível moderar o post.",
        variant: "destructive"
      });
    }
  };

  const moderateResponse = async (responseId: string, status: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("mural_responses")
        .update({
          status,
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          approved_at: status === "approved" ? new Date().toISOString() : null,
          approval_source: "manual"
        })
        .eq("id", responseId);

      if (error) throw error;

      toast({
        title: `Resposta ${status === "approved" ? "aprovada" : "rejeitada"}`,
        description: "A ação foi registrada com sucesso."
      });

      fetchData();
    } catch (error) {
      console.error("Error moderating response:", error);
      toast({
        title: "Erro",
        description: "Não foi possível moderar a resposta.",
        variant: "destructive"
      });
    }
  };

  const updateSettings = async () => {
    try {
      const updates = [
        {
          key: "auto_approve",
          value: { enabled: settings.auto_approve, min_confidence: settings.min_approval_confidence }
        },
        {
          key: "ai_moderation",
          value: { enabled: settings.ai_moderation }
        },
        {
          key: "auto_integrate_feed",
          value: { enabled: settings.auto_integrate_feed }
        },
        {
          key: "forbidden_words",
          value: { words: settings.forbidden_words }
        }
      ];

      for (const update of updates) {
        await supabase
          .from("mural_settings")
          .upsert({
            key: update.key,
            value: update.value,
            updated_at: new Date().toISOString()
          }, { onConflict: "key" });
      }

      toast({
        title: "Configurações salvas",
        description: "As configurações foram atualizadas com sucesso."
      });
    } catch (error) {
      console.error("Error updating settings:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive"
      });
    }
  };

  const getCategoryBadge = (categoryName: string) => {
    return (
      <Badge variant="outline" className="capitalize">
        {categoryName}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Mural Cresci e Perdi</h2>
        <p className="text-muted-foreground">
          Gerencie posts, respostas e configurações do mural
        </p>
      </div>

      <Tabs defaultValue="moderation" className="space-y-4">
        <TabsList>
          <TabsTrigger value="moderation" className="gap-2">
            <Shield className="h-4 w-4" />
            Moderação
            {(pendingPosts.length + pendingResponses.length) > 0 && (
              <Badge variant="destructive" className="ml-1">
                {pendingPosts.length + pendingResponses.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ai-logs" className="gap-2">
            <History className="h-4 w-4" />
            Logs de IA
            <Badge variant="secondary" className="ml-1">
              {aiLogs.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Relatórios
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2">
            <Users className="h-4 w-4" />
            Categorias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="moderation" className="space-y-4">
          {/* Layout Kanban com 3 colunas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Coluna 1: Aguardando Aprovação */}
            <Card className="border-yellow-500/50">
              <CardHeader className="bg-yellow-500/10">
                <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                  <Clock className="h-5 w-5" />
                  Aguardando
                  {pendingPosts.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">{pendingPosts.length}</Badge>
                  )}
                </CardTitle>
                <CardDescription>Posts pendentes de moderação</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 max-h-[600px] overflow-y-auto">
                {pendingPosts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum post pendente</p>
                  </div>
                ) : (
                  pendingPosts.map((post) => (
                    <Card key={post.id} className="border-l-4 border-l-yellow-500">
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          {post.mural_categories && getCategoryBadge(post.mural_categories.name)}
                          <Badge variant="outline" className="gap-1">
                            <Users className="h-3 w-3" />
                            {post.profiles.full_name}
                          </Badge>
                          <span className="text-muted-foreground">
                            {format(new Date(post.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm line-clamp-3">{post.content}</p>
                        {post.ai_reason && (
                          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                            <Sparkles className="h-3 w-3 flex-shrink-0 mt-0.5" />
                            <span>{post.ai_reason}</span>
                          </div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => moderatePost(post.id, "approved")}
                            className="gap-1 flex-1"
                          >
                            <CheckCircle className="h-3 w-3" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => moderatePost(post.id, "rejected")}
                            className="gap-1 flex-1"
                          >
                            <XCircle className="h-3 w-3" />
                            Rejeitar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Coluna 2: Aprovadas */}
            <Card className="border-green-500/50">
              <CardHeader className="bg-green-500/10">
                <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <CheckCircle className="h-5 w-5" />
                  Aprovadas
                  {approvedPosts.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">{approvedPosts.length}</Badge>
                  )}
                </CardTitle>
                <CardDescription>Últimas 20 aprovadas</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 max-h-[600px] overflow-y-auto">
                {approvedPosts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum post aprovado ainda</p>
                  </div>
                ) : (
                  approvedPosts.map((post) => (
                    <Card key={post.id} className="border-l-4 border-l-green-500">
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          {post.mural_categories && getCategoryBadge(post.mural_categories.name)}
                          {post.approval_source === "ai" && (
                            <Badge variant="outline" className="gap-1 bg-purple-500/10 text-purple-700 dark:text-purple-300">
                              <Sparkles className="h-3 w-3" />
                              IA
                            </Badge>
                          )}
                          <span className="text-muted-foreground">
                            {format(new Date(post.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm line-clamp-3">{post.content}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                          <MessageSquare className="h-3 w-3" />
                          <span>{post.response_count} respostas</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Coluna 3: Recusadas */}
            <Card className="border-red-500/50">
              <CardHeader className="bg-red-500/10">
                <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
                  <XCircle className="h-5 w-5" />
                  Recusadas
                  {rejectedPosts.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">{rejectedPosts.length}</Badge>
                  )}
                </CardTitle>
                <CardDescription>Últimas 20 recusadas</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 max-h-[600px] overflow-y-auto">
                {rejectedPosts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum post recusado</p>
                  </div>
                ) : (
                  rejectedPosts.map((post) => (
                    <Card key={post.id} className="border-l-4 border-l-red-500">
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          {post.mural_categories && getCategoryBadge(post.mural_categories.name)}
                          {post.approval_source === "ai" && (
                            <Badge variant="outline" className="gap-1 bg-purple-500/10 text-purple-700 dark:text-purple-300">
                              <Sparkles className="h-3 w-3" />
                              IA
                            </Badge>
                          )}
                          <span className="text-muted-foreground">
                            {format(new Date(post.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm line-clamp-3">{post.content}</p>
                        {post.ai_reason && (
                          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                            <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                            <span>{post.ai_reason}</span>
                          </div>
                        )}
                        <div className="pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => moderatePost(post.id, "approved")}
                            className="gap-1 w-full"
                          >
                            <CheckCircle className="h-3 w-3" />
                            Aprovar agora
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Respostas Pendentes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Respostas Pendentes
                {pendingResponses.length > 0 && (
                  <Badge variant="secondary">{pendingResponses.length}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Respostas aguardando aprovação manual
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingResponses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma resposta pendente</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingResponses.map((response) => (
                    <Card key={response.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="pt-6">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="gap-1">
                                  <Users className="h-3 w-3" />
                                  {response.profiles.full_name}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(response.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </span>
                              </div>
                              <p className="text-sm">{response.content}</p>
                              {response.ai_reason && (
                                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                                  <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                  <span><strong>IA:</strong> {response.ai_reason}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => moderateResponse(response.id, "approved")}
                              className="gap-2"
                            >
                              <CheckCircle className="h-4 w-4" />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => moderateResponse(response.id, "rejected")}
                              className="gap-2"
                            >
                              <XCircle className="h-4 w-4" />
                              Rejeitar
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Histórico de Decisões Automáticas da IA
              </CardTitle>
              <CardDescription>
                Logs de aprovações e rejeições automáticas com justificativas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aiLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma decisão automática registrada ainda</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {aiLogs.map((log) => (
                    <Card 
                      key={log.id} 
                      className={`border-l-4 ${
                        log.status === 'approved' 
                          ? 'border-l-green-500' 
                          : log.status === 'rejected'
                          ? 'border-l-red-500'
                          : 'border-l-yellow-500'
                      }`}
                    >
                      <CardContent className="pt-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={log.status === 'approved' ? 'default' : 'destructive'}>
                                {log.status === 'approved' ? 'Aprovado' : 
                                 log.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                              </Badge>
                              <Badge variant="outline">
                                {log.type === 'post' ? 'Post' : 'Resposta'}
                              </Badge>
                              {log.category_name && getCategoryBadge(log.category_name)}
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(log.approved_at || log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm line-clamp-2">{log.content}</p>
                          {log.ai_reason && (
                            <div className="flex items-start gap-2 text-xs bg-muted/50 p-2 rounded">
                              <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5 text-purple-600" />
                              <div>
                                <strong className="text-purple-600">Decisão da IA:</strong>
                                <p className="mt-1 text-muted-foreground">{log.ai_reason}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          {stats && (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Posts</CardTitle>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.total_posts}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.pending_posts} aguardando aprovação
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Aprovados</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.approved_posts}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.total_posts > 0 
                        ? Math.round((stats.approved_posts / stats.total_posts) * 100)
                        : 0}% do total
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Auto-aprovados (IA)</CardTitle>
                    <Sparkles className="h-4 w-4 text-purple-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.auto_approved}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.approved_posts > 0
                        ? Math.round((stats.auto_approved / stats.approved_posts) * 100)
                        : 0}% dos aprovados
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Respostas</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.total_responses}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.total_posts > 0
                        ? (stats.total_responses / stats.total_posts).toFixed(1)
                        : 0} por post
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Resumo Geral
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Aprovação Manual</span>
                      <Badge variant="outline">{stats.manual_approved} posts</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Rejeitados</span>
                      <Badge variant="destructive">{stats.rejected_posts} posts</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Taxa de Aprovação</span>
                      <Badge variant="secondary">
                        {stats.total_posts > 0
                          ? Math.round((stats.approved_posts / stats.total_posts) * 100)
                          : 0}%
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Análise de Categorias */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="h-5 w-5" />
                      Distribuição por Categoria
                    </CardTitle>
                    <CardDescription>
                      Posts aprovados por tipo de conteúdo
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {categoryStats.length > 0 ? (
                      <div className="space-y-4">
                        <ResponsiveContainer width="100%" height={250}>
                          <RechartsPieChart>
                            <Pie
                              data={categoryStats}
                              dataKey="count"
                              nameKey="category"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label={(entry) => `${entry.category}: ${entry.percentage}%`}
                            >
                              {categoryStats.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={[
                                    'hsl(var(--chart-1))',
                                    'hsl(var(--chart-2))',
                                    'hsl(var(--chart-3))',
                                    'hsl(var(--chart-4))',
                                    'hsl(var(--chart-5))'
                                  ][index % 5]} 
                                />
                              ))}
                            </Pie>
                            <Tooltip />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2">
                          {categoryStats.map((stat, index) => (
                            <div key={stat.category} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{
                                    backgroundColor: [
                                      'hsl(var(--chart-1))',
                                      'hsl(var(--chart-2))',
                                      'hsl(var(--chart-3))',
                                      'hsl(var(--chart-4))',
                                      'hsl(var(--chart-5))'
                                    ][index % 5]
                                  }}
                                />
                                <span className="text-sm capitalize">{stat.category}</span>
                              </div>
                              <Badge variant="outline">{stat.count} ({stat.percentage}%)</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <PieChart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhum dado disponível ainda</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Categorias Mais Frequentes
                    </CardTitle>
                    <CardDescription>
                      Top 5 temas mais abordados
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {categoryStats.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={categoryStats.slice(0, 5)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="category" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="hsl(var(--primary))" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhum dado disponível ainda</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Tendências ao Longo do Tempo */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Tendências dos Últimos 30 Dias
                  </CardTitle>
                  <CardDescription>
                    Volume de posts, respostas e aprovações automáticas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {trendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(value) => format(new Date(value), "dd/MM")}
                        />
                        <YAxis />
                        <Tooltip 
                          labelFormatter={(value) => format(new Date(value), "dd/MM/yyyy", { locale: ptBR })}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="posts" 
                          stroke="hsl(var(--chart-1))" 
                          name="Posts"
                          strokeWidth={2}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="responses" 
                          stroke="hsl(var(--chart-2))" 
                          name="Respostas"
                          strokeWidth={2}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="auto_approved" 
                          stroke="hsl(var(--chart-3))" 
                          name="Auto-aprovados"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum dado de tendência disponível ainda</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Moderação Automática com IA
              </CardTitle>
              <CardDescription>
                Configure como a IA GiraBot modera automaticamente o conteúdo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Habilitar Moderação com IA</Label>
                  <p className="text-sm text-muted-foreground">
                    Posts e respostas serão analisados automaticamente pela IA
                  </p>
                </div>
                <Switch
                  checked={settings.ai_moderation}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, ai_moderation: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-aprovar Conteúdo Seguro</Label>
                  <p className="text-sm text-muted-foreground">
                    Aprovar automaticamente quando a IA tem alta confiança
                  </p>
                </div>
                <Switch
                  checked={settings.auto_approve}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, auto_approve: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Confiança Mínima para Auto-aprovação</Label>
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.min_approval_confidence}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      min_approval_confidence: parseFloat(e.target.value)
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  De 0 a 1 (recomendado: 0.7)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Integração com Feed
              </CardTitle>
              <CardDescription>
                Configure como posts aprovados aparecem no feed principal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Publicar Automaticamente no Feed</Label>
                  <p className="text-sm text-muted-foreground">
                    Posts aprovados aparecem automaticamente no feed
                  </p>
                </div>
                <Switch
                  checked={settings.auto_integrate_feed}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, auto_integrate_feed: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Filtros de Conteúdo
              </CardTitle>
              <CardDescription>
                Palavras e termos proibidos (uma por linha)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Digite palavras proibidas, uma por linha"
                value={settings.forbidden_words.join("\n")}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    forbidden_words: e.target.value.split("\n").filter(w => w.trim())
                  })
                }
                rows={6}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={updateSettings} size="lg">
              Salvar Configurações
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <MuralCategoryManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
