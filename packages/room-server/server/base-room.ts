// The generic multi-device room. Pure logic, no Cloudflare APIs, so it unit-tests in plain Node.
// The Durable Object (room-do.ts) feeds it messages and sends each connection its own snapshot.
//
// What it owns (identical in Track Record, Sandwich Slam and Chameleon today):
//   members + tokens + rejoin, host, spectators, TV screens, the music device, claimHost, profile, settings,
//   start / again, kick / makeHost, per-viewer snapshots, timers, JSON persistence, plugins (bots, away...).
// What the game owns: everything in GameLogic.
import { cleanText, freeColor, MAX_NAME, newMemberId, newSeed, newToken, PLAYER_COLORS } from '@gizmo564/engine-core/engine';
import type { GameLogic, Seat } from './game-logic';
import type { ClientMsg, MemberInfo, Role, Snapshot } from './protocol';

/** the most members (players + watchers + screens) a room will hold */
export const MAX_MEMBERS = 40;

export interface Member {
  id: string; token: string; name: string; color: string; avatar: number; role: Role; host: boolean;
  screen: boolean; music: boolean; bot: boolean; away: boolean;
  /** a screen that is the Google Cast receiver on a TV (it outranks other screens for the music) */
  cast?: boolean;
  data: Record<string, unknown>;
  /** live connection ids (not persisted: sockets are re-attached after a hibernation) */
  conns: Set<string>;
  /** last time this member had a connection or sent a message (epoch ms) */
  lastSeen: number;
}

export interface RoomData<Settings, State> {
  v: 1;
  code: string;
  members: (Omit<Member, 'conns'> & { conns: string[] })[];
  settings: Settings;
  game: State | null;
  events: unknown[];
  eventSeq: number;
  seed: number;
  plugins: Record<string, unknown>;
}

/** Extra behaviour bolted onto a room without touching the base. See bots-away. */
export interface RoomPlugin<Settings = any, State = any, Action = any, View = any> {
  id: string;
  save?(): unknown;
  load?(data: unknown): void;
  /** a member's first connection / last connection dropped / a message arrived from them */
  onConnect?(room: BaseRoom<Settings, State, Action, View>, m: Member, now: number): void;
  onDisconnect?(room: BaseRoom<Settings, State, Action, View>, m: Member, now: number): void;
  onActivity?(room: BaseRoom<Settings, State, Action, View>, m: Member, now: number): void;
  /** the room was frozen for `ms` (Nap Guard) and is waking: push your own stored timestamps forward */
  shift?(room: BaseRoom<Settings, State, Action, View>, ms: number): void;
  onStart?(room: BaseRoom<Settings, State, Action, View>, now: number): void;
  onAgain?(room: BaseRoom<Settings, State, Action, View>, now: number): void;
  /** a ClientMsg the base does not know; return an error string, null for handled, undefined for "not mine" */
  onMessage?(room: BaseRoom<Settings, State, Action, View>, me: Member, msg: ClientMsg, now: number): string | null | undefined;
  /** run on every tick; return true if anything changed */
  tick?(room: BaseRoom<Settings, State, Action, View>, now: number): boolean;
  nextWake?(room: BaseRoom<Settings, State, Action, View>, now: number): number | null;
  decorate?(m: Member, info: MemberInfo): void;
  publicData?(room: BaseRoom<Settings, State, Action, View>): unknown;
}

const stripConns = (m: Member) => ({ ...m, conns: [] as string[] });

export class BaseRoom<Settings = any, State = any, Action = any, View = any, Ev = unknown> {
  code: string;
  settings: Settings;
  game: State | null = null;
  events: unknown[] = [];
  eventSeq = 0;
  seed: number;
  private _members: Member[] = [];
  /** connection id -> member id */
  private conns = new Map<string, string>();
  /** connection ids the host removed; the Durable Object closes them after the message is handled */
  private kickedConns: string[] = [];
  private pluginList: RoomPlugin<Settings, State, Action, View>[];

  constructor(code: string, readonly logic: GameLogic<Settings, State, Action, View, Ev>, plugins: RoomPlugin<Settings, State, Action, View>[] = [], seed = newSeed()) {
    this.code = code;
    this.settings = logic.defaultSettings();
    this.seed = seed;
    this.pluginList = plugins;
  }

