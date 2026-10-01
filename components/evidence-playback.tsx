'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Volume2 } from 'lucide-react';

interface EvidenceItem {
  id: string;
  quote: string;
  timestamp?: number;
  sourceUrl?: string;
  createdAt: string;
}

interface EvidencePlaybackProps {
  taskId: string;
  audioUrl?: string;
}

export function EvidencePlayback({ taskId, audioUrl }: EvidencePlaybackProps) {
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchEvidence = async () => {
      try {
        const res = await fetch(`/api/commitments/${taskId}/evidence`);
        if (!res.ok) throw new Error('Failed to fetch evidence');
        const data = await res.json();
        setEvidence(data.evidence || []);
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvidence();
  }, [taskId]);

  useEffect(() => {
    if (audioUrl && !audio) {
      const audioElement = new Audio(audioUrl);
      setAudio(audioElement);
    }
  }, [audioUrl, audio]);

  const handlePlayFromTimestamp = (timestamp?: number) => {
    if (!audio || !audioUrl) return;

    if (!playing) {
      audio.play();
      setPlaying(true);
    }

    if (timestamp) {
      audio.currentTime = timestamp / 1000; // Convert ms to seconds
    }
  };

  const formatTimestamp = (ms?: number) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading evidence...</div>;
  }

  if (evidence.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-gray-500">No evidence recorded for this commitment.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Evidence & Timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {evidence.map((item) => (
          <div key={item.id} className="border rounded-lg p-4 hover:bg-gray-50 transition">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">"{item.quote}"</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Badge>
                  {item.timestamp && (
                    <Badge variant="secondary" className="text-xs">
                      {formatTimestamp(item.timestamp)}
                    </Badge>
                  )}
                </div>
              </div>

              {audioUrl && item.timestamp && (
                <button
                  onClick={() => handlePlayFromTimestamp(item.timestamp)}
                  className="flex-shrink-0 p-2 hover:bg-blue-100 rounded-lg transition"
                >
                  {playing ? (
                    <Pause className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Play className="h-4 w-4 text-blue-600" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
