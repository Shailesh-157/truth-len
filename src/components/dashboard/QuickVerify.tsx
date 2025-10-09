import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Search, Link2, Image, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface QuickVerifyProps {
  onVerificationComplete?: () => void;
  onAuthRequired?: () => void;
}

export function QuickVerify({ onVerificationComplete, onAuthRequired }: QuickVerifyProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = async () => {
    if (!user) {
      toast.error("Sign in required", {
        description: "Please sign in to verify content and save your verification history.",
        action: {
          label: "Sign In",
          onClick: () => onAuthRequired?.(),
        },
      });
      return;
    }

    if (!content.trim()) {
      toast.error("Please enter some content to verify");
      return;
    }

    setIsVerifying(true);

    try {
      const { data, error } = await supabase.functions.invoke("verify-content", {
        body: {
          contentText: content,
          contentType: "text",
        },
      });

      if (error) throw error;

      const { analysis } = data;
      
      // Show result toast
      const verdictEmoji = {
        true: "✅",
        false: "❌",
        misleading: "⚠️",
        unverified: "❓",
      }[analysis.verdict];

      toast.success(`${verdictEmoji} ${analysis.verdict.toUpperCase()}`, {
        description: `Confidence: ${analysis.confidence}% - ${analysis.explanation.substring(0, 100)}...`,
        duration: 5000,
      });

      setContent("");
      onVerificationComplete?.();
    } catch (error: any) {
      console.error("Verification error:", error);
      toast.error(error.message || "Failed to verify content");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Card className="border-2 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          Quick Verify
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Paste news text, URL, or claim to verify..."
          className="min-h-[120px] resize-none"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={isVerifying}
        />
        
        <div className="flex gap-2">
          <Button
            className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90"
            onClick={handleVerify}
            disabled={isVerifying || !content.trim()}
          >
            {isVerifying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Verify Now
              </>
            )}
          </Button>
          <Button variant="outline" size="icon" disabled={isVerifying}>
            <Link2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" disabled={isVerifying}>
            <Image className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            {user 
              ? "Supports text, URLs, images, and videos" 
              : "Sign in to verify content and track your verification history"
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
