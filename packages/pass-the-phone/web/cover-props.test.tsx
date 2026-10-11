// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PassCover } from './index';

afterEach(cleanup);
describe('PassCover options', () => {
  it('takes a heading, a note, a class and a since title', () => {
    render(<PassCover name="Ann" color="#fff" heading="Pass to Ann" note="Hands stay hidden." className="felt" since={['x']} sinceTitle="Since" onReady={() => undefined} />);
    expect(screen.getByText('Pass to Ann')).toBeTruthy(); expect(screen.getByText('Hands stay hidden.')).toBeTruthy();
    expect(screen.getByTestId('cover').className).toBe('cover felt'); expect(screen.getByText('Since')).toBeTruthy();
  });
  it('defaults are unchanged', () => {
    render(<PassCover name="Ann" color="#fff" onReady={() => undefined} />);
    expect(screen.getByText('Pass the phone to Ann')).toBeTruthy(); expect(screen.getByTestId('cover').className).toBe('cover');
  });
});
