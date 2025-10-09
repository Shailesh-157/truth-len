import { Bell, Search, LogOut, LogIn, Menu } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface DashboardHeaderProps {
  onSignInClick?: () => void;
  onMenuClick?: () => void;
}

export function DashboardHeader({ onSignInClick, onMenuClick }: DashboardHeaderProps) {
  const { user, signOut } = useAuth();
  
  const getInitials = (email: string | undefined) => {
    if (!email) return "TS";
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <header className="h-20 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-4 lg:px-8">
      {/* Mobile Menu Button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 hover:bg-secondary rounded-lg transition-colors"
      >
        <Menu className="h-6 w-6" />
      </button>
      {/* Search Bar */}
      <div className="flex-1 max-w-xl mx-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search news to verify..."
            className="pl-10 rounded-full border-2 focus:border-primary"
          />
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        <ThemeToggle />
        
        {user && (
          <button className="relative p-2 hover:bg-secondary rounded-full transition-colors">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
          </button>
        )}

        <div className="flex items-center gap-3 pl-4 border-l border-border">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-3 p-2">
                  <div className="text-right">
                    <p className="text-sm font-semibold">Truth Seeker</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <Avatar>
                    <AvatarImage src="" />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                      {getInitials(user?.email)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button 
              onClick={onSignInClick}
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              <LogIn className="h-4 w-4 mr-2" />
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
