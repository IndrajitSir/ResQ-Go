'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  /** Stagger in milliseconds, applied as an animation delay. */
  delay?: number;
  /** Travel distance in pixels. */
  distance?: number;
  as?: ElementType;
  className?: string;
  id?: string;
}

/**
 * Reveals content the first time it scrolls into view.
 *
 * Motion is progressive enhancement: when JavaScript has not run yet, or the
 * viewer prefers reduced motion, the element renders immediately in its final
 * state (`.reveal` is only hidden once `[data-reveal-ready]` is set on the
 * root), so content is never trapped behind an animation.
 */
export function Reveal({
  children,
  delay = 0,
  distance = 16,
  as: Tag = 'div',
  className = '',
  id,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      id={id}
      data-reveal-ready="true"
      data-visible={visible ? 'true' : 'false'}
      className={`reveal ${className}`.trim()}
      style={{ '--reveal-delay': `${delay}ms`, '--reveal-distance': `${distance}px` } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}