import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Search, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Comment {
  id: string;
  comment: string;
  created_at: string;
  user_id: string;
  post_id: string;
  profiles?: {
    full_name: string;
    avatar_url?: string;
  };
  feed_posts?: {
    title: string;
    type: string;
  };
}

export function FeedCommentsModeration() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchComments = async () => {
    try {
      setLoading(true);
      let query = (supabase as any)
        .from("feed_post_comments")
        .select(`
          *,
          profiles:user_id (full_name, avatar_url),
          feed_posts:post_id (title, type)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (searchQuery.trim()) {
        query = query.ilike("comment", `%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      setComments(data || []);
    } catch (error: any) {
      console.error("Error fetching comments:", error);
      toast.error("Erro ao carregar comentários");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [searchQuery]);

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Tem certeza que deseja excluir este comentário?")) return;

    try {
      const { error } = await (supabase as any)
        .from("feed_post_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      toast.success("Comentário excluído");
      fetchComments();
    } catch (error: any) {
      console.error("Error deleting comment:", error);
      toast.error("Erro ao excluir comentário");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Moderação de Comentários
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {comments.length} comentário{comments.length !== 1 ? "s" : ""} encontrado{comments.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar comentários..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {comments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum comentário encontrado
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Comentário</TableHead>
                <TableHead>Post</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comments.map((comment) => (
                <TableRow key={comment.id}>
                  <TableCell className="font-medium">
                    {comment.profiles?.full_name || "Usuário Desconhecido"}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="line-clamp-2 text-sm">{comment.comment}</p>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="line-clamp-1 text-sm">
                      {comment.feed_posts?.title || "Post Removido"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {comment.feed_posts?.type || "N/A"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteComment(comment.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
