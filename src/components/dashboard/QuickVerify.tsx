import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Link2, Image, Loader2, X, Upload, Mic, StopCircle, Video, Music } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { VerificationDialog } from "@/components/VerificationDialog";

interface QuickVerifyProps {
  onVerificationComplete?: () => void;
  onAuthRequired?: () => void;
}

export function QuickVerify({ onVerificationComplete, onAuthRequired }: QuickVerifyProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [inputType, setInputType] = useState<"text" | "url" | "image" | "audio" | "video">("text");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<File | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<"text" | "image" | "audio" | "video">("text");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearAudio = () => {
    setSelectedAudio(null);
    if (audioInputRef.current) audioInputRef.current.value = "";
  };

  const clearVideo = () => {
    setSelectedVideo(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image size should be less than 10MB");
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        toast.error("Please select a valid image file");
        return;
      }
      
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        toast.error("Audio file size should be less than 25MB");
        return;
      }
      
      if (!file.type.startsWith('audio/')) {
        toast.error("Please select a valid audio file");
        return;
      }
      
      setSelectedAudio(file);
      toast.success(`Audio file selected: ${file.name}`);
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        toast.error("Video file size should be less than 100MB");
        return;
      }
      
      if (!file.type.startsWith('video/')) {
        toast.error("Please select a valid video file");
        return;
      }
      
      setSelectedVideo(file);
      toast.success(`Video file selected: ${file.name}`);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
        setSelectedAudio(audioFile);
        stream.getTracks().forEach(track => track.stop());
        toast.success("Recording saved successfully");
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Recording started... Speak now");
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
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

    const hasContent = content.trim() || selectedImage || selectedAudio || selectedVideo;
    if (!hasContent) {
      toast.error("Please enter some content or select a file to verify");
      return;
    }

    setIsVerifying(true);

    try {
      let requestBody: any = {};

      if (selectedImage) {
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
      } else if (selectedAudio) {
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); // Remove data:audio/... prefix
          };
          reader.readAsDataURL(selectedAudio);
        });
        const audioData = await base64Promise;
        
        requestBody = {
          contentType: "audio",
          audioData: audioData,
          contentText: content || "Transcribe and verify this audio content",
        };
        
        toast.info("Transcribing audio... This may take a moment");
      } else if (selectedVideo) {
        // Upload video to storage
        const fileName = `${Date.now()}-${selectedVideo.name}`;
        
        toast.info("Uploading video... This may take a moment");
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('videos')
          .upload(fileName, selectedVideo);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          throw new Error("Failed to upload video");
        }

        const { data: { publicUrl } } = supabase.storage
          .from('videos')
          .getPublicUrl(fileName);

        requestBody = {
          contentType: "video",
          contentUrl: publicUrl,
          videoMetadata: {
            fileName: selectedVideo.name,
            fileSize: selectedVideo.size,
            fileType: selectedVideo.type,
          },
        };
      } else if (inputType === "url") {
        requestBody = {
          contentType: "url",
          contentUrl: content,
        };
      } else {
        requestBody = {
          contentType: "text",
          contentText: content,
        };
      }

      const { data, error } = await supabase.functions.invoke("verify-content", {
        body: requestBody,
      });

      if (error) throw error;

      const { analysis, verification } = data;
      
      setVerificationResult(verification);
      setShowResultDialog(true);

      setContent("");
      clearImage();
      clearAudio();
      clearVideo();
      onVerificationComplete?.();
      
      toast.success("Verification complete!");
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
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="text" className="text-xs sm:text-sm">Text/URL</TabsTrigger>
            <TabsTrigger value="image" className="text-xs sm:text-sm">Image</TabsTrigger>
            <TabsTrigger value="audio" className="text-xs sm:text-sm">Audio</TabsTrigger>
            <TabsTrigger value="video" className="text-xs sm:text-sm">Video</TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4">
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
            <Button
              variant={inputType === "url" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setInputType(inputType === "url" ? "text" : "url");
                setContent("");
              }}
              disabled={isVerifying}
              className="w-full"
            >
              <Link2 className="h-4 w-4 mr-2" />
              {inputType === "url" ? "Switch to Text Mode" : "Switch to URL Mode"}
            </Button>
          </TabsContent>

          <TabsContent value="image" className="space-y-4">
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
                  disabled={isVerifying}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Image className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium mb-2">Select an image to verify</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  disabled={isVerifying}
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isVerifying}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Image
                </Button>
                <p className="text-xs text-muted-foreground mt-4">
                  Supports: JPG, PNG, WEBP (Max 10MB)
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="audio" className="space-y-4">
            <div className="space-y-3">
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Mic className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium mb-4">Record or Upload Audio</p>
                
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isVerifying || !!selectedAudio}
                    variant={isRecording ? "destructive" : "default"}
                    className="w-full"
                  >
                    {isRecording ? (
                      <>
                        <StopCircle className="h-4 w-4 mr-2" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4 mr-2" />
                        Start Recording
                      </>
                    )}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or</span>
                    </div>
                  </div>

                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioSelect}
                    className="hidden"
                    disabled={isVerifying || isRecording}
                  />
                  <Button
                    variant="outline"
                    onClick={() => audioInputRef.current?.click()}
                    disabled={isVerifying || isRecording}
                    className="w-full"
                  >
                    <Music className="h-4 w-4 mr-2" />
                    {selectedAudio ? selectedAudio.name : "Upload Audio File"}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground mt-4">
                  Supports: MP3, WAV, M4A, WEBM (Max 25MB)
                </p>
              </div>

              {selectedAudio && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm truncate">{selectedAudio.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAudio}
                    disabled={isVerifying}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="video" className="space-y-4">
            <div className="space-y-3">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium mb-4">Upload Video for Verification</p>
                
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoSelect}
                  className="hidden"
                  disabled={isVerifying}
                />
                <Button
                  variant="outline"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={isVerifying}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {selectedVideo ? selectedVideo.name : "Choose Video File"}
                </Button>
                
                <p className="text-xs text-muted-foreground mt-4">
                  Supports: MP4, AVI, MOV, WEBM (Max 100MB)
                </p>
              </div>

              {selectedVideo && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex-1 truncate">
                    <span className="text-sm font-medium block truncate">{selectedVideo.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(selectedVideo.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearVideo}
                    disabled={isVerifying}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Button
          className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-sm sm:text-base"
          onClick={handleVerify}
          disabled={isVerifying || (!content.trim() && !selectedImage && !selectedAudio && !selectedVideo)}
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
        
        <div className="pt-2 border-t border-border w-full">
          <p className="text-xs text-muted-foreground text-center break-words">
            {user 
              ? "AI-powered verification for text, URLs, images, audio, and videos"
              : "Sign in to verify content and track your verification history"
            }
          </p>
        </div>
      </CardContent>

      <VerificationDialog
        open={showResultDialog}
        onOpenChange={setShowResultDialog}
        verification={verificationResult}
      />
    </Card>
  );
}
