import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface Verification {
  id: number;
  title: string;
  verdict: "true" | "false" | "misleading";
  confidence: number;
  time: string;
}

const recentVerifications: Verification[] = [
  { id: 1, title: "Breaking: New AI breakthrough announced", verdict: "true", confidence: 94, time: "2 hours ago" },
  { id: 2, title: "Viral claim about health benefits", verdict: "false", confidence: 87, time: "4 hours ago" },
  { id: 3, title: "Political statement verification", verdict: "misleading", confidence: 72, time: "6 hours ago" },
];

export function RecentVerifications() {
  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="text-lg">Recent Verifications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {recentVerifications.map((item) => (
          <div key={item.id} className="flex items-start gap-3 pb-4 border-b last:border-0">
            <div className="mt-1">
              {item.verdict === "true" && <CheckCircle className="h-5 w-5 text-green-500" />}
              {item.verdict === "false" && <XCircle className="h-5 w-5 text-red-500" />}
              {item.verdict === "misleading" && <AlertCircle className="h-5 w-5 text-yellow-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  variant={item.verdict === "true" ? "default" : item.verdict === "false" ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {item.confidence}% confident
                </Badge>
                <span className="text-xs text-muted-foreground">{item.time}</span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
