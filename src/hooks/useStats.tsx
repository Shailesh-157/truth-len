import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  totalVerifications: number;
  verifiedTrue: number;
  detectedFake: number;
  trendingTopics: number;
  loading: boolean;
}

export function useStats() {
  const [stats, setStats] = useState<Stats>({
    totalVerifications: 0,
    verifiedTrue: 0,
    detectedFake: 0,
    trendingTopics: 0,
    loading: true,
  });

  const fetchStats = async () => {
    try {
      // Get total verifications count
      const { count: totalCount, error: totalError } = await supabase
        .from("verifications")
        .select("*", { count: "exact", head: true });

      if (totalError) throw totalError;

      // Get verified true count
      const { count: trueCount, error: trueError } = await supabase
        .from("verifications")
        .select("*", { count: "exact", head: true })
        .eq("verdict", "true");

      if (trueError) throw trueError;

      // Get detected fake count (false + misleading)
      const { count: falseCount, error: falseError } = await supabase
        .from("verifications")
        .select("*", { count: "exact", head: true })
        .in("verdict", ["false", "misleading"]);

      if (falseError) throw falseError;

      // Get trending topics count
      const { count: topicsCount, error: topicsError } = await supabase
        .from("trending_topics")
        .select("*", { count: "exact", head: true });

      if (topicsError) throw topicsError;

      setStats({
        totalVerifications: totalCount || 0,
        verifiedTrue: trueCount || 0,
        detectedFake: falseCount || 0,
        trendingTopics: topicsCount || 0,
        loading: false,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      setStats((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchStats();

    // Set up real-time subscription for verifications
    const verificationsChannel = supabase
      .channel("verifications_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "verifications",
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    // Set up real-time subscription for trending topics
    const topicsChannel = supabase
      .channel("topics_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trending_topics",
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(verificationsChannel);
      supabase.removeChannel(topicsChannel);
    };
  }, []);

  return stats;
}
