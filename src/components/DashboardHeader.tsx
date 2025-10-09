import { Bell, Search } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

export function DashboardHeader() {
  return (
    <header className="h-20 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-8">
      {/* Search Bar */}
      <div className="flex-1 max-w-xl">
        <div className="relative">
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
        
        <button className="relative p-2 hover:bg-secondary rounded-full transition-colors">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="text-right">
            <p className="text-sm font-semibold">Truth Seeker</p>
            <p className="text-xs text-muted-foreground">Verified User</p>
          </div>
          <Avatar>
            <AvatarImage src="" />
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
              TS
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
