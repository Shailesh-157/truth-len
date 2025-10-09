import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, HelpCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { VerificationDialog } from "@/components/VerificationDialog";

interface Verification {
  id: string;
  content_text: string | null;
  content_url: string | null;
  verdict: "true" | "false" | "misleading" | "unverified";
  confidence_score: number;
  explanation: string | null;
  sources: any;
  ai_analysis: any;
  created_at: string;
}

export function RecentVerifications() {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null);

  useEffect(() => {
    loadVerifications();
  }, []);

  const loadVerifications = async () => {
    try {
      const { data, error } = await supabase
        .from("verifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setVerifications(data || []);
    } catch (error) {
      console.error("Error loading verifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = (verdict: string) => {
    switch (verdict) {
      case "true":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "false":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "misleading":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <HelpCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getBadgeVariant = (verdict: string) => {
    if (verdict === "true") return "default";
    if (verdict === "false") return "destructive";
    return "secondary";
  };

  return (
    <Card className="border-2 w-full">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Recent Verifications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 w-full">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : verifications.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">
            No verifications yet. Try verifying some content!
          </p>
        ) : (
          verifications.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-2 sm:gap-3 pb-4 border-b last:border-0 cursor-pointer hover:bg-secondary/50 p-2 rounded transition-colors w-full"
              onClick={() => setSelectedVerification(item)}
            >
              <div className="mt-1 flex-shrink-0">{getIcon(item.verdict)}</div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className="text-xs sm:text-sm font-medium truncate">
                  {item.content_text?.substring(0, 60) || item.content_url?.substring(0, 60) || "Verification"}...
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge variant={getBadgeVariant(item.verdict)} className="text-xs flex-shrink-0">
                    {item.confidence_score}% confident
                  </Badge>
                  <span className="text-xs text-muted-foreground truncate">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <VerificationDialog
        open={!!selectedVerification}
        onOpenChange={(open) => !open && setSelectedVerification(null)}
        verification={selectedVerification}
      />
    </Card>
  );
}
