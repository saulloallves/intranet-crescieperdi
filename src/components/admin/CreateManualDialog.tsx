import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function CreateManualDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'Operação',
    file_url: '',
    file_type: 'pdf',
  });

  const handleCreate = async () => {
    if (!formData.title || !formData.content) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.from('knowledge_base').insert([
        {
          title: formData.title,
          content: formData.content,
          category: formData.category,
          file_url: formData.file_url || null,
          file_type: formData.file_type,
          is_published: true,
        },
      ]);

      if (error) throw error;

      toast({
        title: 'Manual criado',
        description: 'O manual foi adicionado à base de conhecimento.',
      });

      setOpen(false);
      setFormData({
        title: '',
        content: '',
        category: 'Operação',
        file_url: '',
        file_type: 'pdf',
      });
      onSuccess();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o manual.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Novo Manual
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Manual</DialogTitle>
          <DialogDescription>
            Adicione documentação à base de conhecimento
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Ex: Manual de Operação da Loja"
            />
          </div>

          <div>
            <Label htmlFor="category">Categoria</Label>
            <Select
              value={formData.category}
              onValueChange={(value) =>
                setFormData({ ...formData, category: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Operação">Operação</SelectItem>
                <SelectItem value="RH">RH</SelectItem>
                <SelectItem value="Jurídico">Jurídico</SelectItem>
                <SelectItem value="Financeiro">Financeiro</SelectItem>
                <SelectItem value="Mídias">Mídias</SelectItem>
                <SelectItem value="TI">TI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="content">Conteúdo</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
              placeholder="Descreva o conteúdo do manual..."
              rows={8}
            />
          </div>

          <div>
            <Label htmlFor="file_url">URL do Arquivo (opcional)</Label>
            <Input
              id="file_url"
              value={formData.file_url}
              onChange={(e) =>
                setFormData({ ...formData, file_url: e.target.value })
              }
              placeholder="https://..."
            />
          </div>

          <div>
            <Label htmlFor="file_type">Tipo de Arquivo</Label>
            <Select
              value={formData.file_type}
              onValueChange={(value) =>
                setFormData({ ...formData, file_type: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="doc">DOC/DOCX</SelectItem>
                <SelectItem value="video">Vídeo</SelectItem>
                <SelectItem value="link">Link Externo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleCreate} className="w-full">
            Criar Manual
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
