// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Collapsible, Hint, StickyBar } from './collapse';

afterEach(cleanup);

describe('Collapsible', () => {
  it('starts closed with its summary, opens and closes on tap', () => {
    render(<Collapsible title="Game setup" summary="Rounds 3 · Timer 20 s"><p>the body</p></Collapsible>);
    const head = screen.getByRole('button', { name: /Game setup/ });
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(head.textContent).toContain('Rounds 3 · Timer 20 s');
    expect(screen.getByText('the body').parentElement!.hidden).toBe(true);
    fireEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('the body').parentElement!.hidden).toBe(false);
    fireEvent.click(head);
    expect(screen.getByText('the body').parentElement!.hidden).toBe(true);
  });
  it('can start open, and ties the button to the body for screen readers', () => {
    render(<Collapsible title="Open one" defaultOpen><p>x</p></Collapsible>);
    const head = screen.getByRole('button', { name: /Open one/ });
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(head.getAttribute('aria-controls')!)).not.toBeNull();
  });
});

describe('Hint', () => {
  it('shows its sentence only after a tap', () => {
    render(<p>Scoring <Hint label="About scoring">Two points for an uncaught chameleon.</Hint></p>);
    expect(screen.queryByText(/Two points/)).toBeNull();
    fireEvent.click(screen.getByLabelText('About scoring'));
    expect(screen.getByRole('note').textContent).toMatch(/Two points/);
    fireEvent.click(screen.getByLabelText('About scoring'));
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('StickyBar', () => {
  it('holds the main button', () => {
    render(<StickyBar><button>Start game</button></StickyBar>);
    expect(screen.getByTestId('stickybar').className).toContain('stickybar');
    expect(screen.getByText('Start game')).not.toBeNull();
  });
});
