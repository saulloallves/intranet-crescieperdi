import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { IconPicker } from "./IconPicker";
import { ColorPicker } from "./ColorPicker";
import { Plus, Edit, Trash2, GripVertical } from "lucide-react";
import * as Icons from "lucide-react";

interface TrainingCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  color: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export function AdminTrainingCategories() {
  const [categories, setCategories] = useState<TrainingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TrainingCategory | null>(null);
  const [trainingsCount, setTrainingsCount] = useState<Record<string, number>>({});
  
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "FolderOpen",
    color: "#3b82f6",
    order_index: 0,
    is_active: true,
  });

  useEffect(() => {
    fetchCategories();
    fetchTrainingsCount();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("training_categories")
        .select("*")
        .order("order_index", { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar categorias: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrainingsCount = async () => {
    try {
      const { data: trainings, error } = await supabase
        .from("trainings")
        .select("category");

      if (error) throw error;

      const counts: Record<string, number> = {};
      trainings?.forEach((training) => {
        counts[training.category] = (counts[training.category] || 0) + 1;
      });
      setTrainingsCount(counts);
    } catch (error: any) {
      console.error("Erro ao contar treinamentos:", error);
    }
  };

  const handleCreate = async () => {
    try {
      if (!formData.name.trim()) {
        toast.error("Nome é obrigatório");
        return;
      }

      const slug = formData.slug || generateSlug(formData.name);

      const categoryData = {
        ...formData,
        slug,
        order_index: editingCategory ? formData.order_index : categories.length,
      };

      if (editingCategory) {
        const { error } = await supabase
          .from("training_categories")
          .update(categoryData)
          .eq("id", editingCategory.id);

        if (error) throw error;
        toast.success("Categoria atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("training_categories")
          .insert([categoryData]);

        if (error) throw error;
        toast.success("Categoria criada com sucesso!");
      }

      setDialogOpen(false);
      resetForm();
      fetchCategories();
    } catch (error: any) {
      if (error.code === "23505") {
        toast.error("Já existe uma categoria com este nome ou slug");
      } else {
        toast.error("Erro ao salvar categoria: " + error.message);
      }
    }
  };

  const handleEdit = (category: TrainingCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      icon: category.icon,
      color: category.color,
      order_index: category.order_index,
      is_active: category.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (category: TrainingCategory) => {
    const count = trainingsCount[category.slug] || 0;
    
    if (count > 0) {
      if (!confirm(`Esta categoria possui ${count} treinamento(s) vinculado(s). Deseja desativá-la ao invés de excluir?`)) {
        return;
      }
      
      try {
        const { error } = await supabase
          .from("training_categories")
          .update({ is_active: false })
          .eq("id", category.id);

        if (error) throw error;
        toast.success("Categoria desativada com sucesso!");
        fetchCategories();
      } catch (error: any) {
        toast.error("Erro ao desativar categoria: " + error.message);
      }
    } else {
      if (!confirm(`Tem certeza que deseja excluir a categoria "${category.name}"?`)) {
        return;
      }

      try {
        const { error } = await supabase
          .from("training_categories")
          .delete()
          .eq("id", category.id);

        if (error) throw error;
        toast.success("Categoria excluída com sucesso!");
        fetchCategories();
      } catch (error: any) {
        toast.error("Erro ao excluir categoria: " + error.message);
      }
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("training_categories")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      toast.success(currentStatus ? "Categoria desativada" : "Categoria ativada");
      fetchCategories();
    } catch (error: any) {
      toast.error("Erro ao alterar status: " + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      icon: "FolderOpen",
      color: "#3b82f6",
      order_index: 0,
      is_active: true,
    });
    setEditingCategory(null);
  };

  const getIconComponent = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName];
    return IconComponent || Icons.FolderOpen;
  };

  if (loading) {
    return <div className="p-6">Carregando categorias...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Categorias de Treinamento</CardTitle>
            <CardDescription>
              Gerencie as categorias disponíveis para organizar seus treinamentos
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Categoria
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingCategory ? "Editar Categoria" : "Nova Categoria"}
                </DialogTitle>
                <DialogDescription>
                  Preencha os dados da categoria de treinamento
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (!editingCategory) {
                        setFormData(prev => ({ ...prev, slug: generateSlug(e.target.value) }));
                      }
                    }}
                    placeholder="Ex: Gestão de Pessoas"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="slug">Slug *</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="Ex: gestao-de-pessoas"
                  />
                  <p className="text-xs text-muted-foreground">
                    Identificador único (gerado automaticamente do nome)
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descreva o propósito desta categoria"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Ícone</Label>
                    <IconPicker
                      value={formData.icon}
                      onChange={(icon) => setFormData({ ...formData, icon })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Cor</Label>
                    <ColorPicker
                      value={formData.color}
                      onChange={(color) => setFormData({ ...formData, color })}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="order">Ordem de Exibição</Label>
                  <Input
                    id="order"
                    type="number"
                    value={formData.order_index}
                    onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label>Status</Label>
                    <p className="text-sm text-muted-foreground">
                      Categoria {formData.is_active ? "ativa" : "inativa"}
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>

                <div className="rounded-lg border p-4">
                  <Label className="mb-2 block">Preview</Label>
                  <Badge
                    variant="outline"
                    style={{
                      backgroundColor: `${formData.color}20`,
                      borderColor: formData.color,
                      color: formData.color,
                    }}
                  >
                    {(() => {
                      const Icon = getIconComponent(formData.icon);
                      return <Icon className="mr-1 h-3 w-3" />;
                    })()}
                    {formData.name || "Nome da Categoria"}
                  </Badge>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate}>
                  {editingCategory ? "Salvar Alterações" : "Criar Categoria"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-center">Visual</TableHead>
              <TableHead className="text-center">Treinamentos</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => {
              const Icon = getIconComponent(category.icon);
              const count = trainingsCount[category.slug] || 0;
              
              return (
                <TableRow key={category.id}>
                  <TableCell>
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="max-w-[300px] truncate text-muted-foreground">
                    {category.description || "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded"
                        style={{ backgroundColor: `${category.color}20`, color: category.color }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div
                        className="h-4 w-4 rounded border"
                        style={{ backgroundColor: category.color }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{count}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={category.is_active}
                      onCheckedChange={() => toggleActive(category.id, category.is_active)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(category)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(category)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
