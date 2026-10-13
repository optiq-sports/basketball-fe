import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLivePoll } from './useLivePoll';

describe('useLivePoll', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('calls refetch on the interval only while active', () => {
    const refetch = vi.fn();
    const { rerender } = renderHook(({ active }) => useLivePoll(active, refetch, 1000), { initialProps: { active: false } });
    vi.advanceTimersByTime(5000);
    expect(refetch).not.toHaveBeenCalled();

    rerender({ active: true });
    vi.advanceTimersByTime(3500);
    expect(refetch).toHaveBeenCalledTimes(3);

    rerender({ active: false });
    vi.advanceTimersByTime(5000);
    expect(refetch).toHaveBeenCalledTimes(3); // no more calls once it goes inactive
  });

  it('always calls the latest refetch passed in, even from an inline arrow function', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ fn }) => useLivePoll(true, fn, 1000), { initialProps: { fn: first } });
    vi.advanceTimersByTime(1000);
    expect(first).toHaveBeenCalledTimes(1);

    rerender({ fn: second });
    vi.advanceTimersByTime(1000);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1); // not called again after being swapped out
  });

  it('stops polling when the component unmounts', () => {
    const refetch = vi.fn();
    const { unmount } = renderHook(() => useLivePoll(true, refetch, 1000));
    vi.advanceTimersByTime(1000);
    expect(refetch).toHaveBeenCalledTimes(1);
    unmount();
    vi.advanceTimersByTime(5000);
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
