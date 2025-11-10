import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface DailySummary {
  summary: string;
  has_new_content: boolean;
  count: number;
}

export function FeedDailySummary() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('feed-daily-summary', {
        body: { user_id: user.id }
      });

      if (error) throw error;

      setSummary(data);
    } catch (error: any) {
      console.error("Error fetching daily summary:", error);
      // Don't show error toast on initial load
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [user?.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSummary();
  };

  if (loading) {
    return (
      <div className="px-4 py-3 bg-primary/5 border-b border-primary/20">
        <div className="animate-pulse flex items-center gap-2">
          <div className="h-4 w-4 bg-primary/30 rounded-full"></div>
          <div className="h-4 bg-primary/30 rounded flex-1"></div>
        </div>
      </div>
    );
  }

  if (!summary?.has_new_content) {
    return null;
  }

  return (
    <Card className="mx-4 mt-4 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground mb-2">
              💡 GiraBot diz:
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {summary.summary}
            </p>
            {summary.count > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-primary font-medium">
                  {summary.count} {summary.count === 1 ? 'novidade' : 'novidades'}
                </span>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex-shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
