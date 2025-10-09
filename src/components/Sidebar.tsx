import { Home, Search, History, TrendingUp, Settings, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/truthlens-logo.png";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const menuItems = [
  { id: "dashboard", icon: Home, label: "Dashboard" },
  { id: "verify", icon: Search, label: "Verify Now" },
  { id: "history", icon: History, label: "History" },
  { id: "trending", icon: TrendingUp, label: "Trending" },
  { id: "about", icon: Info, label: "About" },
  { id: "settings", icon: Settings, label: "Settings" },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border p-6 flex flex-col">
      {/* Logo Section */}
      <div className="flex items-center gap-3 mb-12">
        <img src={logo} alt="TruthLens" className="h-10 w-10 rounded-full object-cover" />
        <span className="text-2xl font-heading font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Truth.
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-lg" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="pt-6 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          © 2025 TruthLens
        </p>
      </div>
    </aside>
  );
}
