import { useState } from 'react';
import { HelpCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface GiraBotContextualHelpProps {
  fieldName: string;
  fieldType?: string;
  module: string;
  formData?: Record<string, any>;
  fieldValue?: any;
}

export function GiraBotContextualHelp({
  fieldName,
  fieldType = 'text',
  module,
  formData,
  fieldValue
}: GiraBotContextualHelpProps) {
  const [helpText, setHelpText] = useState<string>('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { profile } = useAuth();

  const fetchHelp = async () => {
    if (helpText) return; // Already fetched
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('girabot-contextual-help', {
        body: {
          field_name: fieldName,
          field_type: fieldType,
          module,
          form_data: formData,
          field_value: fieldValue,
          user_role: profile?.role
        }
      });

      if (error) throw error;

      setHelpText(data.help_text || 'Ajuda não disponível no momento.');
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error('Erro ao buscar ajuda:', error);
      setHelpText('Não foi possível carregar a ajuda. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !helpText && !loading) {
      fetchHelp();
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-secondary"
          type="button"
        >
          <HelpCircle className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-full gradient-secondary flex items-center justify-center flex-shrink-0">
              <HelpCircle className="w-4 h-4 text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm mb-1">
                Ajuda: {fieldName}
              </h4>
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Carregando ajuda...</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {helpText}
                </p>
              )}
            </div>
          </div>

          {suggestions.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs font-semibold mb-2">Sugestões:</p>
              <ul className="space-y-1">
                {suggestions.map((suggestion, idx) => (
                  <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                    <span className="text-secondary">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              💡 Dica: Use o GiraBot flutuante para perguntas mais detalhadas
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
