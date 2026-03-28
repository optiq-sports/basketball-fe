import React, { useEffect, useRef } from 'react';

export type CourtMarker = { nx: number; ny: number; color: string };

function drawCourt(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const w = 1000;
  const h = 500;

  ctx.save();
  ctx.scale(width / w, height / h);

  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, '#c8915b');
  gradient.addColorStop(0.5, '#d4a574');
  gradient.addColorStop(1, '#c8915b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(139, 90, 43, 0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i < h; i += 40) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(w, i);
    ctx.stroke();
  }

  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.strokeRect(20, 20, w - 40, h - 40);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  ctx.beginPath();
  ctx.moveTo(w / 2, 20);
  ctx.lineTo(w / 2, h - 20);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 60, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 20, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(120, h / 2, 220, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(120, h / 2 - 220);
  ctx.lineTo(120, 20);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(120, h / 2 + 220);
  ctx.lineTo(120, h - 20);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(w - 120, h / 2, 220, Math.PI / 2, -Math.PI / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(w - 120, h / 2 - 220);
  ctx.lineTo(w - 120, 20);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(w - 120, h / 2 + 220);
  ctx.lineTo(w - 120, h - 20);
  ctx.stroke();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.fillRect(20, h / 2 - 80, 180, 160);
  ctx.strokeRect(20, h / 2 - 80, 180, 160);

  ctx.fillRect(w - 200, h / 2 - 80, 180, 160);
  ctx.strokeRect(w - 200, h / 2 - 80, 180, 160);

  ctx.beginPath();
  ctx.arc(200, h / 2, 60, 0, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(200, h / 2, 60, Math.PI, 0);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(w - 200, h / 2, 60, 0, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(w - 200, h / 2, 60, 0, Math.PI);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(50, h / 2, 40, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(w - 50, h / 2, 40, Math.PI / 2, -Math.PI / 2);
  ctx.stroke();

  ctx.lineWidth = 6;
  ctx.strokeStyle = '#2c2c2c';
  ctx.beginPath();
  ctx.moveTo(35, h / 2 - 30);
  ctx.lineTo(35, h / 2 + 30);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(w - 35, h / 2 - 30);
  ctx.lineTo(w - 35, h / 2 + 30);
  ctx.stroke();

  ctx.fillStyle = '#e85d04';
  ctx.strokeStyle = '#dc2f02';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(50, h / 2, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#2c2c2c';
  ctx.beginPath();
  ctx.arc(50, h / 2, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#e85d04';
  ctx.strokeStyle = '#dc2f02';
  ctx.beginPath();
  ctx.arc(w - 50, h / 2, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#2c2c2c';
  ctx.beginPath();
  ctx.arc(w - 50, h / 2, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 3;
  const laneMarks = [60, 90, 120, 150];
  laneMarks.forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(20, h / 2 - 80 + y);
    ctx.lineTo(30, h / 2 - 80 + y);
    ctx.stroke();
  });

  laneMarks.forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(w - 20, h / 2 - 80 + y);
    ctx.lineTo(w - 30, h / 2 - 80 + y);
    ctx.stroke();
  });

  ctx.restore();
}

function drawShotMarkers(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  markers: CourtMarker[] | undefined
) {
  if (!markers?.length) return;
  const w = 1000;
  const h = 500;
  ctx.save();
  ctx.scale(width / w, height / h);
  markers.forEach((stat) => {
    const x = stat.nx * w;
    const y = stat.ny * h;
    ctx.fillStyle = stat.color;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  ctx.restore();
}

function drawFoulMarkers(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  markers: CourtMarker[] | undefined
) {
  if (!markers?.length) return;
  const w = 1000;
  const h = 500;
  ctx.save();
  ctx.scale(width / w, height / h);
  markers.forEach((foul) => {
    const x = foul.nx * w;
    const y = foul.ny * h;
    ctx.strokeStyle = foul.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 8);
    ctx.lineTo(x + 8, y + 8);
    ctx.moveTo(x + 8, y - 8);
    ctx.lineTo(x - 8, y + 8);
    ctx.stroke();
  });
  ctx.restore();
}

export interface BasketballCourtProps {
  className?: string;
  shotMarkers?: CourtMarker[];
  foulMarkers?: CourtMarker[];
}

/** Wood-floor canvas court; optional shot (dots) / foul (X) markers in normalized coords. */
const BasketballCourt: React.FC<BasketballCourtProps> = ({
  className = 'block h-full w-full',
  shotMarkers,
  foulMarkers,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const paint = () => {
      const r = wrap.getBoundingClientRect();
      const cssW = Math.max(1, r.width);
      const cssH = Math.max(1, r.height);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      drawCourt(ctx, cssW, cssH);
      drawShotMarkers(ctx, cssW, cssH, shotMarkers);
      drawFoulMarkers(ctx, cssW, cssH, foulMarkers);
    };

    paint();
    const ro = new ResizeObserver(() => paint());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [shotMarkers, foulMarkers]);

  return (
    <div ref={wrapRef} className={'relative h-full w-full min-h-0 min-w-0 ' + className}>
      <canvas
        ref={canvasRef}
        className="pointer-events-none block h-full w-full"
        role="img"
        aria-label="Basketball court diagram"
      />
    </div>
  );
};

export default BasketballCourt;
