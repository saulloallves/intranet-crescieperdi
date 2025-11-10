import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Heart, 
  MessageCircle, 
  Pin,
  GraduationCap,
  CheckSquare,
  BookOpen,
  Target,
  Trophy,
  Lightbulb,
  Film,
  BarChart3,
  Megaphone,
  Brain,
  Loader2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RelatedContentCard } from "./RelatedContentCard";
import { supabase } from "@/integrations/supabase/client";

interface Comment {
  id: string;
  comment: string;
  created_at: string;
  user_id: string;
  profiles?: {
    full_name: string;
    avatar_url?: string;
  };
}

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
  created_by?: string;
  user_liked?: boolean;
}

interface FeedPostCardProps {
  post: FeedPost;
  comments: Comment[];
  newComment: string;
  showComments: boolean;
  userId?: string;
  onLike: (postId: string) => void;
  onToggleComments: (postId: string) => void;
  onComment: (postId: string) => void;
  onCommentChange: (value: string) => void;
}

const getPostIcon = (type: string) => {
  const icons: Record<string, any> = {
    training: GraduationCap,
    checklist: CheckSquare,
    manual: BookOpen,
    campaign: Target,
    recognition: Trophy,
    idea: Lightbulb,
    media: Film,
    survey: BarChart3,
    announcement: Megaphone,
  };
  return icons[type] || Megaphone;
};

const getPostLabel = (type: string) => {
  const labels: Record<string, string> = {
    training: "Treinamento",
    checklist: "Rotina",
    manual: "Manual",
    campaign: "Campanha",
    recognition: "Reconhecimento",
    idea: "Ideia",
    media: "Mídia",
    survey: "Pesquisa",
    announcement: "Comunicado",
  };
  return labels[type] || type;
};

const getPostColor = (type: string): string => {
  const colors: Record<string, string> = {
    training: 'bg-emerald-500/10 text-emerald-600',
    checklist: 'bg-blue-500/10 text-blue-600',
    manual: 'bg-purple-500/10 text-purple-600',
    campaign: 'bg-red-500/10 text-red-600',
    recognition: 'bg-yellow-500/10 text-yellow-600',
    idea: 'bg-pink-500/10 text-pink-600',
    media: 'bg-indigo-500/10 text-indigo-600',
    survey: 'bg-cyan-500/10 text-cyan-600',
    announcement: 'bg-orange-500/10 text-orange-600',
  };
  return colors[type] || 'bg-gray-500/10 text-gray-600';
};

