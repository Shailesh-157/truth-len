import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { QuickVerify } from "@/components/dashboard/QuickVerify";
import { RecentVerifications } from "@/components/dashboard/RecentVerifications";
import { TrendingNews } from "@/components/dashboard/TrendingNews";
import { Auth } from "@/components/Auth";
import { useAuth } from "@/hooks/useAuth";
import { useStats } from "@/hooks/useStats";
import { Shield, CheckCircle, XCircle, TrendingUp } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const stats = useStats();
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
              value={stats.loading ? "..." : stats.totalVerifications.toLocaleString()}
              trend={
                stats.totalVerifications > 0
                  ? `${stats.totalVerifications} verification${stats.totalVerifications !== 1 ? "s" : ""} recorded`
                  : "No verifications yet"
              }
              icon={Shield}
              iconColor="from-blue-500 to-blue-600"
            />
            <StatsCard
              title="Verified True"
              value={stats.loading ? "..." : stats.verifiedTrue.toLocaleString()}
              trend={
                stats.totalVerifications > 0
                  ? `${Math.round((stats.verifiedTrue / stats.totalVerifications) * 100)}% of total`
                  : "Start verifying content"
              }
              icon={CheckCircle}
              iconColor="from-green-500 to-green-600"
            />
            <StatsCard
              title="Detected Fake"
              value={stats.loading ? "..." : stats.detectedFake.toLocaleString()}
              trend={
                stats.totalVerifications > 0
                  ? `${Math.round((stats.detectedFake / stats.totalVerifications) * 100)}% of total`
                  : "Track misinformation"
              }
              icon={XCircle}
              iconColor="from-red-500 to-red-600"
            />
            <StatsCard
              title="Trending Topics"
              value={stats.loading ? "..." : stats.trendingTopics.toLocaleString()}
              trend={
                stats.trendingTopics > 0
                  ? `${stats.trendingTopics} active topic${stats.trendingTopics !== 1 ? "s" : ""}`
                  : "No trending topics"
              }
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
