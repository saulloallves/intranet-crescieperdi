import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Edit,
  Trash2,
  User,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  XCircle
} from "lucide-react";

interface Category {
  id: string;
  key: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  curator_id?: string;
  is_active: boolean;
  display_order: number;
  curator?: {
    full_name: string;
    email: string;
  };
}

interface Curator {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export function MuralCategoryManager() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [curators, setCurators] = useState<Curator[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    key: "",
    name: "",
    icon: "",
    color: "",
    description: "",
    curator_id: "",
    is_active: true,
    display_order: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchCategories(), fetchCurators()]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("mural_categories")
      .select(`
        *,
        curator:profiles!mural_categories_curator_id_fkey(full_name, email)
      `)
      .order("display_order", { ascending: true });

    if (error) throw error;
    setCategories(data as any || []);
  };

  const fetchCurators = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .in("role", ["admin", "gestor_setor"])
      .order("full_name");

    if (error) throw error;
    setCurators(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("mural_categories")
          .update({
            ...formData,
            curator_id: formData.curator_id || null
          })
          .eq("id", editingCategory.id);

        if (error) throw error;

        toast({
          title: "Categoria atualizada",
          description: "As alterações foram salvas com sucesso."
        });
      } else {
        const { error } = await supabase
          .from("mural_categories")
          .insert({
            ...formData,
            curator_id: formData.curator_id || null
          });

        if (error) throw error;

        toast({
          title: "Categoria criada",
          description: "Nova categoria adicionada com sucesso."
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchCategories();
    } catch (error) {
      console.error("Error saving category:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a categoria.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      key: category.key,
      name: category.name,
      icon: category.icon,
      color: category.color,
      description: category.description,
      curator_id: category.curator_id || "",
      is_active: category.is_active,
      display_order: category.display_order
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;

    try {
      const { error } = await supabase
        .from("mural_categories")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Categoria excluída",
        description: "A categoria foi removida com sucesso."
      });

      fetchCategories();
    } catch (error) {
      console.error("Error deleting category:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a categoria.",
        variant: "destructive"
      });
    }
  };

  const handleReorder = async (id: string, direction: "up" | "down") => {
    const currentIndex = categories.findIndex(c => c.id === id);
    if (
      (direction === "up" && currentIndex === 0) ||
      (direction === "down" && currentIndex === categories.length - 1)
    ) {
      return;
    }

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const updatedCategories = [...categories];
    [updatedCategories[currentIndex], updatedCategories[newIndex]] = 
      [updatedCategories[newIndex], updatedCategories[currentIndex]];

    try {
      const updates = updatedCategories.map((cat, idx) => ({
        id: cat.id,
        display_order: idx
      }));

      for (const update of updates) {
        await supabase
          .from("mural_categories")
          .update({ display_order: update.display_order })
          .eq("id", update.id);
      }

      fetchCategories();
    } catch (error) {
      console.error("Error reordering categories:", error);
      toast({
        title: "Erro",
        description: "Não foi possível reordenar as categorias.",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setEditingCategory(null);
    setFormData({
      key: "",
      name: "",
      icon: "",
      color: "",
      description: "",
      curator_id: "",
      is_active: true,
      display_order: categories.length
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Gerenciar Categorias</h3>
          <p className="text-sm text-muted-foreground">
            Configure categorias e atribua curadores para acompanhamento
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Editar Categoria" : "Nova Categoria"}
              </DialogTitle>
              <DialogDescription>
                Configure os detalhes da categoria e atribua um curador responsável
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="key">Chave (única)</Label>
                  <Input
                    id="key"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    placeholder="vendas"
                    required
                    disabled={!!editingCategory}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Estratégias de Venda"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="icon">Ícone (Lucide)</Label>
                  <Input
                    id="icon"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="TrendingUp"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="curator">Curador</Label>
                  <Select
                    value={formData.curator_id}
                    onValueChange={(value) => setFormData({ ...formData, curator_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar curador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {curators.map((curator) => (
                        <SelectItem key={curator.id} value={curator.id}>
                          {curator.full_name} ({curator.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">Classes Tailwind (cores)</Label>
                <Input
                  id="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Estratégias, técnicas e dicas de vendas"
                  required
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Categoria ativa</Label>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingCategory ? "Salvar" : "Criar"}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {categories.map((category, index) => (
          <Card key={category.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={category.is_active ? "default" : "secondary"}>
                      {category.name}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {category.key}
                    </Badge>
                    {category.curator && (
                      <Badge variant="outline" className="gap-1">
                        <User className="h-3 w-3" />
                        Curador: {category.curator.full_name}
                      </Badge>
                    )}
                    {category.is_active ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Ícone: {category.icon}</span>
                    <span>•</span>
                    <span>Ordem: {category.display_order}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleReorder(category.id, "up")}
                    disabled={index === 0}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleReorder(category.id, "down")}
                    disabled={index === categories.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(category)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(category.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
