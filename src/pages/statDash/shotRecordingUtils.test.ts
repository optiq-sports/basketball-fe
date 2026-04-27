import {
  emptyShotDraft,
  reboundBranchFromTipShot,
  shotTypeResultPhrase,
  snapshotPriorMiss,
} from './shotRecordingUtils';

describe('shot recording utils', () => {
  it('maps tip-in branches correctly', () => {
    expect(reboundBranchFromTipShot('layup', 'made')).toBe('tipin_layup_made');
    expect(reboundBranchFromTipShot('dunk', 'missed')).toBe('tipin_dunk_miss');
    expect(reboundBranchFromTipShot('jump', 'made')).toBeNull();
  });

  it('creates prior miss snapshots only when complete', () => {
    const empty = emptyShotDraft();
    expect(snapshotPriorMiss(empty)).toBeNull();

    const draft = {
      ...empty,
      side: 'home' as const,
      shooterJersey: 7,
      shotType: 'layup' as const,
      fastBreak: true,
    };
    expect(snapshotPriorMiss(draft)).toEqual({
      side: 'home',
      shooterJersey: 7,
      shotType: 'layup',
      fastBreak: true,
    });
  });

  it('returns readable shot result phrases', () => {
    expect(shotTypeResultPhrase('jump', 'made')).toContain('made');
    expect(shotTypeResultPhrase('post', 'missed')).toContain('missed');
  });
});
