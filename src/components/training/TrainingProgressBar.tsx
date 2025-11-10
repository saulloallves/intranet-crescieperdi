import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Target, Clock, CheckCircle2 } from "lucide-react";

interface TrainingProgressBarProps {
  totalModules: number;
  completedModules: number;
  currentModule: number;
  estimatedHours: number;
  score?: number;
}

export function TrainingProgressBar({
  totalModules,
  completedModules,
  currentModule,
  estimatedHours,
  score
}: TrainingProgressBarProps) {
  const progress = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  return (
    <Card className="sticky top-4 z-10 shadow-lg fade-in">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Progresso principal */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Progresso Geral</span>
              </div>
              <span className="text-sm font-bold text-primary">{progress}%</span>
            </div>
            <Progress value={progress} className="h-3 transition-all duration-500" />
            <p className="text-xs text-muted-foreground mt-1">
              {completedModules} de {totalModules} módulos concluídos
            </p>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <span className="text-xs text-muted-foreground">Concluídos</span>
              </div>
              <p className="text-lg font-bold">{completedModules}</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Horas</span>
              </div>
              <p className="text-lg font-bold">{estimatedHours}h</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Trophy className="w-3 h-3 text-primary" />
                <span className="text-xs text-muted-foreground">Nota</span>
              </div>
              <p className="text-lg font-bold">{score || '—'}</p>
            </div>
          </div>

          {/* Badge de status */}
          {progress === 100 && (
            <Badge className="w-full justify-center bg-green-500 hover:bg-green-600 pulse-slow">
              <Trophy className="w-3 h-3 mr-1" />
              Trilha Completa!
            </Badge>
          )}
          {progress > 0 && progress < 100 && (
            <Badge className="w-full justify-center" variant="secondary">
              Em andamento - Módulo {currentModule + 1}/{totalModules}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
