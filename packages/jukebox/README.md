# jukebox

A shared song list, a rolling-out panel (Auto + each song + a volume slider) and a room plugin, so the host can pick the background music and the TV plays it.

The songs live on one music host (`music.0801564.xyz`, see the `music-site` project): a small `tracks.json` names every song, so adding or renaming one needs no game rebuild.

```ts
// web: wire it to the game's audio kit (needs @gizmo564/audio >= 0.1.3)
import { createJukebox, JukeboxPanel } from '@gizmo564/jukebox/web';
import '@gizmo564/jukebox/web/jukebox.css';
export const jukebox = createJukebox(audio);          // audio = your createAudio(...)
<JukeboxPanel jukebox={jukebox} />                    // this device's own sound (phones with no TV)
```

**Auto** means the game's own music (lobby, playing, results...). Picking a song plays it instead for as long as the game wants music; stings and sound effects are never touched. Volume is for the music only and is remembered on each device.

**With a TV** (room games): add `jukeboxPlugin()` from `@gizmo564/jukebox/server` to the room's `plugins`. The host's phone shows `<JukeboxPanel remote={{ track, volume, onTrack, onVolume }}>` and sends `{ type: 'jukebox', track?, volume? }`; every device reads `jukeboxFromPlugins(snap.plugins)`, and the music device calls `jukebox.apply(shared)`.
