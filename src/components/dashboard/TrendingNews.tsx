import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TrendingItem {
  id: string;
  topic_name: string;
  verification_count: number;
  trend_direction: string;
  average_accuracy: number;
}

export function TrendingNews() {
  const [trendingTopics, setTrendingTopics] = useState<TrendingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTrendingTopics();
  }, []);

  const loadTrendingTopics = async () => {
    try {
      const { data, error } = await supabase
        .from("trending_topics")
        .select("*")
        .order("verification_count", { ascending: false })
        .limit(5);

      if (error) throw error;
      
      // If no data, show sample data for demo
      if (!data || data.length === 0) {
        setTrendingTopics([
          {
            id: "1",
            topic_name: "Climate Change News",
            verification_count: 1234,
            trend_direction: "up",
            average_accuracy: 78,
          },
          {
            id: "2",
            topic_name: "Tech Innovations",
            verification_count: 987,
            trend_direction: "up",
            average_accuracy: 92,
          },
          {
            id: "3",
            topic_name: "Health Claims",
            verification_count: 756,
            trend_direction: "down",
            average_accuracy: 45,
          },
          {
            id: "4",
            topic_name: "Political Statements",
            verification_count: 654,
            trend_direction: "up",
            average_accuracy: 67,
          },
        ]);
      } else {
        setTrendingTopics(data);
      }
    } catch (error) {
      console.error("Error loading trending topics:", error);
      // Show sample data on error
      setTrendingTopics([
        {
          id: "1",
          topic_name: "Climate Change News",
          verification_count: 1234,
          trend_direction: "up",
          average_accuracy: 78,
        },
        {
          id: "2",
          topic_name: "Tech Innovations",
          verification_count: 987,
          trend_direction: "up",
          average_accuracy: 92,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="text-lg">Trending Topics</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : trendingTopics.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No trending topics yet
          </p>
        ) : (
          <div className="space-y-4">
            {trendingTopics.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      item.trend_direction === "up"
                        ? "bg-green-100 dark:bg-green-900/30"
                        : "bg-red-100 dark:bg-red-900/30"
                    }`}
                  >
                    {item.trend_direction === "up" ? (
                      <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{item.topic_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.verification_count.toLocaleString()} verifications
                    </p>
                  </div>
                </div>
                <Badge
                  variant={item.average_accuracy > 70 ? "default" : "secondary"}
                  className="ml-2"
                >
                  {item.average_accuracy}% avg
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
