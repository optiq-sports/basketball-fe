import React from 'react';

/** A small inline loading spinner that inherits the surrounding text colour. */
const Spinner: React.FC<{ className?: string; label?: string }> = ({ className = 'size-4', label }) => (
  <svg
    className={`animate-spin ${className}`}
    viewBox="0 0 24 24"
    fill="none"
    role={label ? 'status' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

export default Spinner;
