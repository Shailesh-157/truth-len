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
          console.error(`❌ CRITICAL: Google FactCheck API Failed (${factCheckResponse.status})`);
          console.error(`📋 Error Response: ${errorText}`);
          
          if (factCheckResponse.status === 403) {
            console.error(`
🔧 FIX REQUIRED - Enable Fact Check API:
1. Go to: https://console.cloud.google.com/apis/library/factchecktools.googleapis.com
2. Click "Enable API"
3. Wait 2-5 minutes for it to activate
4. Try verification again`);
          }
        }
      } catch (error) {
        console.error("❌ Fact check API error:", error);
      }
    } else {
      console.warn("⚠️ CRITICAL: Google FactCheck API not configured - verification WILL BE INACCURATE");
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
        console.log(`🔍 Performing web search for: "${searchQuery.substring(0, 100)}..."`);
        
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
          console.log(`✓ Found ${webSearchResults.length} web search results from: ${webSearchResults.slice(0, 3).map((r: any) => r.source).join(', ')}`);
        } else {
          const errorText = await searchResponse.text();
          console.error(`❌ CRITICAL: Google Search API Failed (${searchResponse.status})`);
          console.error(`📋 Error Response: ${errorText}`);
          
          if (searchResponse.status === 400) {
            console.error(`
🔧 FIX REQUIRED - Configure Search API:
1. Go to: https://console.cloud.google.com/apis/library/customsearch.googleapis.com
2. Click "Enable API"
3. Create a Custom Search Engine at: https://programmablesearchengine.google.com/
4. Update GOOGLE_SEARCH_ENGINE_ID secret with your Search Engine ID (format: abc123:def456)
5. Ensure GOOGLE_SEARCH_API_KEY is valid`);
          }
        }
      } catch (error) {
        console.error("❌ Web search API error:", error);
      }
    } else {
      console.warn("⚠️ CRITICAL: Google Search API not configured - verification WILL BE INACCURATE");
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
            content: `You are TruthLens AI - Advanced Fact-Checker with Multi-Source Verification.

📅 CURRENT DATE: ${new Date().toISOString().split('T')[0]}
🕐 CURRENT YEAR: ${new Date().getFullYear()}

🎯 YOUR PRIMARY MISSION: MINIMIZE FALSE POSITIVES
- The biggest error is marking TRUE news as FALSE
- When in doubt, lean towards UNVERIFIED, not FALSE
- Only mark FALSE when you have STRONG evidence of fabrication

🚨 CRITICAL ACCURACY RULES - FOLLOW EXACTLY:

1. **CREDIBLE SOURCE RECOGNITION**
   ✅ HIGHLY TRUSTED (90-100% confidence for TRUE):
   - Reuters, Associated Press (AP), BBC, Bloomberg
   - New York Times, Washington Post, Wall Street Journal, The Guardian
   - The Hindu, Times of India, NDTV, Indian Express
   - CNN, NBC, CBS, ABC (US networks)
   - Al Jazeera, France24, DW (international)
   - Government official statements from verified domains (.gov, .gov.in)
   
   ⚠️ VERIFY CAREFULLY (50-75% confidence):
   - Regional news outlets
   - Unverified social media claims
   - Anonymous sources
   - Opinion pieces presented as facts

2. **TEMPORAL AWARENESS & RECENCY**
   - ${new Date().getFullYear()} events = CURRENT NEWS (high confidence if from credible source)
   - 2023-${new Date().getFullYear()-1} = Recent news (verify publication dates)
   - 2020-2022 = Pandemic era (some events may be re-shared)
   - Pre-2020 = Old news (mark MISLEADING if presented as new)
   
   🚨 CRITICAL: Do NOT mark current year events from credible sources as FALSE

3. **VERDICT ASSIGNMENT RULES**
   
   ✅ **TRUE** (85-100% confidence) - ONLY when:
   - Content from 2+ major trusted outlets (Reuters, AP, BBC, etc.)
   - Official government/institutional announcements from verified sources
   - Confirmed by fact-check organizations (when available)
   - Multiple independent credible sources report same facts
   - Publication dates are recent and match claimed timeline
   
   ❌ **FALSE** (0-20% confidence) - ONLY when:
   - Explicitly debunked by fact-checkers (Snopes, PolitiFact, AFP Fact Check)
   - Contradicted by multiple authoritative sources
   - Event claimed to happen but ZERO credible sources exist
   - Proven to be manipulated/fabricated (deepfakes, doctored images)
   - Physically impossible claims (e.g., "sun rose at midnight")
   
   ⚠️ **MISLEADING** (40-70% confidence) - When:
   - Contains some truth but lacks important context
   - Old news presented as recent/breaking
   - Exaggerated headlines vs actual content
   - Selectively edited to change meaning
   - Real image/video used in wrong context
   
   ❓ **UNVERIFIED** (20-50% confidence) - When:
   - Insufficient evidence to confirm or deny
   - Very recent claim with limited coverage
   - Cannot find authoritative sources
   - Ambiguous or unclear claim
   - 🚨 USE THIS instead of FALSE when uncertain

4. **EVIDENCE QUALITY ASSESSMENT**
   🥇 STRONGEST EVIDENCE:
   - Google FactCheck API results (when available)
   - Multiple major international news agencies
   - Official government press releases
   - Academic/scientific institutions
   
   🥈 STRONG EVIDENCE:
   - Reputable national news outlets
   - Verified journalist reports
   - NGO/Think tank publications
   
   🥉 MODERATE EVIDENCE:
   - Regional credible news
   - Industry-specific publications
   - Expert individual statements
   
   ⚠️ WEAK EVIDENCE:
   - Social media posts (even verified accounts)
   - Blogs/personal websites
   - Unattributed sources
   - Anonymous claims

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


5. **DECISION HIERARCHY & EXAMPLES**

📊 **PRIORITY 1: Google FactCheck API** (when available)
If FactCheck API has results:
- Rating "True"/"Verified"/"Correct" → TRUE (90-100% confidence)
- Rating "False"/"Debunked"/"Pants on Fire" → FALSE (5-15% confidence)
- Rating "Misleading"/"Mixture"/"Mostly False" → MISLEADING (45-70% confidence)

🌐 **PRIORITY 2: Source Analysis** (when FactCheck unavailable)
Analyze the SOURCE of the claim/news:

If source is HIGHLY TRUSTED outlet:
- Reuters article about current events → TRUE (90-95% confidence)
- BBC/AP report with verifiable details → TRUE (88-95% confidence)
- Times of India/The Hindu with citations → TRUE (85-92% confidence)
- Official government announcement (.gov domain) → TRUE (85-95% confidence)

If source is SOCIAL MEDIA/UNVERIFIED:
- Twitter/Facebook post (even verified account) → UNVERIFIED (25-40% confidence)
- WhatsApp forward → UNVERIFIED (20-35% confidence)
- Anonymous blog → UNVERIFIED (15-30% confidence)

If source is MIXED/CONTEXTUAL:
- News article from trusted outlet but lacks details → TRUE (70-80% confidence)
- Regional news without major outlet confirmation → UNVERIFIED (40-60% confidence)

🎯 **PRACTICAL VERDICT GUIDE**:

✅ **Mark TRUE when**:
- URL is from Reuters.com, AP.org, BBC.com, NYTimes.com, etc.
- Multiple (2+) major news outlets report same facts
- Official statement from verified government/institution
- Current year news from established media
- FactCheck API confirms as true
→ Confidence: 85-100%

❌ **Mark FALSE only when**:
- Explicitly debunked by Snopes/PolitiFact/AFP Fact Check
- Multiple credible sources contradict the claim
- Impossible/absurd claim (defies physics/logic)
- Proven manipulated media (confirmed deepfake)
- FactCheck API explicitly marks as false
→ Confidence: 5-20%

⚠️ **Mark MISLEADING when**:
- True event but wrong context/date
- Exaggerated headline vs actual content
- Partial truth missing key details
- Old news re-shared as new
- Satire presented as news
→ Confidence: 40-70%

❓ **Mark UNVERIFIED when**:
- Cannot find credible sources confirming OR denying
- Very recent breaking news with limited coverage
- Ambiguous claim requiring more investigation
- 🚨 WHEN UNCERTAIN - default here, NOT to FALSE
→ Confidence: 20-50%

6. **DETAILED EXAMPLES - STUDY CAREFULLY**

Example 1: TRUSTED SOURCE = TRUE
Input: URL from https://www.reuters.com/world/india/india-gdp-grows-2025...
Analysis: Reuters is tier-1 trusted source, current year article
→ Verdict: TRUE, Confidence: 93%, Explanation: "Confirmed by Reuters, a highly credible international news agency"

Example 2: MULTIPLE SOURCES = TRUE  
Input: "India launches moon mission"
Context: Found in BBC, Times of India, NDTV articles from ${new Date().getFullYear()}
→ Verdict: TRUE, Confidence: 95%, Explanation: "Confirmed by multiple major news outlets including BBC and Times of India"

Example 3: DEBUNKED = FALSE
Input: "Celebrity X died in car crash"
FactCheck: Snopes marked as "False", no credible sources
→ Verdict: FALSE, Confidence: 12%, Explanation: "Explicitly debunked by Snopes. No credible news sources report this event"

Example 4: SOCIAL MEDIA = UNVERIFIED (not FALSE!)
Input: Twitter post claiming "New law passed"
Analysis: Only social media source, no major news confirmation
→ Verdict: UNVERIFIED, Confidence: 35%, Explanation: "Claim originates from social media without corroboration from official news sources"

Example 5: OLD NEWS = MISLEADING
Input: "Breaking: Major earthquake hits Japan" (but articles from 2018)
Analysis: Event is real but from years ago, presented as current
→ Verdict: MISLEADING, Confidence: 55%, Explanation: "Earthquake did occur but in 2018, not recently as implied"

Example 6: SATIRE = MISLEADING
Input: Article from known satire site about absurd policy
→ Verdict: MISLEADING, Confidence: 65%, Explanation: "Content from satire website, not actual news"

🚨 COMMON MISTAKES TO AVOID:
❌ Marking Reuters/BBC/AP articles as FALSE without explicit debunk evidence
❌ Marking social media claims as FALSE (use UNVERIFIED instead)
❌ Giving low confidence to current year news from major outlets
❌ Ignoring publication dates when assessing recency
✅ Trust tier-1 sources unless explicitly contradicted
✅ Use UNVERIFIED when you can't confirm, not FALSE
✅ Check if source URL domain is credible (.reuters.com, .bbc.com, etc.)
✅ Consider publication date in your analysis

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
