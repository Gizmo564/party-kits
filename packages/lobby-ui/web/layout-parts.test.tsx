// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DeviceGrid, LobbyHeader, TvLobbyFrame } from './layout-parts';

afterEach(cleanup);

describe('LobbyHeader', () => {
  it('has Leave on the left and the title in the middle', () => {
    const onLeave = vi.fn();
    render(<LobbyHeader onLeave={onLeave} />);
    const head = screen.getByTestId('lobby-header');
    expect(head.firstElementChild!.textContent).toBe('Leave');
    expect(head.querySelector('h1')!.textContent).toBe('Lobby');
    fireEvent.click(screen.getByText('Leave'));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});

describe('DeviceGrid', () => {
  it('holds the buttons in order', () => {
    render(<DeviceGrid><button>Sound</button><button>Show on TV</button><button>Open on another device</button></DeviceGrid>);
    const names = Array.from(screen.getByTestId('devices').children).map((c) => c.textContent);
    expect(names).toEqual(['Sound', 'Show on TV', 'Open on another device']);
  });
});

describe('TvLobbyFrame', () => {
  it('puts the buttons in a top bar, code on the left, players on the right, and has no Leave', () => {
    render(<TvLobbyFrame buttons={<button>Full screen</button>} left={<p>CODE</p>} right={<p>PLAYERS</p>} />);
    expect(screen.getByTestId('tv-top').textContent).toContain('Full screen');
    expect(screen.getByTestId('tv-top').textContent).toContain('Lobby');
    const body = document.querySelector('.tvl-body')!;
    expect(body.children[0].textContent).toBe('CODE');
    expect(body.children[1].textContent).toBe('PLAYERS');
    expect(screen.queryByText('Leave')).toBeNull();
  });
});
