import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Search, Link2, Image } from "lucide-react";

export function QuickVerify() {
  return (
    <Card className="border-2 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          Quick Verify
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Paste news text, URL, or claim to verify..."
          className="min-h-[120px] resize-none"
        />
        
        <div className="flex gap-2">
          <Button className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90">
            <Search className="h-4 w-4 mr-2" />
            Verify Now
          </Button>
          <Button variant="outline" size="icon">
            <Link2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Image className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Supports text, URLs, images, and videos
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
