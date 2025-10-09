import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

interface TrendingItem {
  id: number;
  topic: string;
  verifications: number;
  trend: "up" | "down";
  accuracy: number;
}

const trendingTopics: TrendingItem[] = [
  { id: 1, topic: "Climate Change News", verifications: 1234, trend: "up", accuracy: 78 },
  { id: 2, topic: "Tech Innovations", verifications: 987, trend: "up", accuracy: 92 },
  { id: 3, topic: "Health Claims", verifications: 756, trend: "down", accuracy: 45 },
  { id: 4, topic: "Political Statements", verifications: 654, trend: "up", accuracy: 67 },
];

export function TrendingNews() {
  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="text-lg">Trending Topics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {trendingTopics.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${item.trend === "up" ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                  {item.trend === "up" ? (
                    <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm">{item.topic}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.verifications.toLocaleString()} verifications
                  </p>
                </div>
              </div>
              <Badge 
                variant={item.accuracy > 70 ? "default" : "secondary"}
                className="ml-2"
              >
                {item.accuracy}% avg
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
