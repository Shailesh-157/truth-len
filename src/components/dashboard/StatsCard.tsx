import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  trend?: string;
  icon: LucideIcon;
  iconColor?: string;
}

export function StatsCard({ title, value, trend, icon: Icon, iconColor = "from-primary to-accent" }: StatsCardProps) {
  return (
    <Card className="border-2 hover:shadow-elegant transition-all w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${iconColor} flex items-center justify-center flex-shrink-0`}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl sm:text-3xl font-bold">{value}</div>
        {trend && (
          <p className="text-xs text-muted-foreground mt-1">
            {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
