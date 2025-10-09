import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, AlertCircle, HelpCircle, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { VerificationDialog } from "@/components/VerificationDialog";
import { Sidebar } from "@/components/Sidebar";
import { DashboardHeader } from "@/components/DashboardHeader";

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

const History = () => {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [filteredVerifications, setFilteredVerifications] = useState<Verification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    loadVerifications();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = verifications.filter((v) =>
        v.content_text?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredVerifications(filtered);
    } else {
      setFilteredVerifications(verifications);
    }
  }, [searchQuery, verifications]);

  const loadVerifications = async () => {
    try {
      const { data, error } = await supabase
        .from("verifications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVerifications(data || []);
      setFilteredVerifications(data || []);
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
    <div className="min-h-screen flex w-full overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 lg:ml-64 w-full overflow-x-hidden">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
        
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-full">
          <div className="max-w-6xl mx-auto space-y-4 md:space-y-6 w-full">
        <div className="w-full">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">Verification History</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Browse all your past verifications and their results
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search verifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 w-full"
          />
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredVerifications.length === 0 ? (
          <Card className="w-full">
            <CardContent className="py-12 text-center">
              <p className="text-sm sm:text-base text-muted-foreground">
                {searchQuery ? "No verifications found" : "No verification history yet"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4 w-full">
            {filteredVerifications.map((item) => (
              <Card
                key={item.id}
                className="border-2 hover:shadow-lg transition-all cursor-pointer w-full max-w-full overflow-hidden"
                onClick={() => setSelectedVerification(item)}
              >
                <CardHeader className="p-3 sm:p-4 md:p-6 w-full">
                  <div className="flex items-start gap-2 sm:gap-3 w-full min-w-0">
                    <div className="mt-1 flex-shrink-0">{getIcon(item.verdict)}</div>
                    <div className="flex-1 min-w-0 overflow-hidden w-full max-w-full">
                      <CardTitle className="text-sm sm:text-base md:text-lg break-words overflow-wrap-anywhere pr-2">
                        {item.content_text || item.content_url || "Verification"}
                      </CardTitle>
                      <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-1.5 sm:gap-2 mt-2 w-full">
                        <Badge variant={getBadgeVariant(item.verdict)} className="text-xs flex-shrink-0 whitespace-nowrap">
                          {item.verdict.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-xs flex-shrink-0 whitespace-nowrap">
                          {item.confidence_score}% confident
                        </Badge>
                        <span className="text-xs sm:text-sm text-muted-foreground break-words">
                          {formatDistanceToNow(new Date(item.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
          </div>
        </div>

        <VerificationDialog
          open={!!selectedVerification}
          onOpenChange={(open) => !open && setSelectedVerification(null)}
          verification={selectedVerification}
        />
      </div>
    </div>
  );
};

export default History;