  // ---------- persistence ----------
  toJSON(): RoomData<Settings, State> {
    const plugins: Record<string, unknown> = {};
    for (const p of this.pluginList) if (p.save) plugins[p.id] = p.save();
    return { v: 1, code: this.code, members: this._members.map(stripConns), settings: this.settings, game: this.game, events: this.events, eventSeq: this.eventSeq, seed: this.seed, plugins };
  }
  static restore<Settings, State, Action, View, Ev = unknown>(d: RoomData<Settings, State>, logic: GameLogic<Settings, State, Action, View, Ev>, plugins: RoomPlugin<Settings, State, Action, View>[] = []): BaseRoom<Settings, State, Action, View, Ev> {
    const r = new BaseRoom<Settings, State, Action, View, Ev>(d.code, logic, plugins, d.seed);
    r._members = d.members.map((m) => ({ ...m, conns: new Set<string>() })) as Member[];
    r.settings = d.settings; r.game = d.game; r.events = d.events; r.eventSeq = d.eventSeq;
    for (const p of plugins) if (p.load && d.plugins?.[p.id] !== undefined) p.load(d.plugins[p.id]);
    return r;
  }

  // ---------- read access (plugins and tests) ----------
  get members(): readonly Member[] { return this._members; }
  get started(): boolean { return this.game !== null; }
  get over(): boolean { return this.game !== null && this.logic.isOver(this.game); }
  member(id: string): Member | undefined { return this._members.find((m) => m.id === id); }
  get host(): Member | undefined { return this._members.find((m) => m.host); }
  players(): Member[] { return this._members.filter((m) => m.role === 'player' && !m.screen); }
  isConnected(m: Member): boolean { return m.conns.size > 0; }
  connectionIds(): string[] { return [...this.conns.keys()]; }
  private byConn(conn: string): Member | undefined { const id = this.conns.get(conn); return id ? this.member(id) : undefined; }
  memberIdOf(conn: string): string | undefined { return this.conns.get(conn); }
  /** connection ids to close because the host removed their member; clears the list */
  takeKicked(): string[] { const k = this.kickedConns; this.kickedConns = []; return k; }
  /** the next seed for one step; stored, so a restored room continues the same stream */
  nextSeed(): number { this.seed = (Math.imul(this.seed ^ 0x9e3779b9, 2654435761) + 1) >>> 0; return this.seed; }

  // ---------- connections ----------
  /** re-link a connection that survived the Durable Object hibernating */
  attach(conn: string, memberId: string, now = Date.now()): void {
    const m = this.member(memberId);
    if (!m) return;
    this.conns.set(conn, m.id); m.conns.add(conn); m.lastSeen = now;
  }

  disconnect(conn: string, now = Date.now()): void {
    const m = this.byConn(conn);
    this.conns.delete(conn);
    if (!m) return;
    m.conns.delete(conn);
    if (m.conns.size === 0) {
      m.lastSeen = now;
      if (m.music) { m.music = false; this.handMusicBack(); }
      for (const p of this.pluginList) p.onDisconnect?.(this, m, now);
    }
  }

  // ---------- members (also used by plugins to add bots) ----------
  addMember(init: Partial<Member> & { name: string }, now = Date.now()): Member {
    const taken = this._members.map((x) => x.color);
    const m: Member = {
      id: newMemberId(this._members.map((x) => x.id)), token: newToken(),
      color: freeColor(taken, PLAYER_COLORS, this._members.length), avatar: this.freeAvatar(),
      role: 'player', host: false, screen: false, music: false, bot: false, away: false, data: {}, conns: new Set(), lastSeen: now,
      ...init,
    };
    this._members.push(m);
    return m;
  }
  removeMember(id: string): void {
    const m = this.member(id);
    if (!m) return;
    for (const c of m.conns) { this.conns.delete(c); this.kickedConns.push(c); }
    this._members = this._members.filter((x) => x.id !== id);
  }
  private freeAvatar(): number {
    const n = this.logic.avatarLooks;
    if (n <= 0) return 0;
    const used = new Set(this._members.map((x) => x.avatar));
    for (let i = 0; i < n; i++) if (!used.has(i)) return i;
    return this._members.length % n;
  }
  private seatOf(m: Member): Seat { return { id: m.id, name: m.name, color: m.color, avatar: m.avatar, data: m.data, bot: m.bot }; }

