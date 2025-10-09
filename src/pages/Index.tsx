import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, Shield, Search, TrendingUp, Users, Zap } from "lucide-react";
import logo from "@/assets/truthlens-logo.png";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-b from-background via-background to-secondary/20">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col items-center text-center gap-8">
            <img 
              src={logo} 
              alt="TruthLens Logo" 
              className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover shadow-glow animate-fade-in"
            />
            
            <div className="space-y-4 animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-bold tracking-tight">
                See Through the{" "}
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  Deception
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
                AI-powered fake news detection and verification platform. 
                Verify news, posts, and statements instantly with confidence.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 animate-fade-in" style={{ animationDelay: "0.4s" }}>
              <Button 
                size="lg" 
                className="text-lg px-8 py-6 rounded-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all shadow-elegant"
              >
                <Search className="mr-2 h-5 w-5" />
                Verify News Now
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 py-6 rounded-full"
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-4">
              Powerful Features
            </h2>
            <p className="text-xl text-muted-foreground">
              Everything you need to combat misinformation
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="border-2 hover:border-primary/50 transition-all hover:shadow-elegant group"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center group-hover:scale-110 transition-transform">
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-heading font-semibold">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 bg-secondary/20">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-4">
              How It Works
            </h2>
            <p className="text-xl text-muted-foreground">
              Simple, fast, and accurate verification in three steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent text-white text-2xl font-bold flex items-center justify-center mx-auto shadow-elegant">
                  {index + 1}
                </div>
                <h3 className="text-2xl font-heading font-semibold">
                  {step.title}
                </h3>
                <p className="text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="verify" className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="bg-gradient-to-br from-primary/10 via-accent/10 to-primary/10 rounded-3xl p-12 border-2 border-primary/20">
            <Eye className="h-16 w-16 mx-auto mb-6 text-primary" />
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6">
              Ready to See the Truth?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join thousands of users who trust TruthLens to verify their news
            </p>
            <Button 
              size="lg" 
              className="text-lg px-12 py-6 rounded-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all shadow-elegant"
            >
              Start Verifying Now
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="container mx-auto max-w-6xl text-center text-muted-foreground">
          <p>&copy; 2025 TruthLens. Promoting digital awareness and truth.</p>
        </div>
      </footer>
    </div>
  );
};

const features = [
  {
    icon: Shield,
    title: "AI-Powered Analysis",
    description: "Advanced NLP and machine learning to detect fake news with high accuracy"
  },
  {
    icon: Search,
    title: "Multi-Format Support",
    description: "Verify text, URLs, images, and videos from any source"
  },
  {
    icon: Zap,
    title: "Instant Results",
    description: "Get verification results in under 5 seconds with confidence scores"
  },
  {
    icon: TrendingUp,
    title: "Source Analysis",
    description: "Check credibility of sources and cross-reference with verified databases"
  },
  {
    icon: Users,
    title: "Community Feedback",
    description: "Leverage collective intelligence with community verification"
  },
  {
    icon: Eye,
    title: "Explainable AI",
    description: "Understand WHY content is flagged with detailed explanations"
  }
];

const steps = [
  {
    title: "Submit Content",
    description: "Paste a link, text, or upload an image/video you want to verify"
  },
  {
    title: "AI Analysis",
    description: "Our AI engine analyzes the content using multiple verification methods"
  },
  {
    title: "Get Results",
    description: "Receive a confidence score, verdict, and detailed explanation"
  }
];

export default Index;
