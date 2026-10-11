// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Credits, ResultsScreen, RulesPage, Tutorial } from './index';

afterEach(() => { cleanup(); localStorage.clear(); });

describe('Credits open', () => {
  it('is collapsed by default and open when asked (a TV)', () => {
    const { rerender } = render(<Credits />);
    expect(screen.getByTestId('credits').hasAttribute('open')).toBe(false);
    rerender(<Credits open />);
    expect(screen.getByTestId('credits').hasAttribute('open')).toBe(true);
  });
});

describe('Tutorial look hooks', () => {
  it('has the tour classes and one dot per step with the current one on', () => {
    const { container } = render(<Tutorial game="g" steps={[{ title: 'A', body: 'a' }, { title: 'B', body: 'b' }]} />);
    expect(container.querySelector('.modal-back.tour-back')).toBeTruthy();
    expect(container.querySelector('.modal.panel.tour')).toBeTruthy();
    expect(container.querySelectorAll('.tour-dots i').length).toBe(2);
    expect(container.querySelectorAll('.tour-dots i.on').length).toBe(1);
  });
});

describe('RulesPage', () => {
  it('shows back, title, sections and children', () => {
    const back = vi.fn();
    render(<RulesPage onBack={back} sections={[{ title: 'Goal', body: <p>win</p> }]}><p>extra</p></RulesPage>);
    expect(screen.getByText('How to play')).toBeTruthy(); expect(screen.getByText('Goal')).toBeTruthy();
    expect(screen.getByText('win')).toBeTruthy(); expect(screen.getByText('extra')).toBeTruthy();
    fireEvent.click(screen.getByText('← Back')); expect(back).toHaveBeenCalled();
  });
  it('head replaces the top row', () => {
    render(<RulesPage head={<h1>Mine</h1>} />);
    expect(screen.getByText('Mine')).toBeTruthy(); expect(screen.queryByText('How to play')).toBeNull();
  });
});

describe('ResultsScreen labels', () => {
  const rows = [{ id: 'a', name: 'Ann', color: '#fff', score: 3 }];
  it('custom button labels, optional leave, and a waiting line for non-hosts', () => {
    const { rerender } = render(<ResultsScreen rows={rows} isHost onAgain={() => undefined} againLabel="Rematch" leaveLabel="Menu" onLeave={() => undefined} above={<i data-testid="above" />} />);
    expect(screen.getByText('Rematch')).toBeTruthy(); expect(screen.getByText('Menu')).toBeTruthy(); expect(screen.getByTestId('above')).toBeTruthy();
    rerender(<ResultsScreen rows={rows} isHost={false} onAgain={() => undefined} />);
    expect(screen.queryByText('Leave')).toBeNull(); expect(screen.getByText(/Waiting for the host/)).toBeTruthy();
  });
});