  // ---------- messages ----------
  /** Returns an error string, or null on success. */
  handle(conn: string, msg: ClientMsg<Action, Settings>, now = Date.now()): string | null {
    if (msg.type === 'ping') return null;
    if (msg.type === 'hello') return this.hello(conn, msg, now);
    const me = this.byConn(conn);
    if (!me) return 'say hello first';
    me.lastSeen = now;
    if (me.away) me.away = false;
    for (const p of this.pluginList) p.onActivity?.(this, me, now);
    switch (msg.type) {
      case 'profile': return this.profile(me, msg);
      case 'settings': return this.setSettings(me, msg.settings);
      case 'claimHost': return this.claimHost(me);
      case 'leave': return this.leave(me);
      case 'start': return this.start(me, now);
      case 'again': return this.again(me, now);
      case 'music': return this.setMusic(me, msg.on);
      case 'act': return this.act(me, msg.action, now);
      case 'kick': return this.kick(me, msg.id);
      case 'makeHost': return this.makeHost(me, msg.id);
    }
    for (const p of this.pluginList) {
      const r = p.onMessage?.(this, me, msg as ClientMsg, now);
      if (r !== undefined) return r;
    }
    return 'unknown message';
  }

  private hello(conn: string, msg: Extract<ClientMsg, { type: 'hello' }>, now: number): string | null {
    let m = msg.token ? this._members.find((x) => x.token === msg.token && !x.bot) : undefined;
    if (!m) {
      if (this._members.filter((x) => !x.bot).length >= MAX_MEMBERS) return 'this room is full';
      const wantWatch = !!msg.spectate || !!msg.screen || this.started;
      const seated = this.players().length;
      if (!wantWatch && seated >= this.logic.maxPlayers) return `this room is full (${this.logic.maxPlayers} players). You can watch instead.`;
      m = this.addMember({
        name: cleanText(msg.name, MAX_NAME) || (msg.screen ? 'Display' : wantWatch ? 'Watcher' : `Player ${seated + 1}`),
        role: wantWatch ? 'spectator' : 'player', screen: !!msg.screen, cast: !!msg.screen && !!msg.cast,
        // the first player in is the host (a TV or a spectator never is); a room opened from a TV is hosted by its first phone.
        // Same rule as Track Record and Chameleon (Sandwich Slam has no host concept: FLAGS.md)
        host: !msg.screen && !wantWatch && !this.started && !this._members.some((x) => x.host),
      }, now);
      // a TV plays the music; the casting TV outranks any other screen (a laptop display never takes it from a connected cast TV)
      if (msg.screen && (m.cast || !this._members.some((x) => x.cast && x !== m && x.conns.size > 0))) this.makeMusicDevice(m);
    } else if (msg.name && !this.started) {
      m.name = cleanText(msg.name, MAX_NAME) || m.name;
    }
    this.conns.set(conn, m.id);
    const first = m.conns.size === 0;
    m.conns.add(conn);
    m.lastSeen = now; m.away = false;
    // the host's device is the music device unless it says otherwise; a TV, if present, wins
    if (m.host && msg.music !== false && !this._members.some((x) => x.screen && x.conns.size > 0 && x !== m)) m.music = true;
    if (first) for (const p of this.pluginList) p.onConnect?.(this, m, now);
    return null;
  }

  private setMusic(me: Member, on: boolean): string | null {
    if (!me.host) return 'only the host can be the music device';
    if (on) this.makeMusicDevice(me);
    else { me.music = false; this.handMusicBack(); }
    return null;
  }
  private makeMusicDevice(m: Member) { for (const x of this._members) x.music = x === m; }
  /** when the music device leaves: a connected casting TV, then any connected TV, then the host, else nobody */
  private handMusicBack() {
    if (this._members.some((x) => x.music)) return;
    const tv = this._members.find((x) => x.cast && x.conns.size > 0) ?? this._members.find((x) => x.screen && x.conns.size > 0);
    const h = this.host;
    const pick = tv ?? (h && h.conns.size > 0 ? h : undefined);
    if (pick) this.makeMusicDevice(pick);
  }

