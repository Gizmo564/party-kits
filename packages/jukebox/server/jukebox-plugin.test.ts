import { describe, expect, it } from 'vitest';
import { BaseRoom } from '@gizmo564/room-server/server/base-room';
import type { ClientMsg } from '@gizmo564/room-server/server/protocol';
import { toyLogic, type ToyAction, type ToySettings, type ToyState, type ToyView } from '@gizmo564/room-server/server/testing/toy-logic';
import { jukeboxFromPlugins, jukeboxPlugin } from './jukebox-plugin';

type Msg = ClientMsg<ToyAction, ToySettings>;
const mk = () => new BaseRoom<ToySettings, ToyState, ToyAction, ToyView>('ABCD', toyLogic, [jukeboxPlugin()], 3);
const hello = (r: BaseRoom<any, any, any, any>, c: string) => r.handle(c, { type: 'hello', name: c } as Msg, 0);
const send = (r: BaseRoom<any, any, any, any>, c: string, m: object) => r.handle(c, m as Msg, 0);

describe('jukebox plugin', () => {
  it('starts on Auto with no volume, visible in every snapshot', () => {
    const r = mk(); hello(r, 'h'); hello(r, 'g');
    expect(jukeboxFromPlugins(r.snapshot('g')!.plugins)).toEqual({ track: 'auto', volume: null });
  });
  it('only the host can change it; everyone then sees the change', () => {
    const r = mk(); hello(r, 'h'); hello(r, 'g');
    expect(send(r, 'g', { type: 'jukebox', track: 'picnic' })).toMatch(/only the host/);
    expect(send(r, 'h', { type: 'jukebox', track: 'picnic', volume: 0.4 })).toBeNull();
    expect(jukeboxFromPlugins(r.snapshot('g')!.plugins)).toEqual({ track: 'picnic', volume: 0.4 });
    expect(send(r, 'h', { type: 'jukebox', volume: 2 })).toBeNull();           // clamped, track kept
    expect(jukeboxFromPlugins(r.snapshot('h')!.plugins)).toEqual({ track: 'picnic', volume: 1 });
    expect(send(r, 'h', { type: 'jukebox', volume: null })).toBeNull();
    expect(send(r, 'h', { type: 'jukebox', track: 'auto' })).toBeNull();
    expect(jukeboxFromPlugins(r.snapshot('h')!.plugins)).toEqual({ track: 'auto', volume: null });
  });
  it('rejects junk and changes nothing', () => {
    const r = mk(); hello(r, 'h');
    expect(send(r, 'h', { type: 'jukebox', track: '../etc' })).toBe('unknown song');
    expect(send(r, 'h', { type: 'jukebox', track: 'x'.repeat(80) })).toBe('unknown song');
    expect(send(r, 'h', { type: 'jukebox', volume: 'loud' })).toBe('bad volume');
    expect(jukeboxFromPlugins(r.snapshot('h')!.plugins)).toEqual({ track: 'auto', volume: null });
  });
  it('survives the room being saved and restored', () => {
    const r = mk(); hello(r, 'h');
    send(r, 'h', { type: 'jukebox', track: 'elevator', volume: 0.3 });
    const back = BaseRoom.restore<ToySettings, ToyState, ToyAction, ToyView>(JSON.parse(JSON.stringify(r.toJSON())), toyLogic, [jukeboxPlugin()]);
    hello(back, 'h');
    expect(jukeboxFromPlugins(back.snapshot('h')!.plugins)).toEqual({ track: 'elevator', volume: 0.3 });
  });
  it('a missing or malformed plugin entry reads as Auto', () => {
    expect(jukeboxFromPlugins(undefined)).toEqual({ track: 'auto', volume: null });
    expect(jukeboxFromPlugins({ jukebox: { track: 5, volume: 'x' } })).toEqual({ track: 'auto', volume: null });
  });
});
