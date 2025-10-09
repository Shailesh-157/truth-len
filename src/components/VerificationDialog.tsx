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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-3 flex-1">
              {getIcon(verification.verdict)}
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl sm:text-2xl">Verification Result</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  {formatDistanceToNow(new Date(verification.created_at), {
                    addSuffix: true,
                  })}
                </DialogDescription>
              </div>
            </div>
            <Badge
              variant={getBadgeVariant(verification.verdict)}
              className="text-sm sm:text-lg px-3 py-1 sm:px-4 sm:py-2 self-start sm:self-auto"
            >
              {verification.verdict.toUpperCase()}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Content */}
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2 text-sm sm:text-base">
              <Shield className="h-4 w-4 flex-shrink-0" />
              Analyzed Content
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground bg-secondary/50 p-3 sm:p-4 rounded-lg break-words overflow-wrap-anywhere">
              {verification.content_text || verification.content_url}
            </p>
          </div>

          {/* Confidence Score */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm sm:text-base">Confidence Score</h3>
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex-1 bg-secondary rounded-full h-3 sm:h-4 overflow-hidden">
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
              <span className="font-bold text-base sm:text-lg flex-shrink-0">{verification.confidence_score}%</span>
            </div>
          </div>

          {/* Explanation */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm sm:text-base">Explanation</h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed break-words">
              {verification.explanation}
            </p>
          </div>

          {/* Red Flags */}
          {redFlags.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-red-600 dark:text-red-400 text-sm sm:text-base">Red Flags</h3>
              <ul className="space-y-2">
                {redFlags.map((flag: string, index: number) => (
                  <li
                    key={index}
                    className="text-xs sm:text-sm text-muted-foreground flex items-start gap-2"
                  >
                    <span className="text-red-500 mt-0.5 flex-shrink-0">•</span>
                    <span className="break-words">{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Positive Indicators */}
          {positiveIndicators.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-green-600 dark:text-green-400 text-sm sm:text-base">
                Positive Indicators
              </h3>
              <ul className="space-y-2">
                {positiveIndicators.map((indicator: string, index: number) => (
                  <li
                    key={index}
                    className="text-xs sm:text-sm text-muted-foreground flex items-start gap-2"
                  >
                    <span className="text-green-500 mt-0.5 flex-shrink-0">•</span>
                    <span className="break-words">{indicator}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sources */}
          {sources.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm sm:text-base">Credible Sources</h3>
              <ul className="space-y-2">
                {sources.map((source: string, index: number) => (
                  <li
                    key={index}
                    className="text-xs sm:text-sm text-primary hover:underline cursor-pointer break-words"
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
