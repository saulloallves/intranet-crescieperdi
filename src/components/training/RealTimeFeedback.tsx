import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Sparkles, TrendingUp } from "lucide-react";

interface RealTimeFeedbackProps {
  message: string;
  type: 'success' | 'tip' | 'achievement';
  autoHide?: boolean;
  duration?: number;
}

export function RealTimeFeedback({ 
  message, 
  type, 
  autoHide = true, 
  duration = 5000 
}: RealTimeFeedbackProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (autoHide) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [autoHide, duration]);

  if (!visible) return null;

  const config = {
    success: {
      icon: <CheckCircle2 className="w-4 h-4" />,
      className: "bg-green-50 border-green-200 text-green-900 dark:bg-green-950/20 dark:text-green-100"
    },
    tip: {
      icon: <Sparkles className="w-4 h-4" />,
      className: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/20 dark:text-blue-100"
    },
    achievement: {
      icon: <TrendingUp className="w-4 h-4" />,
      className: "bg-purple-50 border-purple-200 text-purple-900 dark:bg-purple-950/20 dark:text-purple-100"
    }
  };

  const { icon, className } = config[type];

  return (
    <Alert className={`fixed bottom-20 right-4 max-w-md z-50 shadow-lg fade-in ${className}`}>
      {icon}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
