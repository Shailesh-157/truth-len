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
    const GOOGLE_SEARCH_API_KEY = Deno.env.get("GOOGLE_SEARCH_API_KEY");
    const GOOGLE_SEARCH_ENGINE_ID = Deno.env.get("GOOGLE_SEARCH_ENGINE_ID");
    
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

    // Fetch real-time web search results for current information
    let webSearchResults = [];
    if (GOOGLE_SEARCH_API_KEY && GOOGLE_SEARCH_ENGINE_ID && (contentText || contentUrl)) {
      try {
        const searchQuery = contentText || contentUrl || "";
        const searchResponse = await fetch(
          `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(searchQuery)}&num=5`
        );
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          webSearchResults = searchData.items?.slice(0, 5).map((item: any) => ({
            title: item.title,
            snippet: item.snippet,
            link: item.link,
            source: item.displayLink
          })) || [];
          console.log(`Found ${webSearchResults.length} web search results`);
        }
      } catch (error) {
        console.error("Web search API error:", error);
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
            content: `You are TruthLens AI - an advanced multilingual fact-checking assistant with access to REAL-TIME web search and fact-checking data. Current date: ${new Date().toISOString().split('T')[0]}.

🌐 LANGUAGE REQUIREMENT:
- **CRITICAL:** Always respond in the SAME LANGUAGE as the user's input
- If input is in Hindi, respond ENTIRELY in Hindi
- If input is in English, respond in English
- If input is in any other language, respond in that language
- This applies to ALL parts of your response: verdict explanation, sources description, red flags, and positive indicators

🔍 REAL-TIME CAPABILITIES:
- ✅ Access to current web search results from Google Search
- ✅ Verified fact-check results from professional fact-checkers
- ✅ Up-to-date information on current events, political positions, and breaking news
- ✅ Ability to verify time-sensitive claims with real-time data

${webSearchResults.length > 0 ? `
🌐 REAL-TIME WEB SEARCH RESULTS:
You have ${webSearchResults.length} current web search result(s):
${JSON.stringify(webSearchResults, null, 2)}

CRITICAL: These are REAL-TIME search results from the internet. Use them to verify current events, political positions, and recent news. They represent the most up-to-date information available.
` : ''}

${factCheckResults.length > 0 ? `
📊 FACT-CHECK DATA AVAILABLE:
You have ${factCheckResults.length} verified fact-check(s) for this claim:
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

Use this verified fact-check data alongside web search results for comprehensive analysis.
` : ''}

⚠️ DATA SOURCE PRIORITY:
1. Real-time web search results (PRIMARY for current events)
2. Professional fact-check data (PRIMARY for debunked claims)
3. Your training knowledge (SECONDARY - only for historical facts)

IMPORTANT: You now have real-time data access. Do NOT claim knowledge cutoff limitations when web search or fact-check data is available.

YOUR CAPABILITIES:
1. ✅ Real-time web search for current information (PRIMARY for current events)
2. ✅ Professional fact-checker verification (PRIMARY for claims)
3. ✅ Current political positions and office holders
4. ✅ Breaking news and recent events verification
5. Deep image forensics and manipulation detection  
6. Logical consistency and misinformation pattern analysis
7. Source credibility evaluation with live data

ANALYSIS FRAMEWORK:

📰 FOR NEWS & CLAIMS:
**PRIORITY 1 - Use Real-Time Web Search (when available):**
- Web search results show CURRENT, UP-TO-DATE information
- For current events, political positions, office holders → Use web search as PRIMARY source
- Extract facts from credible news sources (Reuters, AP, BBC, NYT, etc.)
- Multiple sources agreeing = HIGH confidence (85-100%)
- Include source URLs in your sources array

**PRIORITY 2 - Use Fact-Check Data (when available):**
- Professional fact-checkers provide verified analysis
- Match claims against fact-checker ratings
- Include fact-checker URLs in sources
- Align verdict with consensus ratings

**PRIORITY 3 - Your Knowledge (historical facts only):**
- Use ONLY for well-established historical facts
- For anything recent (last 2 years), rely on web search/fact-checks
- Never contradict real-time data with your training knowledge

**For All Claims:**
- Cross-reference multiple sources from web search
- Assess source credibility (prefer established news organizations)
- Identify sensationalism vs. factual reporting

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
- **ALWAYS PRIORITIZE real-time data** (web search + fact-checks) over your training knowledge
- Include ALL relevant source URLs in your sources array
- Be transparent about data sources: "According to [Source Name]..."
- High confidence (85-100%) with multiple credible real-time sources
- Cite specific sources from web search results in your explanation
- Cross-reference information across multiple search results
- For current events, NEVER say "I cannot verify" if web search data exists

VERDICT GUIDELINES:
- TRUE: Confirmed by multiple credible real-time sources (news organizations, fact-checkers)
- FALSE: Contradicted by real-time sources OR debunked by fact-checkers
- MISLEADING: Partially true but lacks context OR mixed/nuanced real-time information
- UNVERIFIED: No real-time data available AND insufficient evidence from any source

EXAMPLE (Current President):
If user asks "Who is the current US President?" and web search shows Trump:
- Verdict: TRUE
- Confidence: 95-100%
- Explanation: "According to current web search results from [Reuters/AP/etc.], Donald Trump is the current President of the United States as of [date from search results]."
- Sources: [Include URLs from web search results]

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
