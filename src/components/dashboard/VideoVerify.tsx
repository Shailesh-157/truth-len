import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Video, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

interface VideoVerifyProps {
  onVerificationComplete?: () => void;
  onAuthRequired?: () => void;
}

export function VideoVerify({ onVerificationComplete, onAuthRequired }: VideoVerifyProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
      if (!validTypes.includes(selectedFile.type)) {
        toast({
          title: "Invalid File Type",
          description: "Please upload MP4, WebM, MOV, or AVI video files only.",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (50MB limit)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (selectedFile.size > maxSize) {
        toast({
          title: "File Too Large",
          description: "Video file must be less than 50MB.",
          variant: "destructive",
        });
        return;
      }

      setFile(selectedFile);
    }
  };

  const handleVerify = async () => {
    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please select a video file to verify.",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      onAuthRequired?.();
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Upload video to storage
      const fileName = `${user.id}/${Date.now()}_${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      setUploadProgress(100);
      setUploading(false);
      setProcessing(true);

      toast({
        title: "Upload Complete",
        description: "Processing video... This may take 1-2 minutes.",
      });

      // Process video through edge function
      const { data, error } = await supabase.functions.invoke('process-video', {
        body: {
          videoPath: fileName,
          userId: user.id
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Video processing failed');
      }

      toast({
        title: "Verification Complete",
        description: `Video analyzed: ${data.analysis.verdict.toUpperCase()}`,
      });

      setFile(null);
      onVerificationComplete?.();
    } catch (error) {
      console.error('Video verification error:', error);
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : "Failed to verify video",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setProcessing(false);
      setUploadProgress(0);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Video Verification
        </CardTitle>
        <CardDescription>
          Upload a video to analyze for deepfakes, manipulation, and authenticity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Video analysis includes: deepfake detection, editing artifacts, audio-visual sync, and context verification.
            Maximum file size: 50MB. Processing time: 1-2 minutes.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="video-upload">Select Video File</Label>
          <Input
            id="video-upload"
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
            onChange={handleFileChange}
            disabled={uploading || processing}
          />
          {file && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
            </p>
          )}
        </div>

        {(uploading || processing) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {uploading ? 'Uploading...' : 'Processing video...'}
              </span>
              {uploading && <span>{uploadProgress}%</span>}
            </div>
            <Progress value={uploading ? uploadProgress : undefined} className={processing ? "animate-pulse" : ""} />
          </div>
        )}

        <Button
          onClick={handleVerify}
          disabled={!file || uploading || processing}
          className="w-full"
        >
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing Video...
            </>
          ) : uploading ? (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Uploading...
            </>
          ) : (
            <>
              <Video className="h-4 w-4 mr-2" />
              Verify Video
            </>
          )}
        </Button>

        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Supported formats:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>MP4 - Most common, recommended</li>
            <li>WebM - Web-optimized format</li>
            <li>MOV - Apple QuickTime</li>
            <li>AVI - Windows video format</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
