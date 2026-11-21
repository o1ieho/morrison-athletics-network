"use client";

import { useBriefly, useFlash } from "@/lib/use-flash";

/**
 * A score that rolls to its new value when it changes live: the old number
 * slides up and out, the new one slides up into place and holds yellow for a
 * moment. A basket also shows a square "+2"/"+3" tag beside the number. A
 * correction (the score going down) flashes grey and gets no tag, so it
 * doesn't look like a basket. With reduced motion the number swaps in place
 * and only the colour changes. Nothing animates on page load.
 */
export function ScoreRoll({
  value,
  className = "",
  tag,
  compact = false,
}: {
  value: number;
  className?: string;
  /** Which side of the number the "+3" tag sits on (the side facing the clock). Omit for no tag. */
  tag?: "start" | "end";
  /** Smaller, quicker roll for the live bar. */
  compact?: boolean;
}) {
  const { key, previous, delta } = useFlash(value);
  // The outgoing digit is removed once its exit has played.
  const rolling = useBriefly(key, compact ? 320 : 400);
  const tagged = useBriefly(key, 2200);
  const tone = delta < 0 ? "flash-down" : "flash";

  return (
    <span className={`score-roll ${compact ? "compact" : ""} ${className}`}>
      {/* The tag is placed against this box, so it hugs the digits even when the score spans its column. */}
      <span className="score-roll-box">
        <span className="score-roll-window">
          {rolling && previous !== undefined && (
            <span key={`old-${key}`} className="score-roll-old" aria-hidden="true">
              {previous}
            </span>
          )}
          <span key={`new-${key}`} className={`score-roll-new ${key ? tone : ""}`}>
            {value}
          </span>
        </span>
        {tag && tagged && delta > 0 && (
          <span key={`tag-${key}`} className={`points-tag ${tag}`} aria-hidden="true">
            +{delta}
          </span>
        )}
      </span>
    </span>
  );
}
