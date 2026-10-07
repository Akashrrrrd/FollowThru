'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

const COLORS = [
  'hsl(var(--gold))',
  'hsl(var(--gold-light))',
  'hsl(var(--status-done))',
  'hsl(var(--status-progress))',
  'hsl(var(--primary))',
];

type Piece = { id: number; x: number; dx: number; r: number; d: number; c: string };

/**
 * Fires a short confetti burst each time `burst` increments.
 * Styling lives in globals.css (.confetti-piece) and is hidden for reduced motion.
 *
 *   const [burst, setBurst] = useState(0);
 *   <Confetti burst={burst} />
 *   setBurst((n) => n + 1);   // to fire
 */
export function Confetti({ burst }: { burst: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (!burst) return;

    setPieces(
      Array.from({ length: 40 }, (_, i) => ({
        id: burst * 100 + i,
        x: 20 + Math.random() * 60,
        dx: (Math.random() - 0.5) * 240,
        r: 360 + Math.random() * 540,
        d: Math.random() * 0.25,
        c: COLORS[i % COLORS.length],
      })),
    );

    const timer = setTimeout(() => setPieces([]), 1700);
    return () => clearTimeout(timer);
  }, [burst]);

  if (pieces.length === 0) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={
            {
              '--x': `${p.x}%`,
              '--dx': `${p.dx}px`,
              '--r': `${p.r}deg`,
              '--d': `${p.d}s`,
              '--c': p.c,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}