import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import * as LucideIcons from "lucide-react";

interface MuralCategory {
  id: string;
  key: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  curator_id?: string;
  display_order: number;
}

interface MuralCategoriesProps {
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

export function MuralCategories({ selectedCategory, onSelectCategory }: MuralCategoriesProps) {
  const [categories, setCategories] = useState<MuralCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("mural_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName];
    return Icon || LucideIcons.HelpCircle;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Carregando categorias...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Categorias</h3>
        {selectedCategory && (
          <button
            onClick={() => onSelectCategory(null)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver todas
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {categories.map((category) => {
          const Icon = getIcon(category.icon);
          const isSelected = selectedCategory === category.id;

          return (
            <Card
              key={category.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected
                  ? "ring-2 ring-primary shadow-lg scale-105"
                  : "hover:scale-102"
              }`}
              onClick={() => onSelectCategory(isSelected ? null : category.id)}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={category.color}>
                    <Icon className="h-4 w-4 mr-1" />
                    {category.name}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {category.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
