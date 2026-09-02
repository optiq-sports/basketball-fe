import React from 'react';

/** Fixed, pointer-events-none noise layer — breaks up flat dark gradients on the login/match-key screens. */
const GrainOverlay: React.FC<{ opacity?: number }> = ({ opacity = 0.05 }) => (
  <div
    aria-hidden
    className="pointer-events-none absolute inset-0"
    style={{
      opacity,
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      mixBlendMode: 'overlay',
    }}
  />
);

export default GrainOverlay;
