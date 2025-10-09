import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/useAdminRole";
import { MessageSquare, Plus, Calendar, Reply } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Feedback {
  id: string;
  feedback_type: string;
  subject: string;
  message: string;
  rating: number | null;
  status: string;
  created_at: string;
  reply: string | null;
  replied_at: string | null;
  replied_by: string | null;
}

export default function Feedback() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const { isAdmin } = useAdminRole();

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = async () => {
    try {
      const { data, error } = await supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFeedbacks(data || []);
    } catch (error) {
      console.error("Error loading feedback:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "bug": return "destructive";
      case "feature": return "default";
      case "improvement": return "secondary";
      case "accuracy": return "outline";
      default: return "outline";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "resolved": return "default";
      case "reviewed": return "secondary";
      default: return "outline";
    }
  };

  const handleReply = async (feedbackId: string) => {
    const reply = replyText[feedbackId];
    if (!reply?.trim()) {
      toast.error("Please enter a reply");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("feedback")
        .update({
          reply: reply.trim(),
          replied_at: new Date().toISOString(),
          replied_by: user.id,
          status: "resolved"
        })
        .eq("id", feedbackId);

      if (error) throw error;

      toast.success("Reply sent successfully");
      setReplyText({ ...replyText, [feedbackId]: "" });
      setReplyingTo(null);
      loadFeedback();
    } catch (error: any) {
      toast.error(error.message || "Failed to send reply");
    }
  };

  return (
    <div className="min-h-screen flex w-full">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 lg:ml-64 w-full overflow-x-hidden">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="p-4 md:p-6 lg:p-8 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Feedback & Reports</h1>
              <p className="text-muted-foreground mt-1">
                Share your experience and help us improve
              </p>
            </div>
            <Button onClick={() => setFeedbackOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Feedback
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 animate-pulse mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading feedback...</p>
            </div>
          ) : feedbacks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">No feedback submitted yet</p>
                <Button onClick={() => setFeedbackOpen(true)}>
                  Submit Your First Feedback
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {feedbacks.map((feedback) => (
                <Card key={feedback.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1 flex-1">
                        <div className="flex gap-2 items-center flex-wrap">
                          <Badge variant={getTypeColor(feedback.feedback_type)}>
                            {feedback.feedback_type}
                          </Badge>
                          <Badge variant={getStatusColor(feedback.status)}>
                            {feedback.status}
                          </Badge>
                        </div>
                        <CardTitle className="text-xl">{feedback.subject}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {formatDistanceToNow(new Date(feedback.created_at), { addSuffix: true })}
                        </CardDescription>
                      </div>
                      {feedback.rating && (
                        <div className="flex gap-1">
                          {Array.from({ length: feedback.rating }).map((_, i) => (
                            <span key={i} className="text-yellow-400">★</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm whitespace-pre-wrap">{feedback.message}</p>
                    
                    {feedback.reply && (
                      <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                        <div className="flex items-start gap-2">
                          <Reply className="h-4 w-4 text-primary mt-1" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-primary mb-1">Admin Reply</p>
                            <p className="text-sm whitespace-pre-wrap">{feedback.reply}</p>
                            {feedback.replied_at && (
                              <p className="text-xs text-muted-foreground mt-2">
                                {formatDistanceToNow(new Date(feedback.replied_at), { addSuffix: true })}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {isAdmin && !feedback.reply && (
                      <div className="mt-4">
                        {replyingTo === feedback.id ? (
                          <div className="space-y-2">
                            <Textarea
                              placeholder="Type your reply..."
                              value={replyText[feedback.id] || ""}
                              onChange={(e) => setReplyText({ ...replyText, [feedback.id]: e.target.value })}
                              className="min-h-[100px]"
                            />
                            <div className="flex gap-2">
                              <Button onClick={() => handleReply(feedback.id)} size="sm">
                                Send Reply
                              </Button>
                              <Button onClick={() => setReplyingTo(null)} variant="outline" size="sm">
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button onClick={() => setReplyingTo(feedback.id)} variant="outline" size="sm">
                            <Reply className="h-4 w-4 mr-2" />
                            Reply
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      <FeedbackDialog 
        open={feedbackOpen} 
        onOpenChange={(open) => {
          setFeedbackOpen(open);
          if (!open) loadFeedback();
        }} 
      />
    </div>
  );
}
