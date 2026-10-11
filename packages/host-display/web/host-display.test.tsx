// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { DisplayShell, Stage, stageScale } from './index';

afterEach(cleanup);
describe('Stage', () => {
  it('scales to fit the smaller dimension and respects a cap', () => {
    expect(stageScale(1920, 1080, 1280, 720)).toBeCloseTo(1.5);
    expect(stageScale(1000, 1080, 1280, 720)).toBeCloseTo(0.78125);
    expect(stageScale(3840, 2160, 1280, 720, 2)).toBe(2);
    expect(stageScale(0, 0, 1280, 720)).toBe(0.1);
  });
  it('centres the design box and follows window resizes', () => {
    Object.assign(window, { innerWidth: 1280, innerHeight: 720 });
    render(<Stage><i>table</i></Stage>);
    const box = () => screen.getByTestId('stage').firstElementChild as HTMLElement;
    expect(box().style.transform).toBe('translate(0px, 0px) scale(1)');
    act(() => { Object.assign(window, { innerWidth: 2560, innerHeight: 1440 }); window.dispatchEvent(new Event('resize')); });
    expect(box().style.transform).toBe('translate(0px, 0px) scale(2)');
    act(() => { Object.assign(window, { innerWidth: 1600, innerHeight: 720 }); window.dispatchEvent(new Event('resize')); });
    expect(box().style.transform).toBe('translate(160px, 0px) scale(1)');
  });
});
describe('DisplayShell', () => {
  it('shows the code, a QR for latecomers, and the content', async () => {
    render(<DisplayShell code="ABCD" joinUrl="https://x.test/?room=ABCD" title="Toy"><p>table</p></DisplayShell>);
    expect(screen.getByTestId('room-code').textContent).toBe('ABCD');
    expect(screen.getByText('table')).toBeTruthy();
    await waitFor(() => expect(document.querySelector('.qr')).not.toBeNull());
  });
});
