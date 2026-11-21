// iPhone/iPad: Web Audio alone is muted by the ring/silent switch. Playing the final mix through an ordinary
// <audio> element (media playback, like music or a video) ignores the switch — the same reason EROS is heard
// (its microphone switches the phone into 'call' audio). Same code in every When Love Responds work.
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const routes = [];

// Connect the final node of a work's mix to speakerOut(ctx) instead of ctx.destination.
export function speakerOut(ctx) {
  if (!IOS || !ctx.createMediaStreamDestination) return ctx.destination;
  const old = routes.find((r) => r.ctx === ctx);
  if (old) return old.bus;
  const bus = ctx.createGain();
  const dest = ctx.createMediaStreamDestination();
  // a safety limiter at the very end, so lifting the level never distorts
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1;
  bus.connect(lim); lim.connect(dest);
  const el = new Audio(); el.srcObject = dest.stream; el.setAttribute('playsinline', '');
  const r = { ctx, bus, lim, el, dest, fallback: false, mic: false };
  routes.push(r);
  wake();
  return bus;
}
let held = false;
// While a work turns its microphone on, iOS can refuse to start the mic if media playback is already running
// ("Failed to start the audio device"). Pause the speaker route for that moment, then resume.
export function holdSpeakers() { held = true; for (const r of routes) if (!r.fallback) r.el.pause(); }
export function releaseSpeakers() { held = false; wake(); }
function wake() {
  if (held) return;
  for (const r of routes) {
    if (r.fallback || r.mic || !r.el.paused) continue;
    // if the phone refuses this route, fall back to normal output (then sound needs the switch off)
    r.el.play().catch((e) => { if (e && e.name === 'NotAllowedError') return; r.fallback = true; r.lim.connect(r.ctx.destination); });
  }
}
if (IOS) {
  for (const e of ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown']) window.addEventListener(e, wake, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
}

// While a microphone is open (AGAPE's breath), the iPhone is already in 'call' audio: the silent switch no
// longer applies, and a media element would be sent to the quiet earpiece. So then play straight out, as EROS does.
const MIC_LIFT = 3.2;   // about +10 dB
export function setMicActive(on) {
  for (const r of routes) {
    if (r.mic === on) continue;
    r.mic = on;
    try { r.lim.disconnect(); } catch {}
    // iPhone plays quieter while the mic is open (it switches to 'call' volume), so lift the mix to make up for it
    r.bus.gain.setTargetAtTime(on ? MIC_LIFT : 1, r.ctx.currentTime, 0.05);
    if (on) { r.el.pause(); r.lim.connect(r.ctx.destination); }
    else if (r.fallback) r.lim.connect(r.ctx.destination);
    else { r.lim.connect(r.dest); wake(); }
  }
}
