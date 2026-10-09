import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TeamCrest, isLight, luminance } from './TeamCrest';

describe('luminance and isLight', () => {
  it('rates white and pale colours as light, and dark and saturated ones as not', () => {
    expect(isLight('#FFFFFF')).toBe(true);
    expect(isLight('#fff')).toBe(true);
    expect(isLight('#FFFF00')).toBe(true);
    expect(isLight('#F6D56F')).toBe(true);
    expect(isLight('#FF0000')).toBe(false);
    expect(isLight('#20365A')).toBe(false);
    expect(isLight('#000000')).toBe(false);
  });

  it('reads short and alpha forms', () => {
    expect(luminance('#fff')).toBeCloseTo(1, 3);
    expect(luminance('#ffffffff')).toBeCloseTo(1, 3);
    expect(luminance('#000')).toBeCloseTo(0, 3);
    expect(luminance('#ffff')).toBeCloseTo(1, 3);
  });

  it('treats a missing, malformed or odd-length colour as not light, so the default styling applies', () => {
    expect(isLight(undefined)).toBe(false);
    expect(isLight(null)).toBe(false);
    expect(isLight('red')).toBe(false);
    expect(isLight('#12345')).toBe(false);
  });
});

describe('TeamCrest', () => {
  const crest = (color?: string | null) => render(<TeamCrest name="Aso Skyhawks" code="ASK" color={color} />).container.firstElementChild as HTMLElement;

  it('uses dark initials on a white crest, and keeps the ring that shows it on a white card', () => {
    const el = crest('#FFFFFF');
    expect(el.className).toContain('text-gray-900');
    expect(el.className).not.toContain('text-white');
    expect(el.className).toContain('ring-1');
  });

  it('keeps white initials on a dark crest', () => {
    const el = crest('#20365A');
    expect(el.className).toContain('text-white');
    expect(el.className).not.toContain('text-gray-900');
  });

  it('shows the code as the initials, and a grey crest when the team has no colour', () => {
    const el = crest(null);
    expect(el.textContent).toBe('ASK');
    expect(el.className).toContain('bg-gray-400');
  });

  it('shows the logo instead when there is one', () => {
    const { container } = render(<TeamCrest name="Aso Skyhawks" logo="https://cdn.test/l.png" color="#FFFFFF" />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn.test/l.png');
  });
});
