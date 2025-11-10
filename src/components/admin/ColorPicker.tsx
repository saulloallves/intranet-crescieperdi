import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check } from "lucide-react";

const colors = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#10b981" },
  { name: "Red", value: "#ef4444" },
  { name: "Yellow", value: "#f59e0b" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Pink", value: "#ec4899" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Orange", value: "#f97316" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Lime", value: "#84cc16" },
  { name: "Emerald", value: "#059669" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Fuchsia", value: "#d946ef" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Sky", value: "#0ea5e9" },
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          <div
            className="mr-2 h-4 w-4 rounded border"
            style={{ backgroundColor: value }}
          />
          {colors.find((c) => c.value === value)?.name || "Escolher cor"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3">
        <div className="grid grid-cols-4 gap-2">
          {colors.map((color) => (
            <button
              key={color.value}
              onClick={() => onChange(color.value)}
              className="relative h-12 w-full rounded border-2 transition-all hover:scale-105"
              style={{
                backgroundColor: color.value,
                borderColor: value === color.value ? "#000" : "transparent",
              }}
              title={color.name}
            >
              {value === color.value && (
                <Check className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow-lg" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
