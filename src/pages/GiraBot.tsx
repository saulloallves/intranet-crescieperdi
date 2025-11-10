import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Bot, Send, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function GiraBot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();

  const quickPrompts = [
    'Como usar o módulo de Feed?',
    'Explicar sistema de treinamentos',
    'Como criar uma nova campanha?',
    'Ajuda com checklists diários',
    'Como funciona o sistema de ideias?',
  ];

  const handleSend = async (message?: string) => {
    const textToSend = message || input;
    if (!textToSend.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('girabot-universal', {
        body: {
          message: textToSend,
          module: 'general',
          user_role: profile?.role || 'colaborador',
          context: {}
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: 'assistant',
        content: data?.reply || 'Desculpe, não consegui processar sua mensagem.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="container max-w-5xl mx-auto p-6 h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-16 h-16 rounded-full gradient-secondary flex items-center justify-center">
              <Bot className="w-8 h-8 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">GiraBot</h1>
              <p className="text-muted-foreground">Assistente IA Institucional</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {quickPrompts.map((prompt, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={() => handleSend(prompt)}
                disabled={loading}
                className="text-xs"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                {prompt}
              </Button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <Card className="flex-1 flex flex-col mb-4">
          <ScrollArea className="flex-1 p-6">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <Bot className="w-16 h-16 mx-auto mb-4 text-secondary" />
                <h3 className="text-xl font-semibold mb-2">Olá! Sou o GiraBot 🧠</h3>
                <p className="text-muted-foreground mb-4">
                  Seu assistente inteligente para tudo no sistema Cresci e Perdi
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto text-left">
                  <Card className="p-4">
                    <h4 className="font-semibold text-sm mb-2">✨ Posso ajudar com:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Explicações sobre módulos</li>
                      <li>• Tutoriais passo a passo</li>
                      <li>• Dúvidas sobre funcionalidades</li>
                    </ul>
                  </Card>
                  <Card className="p-4">
                    <h4 className="font-semibold text-sm mb-2">🎯 Recursos:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Contexto inteligente</li>
                      <li>• Base de conhecimento</li>
                      <li>• Respostas personalizadas</li>
                    </ul>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] ${msg.role === 'assistant' ? 'flex gap-3' : ''}`}>
                      {msg.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full gradient-secondary flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-secondary-foreground" />
                        </div>
                      )}
                      <div>
                        <div
                          className={`rounded-2xl p-4 ${
                            msg.role === 'user'
                              ? 'gradient-secondary text-secondary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 px-2">
                          {msg.timestamp.toLocaleTimeString('pt-BR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="flex gap-3 max-w-[80%]">
                      <div className="w-8 h-8 rounded-full gradient-secondary flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-secondary-foreground" />
                      </div>
                      <div className="bg-muted rounded-2xl p-4">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* Input */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Digite sua pergunta para o GiraBot..."
                className="resize-none"
                rows={2}
                disabled={loading}
              />
              <Button
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className="gradient-secondary"
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                IA Ativa
              </Badge>
              <span>Pressione Enter para enviar</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
