"use client";

/**
 * Thin fixed bar across the top of the viewport that fills as the user
 * scrolls the page. Scroll handler is rAF-throttled so it never runs more
 * than once per frame. Sits above the fixed PublicHeader/sticky TopHeader
 * (z-[60] vs their z-50/z-40) as a slim overlay strip along the very top
 * edge, rather than pushing content down.
 */

import { useEffect, useState } from "react";

export function ScrollProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100)) : 0);
      ticking = false;
    };
    const onScrollOrResize = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-[60] h-[3px] print:hidden"
    >
      <div
        className="h-full bg-gradient-to-r from-[var(--green-600)] to-[var(--amber-500)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
