import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, HelpCircle, Shield } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface VerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verification: {
    id: string;
    content_text: string | null;
    content_url: string | null;
    verdict: "true" | "false" | "misleading" | "unverified";
    confidence_score: number;
    explanation: string | null;
    sources: any;
    ai_analysis: any;
    created_at: string;
  } | null;
}

export function VerificationDialog({
  open,
  onOpenChange,
  verification,
}: VerificationDialogProps) {
  if (!verification) return null;

  const getIcon = (verdict: string) => {
    switch (verdict) {
      case "true":
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case "false":
        return <XCircle className="h-8 w-8 text-red-500" />;
      case "misleading":
        return <AlertCircle className="h-8 w-8 text-yellow-500" />;
      default:
        return <HelpCircle className="h-8 w-8 text-gray-500" />;
    }
  };

  const getBadgeVariant = (verdict: string) => {
    if (verdict === "true") return "default";
    if (verdict === "false") return "destructive";
    return "secondary";
  };

  const redFlags = verification.ai_analysis?.redFlags || [];
  const positiveIndicators = verification.ai_analysis?.positiveIndicators || [];
  const sources = Array.isArray(verification.sources) ? verification.sources : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {getIcon(verification.verdict)}
            <div className="flex-1">
              <DialogTitle className="text-2xl">Verification Result</DialogTitle>
              <DialogDescription>
                {formatDistanceToNow(new Date(verification.created_at), {
                  addSuffix: true,
                })}
              </DialogDescription>
            </div>
            <Badge
              variant={getBadgeVariant(verification.verdict)}
              className="text-lg px-4 py-2"
            >
              {verification.verdict.toUpperCase()}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Content */}
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Analyzed Content
            </h3>
            <p className="text-sm text-muted-foreground bg-secondary/50 p-4 rounded-lg">
              {verification.content_text || verification.content_url}
            </p>
          </div>

          {/* Confidence Score */}
          <div className="space-y-2">
            <h3 className="font-semibold">Confidence Score</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-secondary rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    verification.confidence_score > 80
                      ? "bg-green-500"
                      : verification.confidence_score > 60
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${verification.confidence_score}%` }}
                />
              </div>
              <span className="font-bold text-lg">{verification.confidence_score}%</span>
            </div>
          </div>

          {/* Explanation */}
          <div className="space-y-2">
            <h3 className="font-semibold">Explanation</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {verification.explanation}
            </p>
          </div>

          {/* Red Flags */}
          {redFlags.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-red-600 dark:text-red-400">Red Flags</h3>
              <ul className="space-y-1">
                {redFlags.map((flag: string, index: number) => (
                  <li
                    key={index}
                    className="text-sm text-muted-foreground flex items-start gap-2"
                  >
                    <span className="text-red-500 mt-1">•</span>
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Positive Indicators */}
          {positiveIndicators.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-green-600 dark:text-green-400">
                Positive Indicators
              </h3>
              <ul className="space-y-1">
                {positiveIndicators.map((indicator: string, index: number) => (
                  <li
                    key={index}
                    className="text-sm text-muted-foreground flex items-start gap-2"
                  >
                    <span className="text-green-500 mt-1">•</span>
                    <span>{indicator}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sources */}
          {sources.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Credible Sources</h3>
              <ul className="space-y-1">
                {sources.map((source: string, index: number) => (
                  <li
                    key={index}
                    className="text-sm text-primary hover:underline cursor-pointer"
                  >
                    {source}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
