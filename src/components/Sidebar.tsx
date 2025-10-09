import { Home, Search, History, TrendingUp, Settings, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "react-router-dom";
import logo from "@/assets/truthlens-logo.png";

const menuItems = [
  { id: "dashboard", icon: Home, label: "Dashboard", path: "/" },
  { id: "history", icon: History, label: "History", path: "/history" },
  { id: "trending", icon: TrendingUp, label: "Trending", path: "/" },
  { id: "about", icon: Info, label: "About", path: "/about" },
  { id: "settings", icon: Settings, label: "Settings", path: "/settings" },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border p-6 flex flex-col">
      {/* Logo Section */}
      <Link to="/" className="flex items-center gap-3 mb-12 hover:opacity-80 transition-opacity">
        <img src={logo} alt="TruthLens" className="h-10 w-10 rounded-full object-cover" />
        <span className="text-2xl font-heading font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Truth.
        </span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.id}
              to={item.path}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-lg" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
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
