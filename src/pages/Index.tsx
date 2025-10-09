import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { QuickVerify } from "@/components/dashboard/QuickVerify";
import { VideoVerify } from "@/components/dashboard/VideoVerify";
import { RecentVerifications } from "@/components/dashboard/RecentVerifications";
import { TrendingNews } from "@/components/dashboard/TrendingNews";
import { Auth } from "@/components/Auth";
import { useAuth } from "@/hooks/useAuth";
import { Shield, CheckCircle, XCircle, TrendingUp } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAuth, setShowAuth] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 animate-pulse mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading TruthLens...</p>
        </div>
      </div>
    );
  }

  if (showAuth && !user) {
    return <Auth onSuccess={() => {
      setShowAuth(false);
      setRefreshKey((k) => k + 1);
    }} />;
  }

  return (
    <div className="min-h-screen flex w-full">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 lg:ml-64 w-full overflow-x-hidden">
        <DashboardHeader 
          onSignInClick={() => setShowAuth(true)}
          onMenuClick={() => setSidebarOpen(true)}
        />
        
        <main className="p-4 md:p-6 lg:p-8 space-y-6 w-full max-w-full">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 w-full">
            <StatsCard
              title="Total Verifications"
              value="12,543"
              trend="+12% from last week"
              icon={Shield}
              iconColor="from-blue-500 to-blue-600"
            />
            <StatsCard
              title="Verified True"
              value="8,234"
              trend="65.6% accuracy rate"
              icon={CheckCircle}
              iconColor="from-green-500 to-green-600"
            />
            <StatsCard
              title="Detected Fake"
              value="3,127"
              trend="24.9% of total"
              icon={XCircle}
              iconColor="from-red-500 to-red-600"
            />
            <StatsCard
              title="Trending Topics"
              value="42"
              trend="8 new today"
              icon={TrendingUp}
              iconColor="from-purple-500 to-purple-600"
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-3 gap-4 md:gap-6 w-full">
            {/* Left Column - 2 cols */}
            <div className="lg:col-span-2 space-y-4 md:space-y-6 w-full min-w-0">
              <QuickVerify 
                onVerificationComplete={() => setRefreshKey((k) => k + 1)}
                onAuthRequired={() => setShowAuth(true)}
              />
              <VideoVerify
                onVerificationComplete={() => setRefreshKey((k) => k + 1)}
                onAuthRequired={() => setShowAuth(true)}
              />
              <RecentVerifications key={refreshKey} />
            </div>

            {/* Right Column - 1 col */}
            <div className="space-y-4 md:space-y-6 w-full min-w-0">
              <TrendingNews />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
