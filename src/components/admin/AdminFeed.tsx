import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pin, Trash2, TrendingUp, Eye, BarChart3, MessageSquare, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FeedEngagementDashboard } from "./FeedEngagementDashboard";
import { FeedCommentsModeration } from "./FeedCommentsModeration";
import { FeedWeeklySummary } from "./FeedWeeklySummary";

interface FeedPost {
  id: string;
  type: string;
  title: string;
  description: string;
  module_link?: string;
  media_url?: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  pinned: boolean;
}

const POST_TYPES = [
  { value: "announcement", label: "Comunicado" },
  { value: "training", label: "Treinamento" },
  { value: "checklist", label: "Rotina" },
  { value: "manual", label: "Manual" },
  { value: "campaign", label: "Campanha" },
  { value: "recognition", label: "Reconhecimento" },
  { value: "idea", label: "Ideia" },
  { value: "media", label: "Mídia" },
  { value: "survey", label: "Pesquisa" },
];

export default function AdminFeed() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    type: "announcement",
    title: "",
    description: "",
    module_link: "",
    media_url: "",
    pinned: false,
    target_roles: [] as string[],
  });

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from("feed_posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error: any) {
      console.error("Error fetching posts:", error);
      toast.error("Erro ao carregar posts");
    } finally {
      setLoading(false);
    }
  };

  const fetchRolesAndUnits = async () => {
    try {
      // Fetch distinct roles
      const { data: rolesData } = await supabase
        .from("profiles")
        .select("role")
        .not("role", "is", null);
      
      const uniqueRoles = [...new Set(rolesData?.map(p => p.role).filter(Boolean))];
      setRoles(uniqueRoles as string[]);
    } catch (error: any) {
      console.error("Error fetching roles:", error);
    }
  };

  useEffect(() => {
    fetchPosts();
    fetchRolesAndUnits();
  }, []);

  const handleCreate = async () => {
    if (!formData.title || !formData.description) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      const { data: newPost, error } = await supabase.from("feed_posts").insert([{
        ...formData,
        target_units: [], // Keep for future use
      }]).select().single();

      if (error) throw error;

      toast.success("Post criado com sucesso!");

      // Enviar notificação push para usuários alvo
      try {
        const { data: targetUsers } = await supabase
          .from('profiles')
          .select('id, full_name, phone, role')
          .eq('is_active', true);

        if (targetUsers && targetUsers.length > 0) {
          // Filtrar por roles se especificado
          const filteredUsers = formData.target_roles.length > 0
            ? targetUsers.filter(u => formData.target_roles.includes(u.role))
            : targetUsers;

          // Enviar notificação via send-notification-advanced
          await supabase.functions.invoke('send-notification-advanced', {
            body: {
              recipients: filteredUsers.map(u => ({
                user_id: u.id,
                phone: u.phone,
                email: null,
              })),
              title: `📣 ${formData.title}`,
              message: formData.description,
              type: formData.type,
              reference_id: newPost?.id,
              channels: ['push', 'whatsapp'],
              priority: formData.pinned ? 'high' : 'normal',
            }
          });

          console.log(`Notificações enviadas para ${filteredUsers.length} usuários`);
        }
      } catch (notifError) {
        console.error('Erro ao enviar notificações:', notifError);
        // Não falhar a criação do post por erro na notificação
      }

      setDialogOpen(false);
      setFormData({
        type: "announcement",
        title: "",
        description: "",
        module_link: "",
        media_url: "",
        pinned: false,
        target_roles: [],
      });
      fetchPosts();
    } catch (error: any) {
      console.error("Error creating post:", error);
      toast.error("Erro ao criar post");
    }
  };

  const handleTogglePin = async (postId: string, currentPinned: boolean) => {
    try {
      const { error } = await supabase
        .from("feed_posts")
        .update({ pinned: !currentPinned })
        .eq("id", postId);

      if (error) throw error;

      toast.success(currentPinned ? "Post desafixado" : "Post fixado");
      fetchPosts();
    } catch (error: any) {
      console.error("Error toggling pin:", error);
      toast.error("Erro ao fixar/desafixar post");
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("Tem certeza que deseja excluir este post?")) return;

    try {
      const { error } = await supabase
        .from("feed_posts")
        .delete()
        .eq("id", postId);

      if (error) throw error;

      toast.success("Post excluído com sucesso!");
      fetchPosts();
    } catch (error: any) {
      console.error("Error deleting post:", error);
      toast.error("Erro ao excluir post");
    }
  };

  const getEngagementRate = (post: FeedPost) => {
    const total = post.likes_count + post.comments_count;
    if (total === 0) return "0%";
    return `${Math.round((post.likes_count / total) * 100)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="posts" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="posts" className="gap-2">
          <Eye className="w-4 h-4" />
          Posts
        </TabsTrigger>
        <TabsTrigger value="moderation" className="gap-2">
          <MessageSquare className="w-4 h-4" />
          Moderação
        </TabsTrigger>
        <TabsTrigger value="summary" className="gap-2">
          <FileText className="w-4 h-4" />
          Resumo
        </TabsTrigger>
        <TabsTrigger value="analytics" className="gap-2">
          <BarChart3 className="w-4 h-4" />
          Analytics
        </TabsTrigger>
      </TabsList>

      <TabsContent value="posts">
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gerenciar Feed</h2>
          <p className="text-muted-foreground">
            Gerencie posts e monitore engajamento
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Post
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Novo Post</DialogTitle>
              <DialogDescription>
                Publique uma novidade no feed institucional
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Tipo de Conteúdo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POST_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Título *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Ex: Nova Campanha de Vendas"
                />
              </div>

              <div>
                <Label>Descrição *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Descreva a novidade..."
                  rows={4}
                />
              </div>

              <div>
                <Label>Link do Módulo</Label>
                <Input
                  value={formData.module_link}
                  onChange={(e) =>
                    setFormData({ ...formData, module_link: e.target.value })
                  }
                  placeholder="/campanhas"
                />
              </div>

              <div>
                <Label>URL da Mídia</Label>
                <Input
                  value={formData.media_url}
                  onChange={(e) =>
                    setFormData({ ...formData, media_url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.pinned}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, pinned: checked })
                  }
                />
                <Label>Fixar no topo do feed</Label>
              </div>

              {/* Audience Targeting */}
              <div className="space-y-3 pt-4 border-t">
                <h3 className="font-semibold text-sm">Segmentação de Audiência</h3>
                <p className="text-sm text-muted-foreground">
                  Deixe vazio para mostrar a todos. Selecione cargos específicos para restringir.
                </p>
                
                <div>
                  <Label>Cargos</Label>
                  <Select
                    value=""
                    onValueChange={(role) => {
                      if (!formData.target_roles.includes(role)) {
                        setFormData({ 
                          ...formData, 
                          target_roles: [...formData.target_roles, role] 
                        });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Adicionar cargo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.target_roles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.target_roles.map((role) => (
                        <Badge 
                          key={role} 
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => setFormData({
                            ...formData,
                            target_roles: formData.target_roles.filter(r => r !== role)
                          })}
                        >
                          {role} ✕
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Button onClick={handleCreate} className="w-full">
                Publicar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Posts</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{posts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Curtidas</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {posts.reduce((sum, post) => sum + post.likes_count, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Comentários</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {posts.reduce((sum, post) => sum + post.comments_count, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Posts Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Curtidas</TableHead>
                <TableHead>Comentários</TableHead>
                <TableHead>Engajamento</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell>
                    <Badge variant="secondary">
                      {POST_TYPES.find((t) => t.value === post.type)?.label || post.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {post.pinned && <Pin className="inline h-4 w-4 mr-2 text-primary" />}
                    {post.title}
                  </TableCell>
                  <TableCell>{post.likes_count}</TableCell>
                  <TableCell>{post.comments_count}</TableCell>
                  <TableCell>{getEngagementRate(post)}</TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(post.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTogglePin(post.id, post.pinned)}
                      >
                        <Pin className={`h-4 w-4 ${post.pinned ? "text-primary" : ""}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(post.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </TabsContent>

    <TabsContent value="moderation">
      <FeedCommentsModeration />
    </TabsContent>

    <TabsContent value="summary">
      <FeedWeeklySummary />
    </TabsContent>

    <TabsContent value="analytics">
      <FeedEngagementDashboard />
    </TabsContent>
  </Tabs>
  );
}