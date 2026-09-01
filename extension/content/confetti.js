// A short burst of confetti when a fill lands.
//
// Written by hand rather than pulled from a library: an MV3 extension may not
// load remote code, and shipping a whole animation package to draw forty
// rectangles is not a trade worth making.
//
// It draws on its own fixed canvas, above everything and deaf to the pointer,
// so the form underneath keeps working while it plays. The canvas is created
// for the burst and removed when the last piece falls out of view — nothing is
// left running on the page.

/* exported celebrate */

const CONFETTI_COLORS = ["#43507f", "#2968a5", "#779bc6", "#12bc59", "#69e889"];

/**
 * Throw confetti from `origin` (a viewport point; the panel, normally).
 *
 * Honours prefers-reduced-motion by doing nothing at all — the tick on each
 * payer card already says the same thing, so nobody loses information here.
 */
function celebrate(origin) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  if (document.getElementById("beond-confetti")) return; // one burst at a time

  const canvas = document.createElement("canvas");
  canvas.id = "beond-confetti";
  canvas.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483646";
  document.documentElement.appendChild(canvas);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const from = origin ?? { x: innerWidth / 2, y: innerHeight / 3 };
  const pieces = [];
  for (let i = 0; i < 70; i += 1) {
    // Fired up and out in a fan, with enough spread that the pieces separate
    // before gravity takes them.
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.7;
    const speed = 5 + Math.random() * 7;
    pieces.push({
      x: from.x,
      y: from.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: 5 + Math.random() * 5,
      h: 8 + Math.random() * 6,
      spin: (Math.random() - 0.5) * 0.3,
      tilt: Math.random() * Math.PI,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    });
  }

  const started = performance.now();
  let last = started;

  function frame(now) {
    // Scaled to a 60fps step so the fall looks the same on any refresh rate,
    // and clamped so a backgrounded tab does not teleport everything downwards.
    const step = Math.min((now - last) / 16.7, 3);
    last = now;
    const life = now - started;

    ctx.clearRect(0, 0, innerWidth, innerHeight);
    let visible = 0;
    for (const p of pieces) {
      p.vy += 0.28 * step; // gravity
      p.vx *= 0.995 ** step; // air
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.tilt += p.spin * step;
      if (p.y - p.h > innerHeight) continue;
      visible += 1;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.tilt);
      ctx.globalAlpha = Math.max(0, 1 - life / 2600);
      ctx.fillStyle = p.color;
      // Flip the height by the tilt so a flat rectangle reads as a spinning
      // ribbon rather than a sliding brick.
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.tilt)));
      ctx.restore();
    }

    if (visible && life < 2600) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
