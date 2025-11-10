import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Search, FileText, Download } from 'lucide-react';

interface Manual {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  file_url: string | null;
  views_count: number;
}

export default function Manuais() {
  const [manuais, setManuais] = useState<Manual[]>([]);
  const [filteredManuais, setFilteredManuais] = useState<Manual[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchManuais();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = manuais.filter(
        (manual) =>
          manual.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          manual.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          manual.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          manual.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredManuais(filtered);
    } else {
      setFilteredManuais(manuais);
    }
  }, [searchQuery, manuais]);

  const fetchManuais = async () => {
    try {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setManuais(data || []);
      setFilteredManuais(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar manuais',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const categories = Array.from(new Set(manuais.map((m) => m.category)));

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Manuais e Documentos</h1>
          <p className="text-muted-foreground">
            Base de conhecimento institucional
          </p>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Buscar manuais, políticas, FAQs..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Categories */}
        <div className="flex gap-2 flex-wrap mb-6">
          <Badge
            variant={searchQuery === '' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSearchQuery('')}
          >
            Todos
          </Badge>
          {categories.map((category) => (
            <Badge
              key={category}
              variant={searchQuery === category ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setSearchQuery(category)}
            >
              {category}
            </Badge>
          ))}
        </div>

        {/* Manuais Grid */}
        {filteredManuais.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                {searchQuery
                  ? `Nenhum resultado encontrado para "${searchQuery}"`
                  : 'Nenhum manual disponível no momento'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredManuais.map((manual) => (
              <Card key={manual.id} className="card-elevated card-interactive">
                <CardHeader>
                  <div className="flex items-start justify-between mb-3">
                    <Badge>{manual.category}</Badge>
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-purple-600" />
                    </div>
                  </div>
                  <CardTitle className="text-lg">{manual.title}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {manual.content}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1 flex-wrap">
                      {manual.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    {manual.file_url && (
                      <a
                        href={manual.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1 text-sm"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    {manual.views_count} visualizações
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
