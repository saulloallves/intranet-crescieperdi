import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QuizQuestion {
  id: string;
  question: string;
  type: 'multiple_choice' | 'true_false' | 'essay';
  options: string[];
  correct_answer: string;
  feedback: string;
}

interface QuizEditorProps {
  trainingId?: string;
  onSave: (questions: QuizQuestion[], minScore: number, maxAttempts: number) => void;
}

export function QuizEditor({ onSave }: QuizEditorProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [minScore, setMinScore] = useState(70);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [editingQuestion, setEditingQuestion] = useState<Partial<QuizQuestion>>({
    type: 'multiple_choice',
    options: ['', '', '', ''],
    correct_answer: '',
    feedback: '',
  });
  const { toast } = useToast();

  const handleAddQuestion = () => {
    if (!editingQuestion.question || !editingQuestion.correct_answer) {
      toast({
        title: 'Erro',
        description: 'Preencha a pergunta e a resposta correta',
        variant: 'destructive',
      });
      return;
    }

    const newQuestion: QuizQuestion = {
      id: Date.now().toString(),
      question: editingQuestion.question,
      type: editingQuestion.type as any,
      options: editingQuestion.options?.filter(o => o.trim() !== '') || [],
      correct_answer: editingQuestion.correct_answer,
      feedback: editingQuestion.feedback || '',
    };

    setQuestions([...questions, newQuestion]);
    setEditingQuestion({
      type: 'multiple_choice',
      options: ['', '', '', ''],
      correct_answer: '',
      feedback: '',
    });
    toast({ title: 'Questão adicionada!' });
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleSave = () => {
    if (questions.length === 0) {
      toast({
        title: 'Erro',
        description: 'Adicione pelo menos uma questão',
        variant: 'destructive',
      });
      return;
    }

    onSave(questions, minScore, maxAttempts);
    toast({ title: 'Quiz salvo com sucesso!' });
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...(editingQuestion.options || ['', '', '', ''])];
    newOptions[index] = value;
    setEditingQuestion({ ...editingQuestion, options: newOptions });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Editor de Quiz</CardTitle>
          <CardDescription>
            Crie questões de múltipla escolha, verdadeiro/falso ou dissertativas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configurações gerais */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <Label htmlFor="min-score">Nota Mínima para Aprovação (%)</Label>
              <Input
                id="min-score"
                type="number"
                min="0"
                max="100"
                value={minScore}
                onChange={(e) => setMinScore(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label htmlFor="max-attempts">Máximo de Tentativas</Label>
              <Input
                id="max-attempts"
                type="number"
                min="1"
                max="10"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          {/* Nova questão */}
          <div className="space-y-4 p-4 border-2 border-dashed rounded-lg">
            <div>
              <Label htmlFor="question-type">Tipo de Questão</Label>
              <Select
                value={editingQuestion.type}
                onValueChange={(value: any) => setEditingQuestion({ ...editingQuestion, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple_choice">Múltipla Escolha</SelectItem>
                  <SelectItem value="true_false">Verdadeiro/Falso</SelectItem>
                  <SelectItem value="essay">Dissertativa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="question-text">Pergunta</Label>
              <Textarea
                id="question-text"
                value={editingQuestion.question || ''}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                placeholder="Digite a pergunta"
                rows={2}
              />
            </div>

            {editingQuestion.type === 'multiple_choice' && (
              <div className="space-y-2">
                <Label>Opções de Resposta</Label>
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={editingQuestion.options?.[index] || ''}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Opção ${index + 1}`}
                    />
                  </div>
                ))}
              </div>
            )}

            {editingQuestion.type === 'true_false' && (
              <div className="space-y-2">
                <Label>Resposta Correta</Label>
                <Select
                  value={editingQuestion.correct_answer}
                  onValueChange={(value) => setEditingQuestion({ ...editingQuestion, correct_answer: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Verdadeiro">Verdadeiro</SelectItem>
                    <SelectItem value="Falso">Falso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {editingQuestion.type === 'multiple_choice' && (
              <div>
                <Label htmlFor="correct-answer">Resposta Correta</Label>
                <Select
                  value={editingQuestion.correct_answer}
                  onValueChange={(value) => setEditingQuestion({ ...editingQuestion, correct_answer: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a resposta correta" />
                  </SelectTrigger>
                  <SelectContent>
                    {editingQuestion.options?.filter(o => o.trim() !== '').map((option, index) => (
                      <SelectItem key={index} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="feedback">Feedback (Explicação)</Label>
              <Textarea
                id="feedback"
                value={editingQuestion.feedback || ''}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, feedback: e.target.value })}
                placeholder="Explique por que essa é a resposta correta"
                rows={2}
              />
            </div>

            <Button onClick={handleAddQuestion} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Questão
            </Button>
          </div>

          {/* Lista de questões */}
          {questions.length > 0 && (
            <div className="space-y-3">
              <Label className="text-lg">Questões Adicionadas ({questions.length})</Label>
              {questions.map((q, index) => (
                <Card key={q.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <Badge>{q.type === 'multiple_choice' ? 'Múltipla Escolha' : q.type === 'true_false' ? 'V/F' : 'Dissertativa'}</Badge>
                        </div>
                        <p className="font-medium">{q.question}</p>
                        {q.type !== 'essay' && (
                          <div className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-green-600" />
                            <span className="text-muted-foreground">Resposta: <strong>{q.correct_answer}</strong></span>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveQuestion(q.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {questions.length > 0 && (
            <Button onClick={handleSave} size="lg" className="w-full">
              Salvar Quiz Completo
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
