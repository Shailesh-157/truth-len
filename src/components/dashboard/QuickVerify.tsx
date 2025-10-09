import { useState, useRef, DragEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Search, Link2, Image, Loader2, X, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface QuickVerifyProps {
  onVerificationComplete?: () => void;
  onAuthRequired?: () => void;
}

export function QuickVerify({ onVerificationComplete, onAuthRequired }: QuickVerifyProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [inputType, setInputType] = useState<"text" | "url" | "image">("text");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = (file: File) => {
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error("Image size should be less than 10MB");
      return;
    }
    
    if (!file.type.startsWith('image/')) {
      toast.error("Please select a valid image file");
      return;
    }
    
    setSelectedImage(file);
    setInputType("image");
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setShowImageDialog(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImage(file);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setInputType("text");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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

    if (!content.trim() && !selectedImage) {
      toast.error("Please enter some content or select an image to verify");
      return;
    }

    setIsVerifying(true);

    try {
      let requestBody: any = {
        contentType: inputType === "url" ? "url" : "text",
      };

      if (selectedImage) {
        // Convert image to base64
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(selectedImage);
        });
        const base64Image = await base64Promise;
        
        requestBody = {
          contentType: "image",
          imageData: base64Image,
          contentText: content || "Analyze this image for authenticity and credibility",
        };
      } else if (inputType === "url") {
        requestBody.contentUrl = content;
      } else {
        requestBody.contentText = content;
      }

      const { data, error } = await supabase.functions.invoke("verify-content", {
        body: requestBody,
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
      clearImage();
      onVerificationComplete?.();
    } catch (error: any) {
      console.error("Verification error:", error);
      toast.error(error.message || "Failed to verify content");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Card className="border-2 bg-gradient-to-br from-primary/5 to-accent/5 w-full">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Search className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
          Quick Verify
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 w-full">
        {imagePreview ? (
          <div className="relative">
            <img 
              src={imagePreview} 
              alt="Selected" 
              className="w-full h-48 object-cover rounded-lg"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2"
              onClick={clearImage}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Textarea
            placeholder={
              inputType === "url" 
                ? "Paste URL to verify..." 
                : "Paste news text or claim to verify..."
            }
            className="min-h-[100px] sm:min-h-[120px] resize-none w-full"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isVerifying}
          />
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />
        
        <div className="flex gap-2 w-full">
          <Button
            className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-sm sm:text-base min-w-0"
            onClick={handleVerify}
            disabled={isVerifying || (!content.trim() && !selectedImage)}
          >
            {isVerifying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin flex-shrink-0" />
                <span className="truncate">Verifying...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Verify Now</span>
              </>
            )}
          </Button>
          <Button 
            variant={inputType === "url" ? "default" : "outline"} 
            size="icon" 
            disabled={isVerifying || !!selectedImage}
            onClick={() => {
              setInputType(inputType === "url" ? "text" : "url");
              setContent("");
            }}
            className="flex-shrink-0"
            title="Toggle URL mode"
          >
            <Link2 className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            disabled={isVerifying}
            onClick={() => setShowImageDialog(true)}
            className="flex-shrink-0"
            title="Upload image"
          >
            <Image className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="pt-2 border-t border-border w-full">
          <p className="text-xs text-muted-foreground text-center break-words">
            {user 
              ? selectedImage
                ? "Image selected - Click 'Verify Now' to analyze"
                : inputType === "url"
                ? "Paste a URL and click verify"
                : "Supports text, URLs, and images"
              : "Sign in to verify content and track your verification history"
            }
          </p>
        </div>
      </CardContent>

      {/* Image Upload Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Image</DialogTitle>
            <DialogDescription>
              Upload an image to verify its authenticity and detect potential misinformation
            </DialogDescription>
          </DialogHeader>
          
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm font-medium mb-2">
              Drag and drop your image here
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              or
            </p>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Browse from device
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              Supports: JPG, PNG, WEBP (Max 10MB)
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
