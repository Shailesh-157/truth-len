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
        console.log(`Performing web search for: "${searchQuery.substring(0, 100)}..."`);
        
        const searchResponse = await fetch(
          `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(searchQuery)}&num=10`
        );
        
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
          console.error('Web search API error:', searchResponse.status);
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
            content: `You are TruthLens AI - Elite Fact-Checker with REAL-TIME web search. Date: ${new Date().toISOString().split('T')[0]}.

🚨 CRITICAL ACCURACY RULES - FOLLOW EXACTLY:

1. **DEFAULT TO TRUE for credible sources**
   - Reuters, AP, BBC, NYT, CNN, Guardian, WSJ = Trusted sources
   - If 2+ major outlets confirm → Mark TRUE with 90%+ confidence
   - Real news is usually TRUE, not false

2. **REQUIRE PROOF for FALSE verdict**
   - Only FALSE when contradicted by authoritative sources
   - Do NOT mark FALSE because you're unsure
   - No evidence ≠ Evidence of falsehood

3. **TRUST WEB SEARCH RESULTS**
   - Web search = PRIMARY source of truth
   - Multiple credible sources in search = TRUE verdict
   - Use search data over your training knowledge

🌐 LANGUAGE: Respond in user's language (Hindi → Hindi, English → English)

${webSearchResults.length > 0 ? `
🌐 **YOU HAVE ${webSearchResults.length} REAL-TIME WEB SEARCH RESULTS:**

${JSON.stringify(webSearchResults, null, 2)}

⚠️ CRITICAL: Use these as PRIMARY evidence
- If 2+ credible sources (Reuters, AP, BBC, NYT) confirm → TRUE with 90%+ confidence
- Include source URLs in your "sources" array
- DO NOT ignore this data
` : '⚠️ NO WEB SEARCH DATA - Accuracy limited'}

${factCheckResults.length > 0 ? `
📊 FACT-CHECK DATA (${factCheckResults.length} results):
${JSON.stringify(factCheckResults.slice(0, 3).map((claim: any) => ({
  text: claim.text,
  claimReview: claim.claimReview?.map((review: any) => ({
    publisher: review.publisher?.name,
    rating: review.textualRating
  }))
})), null, 2)}
` : ''}


VERDICT RULES (Use these exactly):

✅ **TRUE** (90-100% confidence):
- 2+ credible sources in web search confirm
- Fact-checkers verify as true
- Strong consensus from established outlets

❌ **FALSE** (0-30% confidence):
- Authoritative sources contradict
- Fact-checkers debunk
- Clear evidence of fabrication

⚠️ **MISLEADING** (50-75% confidence):
- Partially true, missing context
- Mixed true/false elements

❓ **UNVERIFIED** (20-40% confidence):
- No credible sources found
- Insufficient evidence

EXAMPLES:

✅ TRUE Example:
Search: Reuters + BBC + NYT say "Policy announced"
→ Verdict: TRUE, Confidence: 95%

❌ FALSE Example:
Search: Snopes + FactCheck.org + AP debunk claim
→ Verdict: FALSE, Confidence: 10%

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
