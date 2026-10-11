import { describe, expect, it } from 'vitest';
import { confirm, initialGate, isCovered, recover } from './pass-gate-state';

describe('pass gate', () => {
  it('covers until the player confirms this turn, then re-covers on the next turn', () => {
    let g = initialGate();
    expect(isCovered(g, 't1', true)).toBe(true);
    g = confirm(g, 't1');
    expect(isCovered(g, 't1', true)).toBe(false);
    expect(isCovered(g, 't2', true)).toBe(true);
  });
  it('never covers a phase that shows nothing private', () => {
    expect(isCovered(initialGate(), 't1', false)).toBe(false);
  });
  it('a saved confirmation survives a reload, a recover does not', () => {
    const saved = initialGate({ confirmedKey: 't3' });
    expect(isCovered(saved, 't3', true)).toBe(false);
    expect(isCovered(recover(), 't3', true)).toBe(true);
  });
});
