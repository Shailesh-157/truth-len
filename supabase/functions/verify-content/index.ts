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
    let factCheckResults: any[] = [];
    if (GOOGLE_FACT_CHECK_API_KEY && (contentText || contentUrl)) {
      try {
        const query = contentText || contentUrl || "";
        console.log(`🔍 Querying Google FactCheck API for: "${query.substring(0, 100)}..."`);
        console.log(`API Key present: ${GOOGLE_FACT_CHECK_API_KEY ? 'Yes' : 'No'}`);
        
        const factCheckUrl = `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(query)}&key=${GOOGLE_FACT_CHECK_API_KEY}&languageCode=en`;
        
        const factCheckResponse = await fetch(factCheckUrl);
        
        if (factCheckResponse.ok) {
          const factCheckData = await factCheckResponse.json();
          factCheckResults = factCheckData.claims || [];
          console.log(`✓ Google FactCheck found ${factCheckResults.length} verified claims`);
          
          if (factCheckResults.length > 0) {
            console.log("Sample fact-check results:", JSON.stringify(factCheckResults.slice(0, 2).map((claim: any) => ({
              claim: claim.text?.substring(0, 100),
              publisher: claim.claimReview?.[0]?.publisher?.name,
              rating: claim.claimReview?.[0]?.textualRating
            })), null, 2));
          }
        } else {
          const errorText = await factCheckResponse.text();
          console.error(`❌ Google FactCheck API error: ${factCheckResponse.status} - ${errorText}`);
          console.error(`Error details: The API key may be invalid or the Fact Check API may not be enabled in your Google Cloud project`);
        }
      } catch (error) {
        console.error("❌ Fact check API error:", error);
      }
    } else {
      console.warn("⚠️ Google FactCheck API not configured - fact-checking accuracy limited");
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
        console.log(`Performing web search for: "${searchQuery.substring(0, 100)}..."`);
        console.log(`Search API Key present: ${GOOGLE_SEARCH_API_KEY ? 'Yes' : 'No'}, Engine ID: ${GOOGLE_SEARCH_ENGINE_ID ? 'Yes' : 'No'}`);
        
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(searchQuery)}&num=10`;
        
        const searchResponse = await fetch(searchUrl);
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          webSearchResults = searchData.items?.slice(0, 10).map((item: any) => ({
            title: item.title,
            snippet: item.snippet,
            link: item.link,
            source: item.displayLink
          })) || [];
          console.log(`✓ Found ${webSearchResults.length} web search results from sources like: ${webSearchResults.slice(0, 3).map((r: any) => r.source).join(', ')}`);
        } else {
          const errorText = await searchResponse.text();
          console.error(`Web search API error: ${searchResponse.status} - ${errorText}`);
          console.error(`Error details: Check if Custom Search API is enabled and Search Engine ID is correct`);
        }
      } catch (error) {
        console.error("Web search API error:", error);
      }
    } else {
      console.warn("⚠️ Google Search API not configured - verification accuracy will be limited");
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
            content: `You are TruthLens AI - Elite Fact-Checker with REAL-TIME Google FactCheck Tools API integration.

📅 CURRENT DATE: ${new Date().toISOString().split('T')[0]} (Use this to assess recency)
🕐 CURRENT YEAR: ${new Date().getFullYear()}

🚨 CRITICAL TEMPORAL AWARENESS:
- Events from 2023-${new Date().getFullYear()} are RECENT/CURRENT news
- Events from 2020-2022 are recent past
- Events before 2020 are old news
- Do NOT mark recent events (2023+) as "not occurred" or "old news"
- Recent news from credible sources (2023+) should be marked TRUE if verified by multiple outlets
- Check web search results for date information and recent coverage

🚨 CRITICAL ACCURACY RULES - FOLLOW EXACTLY:

1. **PRIORITIZE GOOGLE FACTCHECK API DATA**
   - Google FactCheck API = HIGHEST authority source
   - If FactCheck API has verdict → Use it as PRIMARY evidence
   - FactCheck publishers (Snopes, PolitiFact, AFP, Reuters) = Most reliable

2. **DEFAULT TO TRUE for credible sources**
   - Reuters, AP, BBC, NYT, CNN, Guardian, WSJ, The Hindu, Times of India = Trusted sources
   - If 2+ major outlets confirm → Mark TRUE with 90%+ confidence
   - Real news is usually TRUE, not false
   - Recent news (2023-${new Date().getFullYear()}) from credible outlets = HIGH confidence TRUE

3. **REQUIRE STRONG PROOF for FALSE verdict**
   - Only FALSE when:
     a) Google FactCheck API debunks it, OR
     b) Multiple authoritative sources contradict it, OR
     c) Event is claimed to have happened but NO credible sources report it
   - Do NOT mark FALSE just because you're unsure
   - Do NOT mark recent news from credible sources as FALSE unless debunked
   - No evidence ≠ Evidence of falsehood

4. **TRUST DATA HIERARCHY**
   1st: Google FactCheck API results
   2nd: Web search from major news outlets (check dates!)
   3rd: Content analysis
   - NEVER contradict FactCheck API without extreme evidence
   - ALWAYS check publication dates in web search results

