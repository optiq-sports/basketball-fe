import React from 'react';

/** Reference court: viewBox 0 0 620 380, grayscale markings. */
const BasketballCourt: React.FC<{ className?: string }> = ({ className = 'block h-full w-full' }) => (
  <svg
    viewBox="0 0 620 380"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    preserveAspectRatio="xMidYMid meet"
    role="img"
    aria-label="Basketball court diagram"
  >
    <rect width="620" height="380" fill="#d8dce1" />
    <rect x="16" y="16" width="588" height="348" fill="#e4e7eb" stroke="#6b7280" strokeWidth="3" rx="2" />
    <line x1="310" y1="16" x2="310" y2="364" stroke="#4b5563" strokeWidth="2" />
    <circle cx="310" cy="190" r="54" fill="none" stroke="#4b5563" strokeWidth="2" />
    <circle cx="310" cy="190" r="5" fill="#4b5563" />
    <rect x="16" y="118" width="132" height="144" fill="none" stroke="#4b5563" strokeWidth="2" />
    <path d="M148 118 A72 72 0 0 1 148 262" fill="none" stroke="#4b5563" strokeWidth="2" />
    <path
      d="M148 118 A72 72 0 0 0 148 262"
      fill="none"
      stroke="#4b5563"
      strokeWidth="2"
      strokeDasharray="7 5"
    />
    <rect x="16" y="165" width="13" height="50" fill="none" stroke="#4b5563" strokeWidth="2" />
    <circle cx="46" cy="190" r="20" fill="none" stroke="#4b5563" strokeWidth="2" />
    {/* 3pt: sideline straights extend past paint edge (key to x=148 / from x=472) */}
    <line x1="16" y1="58" x2="152" y2="58" stroke="#4b5563" strokeWidth="2" />
    <line x1="16" y1="322" x2="152" y2="322" stroke="#4b5563" strokeWidth="2" />
    <path d="M152 58 A148 148 0 0 1 152 322" fill="none" stroke="#4b5563" strokeWidth="2" />
    <rect x="472" y="118" width="132" height="144" fill="none" stroke="#4b5563" strokeWidth="2" />
    <path d="M472 118 A72 72 0 0 0 472 262" fill="none" stroke="#4b5563" strokeWidth="2" />
    <path
      d="M472 118 A72 72 0 0 1 472 262"
      fill="none"
      stroke="#4b5563"
      strokeWidth="2"
      strokeDasharray="7 5"
    />
    <rect x="591" y="165" width="13" height="50" fill="none" stroke="#4b5563" strokeWidth="2" />
    <circle cx="574" cy="190" r="20" fill="none" stroke="#4b5563" strokeWidth="2" />
    <line x1="604" y1="58" x2="466" y2="58" stroke="#4b5563" strokeWidth="2" />
    <line x1="604" y1="322" x2="466" y2="322" stroke="#4b5563" strokeWidth="2" />
    <path d="M466 58 A148 148 0 0 0 466 322" fill="none" stroke="#4b5563" strokeWidth="2" />
  </svg>
);

export default BasketballCourt;