export function FeedPostCard({
  post,
  comments,
  newComment,
  showComments,
  userId,
  onLike,
  onToggleComments,
  onComment,
  onCommentChange,
}: FeedPostCardProps) {
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showGiraBot, setShowGiraBot] = useState(false);
  const [giraBotExplanation, setGiraBotExplanation] = useState('');
  const [giraBotLoading, setGiraBotLoading] = useState(false);
  const lastTap = useRef<number>(0);
  const Icon = getPostIcon(post.type);
  const postColor = getPostColor(post.type);

  const handleGiraBotExplain = async () => {
    setShowGiraBot(true);
    setGiraBotLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('girabot-universal', {
        body: {
          message: `Explique este post de forma clara e objetiva: "${post.title}". Descrição: ${post.description}`,
          module: 'feed',
          context: {
            post_type: post.type,
            post_id: post.id
          }
        }
      });

      if (error) throw error;

      // Handle streaming response
      if (data) {
        setGiraBotExplanation(data.response || 'Explicação não disponível.');
      }
    } catch (error) {
      setGiraBotExplanation('Não foi possível gerar explicação no momento.');
    } finally {
      setGiraBotLoading(false);
    }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      if (!post.user_liked) {
        onLike(post.id);
        setShowLikeAnimation(true);
        setTimeout(() => setShowLikeAnimation(false), 1000);
      }
    }
    lastTap.current = now;
  };

  return (
    <article className="bg-card border-b border-border pb-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${postColor}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">{getPostLabel(post.type)}</p>
              {post.pinned && (
                <Pin className="h-3 w-3 text-primary fill-primary" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_at), {
                addSuffix: true,
                locale: ptBR
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 mb-2">
        <h3 className="font-semibold text-base mb-1">{post.title}</h3>
        <p className="text-sm text-foreground/90 leading-relaxed">{post.description}</p>
      </div>

      {/* Image */}
      {post.media_url && (
        <div 
          className="relative w-full bg-muted overflow-hidden cursor-pointer"
          onClick={handleDoubleTap}
        >
          {!imageLoaded && (
            <div className="absolute inset-0 animate-pulse bg-muted" />
          )}
          <img
            src={post.media_url}
            alt={post.title}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            className={`w-full object-cover transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ maxHeight: '500px' }}
          />
          {showLikeAnimation && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Heart className="h-24 w-24 text-white fill-white animate-scale-in drop-shadow-lg" />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pt-2">
        <div className="flex items-center gap-4 mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onLike(post.id);
              if (!post.user_liked) {
                setShowLikeAnimation(true);
                setTimeout(() => setShowLikeAnimation(false), 800);
              }
            }}
            className="hover:scale-110 transition-transform -ml-2"
          >
            <Heart 
              className={`h-6 w-6 ${
                post.user_liked 
                  ? 'fill-red-500 text-red-500' 
                  : 'text-foreground'
              }`} 
            />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleComments(post.id)}
            className="hover:scale-110 transition-transform"
          >
            <MessageCircle className="h-6 w-6" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleGiraBotExplain}
            className="hover:scale-110 transition-transform ml-auto"
            title="Gira me explica"
          >
            <Brain className="h-6 w-6 text-secondary" />
          </Button>
        </div>

        {/* Likes count */}
        {post.likes_count > 0 && (
          <p className="text-sm font-semibold mb-2">
            {post.likes_count} {post.likes_count === 1 ? 'curtida' : 'curtidas'}
          </p>
        )}

        {/* Comments preview */}
        {post.comments_count > 0 && !showComments && (
          <button
            onClick={() => onToggleComments(post.id)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver {post.comments_count === 1 ? 'o comentário' : `todos os ${post.comments_count} comentários`}
          </button>
        )}
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="px-4 pt-3 space-y-3 border-t border-border mt-3">
          {comments.length > 0 && (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={comment.profiles?.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {comment.profiles?.full_name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="bg-muted rounded-2xl px-4 py-2">
                      <p className="font-semibold text-sm">
                        {comment.profiles?.full_name || "Usuário"}
                      </p>
                      <p className="text-sm break-words">{comment.comment}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-4">
                      {formatDistanceToNow(new Date(comment.created_at), {
                        addSuffix: true,
                        locale: ptBR
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Comment input */}
          <div className="flex gap-2 pt-2">
            <Input
              placeholder="Adicione um comentário..."
              value={newComment}
              onChange={(e) => onCommentChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onComment(post.id);
                }
              }}
              className="flex-1"
            />
            <Button 
              onClick={() => onComment(post.id)}
              disabled={!newComment.trim()}
              size="sm"
            >
              Enviar
            </Button>
          </div>
        </div>
      )}

      {post.module_link && (
        <div className="px-4 pt-3">
          <Button variant="outline" size="sm" asChild className="w-full">
            <a href={post.module_link}>Ver mais detalhes</a>
          </Button>
        </div>
      )}

      {/* Related content recommendations */}
      {userId && <RelatedContentCard postId={post.id} userId={userId} />}

      {/* GiraBot Explanation Dialog */}
      <Dialog open={showGiraBot} onOpenChange={setShowGiraBot}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-secondary" />
              GiraBot Explica
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">{post.title}</h4>
              <p className="text-sm text-muted-foreground">{post.description}</p>
            </div>
            {giraBotLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-secondary" />
              </div>
            ) : (
              <div className="prose prose-sm max-w-none">
                <p className="whitespace-pre-wrap">{giraBotExplanation}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}
