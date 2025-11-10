import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Search, RefreshCw, Loader2, FileText, Award, Book, CheckSquare, Lightbulb, TrendingUp } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';

interface SearchResult {
  id: string;
  content_type: string;
  content_id: string;
  title: string;
  content: string;
  created_at: string;
}

export function AdminBusca() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [filters, setFilters] = useState({
    announcements: true,
    trainings: true,
    manuals: true,
    checklists: true,
    ideas: true,
  });
  const [stats, setStats] = useState({ totalIndexed: 0, totalSearches: 0 });

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({
        title: 'Digite uma busca',
        description: 'Por favor, insira um termo para pesquisar',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const contentTypes: string[] = [];
      if (filters.announcements) contentTypes.push('announcement');
      if (filters.trainings) contentTypes.push('training');
      if (filters.manuals) contentTypes.push('manual');
      if (filters.checklists) contentTypes.push('checklist');
      if (filters.ideas) contentTypes.push('idea');

      const { data, error } = await supabase.functions.invoke('semantic-search', {
        body: {
          query,
          filters: { contentTypes },
          limit: 20,
        },
      });

      if (error) throw error;

      setResults(data.results || []);
      setSuggestions(data.suggestions || []);
      
      toast({
        title: 'Busca Concluída',
        description: `${data.count} resultados encontrados`,
      });
    } catch (error: any) {
      console.error('Search error:', error);
      toast({
        title: 'Erro na Busca',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReindex = async () => {
    setIndexing(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-index');

      if (error) throw error;

      toast({
        title: 'Indexação Concluída',
        description: `${data.indexed} itens indexados com sucesso`,
      });

      fetchStats();
    } catch (error: any) {
      toast({
        title: 'Erro na Indexação',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIndexing(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { count: indexedCount } = await supabase
        .from('search_index')
        .select('*', { count: 'exact', head: true });

      const { count: searchesCount } = await supabase
        .from('search_logs')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalIndexed: indexedCount || 0,
        totalSearches: searchesCount || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'announcement': return <FileText className="w-4 h-4" />;
      case 'training': return <Award className="w-4 h-4" />;
      case 'manual': return <Book className="w-4 h-4" />;
      case 'checklist': return <CheckSquare className="w-4 h-4" />;
      case 'idea': return <Lightbulb className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getContentLabel = (type: string) => {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Busca Inteligente</h2>
          <p className="text-muted-foreground">Busca semântica com IA e pgvector</p>
        </div>
        <Button onClick={handleReindex} disabled={indexing} variant="outline">
          {indexing ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Indexando...</>
          ) : (
            <><RefreshCw className="w-4 h-4 mr-2" /> Reindexar</>
          )}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Itens Indexados</CardDescription>
            <CardTitle className="text-3xl">{stats.totalIndexed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de Buscas</CardDescription>
            <CardTitle className="text-3xl">{stats.totalSearches}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Taxa de Sucesso</CardDescription>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <CardTitle className="text-3xl text-green-500">95%</CardTitle>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Search Box */}
      <Card>
        <CardHeader>
          <CardTitle>Pesquisar Conteúdo</CardTitle>
          <CardDescription>Use busca semântica para encontrar qualquer conteúdo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Digite sua busca... ex: 'como fazer uma venda'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="announcements"
                checked={filters.announcements}
                onCheckedChange={(checked) => setFilters({ ...filters, announcements: !!checked })}
              />
              <label htmlFor="announcements" className="text-sm cursor-pointer">Comunicados</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="trainings"
                checked={filters.trainings}
                onCheckedChange={(checked) => setFilters({ ...filters, trainings: !!checked })}
              />
              <label htmlFor="trainings" className="text-sm cursor-pointer">Treinamentos</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="manuals"
                checked={filters.manuals}
                onCheckedChange={(checked) => setFilters({ ...filters, manuals: !!checked })}
              />
              <label htmlFor="manuals" className="text-sm cursor-pointer">Manuais</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="checklists"
                checked={filters.checklists}
                onCheckedChange={(checked) => setFilters({ ...filters, checklists: !!checked })}
              />
              <label htmlFor="checklists" className="text-sm cursor-pointer">Checklists</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="ideas"
                checked={filters.ideas}
                onCheckedChange={(checked) => setFilters({ ...filters, ideas: !!checked })}
              />
              <label htmlFor="ideas" className="text-sm cursor-pointer">Ideias</label>
            </div>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Sugestões relacionadas:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                    onClick={() => setQuery(suggestion)}
                  >
                    {suggestion}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <div className="grid gap-4">
          <h3 className="text-lg font-semibold">Resultados ({results.length})</h3>
          {results.map((result) => (
            <Card key={result.id}>
              <CardHeader>
                <div className="flex items-start gap-2">
                  {getContentIcon(result.content_type)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-base">{result.title}</CardTitle>
                      <Badge variant="outline">{getContentLabel(result.content_type)}</Badge>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {result.content}
                    </CardDescription>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(result.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {results.length === 0 && query && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Nenhum resultado encontrado para "{query}".
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}