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
    <header className="h-16 md:h-20 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-3 md:px-4 lg:px-8 w-full">
      {/* Mobile Menu Button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 hover:bg-secondary rounded-lg transition-colors flex-shrink-0"
      >
        <Menu className="h-5 w-5 md:h-6 md:w-6" />
      </button>
      {/* Search Bar */}
      <div className="flex-1 max-w-xl mx-2 md:mx-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search news to verify..."
            className="pl-10 rounded-full border-2 focus:border-primary"
          />
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
        <ThemeToggle />
        
        {user && (
          <button className="relative p-2 hover:bg-secondary rounded-full transition-colors hidden sm:block">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
          </button>
        )}

        <div className="flex items-center gap-2 md:gap-3 pl-2 md:pl-4 border-l border-border">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 md:gap-3 p-1 md:p-2">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold">Truth Seeker</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[120px] md:max-w-[180px]">{user?.email}</p>
                  </div>
                  <Avatar className="h-8 w-8 md:h-10 md:w-10">
                    <AvatarImage src="" />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs md:text-sm">
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
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-xs md:text-sm px-3 md:px-4"
              size="sm"
            >
              <LogIn className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
              <span className="hidden sm:inline">Sign In</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
