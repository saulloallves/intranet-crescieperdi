import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, FileText, Award, Book, CheckSquare, Lightbulb, Sparkles, Loader2, Brain } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SearchResult {
  id: string;
  content_type: string;
  content_id: string;
  title: string;
  content: string;
  created_at: string;
}

export default function Busca() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [aiImproving, setAiImproving] = useState(false);
  const { toast } = useToast();

  const handleImproveQuery = async () => {
    if (!query.trim()) return;
    
    setAiImproving(true);
    try {
      const { data, error } = await supabase.functions.invoke('girabot-universal', {
        body: {
          message: `Melhore esta consulta de busca para ser mais precisa e encontrar melhores resultados: "${query}". Retorne apenas a consulta melhorada, sem explicações.`,
          module: 'search',
          context: { original_query: query }
        }
      });

      if (error) throw error;

      const improvedQuery = data.response?.trim() || query;
      setQuery(improvedQuery);
      
      toast({
        title: '✨ Consulta melhorada pela IA',
        description: 'Busca otimizada para melhores resultados'
      });
    } catch (error) {
      toast({
        title: 'Não foi possível melhorar a consulta',
        variant: 'destructive'
      });
    } finally {
      setAiImproving(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({
        title: 'Digite algo para buscar',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const { data, error } = await supabase.functions.invoke('semantic-search', {
        body: {
          query,
          filters: {},
          limit: 20,
        },
      });

      if (error) throw error;

      setResults(data.results || []);
      setSuggestions(data.suggestions || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao buscar',
        description: error.message,
        variant: 'destructive',
      });
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'announcement': return <FileText className="w-5 h-5" />;
      case 'training': return <Award className="w-5 h-5" />;
      case 'manual': return <Book className="w-5 h-5" />;
      case 'checklist': return <CheckSquare className="w-5 h-5" />;
      case 'idea': return <Lightbulb className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'announcement': return 'Comunicado';
      case 'training': return 'Treinamento';
      case 'manual': return 'Manual';
      case 'checklist': return 'Checklist';
      case 'idea': return 'Ideia';
      default: return type;
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Busca Global Inteligente</h1>
          <p className="text-muted-foreground">
            Encontre comunicados, manuais, treinamentos e mais
          </p>
        </div>

        {/* Search Bar */}
        <Card className="mb-8 card-elevated">
          <CardContent className="p-6">
            <div className="flex gap-3 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Digite sua busca... Ex: 'política de horários', 'avaliação de peças'"
                  className="pl-10"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button 
                variant="outline" 
                onClick={handleImproveQuery} 
                disabled={aiImproving || !query.trim()}
                title="Melhorar busca com IA"
              >
                {aiImproving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Brain className="w-4 h-4" />
                )}
              </Button>
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Buscando...</>
                ) : (
                  'Buscar'
                )}
              </Button>
            </div>
            
            {/* Search Suggestions */}
            {suggestions.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-muted-foreground">Buscas relacionadas:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                      onClick={() => { setQuery(suggestion); handleSearch(); }}
                    >
                      {suggestion}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Helper */}
        <Card className="mb-8 gradient-secondary text-white">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold mb-2">💡 Dica: Use a IA para buscar melhor!</h3>
                <p className="text-white/90 text-sm">
                  O GiraBot pode te ajudar a encontrar informações específicas e explicar o conteúdo dos documentos.
                  Experimente conversar com ele no módulo GiraBot!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                Nenhum resultado encontrado para "{query}"
              </p>
              <p className="text-sm text-muted-foreground text-center mt-2">
                Tente usar palavras-chave diferentes ou mais específicas
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {results.length} resultado{results.length > 1 ? 's' : ''} encontrado{results.length > 1 ? 's' : ''}
            </p>
            {results.map((result) => (
              <Card key={result.id} className="card-elevated card-interactive">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {getIcon(result.content_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{getTypeLabel(result.content_type)}</Badge>
                      </div>
                      <h3 className="font-semibold text-lg mb-2">{result.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {result.content}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(result.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!searched && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Pronto para buscar?</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Digite no campo acima e pressione Enter ou clique em Buscar para encontrar
                comunicados, manuais e treinamentos
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
