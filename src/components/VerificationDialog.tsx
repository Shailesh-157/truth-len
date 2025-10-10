import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, AlertCircle, HelpCircle, Shield, MessageSquare, Share2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { FeedbackDialog } from "@/components/FeedbackDialog";

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
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  
  if (!verification) return null;

  const generateShareText = () => {
    const verdict = verification.verdict.toUpperCase();
    const confidence = verification.confidence_score;
    const content = (verification.content_text || verification.content_url || "").slice(0, 100);
    
    return `TruthLens Verification Result: ${verdict} (${confidence}% confidence)\n\n"${content}${content.length >= 100 ? '...' : ''}"\n\nVerified with AI-powered fact-checking on TruthLens`;
  };

  const shareToTwitter = () => {
    const text = generateShareText();
    const url = window.location.origin;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
  };

  const shareToWhatsApp = () => {
    const text = generateShareText();
    const url = window.location.origin;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text + '\n\n' + url)}`;
    window.open(whatsappUrl, '_blank');
  };

  const shareToFacebook = () => {
    const url = window.location.origin;
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(generateShareText())}`;
    window.open(facebookUrl, '_blank', 'width=550,height=420');
  };

  const copyToClipboard = async () => {
    const text = generateShareText();
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };
  
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
                {sources.map((source: string, index: number) => {
                  // Check if source is a URL
                  const isUrl = source.startsWith('http://') || source.startsWith('https://');
                  
                  return (
                    <li
                      key={index}
                      className="text-xs sm:text-sm break-words"
                    >
                      {isUrl ? (
                        <a 
                          href={source} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline cursor-pointer"
                        >
                          {source}
                        </a>
                      ) : (
                        <span className="text-primary">{source}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-6 border-t space-y-3">
            {/* Share Button */}
            <div className="space-y-2">
              <Button 
                variant="default" 
                className="w-full bg-gradient-to-r from-primary to-accent"
                onClick={() => setShareMenuOpen(!shareMenuOpen)}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share Verification Result
              </Button>
              
              {shareMenuOpen && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-secondary/30 rounded-lg">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={shareToTwitter}
                    className="w-full text-xs"
                  >
                    <svg className="h-4 w-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    Twitter
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={shareToWhatsApp}
                    className="w-full text-xs"
                  >
                    <svg className="h-4 w-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={shareToFacebook}
                    className="w-full text-xs"
                  >
                    <svg className="h-4 w-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Facebook
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                    className="w-full text-xs"
                  >
                    <svg className="h-4 w-4 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Copy
                  </Button>
                </div>
              )}
            </div>

            {/* Report Button */}
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setFeedbackOpen(true)}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Report Accuracy Issue
            </Button>
          </div>
        </div>
      </DialogContent>

      <FeedbackDialog 
        open={feedbackOpen} 
        onOpenChange={setFeedbackOpen}
        verificationId={verification.id}
      />
    </Dialog>
  );
}
