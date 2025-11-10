import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Loader2, Heart, RefreshCw } from "lucide-react";
import { MuralCategories } from "@/components/mural/MuralCategories";
import { MuralPostCard } from "@/components/mural/MuralPostCard";
import { CreatePostDialog } from "@/components/mural/CreatePostDialog";
import { ResponsesList } from "@/components/mural/ResponsesList";
import { CreateResponseDialog } from "@/components/mural/CreateResponseDialog";

interface MuralPost {
  id: string;
  content: string;
  category_id: string;
  status: "pending" | "approved" | "rejected";
  response_count: number;
  created_at: string;
  media_url?: string;
  approval_source?: "ai" | "manual";
  mural_categories?: {
    name: string;
    icon: string;
    color: string;
  };
}

export default function Mural() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<MuralPost[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [viewResponsesDialogOpen, setViewResponsesDialogOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts();
  }, [selectedCategory]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("mural_posts")
        .select(`
          *,
          mural_categories(name, icon, color)
        `)
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (selectedCategory) {
        query = query.eq("category_id", selectedCategory);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error("Error fetching posts:", error);
      toast({
        title: "Erro ao carregar posts",
        description: "Não foi possível carregar os posts do mural.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = (postId: string) => {
    setSelectedPostId(postId);
    setResponseDialogOpen(true);
  };

  const handleViewResponses = (postId: string) => {
    setSelectedPostId(postId);
    setViewResponsesDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Heart className="h-8 w-8 text-pink-500" />
              Mural Cresci e Perdi
            </h1>
            <p className="text-muted-foreground mt-1">
              Um espaço seguro e anônimo para compartilhar conquistas, reflexões e apoio mútuo.
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchPosts}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Categories */}
        <MuralCategories
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {/* Posts Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Heart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">
                {selectedCategory
                  ? "Nenhum post nesta categoria ainda"
                  : "Nenhum post no mural ainda"}
              </h3>
              <p className="text-muted-foreground mb-4">
                Seja o primeiro a compartilhar algo especial!
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                Criar Primeiro Post
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="mural-posts-grid">
            {posts.map((post) => (
              <MuralPostCard
                key={post.id}
                post={post}
                onRespond={handleRespond}
                onViewResponses={handleViewResponses}
              />
            ))}
          </div>
        )}

        {/* Botão Flutuante "Pedir Ajuda" */}
          <Button
            data-testid="create-post-button"
            onClick={() => setCreateDialogOpen(true)}
            className="fixed bottom-20 right-6 h-14 px-6 rounded-full shadow-lg hover:scale-110 transition-transform z-50 gap-2"
            size="lg"
          >
            🧩 Pedir Ajuda
          </Button>

        {/* Create Post Dialog */}
        <CreatePostDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onPostCreated={fetchPosts}
        />

        {/* Create Response Dialog */}
        {selectedPostId && (
          <CreateResponseDialog
            open={responseDialogOpen}
            onOpenChange={setResponseDialogOpen}
            postId={selectedPostId}
            onResponseCreated={() => {
              fetchPosts();
              if (viewResponsesDialogOpen) {
                // Refresh responses list
                setViewResponsesDialogOpen(false);
                setTimeout(() => setViewResponsesDialogOpen(true), 100);
              }
            }}
          />
        )}

        {/* View Responses Dialog */}
        {selectedPostId && (
          <Dialog open={viewResponsesDialogOpen} onOpenChange={setViewResponsesDialogOpen}>
            <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Respostas</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <ResponsesList postId={selectedPostId} />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AppLayout>
  );
}