  /** the host is walking away (Leave button): the next connected player in join order takes over, and the music with them unless a TV plays it.
   *  Same as Track Record and Chameleon. A non-host leaving changes nothing here (the socket closing is handled by disconnect). */
  private leave(me: Member): string | null {
    if (!me.host) return null;
    me.host = false; me.music = false;
    const rest = this._members.filter((x) => x !== me && !x.screen);
    const next = rest.find((x) => x.role === 'player' && x.conns.size > 0) ?? rest.find((x) => x.conns.size > 0);
    if (next) {
      next.host = true;
      if (!this._members.some((x) => x.screen && x.conns.size > 0)) this.makeMusicDevice(next);
    }
    return null;
  }

  /** if the host left with nobody to hand to, the next person in can take control with claimHost */
  private claimHost(me: Member): string | null {
    if (this.host) return 'this room already has a host';
    if (me.screen) return 'a screen cannot be the host';
    if (me.bot) return 'a bot cannot be the host';
    me.host = true;
    if (!this._members.some((x) => x.screen && x.conns.size > 0)) this.makeMusicDevice(me);
    return null;
  }

  /** hand the host role to another connected, non-screen human (used by makeHost and by the bots-away plugin) */
  transferHost(toId: string): string | null {
    const to = this.member(toId);
    if (!to) return 'no such member';
    if (to.screen || to.bot) return 'that member cannot be the host';
    if (to.conns.size === 0) return 'that member is not connected';
    const musicWasHost = this.host?.music ?? false;
    for (const x of this._members) x.host = x === to;
    if (musicWasHost && !this._members.some((x) => x.screen && x.conns.size > 0)) this.makeMusicDevice(to);
    return null;
  }
  private makeHost(me: Member, id: string): string | null {
    if (!me.host) return 'only the host can hand over hosting';
    if (id === me.id) return null;
    return this.transferHost(id);
  }

  private kick(me: Member, id: string): string | null {
    if (!me.host) return 'only the host can remove someone';
    if (id === me.id) return 'you cannot remove yourself';
    if (this.started) return 'players cannot be removed during a game';
    const t = this.member(id);
    if (!t) return 'no such member';
    this.removeMember(id);
    return null;
  }

  private profile(me: Member, msg: Extract<ClientMsg, { type: 'profile' }>): string | null {
    if (this.started) return 'the game has started';
    if (msg.name !== undefined) me.name = cleanText(msg.name, MAX_NAME) || me.name;
    if (msg.color && (PLAYER_COLORS as readonly string[]).includes(msg.color) && !this._members.some((x) => x !== me && x.color === msg.color)) me.color = msg.color;
    const n = this.logic.avatarLooks;
    if (msg.avatar !== undefined && Number.isInteger(msg.avatar) && msg.avatar >= 0 && msg.avatar < n) me.avatar = msg.avatar;
    if (msg.data && this.logic.cleanProfile) {
      const r = this.logic.cleanProfile(me.data, msg.data);
      if (typeof r === 'string') return r;
      me.data = r;
    }
    return null;
  }

  private setSettings(me: Member, patch: Partial<Settings>): string | null {
    if (!me.host) return 'only the host can change settings';
    if (this.started) return 'the game has started';
    const r = this.logic.cleanSettings(patch, this.settings, this.players().length);
    if (typeof r === 'string') return r;
    this.settings = r;
    return null;
  }

  private start(me: Member, now: number): string | null {
    if (!me.host) return 'only the host can start';
    if (this.started) return 'already started';
    const seats = this.players().map((m) => this.seatOf(m));
    if (seats.length < this.logic.minPlayers) return `need at least ${this.logic.minPlayers} players`;
    if (seats.length > this.logic.maxPlayers) return `at most ${this.logic.maxPlayers} players`;
    const seed = this.nextSeed();
    const r = this.logic.start({ seats, settings: this.settings, seed, now });
    if (!r.ok) return r.error;
    this.game = r.value; this.events = []; this.eventSeq++;
    for (const p of this.pluginList) p.onStart?.(this, now);
    return null;
  }

