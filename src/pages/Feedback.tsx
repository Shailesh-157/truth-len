import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Plus, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Feedback {
  id: string;
  feedback_type: string;
  subject: string;
  message: string;
  rating: number | null;
  status: string;
  created_at: string;
}

export default function Feedback() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

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
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{feedback.message}</p>
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
