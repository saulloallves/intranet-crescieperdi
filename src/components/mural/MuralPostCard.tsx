import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, Clock, CheckCircle, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as LucideIcons from "lucide-react";

interface MuralPost {
  id: string;
  content: string;
  category_id: string;
  status: "pending" | "approved" | "rejected";
  response_count: number;
  created_at: string;
  media_url?: string;
  approval_source?: "ai" | "manual";
  profiles?: {
    full_name: string;
    unit_code: string;
  };
  mural_categories?: {
    name: string;
    icon: string;
    color: string;
  };
}

interface MuralPostCardProps {
  post: MuralPost;
  onRespond: (postId: string) => void;
  onViewResponses: (postId: string) => void;
  showAuthor?: boolean;
}

export function MuralPostCard({ 
  post, 
  onRespond, 
  onViewResponses,
  showAuthor = false 
}: MuralPostCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const getIcon = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName];
    return Icon || LucideIcons.HelpCircle;
  };

  const Icon = post.mural_categories ? getIcon(post.mural_categories.icon) : null;

  const contentPreview = post.content.length > 200 
    ? post.content.substring(0, 200) + "..."
    : post.content;

  const shouldShowExpand = post.content.length > 200;

  return (
    <Card className="hover:shadow-md transition-shadow" data-testid="mural-post">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {post.mural_categories && Icon && (
              <Badge variant="outline" className={post.mural_categories.color}>
                <Icon className="h-3 w-3 mr-1" />
                {post.mural_categories.name}
              </Badge>
            )}

            {post.status === "pending" && (
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                Aguardando aprovação
              </Badge>
            )}

            {post.approval_source === "ai" && post.status === "approved" && (
              <Badge variant="outline" className="gap-1 bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20">
                <Sparkles className="h-3 w-3" />
                Aprovado por IA
              </Badge>
            )}

            {post.approval_source === "manual" && post.status === "approved" && (
              <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20">
                <CheckCircle className="h-3 w-3" />
                Aprovado
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
            {showAuthor && post.profiles && (
              <>
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {post.profiles.full_name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{post.profiles.full_name}</span>
                <span>•</span>
              </>
            )}
            <span>{format(new Date(post.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          <p className="text-sm whitespace-pre-wrap">
            {isExpanded ? post.content : contentPreview}
          </p>

          {post.media_url && (
            <div className="rounded-lg overflow-hidden border mt-3">
              <img
                src={post.media_url}
                alt="Imagem do post"
                className="w-full max-h-96 object-cover"
                loading="lazy"
              />
            </div>
          )}

          {shouldShowExpand && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-primary hover:underline"
            >
              {isExpanded ? "Ver menos" : "Ver mais"}
            </button>
          )}
        </div>
      </CardContent>

      {post.status === "approved" && (
        <CardFooter className="pt-3 border-t">
          <div className="flex items-center justify-between w-full gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewResponses(post.id)}
              className="gap-2"
              data-testid="view-responses-button"
            >
              <MessageCircle className="h-4 w-4" />
              <span>
                {post.response_count} {post.response_count === 1 ? "resposta" : "respostas"}
              </span>
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => onRespond(post.id)}
              data-testid="respond-button"
            >
              Responder
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
