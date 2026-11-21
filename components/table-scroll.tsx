"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A horizontally scrolling table wrapper. When the table is wider than the
 * screen it says "Swipe for more" above it, until the first sideways scroll.
 * The cut-off last column is the other hint; there's no edge shadow.
 */
export function TableScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setOverflows(element.scrollWidth > element.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {overflows && !scrolled && (
        <p className="swipe-hint" aria-hidden="true">
          Swipe for more →
        </p>
      )}
      <div
        ref={ref}
        className="table-wrap"
        onScroll={(event) => {
          if (event.currentTarget.scrollLeft > 0) setScrolled(true);
        }}
      >
        {children}
      </div>
    </>
  );
}
