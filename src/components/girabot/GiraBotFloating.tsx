import { useState, useEffect } from 'react';
import { Bot, X, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function GiraBotFloating() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const { profile } = useAuth();
  const location = useLocation();

  useEffect(() => {
    checkIfEnabled();
  }, []);

  const checkIfEnabled = async () => {
    const { data } = await supabase
      .from('girabot_settings')
      .select('value')
      .eq('key', 'girabot_enabled')
      .single();
    
    const isEnabled = data?.value === true || 
                     (typeof data?.value === 'object' && (data.value as any).enabled === true);
    setIsEnabled(isEnabled);
  };

  const detectModule = () => {
    const path = location.pathname;
    if (path.includes('feed')) return 'feed';
    if (path.includes('treinamentos')) return 'training';
    if (path.includes('checklists')) return 'checklist';
    if (path.includes('mural')) return 'mural';
    if (path.includes('ideias')) return 'ideias';
    if (path.includes('campanhas')) return 'campaigns';
    if (path.includes('comunicados')) return 'announcements';
    return 'general';
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `https://sgeabunxaunzoedwvvox.supabase.co/functions/v1/girabot-universal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZWFidW54YXVuem9lZHd2dm94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5OTQ3ODEsImV4cCI6MjA3MjU3MDc4MX0.DCnflwz3CbKpepMcj-sANiApoR-jHnvwnQWsImVFS58'}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZWFidW54YXVuem9lZHd2dm94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5OTQ3ODEsImV4cCI6MjA3MjU3MDc4MX0.DCnflwz3CbKpepMcj-sANiApoR-jHnvwnQWsImVFS58'
          },
          body: JSON.stringify({
            message: input,
            module: detectModule(),
            user_role: profile?.role,
            context: { pathname: location.pathname }
          }),
        }
      );

      if (!response.ok || !response.body) {
        throw new Error('Falha ao conectar com GiraBot');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantContent += content;
                setMessages(prev => {
                  const lastMsg = prev[prev.length - 1];
                  if (lastMsg?.role === 'assistant') {
                    return [
                      ...prev.slice(0, -1),
                      { ...lastMsg, content: assistantContent }
                    ];
                  }
                  return [...prev, {
                    role: 'assistant',
                    content: assistantContent,
                    timestamp: new Date()
                  }];
                });
              }
            } catch (e) {
              // Ignore parse errors for incomplete JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro. Tente novamente.',
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isEnabled) return null;

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-6 w-14 h-14 rounded-full shadow-lg gradient-secondary hover:scale-110 transition-transform z-50"
          aria-label="Abrir GiraBot"
        >
          <Bot className="w-6 h-6" />
        </Button>
      )}

      {/* Chat Modal */}
      {isOpen && (
        <Card className="fixed bottom-24 right-6 w-96 h-[500px] shadow-2xl z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b gradient-secondary text-secondary-foreground">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-card flex items-center justify-center">
                <Bot className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h3 className="font-semibold">GiraBot</h3>
                <p className="text-xs opacity-90">Assistente IA</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 text-secondary-foreground hover:bg-secondary-foreground/10"
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsOpen(false);
                  setMessages([]);
                }}
                className="h-8 w-8 text-secondary-foreground hover:bg-secondary-foreground/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="w-12 h-12 mx-auto mb-3 text-secondary" />
                <p className="text-sm">Olá! Como posso ajudar?</p>
                <p className="text-xs mt-2">Estou aqui para responder dúvidas sobre o sistema</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.role === 'user'
                          ? 'bg-secondary text-secondary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Digite sua pergunta..."
                className="resize-none"
                rows={2}
                disabled={loading}
              />
              <Button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="gradient-secondary"
              >
                Enviar
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
