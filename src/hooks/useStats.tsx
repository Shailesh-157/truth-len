import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  totalVerifications: number;
  verifiedTrue: number;
  detectedFake: number;
  trendingTopics: number;
  accuracyRate: number;
  fakePercentage: number;
}

export function useStats() {
  const [stats, setStats] = useState<Stats>({
    totalVerifications: 0,
    verifiedTrue: 0,
    detectedFake: 0,
    trendingTopics: 0,
    accuracyRate: 0,
    fakePercentage: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    try {
      // Get total verifications
      const { count: totalCount } = await supabase
        .from('verifications')
        .select('*', { count: 'exact', head: true });

      // Get verified true count
      const { count: trueCount } = await supabase
        .from('verifications')
        .select('*', { count: 'exact', head: true })
        .eq('verdict', 'true');

      // Get detected fake count
      const { count: fakeCount } = await supabase
        .from('verifications')
        .select('*', { count: 'exact', head: true })
        .eq('verdict', 'false');

      // Get trending topics count
      const { count: topicsCount } = await supabase
        .from('trending_topics')
        .select('*', { count: 'exact', head: true });

      const total = totalCount || 0;
      const trueVerdicts = trueCount || 0;
      const fakeVerdicts = fakeCount || 0;

      setStats({
        totalVerifications: total,
        verifiedTrue: trueVerdicts,
        detectedFake: fakeVerdicts,
        trendingTopics: topicsCount || 0,
        accuracyRate: total > 0 ? Math.round((trueVerdicts / total) * 100) : 0,
        fakePercentage: total > 0 ? Math.round((fakeVerdicts / total) * 100) : 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();

    // Subscribe to realtime changes in verifications
    const channel = supabase
      .channel('stats-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'verifications'
        },
        () => {
          loadStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { stats, loading, refresh: loadStats };
}
