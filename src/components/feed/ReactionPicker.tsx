import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Heart, Flame, Zap, ThumbsUp } from "lucide-react";

interface ReactionPickerProps {
  currentReaction?: 'like' | 'love' | 'fire' | 'clap' | null;
  onReact: (reaction: 'like' | 'love' | 'fire' | 'clap') => void;
  likesCount: number;
  loveCount?: number;
  fireCount?: number;
  clapCount?: number;
}

const reactions = [
  { type: 'like' as const, icon: ThumbsUp, emoji: '👍', label: 'Curtir' },
  { type: 'love' as const, icon: Heart, emoji: '❤️', label: 'Amar' },
  { type: 'fire' as const, icon: Flame, emoji: '🔥', label: 'Top' },
  { type: 'clap' as const, icon: Zap, emoji: '👏', label: 'Aplaudir' },
];

export function ReactionPicker({ 
  currentReaction, 
  onReact, 
  likesCount, 
  loveCount = 0, 
  fireCount = 0, 
  clapCount = 0 
}: ReactionPickerProps) {
  const [open, setOpen] = useState(false);
  
  const counts = {
    like: likesCount,
    love: loveCount,
    fire: fireCount,
    clap: clapCount,
  };

  const totalReactions = likesCount + loveCount + fireCount + clapCount;

  const handleReaction = (type: 'like' | 'love' | 'fire' | 'clap') => {
    onReact(type);
    setOpen(false);
  };

  const CurrentIcon = currentReaction 
    ? reactions.find(r => r.type === currentReaction)?.icon 
    : ThumbsUp;

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="hover:scale-110 transition-transform -ml-2"
          >
            {CurrentIcon && (
              <CurrentIcon 
                className={`h-6 w-6 ${
                  currentReaction === 'like' ? 'text-blue-500 fill-blue-500' :
                  currentReaction === 'love' ? 'text-red-500 fill-red-500' :
                  currentReaction === 'fire' ? 'text-orange-500 fill-orange-500' :
                  currentReaction === 'clap' ? 'text-yellow-500 fill-yellow-500' :
                  'text-foreground'
                }`}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex gap-1">
            {reactions.map(({ type, emoji, label }) => (
              <Button
                key={type}
                variant="ghost"
                size="sm"
                onClick={() => handleReaction(type)}
                className={`hover:scale-125 transition-transform text-2xl p-2 ${
                  currentReaction === type ? 'bg-accent' : ''
                }`}
                title={label}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Mostrar contadores de reações */}
      {totalReactions > 0 && (
        <div className="flex items-center gap-1 text-sm">
          {reactions.map(({ type, emoji }) => 
            counts[type] > 0 ? (
              <span key={type} className="flex items-center gap-0.5">
                <span>{emoji}</span>
                <span className="text-muted-foreground">{counts[type]}</span>
              </span>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
