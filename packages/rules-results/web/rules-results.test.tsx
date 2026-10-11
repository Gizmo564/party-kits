// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Credits, ResultsScreen, RulesButton, Scoreboard, Tutorial, rankRows, resetTour, tourSeen, winnersLine, type ResultRow } from './index';

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
const row = (id: string, score: number): ResultRow => ({ id, name: id.toUpperCase(), color: '#ff9fb2', score });
const steps = [{ title: 'One', body: 'first' }, { title: 'Two', body: 'second' }];

describe('rankRows', () => {
  it('ties share a place and the next place skips; high or low can win', () => {
    const r = rankRows([row('a', 5), row('b', 9), row('c', 9), row('d', 1)]);
    expect(r.map((x) => [x.id, x.place, x.winner])).toEqual([['b', 1, true], ['c', 1, true], ['a', 3, false], ['d', 4, false]]);
    const low = rankRows([row('a', 5), row('b', 2), row('c', 7)], true);
    expect(low.map((x) => x.id)).toEqual(['b', 'a', 'c']); expect(low[0].winner).toBe(true);
    expect(rankRows([])).toEqual([]);
  });
  it('winnersLine words one winner, a tie, and nobody', () => {
    expect(winnersLine(rankRows([row('a', 2), row('b', 1)]))).toBe('A wins!');
    expect(winnersLine(rankRows([row('a', 2), row('b', 2), row('c', 2)]))).toBe('A, B and C tie!');
    expect(winnersLine([])).toBe('No winner');
  });
});

describe('Tutorial', () => {
  it('shows once, steps through, remembers per game, and Skip also counts as seen', () => {
    const done = vi.fn();
    const { rerender } = render(<Tutorial game="g" steps={steps} onDone={done} />);
    expect(screen.getByText('One')).toBeTruthy();
    fireEvent.click(screen.getByTestId('tour-next')); expect(screen.getByText('Two')).toBeTruthy();
    fireEvent.click(screen.getByText('Back')); expect(screen.getByText('One')).toBeTruthy();
    fireEvent.click(screen.getByTestId('tour-next')); fireEvent.click(screen.getByTestId('tour-next'));
    expect(done).toHaveBeenCalledTimes(1); expect(tourSeen('g')).toBe(true); expect(tourSeen('other')).toBe(false);
    rerender(<Tutorial game="g" steps={steps} />); expect(screen.queryByTestId('tour')).toBeNull();
    resetTour('g'); expect(tourSeen('g')).toBe(false);
    cleanup(); render(<Tutorial game="g" steps={steps} />); fireEvent.click(screen.getByTestId('tour-skip'));
    expect(tourSeen('g')).toBe(true);
  });
  it('force shows it again; blocked storage means it never nags; no steps renders nothing', () => {
    localStorage.setItem('g-tour-done', '1');
    render(<Tutorial game="g" steps={steps} force />); expect(screen.getByTestId('tour')).toBeTruthy(); cleanup();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<Tutorial game="g" steps={steps} />); expect(screen.queryByTestId('tour')).toBeNull(); cleanup();
    vi.restoreAllMocks();
    const { container } = render(<Tutorial game="z" steps={[]} />); expect(container.textContent).toBe('');
  });
});

describe('Rules', () => {
  it('opens a dialog with every section and closes it', () => {
    render(<RulesButton sections={[{ title: 'Goal', body: 'win' }, { title: 'Turns', body: <b>go</b> }]} />);
    fireEvent.click(screen.getByText('How to play'));
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('How to play');
    expect(screen.getByText('Goal')).toBeTruthy(); expect(screen.getByText('go')).toBeTruthy();
    fireEvent.click(screen.getByText('Close')); expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Results', () => {
  it('Scoreboard marks winners and you', () => {
    render(<Scoreboard rows={[row('a', 3), row('b', 7)]} meId="a" unit=" pts" />);
    const rows = screen.getAllByTestId('score-row');
    expect(rows[0].textContent).toContain('B'); expect(rows[0].textContent).toContain('Winner'); expect(rows[0].textContent).toContain('7 pts');
    expect(rows[1].getAttribute('aria-current')).toBe('true'); expect(rows[1].textContent).toContain('(you)');
  });
  it('ResultsScreen: host can play again, others wait; Leave always works', () => {
    const again = vi.fn(), leave = vi.fn();
    const { rerender } = render(<ResultsScreen rows={[row('a', 1), row('b', 2)]} isHost onAgain={again} onLeave={leave} />);
    expect(screen.getByText('B wins!')).toBeTruthy();
    fireEvent.click(screen.getByText('Play again')); expect(again).toHaveBeenCalled();
    rerender(<ResultsScreen rows={[row('a', 1), row('b', 2)]} isHost={false} onAgain={again} onLeave={leave} headline="Custom" />);
    expect(screen.queryByText('Play again')).toBeNull(); expect(screen.getByText(/Waiting for the host/)).toBeTruthy(); expect(screen.getByText('Custom')).toBeTruthy();
    fireEvent.click(screen.getByText('Leave')); expect(leave).toHaveBeenCalled();
  });
});

describe('Credits', () => {
  it('is a collapsed panel with the creator line, each track (with artist link and licence) and the audio-library note', () => {
    render(<Credits music={[{ title: 'Local Forecast', by: 'Kevin MacLeod', url: 'https://incompetech.com', license: { name: 'By Attribution 4.0 License', url: 'https://creativecommons.org/licenses/by/4.0/' } }, { title: 'Gfh', by: 'Keenan Powell' }]} extra={['Song previews by Deezer']} />);
    const d = screen.getByTestId('credits') as HTMLDetailsElement;
    expect(d.open).toBe(false);
    expect(screen.getByText('Created, designed, illustrated and built by Tanner Nelson')).toBeTruthy();
    expect(screen.getByText(/“Local Forecast” by Kevin MacLeod/)).toBeTruthy();
    expect(screen.getByText('incompetech.com').getAttribute('href')).toBe('https://incompetech.com');
    expect(screen.getByText('creativecommons.org/licenses/by/4.0').getAttribute('target')).toBe('_blank');
    expect(screen.getByText(/“Gfh” by Keenan Powell/)).toBeTruthy();
    expect(screen.getByText('Song previews by Deezer')).toBeTruthy();
    expect(screen.getByText('Music and sound effects are from the YouTube Audio Library.')).toBeTruthy();
  });
  it('shows on the results screen when passed', () => {
    render(<ResultsScreen rows={[{ id: 'a', name: 'Ann', color: '#fff', score: 1 }]} isHost onAgain={() => undefined} onLeave={() => undefined} credits={<Credits />} />);
    expect(screen.getByTestId('credits')).toBeTruthy();
  });
});

describe('ResultsScreen: end game for everyone', () => {
  const rows = [{ id: 'a', name: 'Ann', color: '#fff', score: 1 }];
  it('shows to the host only, and only when onEnd is given', () => {
    const end = vi.fn();
    const { rerender } = render(<ResultsScreen rows={rows} isHost onAgain={() => undefined} onLeave={() => undefined} onEnd={end} />);
    fireEvent.click(screen.getByTestId('end-all')); expect(end).toHaveBeenCalled();
    rerender(<ResultsScreen rows={rows} isHost={false} onAgain={() => undefined} onLeave={() => undefined} onEnd={end} />);
    expect(screen.queryByTestId('end-all')).toBeNull();
    rerender(<ResultsScreen rows={rows} isHost onAgain={() => undefined} onLeave={() => undefined} />);
    expect(screen.queryByTestId('end-all')).toBeNull();
  });
});
