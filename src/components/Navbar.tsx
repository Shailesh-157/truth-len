import { ThemeToggle } from "./ThemeToggle";
import { LanguageSelector } from "./LanguageSelector";
import logo from "@/assets/truthlens-logo.png";

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={logo} alt="TruthLens" className="h-10 w-10 rounded-full object-cover" />
          <span className="text-xl font-heading font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            TruthLens
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <a href="#features" className="hidden sm:block text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="hidden sm:block text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
            How It Works
          </a>
          <a href="#verify" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
            Verify Now
          </a>
          <LanguageSelector />
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
