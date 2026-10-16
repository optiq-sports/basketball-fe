import React from 'react';
import { shotToCourtFeet } from '../../../lib/shot-coordinates';
import {
  COURT,
  COURT_LENGTH_FT,
  COURT_RECT,
  COURT_WIDTH_FT,
  FT,
  VIEWBOX_H,
  VIEWBOX_W,
  feetToElementFraction,
  vx,
  vy,
} from '../courtGeometry';

export type CourtMarker = { nx: number; ny: number; color: string; kind?: 'made' | 'missed' | 'foul' };

export interface BasketballCourtProps {
  className?: string;
  shotMarkers?: CourtMarker[];
  foulMarkers?: CourtMarker[];
}

const LINE = '#0F172A';

/** One end of the court, drawn in feet from the left baseline. The other end is this, mirrored. */
function CourtEnd() {
  const { rimX, rimY, rimRadius, backboardX, restrictedRadius, paintDepth, paintHalfWidth,
    ftCircleRadius, threeRadius, cornerInset, cornerBreakX } = COURT;

  const cornerTopY = vy(cornerInset);
  const cornerBottomY = vy(COURT_WIDTH_FT - cornerInset);
  const breakX = vx(cornerBreakX);
  const r = threeRadius * FT;

  return (
    <g fill="none" stroke={LINE} strokeWidth={2}>
      {/* Paint, and the free-throw circle: solid towards half-way, dashed behind the line. */}
      <rect
        x={vx(0)}
        y={vy(rimY - paintHalfWidth)}
        width={paintDepth * FT}
        height={paintHalfWidth * 2 * FT}
      />
      <path d={`M${vx(paintDepth)} ${vy(rimY - ftCircleRadius)} A${ftCircleRadius * FT} ${ftCircleRadius * FT} 0 0 1 ${vx(paintDepth)} ${vy(rimY + ftCircleRadius)}`} />
      <path
        d={`M${vx(paintDepth)} ${vy(rimY - ftCircleRadius)} A${ftCircleRadius * FT} ${ftCircleRadius * FT} 0 0 0 ${vx(paintDepth)} ${vy(rimY + ftCircleRadius)}`}
        strokeDasharray="7 5"
      />

      {/* Backboard, rim, and the restricted area under it. */}
      <line x1={vx(backboardX)} y1={vy(rimY - 3)} x2={vx(backboardX)} y2={vy(rimY + 3)} strokeWidth={2.5} />
      <circle cx={vx(rimX)} cy={vy(rimY)} r={rimRadius * FT} />
      <path d={`M${vx(rimX)} ${vy(rimY - restrictedRadius)} A${restrictedRadius * FT} ${restrictedRadius * FT} 0 0 1 ${vx(rimX)} ${vy(rimY + restrictedRadius)}`} />

      {/* Three-point line: straight along each corner, then the arc struck from the rim. */}
      <line x1={vx(0)} y1={cornerTopY} x2={breakX} y2={cornerTopY} />
      <line x1={vx(0)} y1={cornerBottomY} x2={breakX} y2={cornerBottomY} />
      <path d={`M${breakX} ${cornerTopY} A${r} ${r} 0 0 1 ${breakX} ${cornerBottomY}`} />
    </g>
  );
}

/**
 * The court a statistician taps to record a shot, drawn to real proportions (94ft by 50ft) inside the
 * same 620 by 380 viewBox the layout already reserves.
 *
 * Markers arrive as the 0-to-1 pair that is stored for every shot, which is a fraction of the *old*
 * schematic court. That format has not changed, so every shot ever recorded still means the same
 * thing; it is decoded here through `shotToCourtFeet` and placed by its real position. See
 * `src/lib/shot-coordinates.ts` for why the stored format was kept rather than corrected at source.
 */
const BasketballCourt: React.FC<BasketballCourtProps> = ({
  className = 'block h-full w-full',
  shotMarkers,
  foulMarkers,
}) => {
  const place = (m: CourtMarker) => {
    const { xFt, yFt } = shotToCourtFeet(m.nx, m.ny);
    return feetToElementFraction(xFt, yFt);
  };

  return (
    <div className={`relative h-full w-full min-h-0 min-w-0 ${className}`.trim()}>
      <svg
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        xmlns="http://www.w3.org/2000/svg"
        className="block h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Basketball court diagram"
      >
        <rect width={VIEWBOX_W} height={VIEWBOX_H} fill="#F8FAFC" />
        <rect {...COURT_RECT} fill="none" stroke={LINE} strokeWidth={2.5} rx={2} />
        <line x1={vx(COURT_LENGTH_FT / 2)} y1={COURT_RECT.y} x2={vx(COURT_LENGTH_FT / 2)} y2={COURT_RECT.y + COURT_RECT.height} stroke={LINE} strokeWidth={2} />
        <circle cx={vx(COURT_LENGTH_FT / 2)} cy={vy(COURT_WIDTH_FT / 2)} r={COURT.centreCircleRadius * FT} fill="none" stroke={LINE} strokeWidth={2} />

        <CourtEnd />
        <g transform={`rotate(180 ${vx(COURT_LENGTH_FT / 2)} ${vy(COURT_WIDTH_FT / 2)})`}>
          <CourtEnd />
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {shotMarkers?.map((m, i) => {
          const { nx, ny } = place(m);
          return (
            <div
              key={`shot-${i}-${m.nx}-${m.ny}`}
              className="absolute flex h-5 w-5 items-center justify-center sm:h-6 sm:w-6"
              style={{
                left: `${nx * 100}%`,
                top: `${ny * 100}%`,
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
          );
        })}
        {foulMarkers?.map((m, i) => {
          const { nx, ny } = place(m);
          return (
            <svg
              key={`foul-${i}-${m.nx}-${m.ny}`}
              className="absolute h-4 w-4 overflow-visible"
              style={{
                left: `${nx * 100}%`,
                top: `${ny * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
              viewBox="0 0 16 16"
              aria-hidden
            >
              <line x1="2" y1="2" x2="14" y2="14" stroke={m.color} strokeWidth="2.5" strokeLinecap="round" />
              <line x1="14" y1="2" x2="2" y2="14" stroke={m.color} strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          );
        })}
      </div>
    </div>
  );
};

export default BasketballCourt;
