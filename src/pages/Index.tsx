import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { QuickVerify } from "@/components/dashboard/QuickVerify";
import { RecentVerifications } from "@/components/dashboard/RecentVerifications";
import { TrendingNews } from "@/components/dashboard/TrendingNews";
import { Auth } from "@/components/Auth";
import { useAuth } from "@/hooks/useAuth";
import { Shield, CheckCircle, XCircle, TrendingUp } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);

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

  if (!user) {
    return <Auth onSuccess={() => setRefreshKey((k) => k + 1)} />;
  }

  return (
    <div className="min-h-screen flex w-full">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="flex-1 ml-64">
        <DashboardHeader />
        
        <main className="p-8 space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - 2 cols */}
            <div className="lg:col-span-2 space-y-6">
              <QuickVerify onVerificationComplete={() => setRefreshKey((k) => k + 1)} />
              <RecentVerifications key={refreshKey} />
            </div>

            {/* Right Column - 1 col */}
            <div className="space-y-6">
              <TrendingNews />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