  private again(me: Member, now: number): string | null {
    if (!me.host) return 'only the host can start another game';
    if (!this.game) return 'no game to finish';
    if (!this.over && !this.logic.abandonable) return 'the game is not over yet';
    this.game = null; this.events = []; this.eventSeq++;
    for (const p of this.pluginList) p.onAgain?.(this, now);
    return null;
  }

  private act(me: Member, action: Action, now: number): string | null {
    if (!this.game) return 'the game has not started';
    if (me.role !== 'player' || me.screen) return 'spectators cannot play';
    return this.applyAct(me.id, action, now);
  }

  /** Apply an action as a given seat (also used by bots and away-takeover, which have no connection). */
  applyAct(seatId: string, action: Action, now: number): string | null {
    if (!this.game) return 'the game has not started';
    if (this.logic.isOver(this.game)) return 'the game is over';
    const r = this.logic.act(this.game, seatId, action, { now, seed: this.nextSeed(), hostId: this.host?.id ?? null });
    if (!r.ok) return r.error;
    this.game = r.value.state; this.events = r.value.events as unknown[]; this.eventSeq++;
    return null;
  }

  // ---------- time ----------
  /** Run timers. Returns true if anything changed (so the caller saves and broadcasts). */
  tick(now: number): boolean {
    let changed = false;
    for (const p of this.pluginList) if (p.tick?.(this, now)) changed = true;
    const g = this.game;
    if (g && !this.logic.isOver(g) && this.logic.tick) {
      const d = this.logic.deadline?.(g);
      if (d != null && now >= d) {
        const s = this.logic.tick(g, now, this.nextSeed());
        if (s) { this.game = s.state; this.events = s.events as unknown[]; this.eventSeq++; changed = true; }
      }
    }
    return changed;
  }
  /** The next time tick() has something to do, or null. */
  nextWake(now: number): number | null {
    let at: number | null = null;
    const min = (t: number | null | undefined) => { if (t != null && (at === null || t < at)) at = t; };
    if (this.game && !this.logic.isOver(this.game)) min(this.logic.deadline?.(this.game));
    for (const p of this.pluginList) min(p.nextWake?.(this, now));
    return at;
  }
  /** The Nap Guard froze the room for `ms`: push every deadline forward so nobody loses time. */
  shiftTime(ms: number): void {
    if (this.game && this.logic.shiftTime) this.game = this.logic.shiftTime(this.game, ms);
    for (const m of this._members) m.lastSeen += ms;
    for (const p of this.pluginList) p.shift?.(this, ms);
  }
  /** The game's own deadline, for clients to draw a countdown. */
  get deadline(): number | null { return this.game && this.logic.deadline ? this.logic.deadline(this.game) ?? null : null; }

  // ---------- views ----------
  info(m: Member): MemberInfo {
    const i: MemberInfo = { id: m.id, name: m.name, color: m.color, avatar: m.avatar, role: m.role, connected: m.conns.size > 0 || m.bot, host: m.host };
    if (m.screen) i.screen = true;
    if (m.cast) i.cast = true;
    if (m.music) i.music = true;
    if (m.bot) i.bot = true;
    if (m.away) i.away = true;
    if (Object.keys(m.data).length) i.data = m.data;
    for (const p of this.pluginList) p.decorate?.(m, i);
    return i;
  }

  /** The snapshot for one connection, or null if it has not said hello. */
  snapshot(conn: string, now = Date.now()): Snapshot<Settings, View> | null {
    const me = this.byConn(conn);
    if (!me) return null;
    const plugins: Record<string, unknown> = {};
    for (const p of this.pluginList) { const d = p.publicData?.(this); if (d !== undefined) plugins[p.id] = d; }
    const viewer = me.role === 'player' && !me.screen ? me.id : null;
    return {
      type: 'state', v: 1, code: this.code,
      you: { id: me.id, token: me.token, role: me.role, host: me.host, screen: me.screen, music: me.music },
      members: this._members.map((m) => this.info(m)),
      settings: this.settings, started: this.started, over: this.over,
      view: this.game ? this.logic.view(this.game, viewer) : null,
      events: this.events, eventSeq: this.eventSeq, deadline: this.deadline, serverNow: now, plugins,
    };
  }
}
