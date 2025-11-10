import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface RelatedPost {
  id: string;
  type: string;
  title: string;
  description: string;
  module_link?: string;
  reason?: string;
  relevance_score?: number;
}

interface RelatedContentCardProps {
  postId: string;
  userId: string;
}

export function RelatedContentCard({ postId, userId }: RelatedContentCardProps) {
  const [related, setRelated] = useState<RelatedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  const fetchRelated = async () => {
    if (related.length > 0) {
      setVisible(!visible);
      return;
    }

    setLoading(true);
    setVisible(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('feed-recommend-related', {
        body: { post_id: postId, user_id: userId }
      });

      if (error) throw error;

      setRelated(data.recommendations || []);
    } catch (error: any) {
      console.error("Error fetching related content:", error);
      toast.error("Erro ao carregar conteúdo relacionado");
    } finally {
      setLoading(false);
    }
  };

  const typeLabels: Record<string, string> = {
    training: 'Treinamento',
    checklist: 'Rotina',
    manual: 'Manual',
    campaign: 'Campanha',
    recognition: 'Reconhecimento',
    idea: 'Ideia',
    media: 'Mídia',
    survey: 'Pesquisa',
    announcement: 'Comunicado',
  };

  return (
    <div className="border-t border-border">
      <Button
        variant="ghost"
        className="w-full flex items-center gap-2 py-3 text-sm"
        onClick={fetchRelated}
        disabled={loading}
      >
        <Link2 className="h-4 w-4" />
        {loading ? 'Buscando...' : visible ? 'Ocultar relacionados' : 'Ver conteúdo relacionado'}
      </Button>

      {visible && related.length > 0 && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-xs text-muted-foreground mb-3">
            🤖 GiraBot recomenda:
          </p>
          {related.map((post) => (
            <Card key={post.id} className="bg-muted/50">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs">
                        {typeLabels[post.type] || post.type}
                      </Badge>
                      {post.reason && (
                        <span className="text-xs text-muted-foreground">
                          {post.reason}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-medium line-clamp-1 mb-1">
                      {post.title}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {post.description}
                    </p>
                  </div>
                  {post.module_link && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0"
                      asChild
                    >
                      <a href={post.module_link}>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {visible && related.length === 0 && !loading && (
        <div className="px-4 pb-4 text-center text-sm text-muted-foreground">
          Nenhum conteúdo relacionado encontrado
        </div>
      )}
    </div>
  );
}
