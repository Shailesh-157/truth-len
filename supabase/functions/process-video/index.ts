import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { videoPath, userId } = await req.json();

    if (!videoPath) {
      throw new Error('Video path is required');
    }

    console.log(`Processing video: ${videoPath}`);

    // Download video from storage
    const { data: videoData, error: downloadError } = await supabase
      .storage
      .from('videos')
      .download(videoPath);

    if (downloadError) {
      throw new Error(`Failed to download video: ${downloadError.message}`);
    }

    // Convert video to base64 for processing
    const arrayBuffer = await videoData.arrayBuffer();
    const base64Video = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    console.log('Video downloaded and converted to base64');

    // Analyze video using Lovable AI (vision model for frame analysis)
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a video verification expert. Analyze videos for:
1. Deepfake indicators (facial inconsistencies, unnatural movements, lighting anomalies)
2. Editing artifacts (cuts, splices, CGI indicators)
3. Audio-visual synchronization issues
4. Context manipulation (misleading captions, out-of-context footage)
5. Source credibility

Provide a detailed analysis with confidence score.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this video for authenticity and manipulation indicators. Provide verdict (true/false/misleading/unverified), confidence score (0-100), detailed explanation, red flags, and positive indicators.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:video/mp4;base64,${base64Video}`
                }
              }
            ]
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'verify_video',
            description: 'Verify video authenticity',
            parameters: {
              type: 'object',
              properties: {
                verdict: {
                  type: 'string',
                  enum: ['true', 'false', 'misleading', 'unverified']
                },
                confidence: {
                  type: 'number',
                  minimum: 0,
                  maximum: 100
                },
                explanation: {
                  type: 'string'
                },
                deepfakeIndicators: {
                  type: 'array',
                  items: { type: 'string' }
                },
                editingArtifacts: {
                  type: 'array',
                  items: { type: 'string' }
                },
                audioVisualSync: {
                  type: 'string'
                },
                redFlags: {
                  type: 'array',
                  items: { type: 'string' }
                },
                positiveIndicators: {
                  type: 'array',
                  items: { type: 'string' }
                },
                sources: {
                  type: 'array',
                  items: { type: 'string' }
                }
              },
              required: ['verdict', 'confidence', 'explanation', 'redFlags']
            }
          }
        }],
        tool_choice: {
          type: 'function',
          function: { name: 'verify_video' }
        }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (aiResponse.status === 402) {
        throw new Error('AI credits exhausted. Please add credits to continue.');
      }
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    console.log('AI Response:', JSON.stringify(aiResult, null, 2));

    const toolCall = aiResult.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No analysis result from AI');
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    // Store verification result
    const { data: verification, error: dbError } = await supabase
      .from('verifications')
      .insert({
        user_id: userId,
        content_type: 'video',
        video_url: videoPath,
        verdict: analysis.verdict,
        confidence_score: analysis.confidence,
        explanation: analysis.explanation,
        ai_analysis: {
          deepfakeIndicators: analysis.deepfakeIndicators || [],
          editingArtifacts: analysis.editingArtifacts || [],
          audioVisualSync: analysis.audioVisualSync || 'Not analyzed',
          redFlags: analysis.redFlags || [],
          positiveIndicators: analysis.positiveIndicators || [],
        },
        sources: analysis.sources || [],
        video_metadata: {
          processedAt: new Date().toISOString(),
          model: 'google/gemini-2.5-flash'
        }
      })
      .select()
      .single();

    if (dbError) {
      throw new Error(`Failed to save verification: ${dbError.message}`);
    }

    console.log('Verification saved:', verification.id);

    return new Response(
      JSON.stringify({
        success: true,
        verification: verification,
        analysis: analysis
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error processing video:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
