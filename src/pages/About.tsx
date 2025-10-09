import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Shield, Users, Zap, Globe, Award } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import logo from "@/assets/truthlens-logo.png";

const About = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  return (
    <div className="min-h-screen flex w-full">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 lg:ml-64">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
        
        <div className="p-4 lg:p-8">
          <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <img
            src={logo}
            alt="TruthLens"
            className="w-24 h-24 mx-auto rounded-full shadow-glow"
          />
          <h1 className="text-5xl font-bold">About TruthLens</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Empowering digital literacy through AI-powered fact-checking and
            verification
          </p>
        </div>

        {/* Mission */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-6 w-6 text-primary" />
              Our Mission
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              TruthLens is an AI-powered platform designed to combat misinformation
              and promote digital awareness. We believe everyone deserves access to
              verified, truthful information in an age where fake news spreads faster
              than ever.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Our mission is to provide instant, accurate verification of news,
              social media posts, and online claims, helping users make informed
              decisions based on facts rather than fiction.
            </p>
          </CardContent>
        </Card>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-blue-500" />
                AI-Powered Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Advanced natural language processing and machine learning
                algorithms analyze content for credibility and detect fake news
                with high accuracy.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5 text-yellow-500" />
                Instant Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Get verification results in under 5 seconds with detailed
                explanations and confidence scores to help you understand the
                verdict.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="h-5 w-5 text-green-500" />
                Multi-Format Support
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Verify text, URLs, images, and videos from any source. Our
                platform adapts to different content types for comprehensive
                analysis.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-purple-500" />
                Community Driven
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Leverage collective intelligence with community feedback and
                verification to build a more informed digital society.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Important Notice - Political & Time-Sensitive Content */}
        <Card className="border-2 border-yellow-500/50 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
              <Shield className="h-6 w-6" />
              Important: Political & Time-Sensitive Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              For current political positions, breaking news, and time-sensitive information, 
              TruthLens will return a verdict of <strong className="text-yellow-600 dark:text-yellow-500">"UNVERIFIED"</strong>. 
              This is because our AI system cannot access real-time data or verify rapidly changing 
              political situations without up-to-the-minute information.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              We explicitly state that we cannot verify such content and strongly recommend 
              users consult official government sources, verified news outlets, and authoritative 
              organizations for the most current and accurate information on:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Current political office holders and their positions</li>
              <li>Recent political developments and policy changes</li>
              <li>Breaking news and developing stories</li>
              <li>Real-time events and announcements</li>
            </ul>
            <p className="text-sm text-muted-foreground italic border-l-4 border-yellow-500 pl-4">
              Always verify time-sensitive and political information through multiple official 
              sources before making important decisions.
            </p>
          </CardContent>
        </Card>

        {/* Technology */}
        <Card className="border-2 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-6 w-6 text-primary" />
              Technology
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              TruthLens uses state-of-the-art AI technology powered by Google's
              Gemini models to analyze content for authenticity. Our system
              cross-references claims with verified databases, analyzes source
              credibility, and provides detailed explanations for every verdict.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                AI/ML
              </span>
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                NLP
              </span>
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                Fact-Checking APIs
              </span>
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                Source Analysis
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Get in Touch</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Have questions or feedback? We'd love to hear from you. Reach out to
              us at{" "}
              <a
                href="mailto:contact@truthlens.com"
                className="text-primary hover:underline"
              >
                contact@truthlens.com
              </a>
            </p>
          </CardContent>
        </Card>
        </div>
        </div>
      </div>
    </div>
  );
};

export default About;
