import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

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
      contentType: z.enum(['text', 'url', 'image', 'audio', 'video']).optional(),
      imageData: z.string().optional(),
      audioData: z.string().optional(),
      videoMetadata: z.object({
        fileName: z.string(),
        fileSize: z.number(),
        fileType: z.string(),
      }).optional(),
    }).refine(
      data => data.contentText || data.contentUrl || data.imageData || data.audioData || data.videoMetadata,
      { message: 'At least one content field is required' }
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

    const { contentText, contentUrl, contentType, imageData, audioData, videoMetadata } = validationResult.data;

    // Function to transcribe audio using Lovable AI (free, no API key required)
    const transcribeAudio = async (audioBase64: string): Promise<string> => {
      const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
      if (!lovableApiKey) {
        throw new Error("Audio transcription is not available. Please contact support.");
      }

      console.log("Starting audio transcription with Lovable AI...");

      try {
        // Use Lovable AI with Gemini to analyze the audio content
        // Note: For true transcription, we'd need a speech-to-text model
        // For now, we'll use a workaround approach
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: "You are an audio transcription assistant. The user will provide audio content that needs to be transcribed or described."
              },
              {
                role: "user",
                content: "Please note: Audio transcription requires OpenAI Whisper API. This audio cannot be directly transcribed. Please inform the user to provide text description of the audio content instead."
              }
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Lovable AI error:", errorText);
          throw new Error(`Audio transcription failed. Please describe the audio content as text instead.`);
        }

        const result = await response.json();
        const transcription = result.choices[0]?.message?.content || "";
        console.log("AI response:", transcription.substring(0, 100) + "...");
        
        // Return a message asking user to provide text description
        throw new Error("Audio transcription requires OpenAI Whisper API. Please describe the audio content as text in the Text/URL tab instead.");
      } catch (error) {
        console.error("Transcription error:", error);
        throw new Error("Audio transcription is currently unavailable. Please describe the audio content as text instead.");
      }
    };

    // Create Supabase client for checking duplicates and saving
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

    // Handle audio transcription if audio data is provided
    let transcribedText = "";
    if (audioData) {
      console.log("Audio data detected, starting transcription...");
      try {
        transcribedText = await transcribeAudio(audioData);
        console.log("Audio transcribed successfully");
      } catch (error) {
        console.error("Transcription error:", error);
        throw new Error("Failed to transcribe audio. Please ensure OPENAI_API_KEY is configured.");
      }
    }

    // Handle video analysis
    let videoAnalysisContext = "";
    if (videoMetadata && contentUrl) {
      videoAnalysisContext = `Video File: ${videoMetadata.fileName}
Size: ${(videoMetadata.fileSize / 1024 / 1024).toFixed(2)} MB
Type: ${videoMetadata.fileType}
URL: ${contentUrl}

This is a video file that needs to be analyzed for authenticity and credibility.`;
      console.log("Video metadata:", videoMetadata);
    }

    // Check for recent duplicate verification (within last 24 hours)
    if (!imageData && !audioData && !videoMetadata && (contentText || contentUrl)) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      let query = supabase
        .from("verifications")
        .select("*")
        .gte("created_at", oneDayAgo)
        .order("created_at", { ascending: false })
        .limit(1);

      // Add content filter
      if (contentText) {
        query = query.eq("content_text", contentText);
      } else if (contentUrl) {
        query = query.eq("content_url", contentUrl);
      }

      const { data: recentVerification } = await query.maybeSingle();

      if (recentVerification) {
        console.log("Found recent duplicate verification, returning cached result");
        
        // Return the cached verification result
        const cachedAnalysis = {
          verdict: recentVerification.verdict,
          confidence: recentVerification.confidence_score,
          explanation: recentVerification.explanation,
          sources: recentVerification.sources || [],
          redFlags: recentVerification.ai_analysis?.redFlags || [],
          positiveIndicators: recentVerification.ai_analysis?.positiveIndicators || []
        };

        // Save a new verification record for this user pointing to same data
        const { data: newVerification } = await supabase
          .from("verifications")
          .insert({
            user_id: userId,
            content_type: contentType || recentVerification.content_type,
            content_text: contentText,
            content_url: contentUrl,
            verdict: cachedAnalysis.verdict,
            confidence_score: cachedAnalysis.confidence,
            explanation: cachedAnalysis.explanation,
            sources: cachedAnalysis.sources,
            ai_analysis: {
              redFlags: cachedAnalysis.redFlags,
              positiveIndicators: cachedAnalysis.positiveIndicators
            }
          })
          .select()
          .single();

        return new Response(
          JSON.stringify({
            verification: newVerification,
            analysis: cachedAnalysis,
            cached: true
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
    }

    // Special handling for TruthLens app URL - always verify as genuine
    const truthLensUrl = "https://preview--truth-len.lovable.app/";
    const isTruthLensUrl = contentText?.includes(truthLensUrl) || contentUrl?.includes(truthLensUrl);
    
    if (isTruthLensUrl) {
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

    // Fetch URL content if URL is provided
    let urlContent = "";
    if (contentUrl) {
      try {
        console.log(`Fetching content from URL: ${contentUrl}`);
        const urlResponse = await fetch(contentUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; TruthLens/1.0; +https://truthlens.app)'
          },
          redirect: 'follow'
        });
        
        if (urlResponse.ok) {
          const htmlContent = await urlResponse.text();
          // Extract text content from HTML (simple extraction)
          const textContent = htmlContent
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 4000); // Limit to 4000 chars
          
          urlContent = textContent;
          console.log(`Extracted ${urlContent.length} characters from URL`);
        }
      } catch (error) {
        console.error("URL fetch error:", error);
        urlContent = "";
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
      console.log("Processing image verification, image data length:", imageData.length);
      
      // For image analysis with comprehensive forensic prompt
      const imageAnalysisPrompt = contentText || `Perform a comprehensive forensic analysis of this image to verify its authenticity:

1. **AI Generation Detection**: Check for artifacts common in AI-generated images (Midjourney, DALL-E, Stable Diffusion, etc.)
2. **Photo Manipulation**: Look for cloning, warping, color inconsistencies, unnatural edges
3. **Physical Consistency**: Analyze lighting, shadows, reflections, and perspective
4. **Metadata Indicators**: Note any compression artifacts or editing signs
5. **Contextual Analysis**: Does the image logically match its claimed context?
6. **Temporal Markers**: Any date/time inconsistencies visible in the image?

Provide a detailed verdict on whether this image is AUTHENTIC, MANIPULATED, AI-GENERATED, or needs further verification.`;

      // The image data from frontend already includes the data URL prefix
      console.log("Image data starts with:", imageData.substring(0, 50));
      
      messageContent = [
        {
          type: "text",
          text: imageAnalysisPrompt
        },
        {
          type: "image_url",
          image_url: {
            url: imageData // Use the image data directly as it already has the data:image prefix
          }
        }
      ];
    } else if (transcribedText) {
      // For audio analysis
      const audioAnalysisPrompt = `Analyze this transcribed audio content for credibility and fact-check all claims:

**Transcribed Audio:**
${transcribedText}

**User's Additional Context:** ${contentText || 'None provided'}

Verify ALL factual claims in this audio transcript against real-time web search and fact-check data. Pay attention to:
1. The credibility of statements made
2. Whether claims can be verified
3. Context and potential manipulation through selective editing
4. Speaker's credibility if identifiable`;

      messageContent = [{
        type: "text",
        text: audioAnalysisPrompt
      }];
    } else if (videoAnalysisContext) {
      // For video analysis
      const videoAnalysisPrompt = `Analyze this video for credibility and authenticity:

${videoAnalysisContext}

**User's Additional Context:** ${contentText || 'None provided'}

Note: This is a video file. Analyze based on:
1. Video metadata (file size, type, name patterns)
2. Any suspicious elements in the file properties
3. Contextual information provided by the user
4. Whether the source appears credible
5. Check against web search results for similar content or claims

Provide a verdict on the video's likely authenticity and credibility.`;

      messageContent = [{
        type: "text",
        text: videoAnalysisPrompt
      }];
    } else {
      // For text/URL analysis with enhanced context
      let analysisPrompt = "";
      
      if (contentUrl && urlContent) {
        analysisPrompt = `Analyze this article/webpage for credibility and fact-check all claims:

**URL:** ${contentUrl}

**Extracted Content:**
${urlContent}

**User's Additional Context:** ${contentText || 'None provided'}

Verify ALL factual claims in this content against real-time web search and fact-check data.`;
      } else if (contentUrl) {
        analysisPrompt = `Analyze this URL for credibility: ${contentUrl}

**User's Context:** ${contentText || 'No additional context'}

Note: Unable to fetch URL content. Analyze based on URL structure and available web search data.`;
      } else {
        analysisPrompt = `Fact-check this claim thoroughly using all available real-time data:

**Claim:** ${contentText}

Cross-reference with web search results and fact-checker databases. Verify ALL factual assertions.`;
      }
      
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

⚠️ CRITICAL CONSISTENCY REQUIREMENT:
- You MUST provide DETERMINISTIC and CONSISTENT analysis for identical or similar content
- Always analyze the SAME claim the SAME way based on available evidence
- DO NOT give random or fluctuating confidence scores for the same news
- Be systematic and rule-based in your analysis

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
✅ **URL CONTENT ANALYSIS AVAILABLE:**
When URL content is provided (extracted from the webpage), you have:
- Full article text and claims to fact-check
- Ability to verify all factual assertions in the content
- Cross-reference claims with real-time web search
- Assess journalistic quality and bias

If URL content is NOT available:
- Analyze URL structure (domain credibility, HTTPS)
- Use web search results to find information about the URL/domain
- Check if domain appears in credible sources or fact-check databases
- Note: Limited to URL structure analysis without content access

OUTPUT REQUIREMENTS:
- **ALWAYS PRIORITIZE real-time data** (web search + fact-checks) over your training knowledge
- Include ALL relevant source URLs in your sources array
- Be transparent about data sources: "According to [Source Name]..."
- High confidence (85-100%) with multiple credible real-time sources
- Cite specific sources from web search results in your explanation
- Cross-reference information across multiple search results
- For current events, NEVER say "I cannot verify" if web search data exists

CONFIDENCE SCORING FRAMEWORK (CRITICAL - Follow Precisely):

**90-100% Confidence:**
- Multiple (3+) authoritative real-time sources agree (Reuters, AP, BBC, NYT, verified fact-checkers)
- Direct fact-checker confirmation available
- No contradictory evidence found
- Current, time-stamped information

**75-89% Confidence:**
- 2-3 credible real-time sources confirm
- Some fact-checker support OR strong web search consensus
- Minor inconsistencies in details but core claim verified
- Recent information available

**50-74% Confidence:**
- Single credible source OR multiple less-authoritative sources
- Partial verification from web search
- Some contradictory information exists
- Mixed signals from available data

**25-49% Confidence:**
- Weak or questionable sources only
- Significant contradictory evidence
- Lack of corroboration from real-time data
- Outdated or unreliable information

**0-24% Confidence:**
- Directly contradicted by multiple authoritative sources
- Debunked by professional fact-checkers
- Strong evidence of falsehood
- Clear misinformation patterns

VERDICT GUIDELINES:
- TRUE: Confirmed by multiple credible real-time sources (90%+ confidence typically)
- FALSE: Contradicted by real-time sources OR debunked by fact-checkers (use lower confidence if debunking is partial)
- MISLEADING: Partially true but lacks context (50-75% confidence typically)
- UNVERIFIED: No real-time data available AND insufficient evidence (keep confidence low, 20-40%)

CRITICAL RULES:
1. **Match confidence to source quality**: Multiple authoritative sources = high confidence
2. **Penalize for contradictions**: Any contradictory evidence should lower confidence significantly
3. **Reward consensus**: 3+ sources agreeing = 85%+ confidence
4. **Be conservative**: When in doubt, use lower confidence scores
5. **Time matters**: Recent, timestamped sources deserve higher confidence than old data

EXAMPLE 1 (High Confidence):
User asks: "Who is the current US President?" 
Web search shows 5 sources (Reuters, AP, BBC, CNN, NYT) all confirming Trump
- Verdict: TRUE
- Confidence: 98%
- Explanation: "According to multiple authoritative sources including Reuters, AP, and BBC, Donald Trump is the current President of the United States as of [date]."

EXAMPLE 2 (Medium Confidence):
User asks about a breaking news claim
Web search shows 2 sources confirm, 1 contradicts
- Verdict: MISLEADING
- Confidence: 65%
- Explanation: "The claim is partially verified by [Source 1] and [Source 2], however [Source 3] provides contradicting information suggesting [details]. More verification needed."

EXAMPLE 3 (Low Confidence):
User asks about obscure claim
Web search shows no credible sources, only social media posts
- Verdict: UNVERIFIED
- Confidence: 25%
- Explanation: "No authoritative sources found to verify this claim. Only social media posts without credible sourcing were discovered."

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
      const errorText = await aiResponse.text();
      console.error("AI gateway error - Status:", aiResponse.status, "Response:", errorText);
      
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
      
      throw new Error(`AI verification service error: ${errorText}`);
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

    // Supabase client and user already initialized earlier

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
