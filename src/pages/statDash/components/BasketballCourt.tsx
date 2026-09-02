import React from 'react';

export type CourtMarker = { nx: number; ny: number; color: string; kind?: 'made' | 'missed' | 'foul' };

export interface BasketballCourtProps {
  className?: string;
  shotMarkers?: CourtMarker[];
  foulMarkers?: CourtMarker[];
}

/** Grayscale schematic court (620×380); shot dots / foul X overlays use normalized nx, ny (0–1). */
const BasketballCourt: React.FC<BasketballCourtProps> = ({
  className = 'block h-full w-full',
  shotMarkers,
  foulMarkers,
}) => {
  return (
    <div className={`relative h-full w-full min-h-0 min-w-0 ${className}`.trim()}>
      <svg
        viewBox="0 0 620 380"
        xmlns="http://www.w3.org/2000/svg"
        className="block h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Basketball court diagram"
      >
        <rect width="620" height="380" fill="#F8FAFC" />
        <rect x="16" y="16" width="588" height="348" fill="none" stroke="#0F172A" strokeWidth="2.5" rx="2" />
        <line x1="310" y1="16" x2="310" y2="364" stroke="#0F172A" strokeWidth="2" />
        <circle cx="310" cy="190" r="54" fill="none" stroke="#0F172A" strokeWidth="2" />
        <rect x="16" y="118" width="132" height="144" fill="none" stroke="#0F172A" strokeWidth="2" />
        <path d="M148 118 A72 72 0 0 1 148 262" fill="none" stroke="#0F172A" strokeWidth="2" />
        <path
          d="M148 118 A72 72 0 0 0 148 262"
          fill="none"
          stroke="#0F172A"
          strokeWidth="2"
          strokeDasharray="7 5"
        />
        {/* Left hoop + restricted area semicircle */}
        <path
          d="M66 190 A20 20 0 0 0 66 190.0001"
          fill="none"
          stroke="#0F172A"
          strokeWidth="2"
        />
        <line x1="16" y1="58" x2="152" y2="58" stroke="#0F172A" strokeWidth="2" />
        <line x1="16" y1="322" x2="152" y2="322" stroke="#0F172A" strokeWidth="2" />
        <path d="M152 58 A148 148 0 0 1 152 322" fill="none" stroke="#0F172A" strokeWidth="2" />
        <rect x="472" y="118" width="132" height="144" fill="none" stroke="#0F172A" strokeWidth="2" />
        <path d="M472 118 A72 72 0 0 0 472 262" fill="none" stroke="#0F172A" strokeWidth="2" />
        <path
          d="M472 118 A72 72 0 0 1 472 262"
          fill="none"
          stroke="#0F172A"
          strokeWidth="2"
          strokeDasharray="7 5"
        />
        {/* Right hoop + restricted area semicircle */}
        <path
          d="M554 190 A20 20 0 0 1 554 190.0001"
          fill="none"
          stroke="#0F172A"
          strokeWidth="2"
        />
        <line x1="604" y1="58" x2="466" y2="58" stroke="#0F172A" strokeWidth="2" />
        <line x1="604" y1="322" x2="466" y2="322" stroke="#0F172A" strokeWidth="2" />
        <path d="M466 58 A148 148 0 0 0 466 322" fill="none" stroke="#0F172A" strokeWidth="2" />
      </svg>

      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {shotMarkers?.map((m, i) => (
          <div
            key={`shot-${i}-${m.nx}-${m.ny}`}
            className="absolute flex h-5 w-5 items-center justify-center sm:h-6 sm:w-6"
            style={{
              left: `${m.nx * 100}%`,
              top: `${m.ny * 100}%`,
              transform: 'translate(-50%, -50%)',
              filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.35))',
            }}
          >
            {m.kind === 'missed' ? (
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden>
                <line x1="3" y1="3" x2="13" y2="13" stroke="white" strokeWidth="3.4" strokeLinecap="round" />
                <line x1="13" y1="3" x2="3" y2="13" stroke="white" strokeWidth="3.4" strokeLinecap="round" />
                <line x1="3" y1="3" x2="13" y2="13" stroke={m.color} strokeWidth="2.2" strokeLinecap="round" />
                <line x1="13" y1="3" x2="3" y2="13" stroke={m.color} strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden>
                <circle cx="8" cy="8" r="5.2" fill="none" stroke="white" strokeWidth="3.2" />
                <circle cx="8" cy="8" r="5.2" fill="none" stroke={m.color} strokeWidth="2.2" />
              </svg>
            )}
          </div>
        ))}
        {foulMarkers?.map((m, i) => (
          <svg
            key={`foul-${i}-${m.nx}-${m.ny}`}
            className="absolute h-4 w-4 overflow-visible"
            style={{
              left: `${m.nx * 100}%`,
              top: `${m.ny * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
            viewBox="0 0 16 16"
            aria-hidden
          >
            <line x1="2" y1="2" x2="14" y2="14" stroke={m.color} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="14" y1="2" x2="2" y2="14" stroke={m.color} strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        ))}
      </div>
    </div>
  );
};

export default BasketballCourt;
