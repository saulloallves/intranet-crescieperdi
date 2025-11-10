import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles, CheckCircle, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface Response {
  id: string;
  content: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  approval_source?: "ai" | "manual";
}

interface ResponsesListProps {
  postId: string;
}

export function ResponsesList({ postId }: ResponsesListProps) {
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResponses();
  }, [postId]);

  const fetchResponses = async () => {
    try {
      const { data, error } = await supabase
        .from("mural_responses")
        .select(`
          id,
          content,
          status,
          created_at,
          approval_source
        `)
        .eq("post_id", postId)
        .eq("status", "approved")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setResponses(data as any || []);
    } catch (error) {
      console.error("Error fetching responses:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (responses.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Ainda não há respostas para este post.</p>
        <p className="text-sm mt-1">Seja o primeiro a responder! 💬</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        {responses.length} {responses.length === 1 ? "Resposta" : "Respostas"}
      </h3>

      {responses.map((response) => (
        <Card key={response.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8 bg-muted">
                  <AvatarFallback className="text-xs text-muted-foreground">
                    👤
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Franqueado Anônimo</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(response.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>

              {response.approval_source === "ai" && (
                <Badge variant="outline" className="gap-1 bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20">
                  <Sparkles className="h-3 w-3" />
                  IA
                </Badge>
              )}

              {response.approval_source === "manual" && (
                <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20">
                  <CheckCircle className="h-3 w-3" />
                  Aprovado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{response.content}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
