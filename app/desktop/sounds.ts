export type Sound = "click" | "open" | "close" | "notice" | "error" | "celebrate";
let enabled = false, volume = 0.3, context: AudioContext | null = null, last = -Infinity;
export function configureSound(next: { sound: boolean; volume: number }) { enabled = next.sound; volume = next.volume; }
export function unlockSound() {
  if (!enabled) return;
  try {
    const Constructor = window.AudioContext || (window as any).webkitAudioContext;
    if (Constructor && !context) context = new Constructor();
    if (context?.state === "suspended") void context.resume().catch(() => {});
  } catch { /* A browser may deny audio without an active gesture. */ }
}
export function disposeSound() { if (context) void context.close().catch(() => {}); context = null; last = -Infinity; enabled = false; }
export function systemSound(kind: Sound) {
  if (!enabled || volume <= 0 || !context || context.state !== "running" || performance.now() - last < 160) return;
  last = performance.now();
  const notes: Record<Sound, number[]> = { click: [880], open: [440, 660], close: [660, 440], notice: [523.25, 1046.5], error: [196, 146.83], celebrate: [523.25, 659.25, 783.99, 1046.5] };
  try {
    const ctx = context;
    notes[kind].forEach((frequency, index) => {
      const start = ctx.currentTime + index * 0.065, duration = kind === "click" ? 0.035 : 0.1;
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = "triangle"; osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start); gain.gain.linearRampToValueAtTime(volume * 0.12, start + 0.004); gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(start); osc.stop(start + duration);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    });
  } catch { /* Sound never blocks an app action. */ }
}
