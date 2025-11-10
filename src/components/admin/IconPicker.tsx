import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Settings,
  TrendingUp,
  Users,
  Headphones,
  GraduationCap,
  Target,
  Award,
  Lightbulb,
  BookOpen,
  Zap,
  Heart,
  Star,
  CheckCircle,
  TrendingDown,
  Activity,
  BarChart,
  PieChart,
  FileText,
  Folder,
  FolderOpen,
  Package,
  Briefcase,
  ShoppingCart,
  MessageSquare,
  Phone,
  Mail,
  Globe,
  Shield,
  Lock,
  Unlock,
  Key,
  UserCheck,
  UserPlus,
  Clock,
  Calendar,
  Bell,
  AlertCircle,
  Info,
  HelpCircle,
  Search,
  Filter,
  Download,
  Upload,
  Share2,
  Edit,
  Trash2,
  Plus,
  Minus,
  X,
  Check,
  ChevronRight,
  Home,
  Layout,
  Grid,
  List,
  Eye,
  EyeOff,
} from "lucide-react";

const iconMap = {
  Settings,
  TrendingUp,
  Users,
  Headphones,
  GraduationCap,
  Target,
  Award,
  Lightbulb,
  BookOpen,
  Zap,
  Heart,
  Star,
  CheckCircle,
  TrendingDown,
  Activity,
  BarChart,
  PieChart,
  FileText,
  Folder,
  FolderOpen,
  Package,
  Briefcase,
  ShoppingCart,
  MessageSquare,
  Phone,
  Mail,
  Globe,
  Shield,
  Lock,
  Unlock,
  Key,
  UserCheck,
  UserPlus,
  Clock,
  Calendar,
  Bell,
  AlertCircle,
  Info,
  HelpCircle,
  Search,
  Filter,
  Download,
  Upload,
  Share2,
  Edit,
  Trash2,
  Plus,
  Minus,
  X,
  Check,
  ChevronRight,
  Home,
  Layout,
  Grid,
  List,
  Eye,
  EyeOff,
};

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const SelectedIcon = iconMap[value as keyof typeof iconMap] || FolderOpen;

  const filteredIcons = Object.keys(iconMap).filter((iconName) =>
    iconName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          <SelectedIcon className="mr-2 h-4 w-4" />
          {value}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="p-2 border-b">
          <Input
            placeholder="Buscar ícone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ScrollArea className="h-[300px]">
          <div className="grid grid-cols-6 gap-2 p-2">
            {filteredIcons.map((iconName) => {
              const Icon = iconMap[iconName as keyof typeof iconMap];
              return (
                <Button
                  key={iconName}
                  variant={value === iconName ? "default" : "ghost"}
                  size="icon"
                  onClick={() => {
                    onChange(iconName);
                    setOpen(false);
                  }}
                  title={iconName}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
