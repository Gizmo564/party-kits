// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { track } from './analytics';
import { accountName, usePrefillName } from './account';
import { RETURN_URL, ReturnLink } from './ReturnLink';

const reply = (body: unknown) => vi.fn(async () => ({ json: async () => body }) as unknown as Response) as unknown as typeof fetch;

afterEach(() => { cleanup(); delete window.track; vi.restoreAllMocks(); });

describe('track', () => {
  it('calls window.track when a.js is loaded and is silent when it is not', () => {
    expect(() => track('host')).not.toThrow();
    const f = vi.fn(); window.track = f;
    track('host', { n: 2 });
    expect(f).toHaveBeenCalledWith('host', { n: 2 });
    window.track = () => { throw new Error('a.js bug'); };
    expect(() => track('host')).not.toThrow();
  });
});

describe('accountName', () => {
  it('returns the signed-in username, trimmed and capped', async () => {
    expect(await accountName(5, reply({ loggedIn: true, username: '  Volvi-the-great ' }))).toBe('Volvi');
  });
  it('returns an empty string when signed out, malformed, or unreachable', async () => {
    expect(await accountName(20, reply({ loggedIn: false }))).toBe('');
    expect(await accountName(20, reply({ loggedIn: true, username: 5 }))).toBe('');
    expect(await accountName(20, vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch)).toBe('');
  });
  it('asks with the sign-in cookie', async () => {
    const f = reply({ loggedIn: false });
    await accountName(20, f);
    expect(f).toHaveBeenCalledWith('https://0801564.xyz/api/me', { credentials: 'include' });
  });
});

describe('usePrefillName', () => {
  function Box({ initial, fetcher }: { initial: string; fetcher: typeof fetch }) {
    const [name, setName] = useState(initial);
    usePrefillName(name, setName, fetcher);
    return <input aria-label="name" value={name} onChange={(e) => setName(e.target.value)} />;
  }
  it('fills an empty box', async () => {
    render(<Box initial="" fetcher={reply({ loggedIn: true, username: 'Sam' })} />);
    await waitFor(() => expect((screen.getByLabelText('name') as HTMLInputElement).value).toBe('Sam'));
  });
  it('never overwrites what the player already has', async () => {
    const f = reply({ loggedIn: true, username: 'Sam' });
    render(<Box initial="Pat" fetcher={f} />);
    await Promise.resolve();
    expect((screen.getByLabelText('name') as HTMLInputElement).value).toBe('Pat');
    expect(f).not.toHaveBeenCalled();
  });
});

describe('ReturnLink', () => {
  it('links back to the hub', () => {
    render(<ReturnLink />);
    const a = screen.getByRole('link');
    expect(a.getAttribute('href')).toBe(RETURN_URL);
    expect(a.className).toContain('return-link');
  });
});
