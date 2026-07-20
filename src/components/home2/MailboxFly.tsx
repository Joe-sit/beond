// Prototype — flying segmented papers curving into an isometric mailbox/slot.
// Faithful port of the keyframers/shshaw CodePen (SCSS → scoped plain CSS,
// class names kept, keyframes prefixed mf-*). Pure CSS 3D, no JS animation.
// View at ?anim.

const PAPERS = 5;

// 5-deep nested .segment chain — each level is a horizontal slice that curls on
// its own via rotateX, so the sheet bends as it flies in then flattens.
function Segments({ depth = 5 }: { depth?: number }) {
  if (depth === 0) return null;
  return (
    <div className="segment">
      <Segments depth={depth - 1} />
    </div>
  );
}

const CSS = `
.mailbox-scene, .mailbox-scene *, .mailbox-scene *:before, .mailbox-scene *:after {
  box-sizing: border-box; position: relative;
}
.mailbox-scene * { transform-style: preserve-3d; }

.mailbox-scene {
  --duration: 3.2s;
  --stagger: .65s;
  --easing: cubic-bezier(.36,.07,.25,1);
  --offscreen: 130vmax;
  --color-bg: #EF735A;
  --color-blue: #384969;
  --color-shadow: #211842;
  display: flex; justify-content: center; align-items: center;
  min-height: 100dvh; width: 100%; overflow: hidden;
  background: var(--color-bg);
}

.mailbox-scene #app {
  height: 70vmin; width: 40vmin;
  display: flex; justify-content: center; align-items: center;
  transform: translateX(20vw) rotateX(-20deg) rotateY(-55deg);
  background: var(--color-blue);
  border-radius: 2vmin;
  perspective: 10000px;
}
.mailbox-scene #app:before {
  content: ''; position: absolute; height: 100%; width: 100%; top: 0; left: 0;
  border: 10vmin solid white; border-left-width: 2vmin; border-right-width: 2vmin;
  border-radius: inherit; background: var(--color-blue);
}
.mailbox-scene #app > .papers,
.mailbox-scene #app:before { transform: translateZ(3vmin); }
.mailbox-scene #app:after {
  content: ''; position: absolute; height: 100%; width: 100%; top: 0; left: 0;
  background: inherit; border-radius: inherit; transform: translateZ(1.5vmin);
}
.mailbox-scene #app > .shadow {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  transform-origin: bottom center; transform: rotateX(90deg);
  background: var(--color-shadow); border-radius: inherit;
}

.mailbox-scene .paper-shadow {
  background: var(--color-shadow); height: 50%; width: 100%; position: absolute;
  top: calc(100% + 3vmin); left: 0; transform-origin: top center;
  animation: mf-shadow-in var(--duration) var(--easing) infinite;
  animation-delay: calc(var(--i) * var(--stagger));
  animation-fill-mode: both;
}
@keyframes mf-shadow-in {
  0%, 5% { transform: scale(.8, 1) translateY(var(--offscreen)); }
  100% { transform: scale(.8, 0); }
}

.mailbox-scene .papers { width: 30vmin; height: 40vmin; background: white; }

.mailbox-scene .paper {
  --segments: 5; --segment: calc(100% * 1 / var(--segments));
  position: absolute; top: 0; left: 0; height: 100%; width: 100%;
  animation: mf-fly-in var(--duration) var(--easing) infinite;
  animation-delay: calc(var(--i) * var(--stagger));
}
@keyframes mf-fly-in {
  0%, 2% { transform: translateZ(var(--offscreen)) translateY(80%) rotateX(30deg); }
  80%, 100% { transform: translateZ(0px) translateY(0%) rotateX(0deg); }
}
.mailbox-scene .paper > .segment { height: var(--segment); }

.mailbox-scene .segment {
  --rotate: 20deg; height: 100%; transform-origin: top center; background: white;
  border: 1px solid rgba(0,0,0,0.2); border-top: none; border-bottom: none;
  animation: inherit; animation-name: mf-curve-paper;
}
.mailbox-scene .segment > .segment { top: 98%; }
@keyframes mf-curve-paper {
  0%, 2% { transform: rotateX(var(--rotate, 0deg)); }
  90%, 100% { transform: rotateX(0deg); }
}

.mailbox-scene .paper.-rogue { transform-origin: top center -5vmin; }
.mailbox-scene .paper.-rogue .segment { --rotate: 30deg; animation-name: mf-curve-rogue-paper; }
@keyframes mf-curve-rogue-paper {
  0%, 50% { transform: rotateX(var(--rotate)); }
  100% { transform: rotateX(0deg); }
}
.mailbox-scene .paper.-rogue > .segment {
  animation: inherit; animation-name: mf-rogue-paper; transform-origin: left top 20vmin;
}
@keyframes mf-rogue-paper {
  0%, 2% { transform: rotateX(1.5turn); }
  80%, 100% { transform: rotateX(0turn); }
}
`;

export default function MailboxFly() {
  return (
    <div className="mailbox-scene">
      <style>{CSS}</style>
      <div id="app">
        <div className="papers" style={{ ["--total" as string]: PAPERS }}>
          {Array.from({ length: PAPERS }).map((_, i) => (
            <div
              key={i}
              className={`paper${i === 0 ? " -rogue" : ""}`}
              style={{ ["--i" as string]: i }}
            >
              <Segments depth={5} />
            </div>
          ))}
        </div>
        <div className="shadow">
          {Array.from({ length: PAPERS }).map((_, i) => (
            <div key={i} className="paper-shadow" style={{ ["--i" as string]: i }} />
          ))}
        </div>
      </div>
    </div>
  );
}
