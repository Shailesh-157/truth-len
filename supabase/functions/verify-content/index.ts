import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Define input validation schema
    const inputSchema = z.object({
      contentText: z.string().max(5000).optional(),
      contentUrl: z.string().url().max(2000).optional(),
      contentType: z.enum(['text', 'url', 'image']).optional(),
      imageData: z.string().optional()
    }).refine(
      data => data.contentText || data.contentUrl || data.imageData,
      { message: 'At least one content field (contentText, contentUrl, or imageData) is required' }
    );

    // Parse and validate input
    const rawBody = await req.json();
    const validationResult = inputSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { contentText, contentUrl, contentType, imageData } = validationResult.data;

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
        console.error("Verification save failed");
        throw new Error("Failed to save verification");
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
            content: `You are TruthLens AI - an advanced fact-checking assistant. Current date: ${new Date().toISOString().split('T')[0]}.

⚠️ CRITICAL LIMITATIONS AWARENESS:
- You do NOT have real-time internet access
- Your training data has a knowledge cutoff date
- For current events, political positions, breaking news, or recent appointments - you MUST acknowledge uncertainty
- For time-sensitive claims (government positions, current office holders, recent events), use verdict "UNVERIFIED" and recommend checking official sources

YOUR CAPABILITIES:
1. Historical fact verification (events before your knowledge cutoff)
2. Deep image forensics and manipulation detection  
3. AI tool/app legitimacy assessment (based on general patterns)
4. Logical consistency analysis
5. Misinformation pattern recognition
6. Source credibility evaluation (general reputation)

ANALYSIS FRAMEWORK:

📰 FOR NEWS & CLAIMS:
**For Current Events/Political Positions:**
- If claim involves "current CM/PM/President/Minister" or recent appointments → Verdict: UNVERIFIED
- Explanation must state: "I cannot verify current political positions without real-time data. Please check official government websites."
- Red Flag: "Information may be outdated due to AI knowledge cutoff"
- Provide sources: Official government website URLs for verification

**For Historical Facts:**
- Verify against well-established historical records
- Check multiple credible sources (Reuters, AP, BBC, verified fact-checkers)
- Identify sensationalism, clickbait, or misleading headlines
- Assess author credibility and publication reputation

🖼️ FOR IMAGES:
- Detect AI-generated content (Midjourney, DALL-E, Stable Diffusion artifacts)
- Identify photo manipulation (cloning, warping, color inconsistencies)
- Lighting, shadow, and perspective consistency
- Image compression artifacts indicating editing
- Note: Cannot perform reverse image search without internet access

🤖 FOR AI TOOLS/APPS/EXTENSIONS:
- General pattern analysis (does it look legitimate?)
- Security red flags (excessive permissions, suspicious URLs)
- Common scam indicators
- Privacy policy assessment (if provided in content)
- Note: Cannot verify current company status or real-time reviews

🔍 FOR URLs/WEBSITES:
⚠️ MANDATORY URL ANALYSIS DISCLAIMER:
For ALL URL verifications, your explanation MUST START with:
"I cannot access external websites or URLs, so my analysis is based solely on the URL structure. The domain uses HTTPS [if applicable], which provides basic security."

Then analyze:
- Domain structure analysis (suspicious patterns, credible news domains)
- Security indicators in URL structure (HTTPS presence)
- Known phishing patterns or legitimate news sources
- Domain reputation based on general knowledge
- Note: Cannot access the actual website content or verify current status

OUTPUT REQUIREMENTS:
- Be HONEST about limitations
- For current events: Use "UNVERIFIED" verdict with explanation about knowledge cutoff
- Confidence score reflects certainty given limitations
- Specific red flags with clear reasoning
- Recommend official sources for verification when applicable
- Never claim to have checked something you cannot access

VERDICT GUIDELINES:
- TRUE: Verified historical facts or patterns clearly matching known truth
- FALSE: Proven false based on established facts (be cautious with recent claims)
- MISLEADING: Partial truths, out of context, or manipulated information
- UNVERIFIED: Insufficient data, beyond knowledge cutoff, or requires real-time verification

Format response using verify_news function.`
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
      console.error("AI gateway returned error status");
      throw new Error("AI verification service unavailable");
    }

    const aiData = await aiResponse.json();

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
      console.error("Verification save failed");
      throw new Error("Failed to save verification");
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
    console.error("Verification request failed");
    return new Response(
      JSON.stringify({ error: "Unable to process verification request" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
