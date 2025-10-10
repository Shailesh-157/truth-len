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
    const GOOGLE_FACT_CHECK_API_KEY = Deno.env.get("GOOGLE_FACT_CHECK_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch real-time fact-checks from Google Fact Check API
    let factCheckResults = [];
    if (GOOGLE_FACT_CHECK_API_KEY && (contentText || contentUrl)) {
      try {
        const query = contentText || contentUrl || "";
        const factCheckResponse = await fetch(
          `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(query)}&key=${GOOGLE_FACT_CHECK_API_KEY}`
        );
        
        if (factCheckResponse.ok) {
          const factCheckData = await factCheckResponse.json();
          factCheckResults = factCheckData.claims || [];
          console.log(`Found ${factCheckResults.length} fact-check results`);
        }
      } catch (error) {
        console.error("Fact check API error:", error);
      }
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
            content: `You are TruthLens AI - an advanced fact-checking assistant with access to real-time fact-checking data. Current date: ${new Date().toISOString().split('T')[0]}.

🔍 ENHANCED CAPABILITIES:
- You have access to verified fact-check results from Google Fact Check Tools API
- Cross-reference claims with professional fact-checkers (Snopes, PolitiFact, FactCheck.org, etc.)
- Utilize real-time verification data when available
- Combine AI analysis with verified fact-check sources for maximum accuracy

${factCheckResults.length > 0 ? `
📊 FACT-CHECK DATA AVAILABLE:
You have ${factCheckResults.length} verified fact-check(s) for this claim. Here's the data:
${JSON.stringify(factCheckResults.slice(0, 3).map((claim: any) => ({
  text: claim.text,
  claimant: claim.claimant,
  claimDate: claim.claimDate,
  claimReview: claim.claimReview?.map((review: any) => ({
    publisher: review.publisher?.name,
    url: review.url,
    title: review.title,
    rating: review.textualRating,
    reviewDate: review.reviewDate
  }))
})), null, 2)}

CRITICAL: Use this verified data as your PRIMARY source. Give it the highest weight in your analysis.
` : ''}

⚠️ LIMITATIONS (when fact-check data unavailable):
- Limited real-time internet access for some sources
- Your training data has a knowledge cutoff date
- For current events without fact-check data, acknowledge uncertainty appropriately

YOUR CAPABILITIES:
1. ✅ Real-time verified fact-check integration (PRIMARY SOURCE)
2. Deep image forensics and manipulation detection  
3. AI tool/app legitimacy assessment
4. Logical consistency analysis
5. Misinformation pattern recognition
6. Cross-referencing with professional fact-checkers
7. Source credibility evaluation with real-time data

ANALYSIS FRAMEWORK:

📰 FOR NEWS & CLAIMS:
**PRIORITY 1 - Use Fact-Check Data (if available):**
- If verified fact-check results are provided above, use them as PRIMARY evidence
- Match the claim against fact-checker ratings (True, False, Misleading, etc.)
- Include fact-checker source URLs in your sources array
- Align your verdict with professional fact-checker consensus
- High confidence scores (85-100%) when multiple fact-checkers agree

**PRIORITY 2 - For Current Events (no fact-check data):**
- If claim involves recent events or political positions → Check if fact-check data exists
- Without fact-check data: Use verdict "UNVERIFIED" for time-sensitive claims
- Recommend checking official sources and fact-checking websites
- Lower confidence scores (40-60%) when relying solely on patterns

**For All Claims:**
- Identify sensationalism, clickbait, or misleading headlines
- Assess source credibility and publication reputation
- Cross-reference multiple angles and perspectives

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
- **PRIORITIZE fact-check data** when available - it's verified by professionals
- Include fact-checker URLs in sources array when using their data
- Be HONEST about data sources (fact-check API vs. AI inference)
- High confidence (85-100%) with fact-check consensus, lower (40-70%) without
- Specific red flags with clear reasoning and evidence
- Cross-reference multiple fact-checkers when available
- Transparent about which sources informed your verdict

VERDICT GUIDELINES:
- TRUE: Verified by multiple fact-checkers OR well-established historical facts
- FALSE: Debunked by fact-checkers OR proven false by multiple credible sources
- MISLEADING: Mixed ratings from fact-checkers OR partial truths taken out of context
- UNVERIFIED: No fact-check data AND insufficient evidence for confident determination

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
