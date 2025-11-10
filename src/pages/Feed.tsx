import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Filter, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { FeedPostCard } from "@/components/feed/FeedPostCard";
import { FeedPostSkeleton } from "@/components/feed/FeedPostSkeleton";
import { FeedDailySummary } from "@/components/feed/FeedDailySummary";

interface FeedPost {
  id: string;
  type: string;
  title: string;
  description: string;
  module_link?: string;
  media_url?: string;
  created_at: string;
  likes_count: number;
  love_count?: number;
  fire_count?: number;
  clap_count?: number;
  comments_count: number;
  pinned: boolean;
  user_liked?: boolean;
  user_reaction?: 'like' | 'love' | 'fire' | 'clap' | null;
}

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

const POSTS_PER_PAGE = 15;

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<'week' | 'month' | 'all'>('week');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedPostComments, setSelectedPostComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  const getDaysLimit = () => {
    if (dateFilter === 'week') return 7;
    if (dateFilter === 'month') return 30;
    return null;
  };

  const fetchPosts = useCallback(async (pageNum: number, append: boolean = false) => {
    try {
      if (!append) setLoading(true);
      setIsLoadingMore(true);

      const daysLimit = getDaysLimit();
      let query = supabase
        .from("feed_posts")
        .select("*")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .range(pageNum * POSTS_PER_PAGE, (pageNum + 1) * POSTS_PER_PAGE - 1);

      if (daysLimit) {
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - daysLimit);
        query = query.gte("created_at", dateLimit.toISOString());
      }

      if (selectedTypes.length > 0) {
        query = query.in("type", selectedTypes);
      }

      if (searchQuery.trim()) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Check if we have more posts
      if (!data || data.length < POSTS_PER_PAGE) {
        setHasMore(false);
      }

      // Check which posts user has liked
      const { data: likesData } = await supabase
        .from("feed_likes")
        .select("post_id")
        .eq("user_id", user?.id);

      const likedPostIds = new Set(likesData?.map(l => l.post_id));

      const postsWithLikes = (data || []).map(post => ({
        ...post,
        user_liked: likedPostIds.has(post.id)
      }));

      if (append) {
        setPosts(prev => [...prev, ...postsWithLikes]);
      } else {
        setPosts(postsWithLikes);
      }
    } catch (error: any) {
      console.error("Error fetching posts:", error);
      toast.error("Erro ao carregar feed");
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  }, [dateFilter, selectedTypes, searchQuery, user?.id]);

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchPosts(0, false);
  }, [dateFilter, selectedTypes, searchQuery]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore]);

  // Load more when page changes
  useEffect(() => {
    if (page > 0) {
      fetchPosts(page, true);
    }
  }, [page]);

  // Scroll detection for "Back to top" button
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setShowScrollTop(container.scrollTop > 500);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Realtime subscription for new posts
  useEffect(() => {
    const channel = supabase
      .channel('feed-new-posts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feed_posts'
        },
        () => {
          setNewPostsCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLike = async (postId: string) => {
    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      setPosts(prev => prev.map(p => 
        p.id === postId 
          ? { ...p, user_liked: !p.user_liked, likes_count: p.user_liked ? p.likes_count - 1 : p.likes_count + 1 }
          : p
      ));

      if (post.user_liked) {
        await (supabase as any).from("feed_post_likes").delete().eq("post_id", postId).eq("user_id", user?.id);
      } else {
        await (supabase as any).from("feed_post_likes").insert({ post_id: postId, user_id: user?.id });
      }
    } catch (error: any) {
      console.error("Error liking post:", error);
      fetchPosts(0, false);
      toast.error("Erro ao reagir");
    }
  };

  const fetchComments = async (postId: string) => {
    try {
      const { data: commentsData, error } = await supabase
        .from("feed_comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const userIds = [...new Set(commentsData?.map(c => c.user_id) || [])];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      const profilesMap = new Map(
        profilesData?.map(p => [p.id, p]) || []
      );

      const commentsWithProfiles = (commentsData || []).map(comment => ({
        ...comment,
        profiles: profilesMap.get(comment.user_id)
      }));

      setComments(commentsWithProfiles);
    } catch (error: any) {
      console.error("Error fetching comments:", error);
    }
  };

  const handleComment = async (postId: string) => {
    if (!newComment.trim() || newComment.length > 140) {
      toast.error("Comentário deve ter entre 1 e 140 caracteres");
      return;
    }

    try {
      await (supabase as any).from("feed_post_comments").insert({
        post_id: postId,
        user_id: user?.id,
        comment: newComment.trim()
      });

      setNewComment("");
      fetchComments(postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p));
      toast.success("Comentário adicionado!");
    } catch (error: any) {
      console.error("Error adding comment:", error);
      toast.error("Erro ao comentar");
    }
  };

  const toggleComments = (postId: string) => {
    if (selectedPostComments === postId) {
      setSelectedPostComments(null);
      setComments([]);
      setNewComment("");
    } else {
      setSelectedPostComments(postId);
      fetchComments(postId);
    }
  };

  const handleLoadNewPosts = () => {
    setNewPostsCount(0);
    setPage(0);
    setHasMore(true);
    fetchPosts(0, false);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleTypeFilter = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const postTypes = [
    { value: 'announcement', label: 'Comunicados' },
    { value: 'training', label: 'Treinamentos' },
    { value: 'campaign', label: 'Campanhas' },
    { value: 'recognition', label: 'Reconhecimentos' },
    { value: 'checklist', label: 'Rotinas' },
    { value: 'manual', label: 'Manuais' },
    { value: 'idea', label: 'Ideias' },
    { value: 'media', label: 'Mídias' },
    { value: 'survey', label: 'Pesquisas' },
  ];

  if (loading && page === 0) {
    return (
      <AppLayout>
        <div className="bg-background">
          <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
            <h1 className="text-xl font-bold">Feed</h1>
          </div>
          <div className="space-y-0">
            {[1, 2, 3].map(i => <FeedPostSkeleton key={i} />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        {/* Daily Summary */}
        <FeedDailySummary />
        
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold mb-3">Feed</h1>
          
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filtros</SheetTitle>
                </SheetHeader>
                
                <div className="space-y-6 mt-6">
                  {/* Date filter */}
                  <div>
                    <h3 className="font-medium mb-3">Período</h3>
                    <div className="space-y-2">
                      {[
                        { value: 'week', label: 'Última semana' },
                        { value: 'month', label: 'Último mês' },
                        { value: 'all', label: 'Tudo' },
                      ].map(option => (
                        <Button
                          key={option.value}
                          variant={dateFilter === option.value ? "default" : "outline"}
                          className="w-full"
                          onClick={() => setDateFilter(option.value as any)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Type filter */}
                  <div>
                    <h3 className="font-medium mb-3">Tipos de conteúdo</h3>
                    <div className="space-y-3">
                      {postTypes.map(type => (
                        <div key={type.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={type.value}
                            checked={selectedTypes.includes(type.value)}
                            onCheckedChange={() => toggleTypeFilter(type.value)}
                          />
                          <label
                            htmlFor={type.value}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {type.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Active filters badges */}
          {(selectedTypes.length > 0 || dateFilter !== 'week') && (
            <div className="flex flex-wrap gap-2 mt-3">
              {dateFilter !== 'week' && (
                <Badge variant="secondary">
                  {dateFilter === 'month' ? 'Último mês' : 'Tudo'}
                </Badge>
              )}
              {selectedTypes.map(type => (
                <Badge key={type} variant="secondary">
                  {postTypes.find(t => t.value === type)?.label}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* New posts notification */}
        {newPostsCount > 0 && (
          <div className="border-t border-border">
            <button
              onClick={handleLoadNewPosts}
              className="w-full py-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
            >
              🔔 {newPostsCount} {newPostsCount === 1 ? 'nova atualização' : 'novas atualizações'}
            </button>
          </div>
        )}
      </div>

      {/* Posts feed */}
      <div 
        ref={scrollContainerRef}
        className="pb-4"
      >
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <p className="text-muted-foreground mb-2">Nenhuma publicação encontrada</p>
            <p className="text-sm text-muted-foreground">
              Tente ajustar os filtros ou volte mais tarde
            </p>
          </div>
        ) : (
          <>
            {posts.map((post) => (
              <FeedPostCard
                key={post.id}
                post={post}
                comments={selectedPostComments === post.id ? comments : []}
                newComment={newComment}
                showComments={selectedPostComments === post.id}
                userId={user?.id}
                onLike={handleLike}
                onToggleComments={toggleComments}
                onComment={handleComment}
                onCommentChange={setNewComment}
              />
            ))}

            {/* Loading more indicator */}
            {isLoadingMore && (
              <div className="py-8 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}

            {/* Infinite scroll trigger */}
            {hasMore && <div ref={observerTarget} className="h-20" />}

            {/* End of feed */}
            {!hasMore && posts.length > 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Você chegou ao final do feed
              </div>
            )}
          </>
        )}
      </div>

      {/* Scroll to top button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-24 right-6 bg-primary text-primary-foreground rounded-full p-3 shadow-lg hover:scale-110 transition-transform z-20"
          aria-label="Voltar ao topo"
        >
          <ChevronUp className="h-6 w-6" />
        </button>
      )}
      </div>
    </AppLayout>
  );
}
