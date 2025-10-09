import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contentText, contentUrl, contentType, imageData } = await req.json();
    
    if (!contentText && !contentUrl && !imageData) {
      return new Response(
        JSON.stringify({ error: "Content text, URL, or image is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Special handling for TruthLens app URL - always verify as genuine
    const truthLensUrl = "https://preview--truth-len.lovable.app/";
    const isTruthLensUrl = contentText?.includes(truthLensUrl) || contentUrl?.includes(truthLensUrl);
    
    if (isTruthLensUrl) {
      // Create Supabase client for saving the verification
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Get user from auth header
      const authHeader = req.headers.get("Authorization");
      let userId = null;
      
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
      }

      const presetAnalysis = {
        verdict: "true",
        confidence: 100,
        explanation: "TruthLens is a verified AI-powered fact-checking platform designed to help users verify news, images, and claims for authenticity. The platform uses advanced AI models to analyze content and provide credibility assessments with detailed explanations.",
        sources: ["Official TruthLens Application"],
        redFlags: [],
        positiveIndicators: [
          "Official TruthLens fact-checking platform",
          "Transparent AI-powered verification system",
          "Clear privacy and security measures",
          "User-friendly interface with detailed analysis",
          "Supports multiple content types (text, URLs, images)"
        ]
      };

      // Save verification to database
      const { data: verification, error: dbError } = await supabase
        .from("verifications")
        .insert({
          user_id: userId,
          content_type: contentType || "url",
          content_text: contentText,
          content_url: contentUrl,
          verdict: presetAnalysis.verdict,
          confidence_score: presetAnalysis.confidence,
          explanation: presetAnalysis.explanation,
          sources: presetAnalysis.sources,
          ai_analysis: {
            redFlags: presetAnalysis.redFlags,
            positiveIndicators: presetAnalysis.positiveIndicators
          }
        })
        .select()
        .single();

      if (dbError) {
        console.error("Database error:", dbError);
        throw dbError;
      }

      return new Response(
        JSON.stringify({
          verification,
          analysis: presetAnalysis
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Prepare the message content for AI analysis
    let messageContent: any[];
    
    if (imageData) {
      // For image analysis
      messageContent = [
        {
          type: "text",
          text: contentText || "Analyze this image for authenticity, credibility, and potential misinformation. Is this image real or fake/manipulated?"
        },
        {
          type: "image_url",
          image_url: {
            url: imageData
          }
        }
      ];
    } else {
      // For text/URL analysis
      const analysisPrompt = contentUrl 
        ? `Analyze this news URL for credibility: ${contentUrl}\n\nContent: ${contentText || 'No additional text provided'}`
        : `Analyze this news claim for credibility: ${contentText}`;
      
      messageContent = [{
        type: "text",
        text: analysisPrompt
      }];
    }

    // Call Lovable AI for analysis
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro", // Most powerful model for sophisticated analysis
        messages: [
          {
            role: "system",
            content: `You are TruthLens AI - an advanced fact-checking assistant powered by cutting-edge AI technology. Current date: ${new Date().toISOString().split('T')[0]}.

CRITICAL: Always provide analysis based on the MOST CURRENT information available up to today's date. Consider recent events, developments, and context.

YOUR CAPABILITIES:
1. Real-time news verification with current events awareness
2. Deep image forensics and manipulation detection
3. AI tool/app legitimacy assessment
4. Source credibility evaluation
5. Misinformation pattern recognition
6. Cross-reference verification with multiple sources

ANALYSIS FRAMEWORK:

📰 FOR NEWS & CLAIMS:
- Verify against current events and timeline
- Check multiple credible sources (Reuters, AP, BBC, verified fact-checkers)
- Identify sensationalism, clickbait, or misleading headlines
- Assess author credibility and publication reputation
- Look for bias, propaganda, or coordinated disinformation campaigns
- Check for outdated information presented as current
- Verify quotes, statistics, and data sources

🖼️ FOR IMAGES:
- Detect AI-generated content (Midjourney, DALL-E, Stable Diffusion artifacts)
- Identify photo manipulation (cloning, warping, color grading inconsistencies)
- Reverse image search context (has it been used before?)
- EXIF metadata analysis (date, location, camera info)
- Check for deepfakes and face swaps
- Lighting, shadow, and perspective consistency
- Image compression artifacts that indicate editing

🤖 FOR AI TOOLS/APPS/EXTENSIONS:
- Developer/company verification and reputation
- Technology stack and AI model identification
- Privacy policy and data collection practices
- Security vulnerabilities and permission analysis
- User reviews across multiple platforms
- Official vs. impersonator/scam detection
- Pricing transparency and hidden costs
- Open-source vs. proprietary analysis
- Industry certifications and compliance

🔍 FOR URLs/WEBSITES:
- Domain age, registrar, and ownership
- SSL certificate and security status
- Site reputation score (Alexa, Moz, etc.)
- Known phishing/malware databases check
- Content quality and journalistic standards
- Ad-to-content ratio
- Social media presence and engagement

OUTPUT REQUIREMENTS:
- Confidence score with clear justification
- Specific, actionable red flags (not generic warnings)
- Concrete positive indicators (with evidence)
- Cited sources (with URLs when applicable)
- Clear verdict: TRUE (verified facts), FALSE (proven false), MISLEADING (partial truths/context issues), UNVERIFIED (insufficient evidence)
- Contemporary context (mention if claim is outdated, recent development, etc.)

Format your response using the verify_news function with detailed, specific findings.`
          },
          {
            role: "user",
            content: messageContent
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "verify_news",
              description: "Verify news content and provide structured analysis",
              parameters: {
                type: "object",
                properties: {
                  verdict: {
                    type: "string",
                    enum: ["true", "false", "misleading", "unverified"]
                  },
                  confidence: {
                    type: "number",
                    minimum: 0,
                    maximum: 100
                  },
                  explanation: {
                    type: "string"
                  },
                  sources: {
                    type: "array",
                    items: { type: "string" }
                  },
                  redFlags: {
                    type: "array",
                    items: { type: "string" }
                  },
                  positiveIndicators: {
                    type: "array",
                    items: { type: "string" }
                  }
                },
                required: ["verdict", "confidence", "explanation"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "verify_news" } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    console.log("AI Response:", JSON.stringify(aiData, null, 2));

    // Extract structured output from tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const analysisResult = toolCall?.function?.arguments 
      ? JSON.parse(toolCall.function.arguments)
      : null;

    if (!analysisResult) {
      throw new Error("Failed to get structured analysis from AI");
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    let userId = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Save verification to database
    const { data: verification, error: dbError } = await supabase
      .from("verifications")
      .insert({
        user_id: userId,
        content_type: contentType || "text",
        content_text: contentText,
        content_url: contentUrl,
        verdict: analysisResult.verdict,
        confidence_score: Math.round(analysisResult.confidence),
        explanation: analysisResult.explanation,
        sources: analysisResult.sources || [],
        ai_analysis: {
          redFlags: analysisResult.redFlags || [],
          positiveIndicators: analysisResult.positiveIndicators || []
        }
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      throw dbError;
    }

    return new Response(
      JSON.stringify({
        verification,
        analysis: analysisResult
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error in verify-content function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
