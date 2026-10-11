// The engine package. Two jobs: (1) re-export the shared helpers so every kit's `import ... from '@game/engine'` works,
// (2) export this game's own rules. Keep it free of browser and Worker APIs: it runs in both.
export * from '@gizmo564/engine-core/engine';
export * from './lucky';
export * from './roster';