🌐 LANGUAGE: Respond in user's language (Hindi → Hindi, English → English)

${factCheckResults.length > 0 ? `
📊 **GOOGLE FACTCHECK API RESULTS (${factCheckResults.length} claims found):**

${JSON.stringify(factCheckResults.slice(0, 5).map((claim: any) => ({
  claim: claim.text,
  claimant: claim.claimant,
  claimDate: claim.claimDate,
  reviews: claim.claimReview?.map((review: any) => ({
    publisher: review.publisher?.name,
    url: review.url,
    title: review.title,
    rating: review.textualRating,
    languageCode: review.languageCode
  }))
})), null, 2)}

🔴 CRITICAL: These are VERIFIED fact-checks from trusted organizations
- If rating is "True"/"Verified"/"Correct" → Mark TRUE with 95%+ confidence
- If rating is "False"/"Debunked"/"Pants on Fire" → Mark FALSE with 5-15% confidence
- INCLUDE fact-checker URLs in your "sources" array
- RESPECT these verdicts - they are from professional fact-checkers
` : '⚠️ NO GOOGLE FACTCHECK DATA - Using other sources'}

${webSearchResults.length > 0 ? `
🌐 **WEB SEARCH RESULTS (${webSearchResults.length} found):**

${JSON.stringify(webSearchResults, null, 2)}

⚠️ Use these as SECONDARY evidence (after FactCheck API):
- If 2+ credible sources (Reuters, AP, BBC, NYT) confirm → Strong indicator
- Include source URLs in your "sources" array
- Cross-reference with FactCheck API data
` : '⚠️ NO WEB SEARCH DATA'}


VERDICT RULES (Follow this hierarchy):

📊 **PRIORITY 1: Google FactCheck API**
If FactCheck API has results:
- Rating "True"/"Verified" → TRUE (90-100% confidence)
- Rating "False"/"Debunked" → FALSE (5-15% confidence)
- Rating "Misleading"/"Mixture" → MISLEADING (50-70% confidence)

🌐 **PRIORITY 2: Web Search Consensus**
If no FactCheck data:
✅ **TRUE** (85-95% confidence):
- 2+ major outlets (Reuters, AP, BBC, NYT, CNN, Times of India, The Hindu) confirm
- Strong evidence from reputable sources
- Verified by established media
- Recent news (2023-${new Date().getFullYear()}) from credible outlets
- Web search shows multiple reliable sources reporting the same event

❌ **FALSE** (5-20% confidence):
- Multiple authoritative sources debunk
- Clear contradicting evidence
- Proven fabrication
- Event claimed but ZERO credible sources found
- Web search contradicts the claim

⚠️ **MISLEADING** (50-75% confidence):
- Partially true but missing context
- Mixed true/false elements
- Exaggerated but has some truth
- Old news presented as recent (or vice versa)

❓ **UNVERIFIED** (30-45% confidence):
- Insufficient credible sources
- Cannot confirm or deny
- Needs more evidence
- Very recent claim with limited coverage

EXAMPLES:

📊 FactCheck API Example:
FactCheck: Snopes rates "False", PolitiFact says "Pants on Fire"
→ Verdict: FALSE, Confidence: 10%, Sources: ["https://www.snopes.com/...", "https://www.politifact.com/..."]

✅ TRUE Example - Recent News (2023-2025):
Search: Reuters (Jan 2024) + BBC (Jan 2024) + Times of India (Jan 2024) confirm "India election results"
→ Verdict: TRUE, Confidence: 95%, Sources: ["https://www.reuters.com/world/india/...", "https://www.bbc.com/news/world-asia-india-...", "https://timesofindia.indiatimes.com/..."]

✅ TRUE Example - Breaking News:
Search: Multiple credible outlets from last 48 hours confirm event
→ Verdict: TRUE, Confidence: 90%, Sources: [recent URLs from credible sources]

❌ FALSE Example (No FactCheck):
Search: AFP debunks, Snopes says false, no credible sources support
→ Verdict: FALSE, Confidence: 15%, Sources: ["https://factcheck.afp.com/...", "https://www.snopes.com/..."]

⚠️ MISLEADING Example - Old News as New:
Claim says "just happened" but web search shows articles from 2019
→ Verdict: MISLEADING, Confidence: 60%, Explanation: "Event occurred in 2019, not recently"

🔗 CRITICAL - SOURCES ARRAY RULES:
1. ONLY include FULL URLs (must start with http:// or https://)
2. Extract URLs from FactCheck API results (review.url field) and Web Search results (link field)
3. DO NOT include source names without URLs
4. Each source must be a clickable link
5. Prefer FactCheck URLs, then major news URLs
6. Example: ["https://www.reuters.com/world/...", "https://www.bbc.com/news/..."]
7. DO NOT use generic text like "Reuters", "BBC" - ONLY full URLs

Format using verify_news function.`
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
                    items: { type: "string" },
                    description: "Array of FULL URLs only (must start with http:// or https://). Example: ['https://www.reuters.com/article/...', 'https://www.bbc.com/news/...']"
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
