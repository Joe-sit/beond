// Projects the CSS-3D hero staircase (see Stairs3D) to a flat SVG using the same
// camera parameters, so a dialled-in look in the ?stairs tuner can be exported as
// a plain vector asset. Reproduces CSS's `scale · rotateX · rotateY · rotateZ`
// then `perspective(d)` projection, and paints the cuboid faces back-to-front.
export interface StairsParams {
  rx: number; ry: number; rz: number; persp: number; scale: number;
  w: number; tread: number; rise: number; count: number;
}

// Hero palette, lit from above (mirrors Stairs3D's HERO + extra back/bottom).
const COL = {
  top: "#FDFDFE",
  riser: "#EDEDF1",
  back: "#E2E2E8",
  side: "#D6D6DC",
  bottom: "#C4C4CC",
};

type V3 = [number, number, number];
const deg = (d: number) => (d * Math.PI) / 180;

function rotZ([x, y, z]: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c - y * s, x * s + y * c, z];
}
function rotY([x, y, z]: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c + z * s, y, -x * s + z * c];
}
function rotX([x, y, z]: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [x, y * c - z * s, y * s + z * c];
}

export function buildStairsSvg(p: StairsParams): string {
  const { rx, ry, rz, persp, scale, w, tread, rise, count } = p;

  // Transform a local corner exactly like the CSS: Rz → Ry → Rx → scale, then
  // perspective-divide (camera on +Z at distance `persp`).
  const project = (v: V3): { x: number; y: number; z: number } => {
    let t = rotZ(v, deg(rz));
    t = rotY(t, deg(ry));
    t = rotX(t, deg(rx));
    t = [t[0] * scale, t[1] * scale, t[2] * scale];
    const denom = 1 - t[2] / persp;
    return { x: t[0] / denom, y: t[1] / denom, z: t[2] };
  };

  type Face = { pts: { x: number; y: number }[]; z: number; fill: string };
  const faces: Face[] = [];

  for (let i = 0; i < count; i++) {
    const H = (i + 1) * rise; // full height from the ground (up = −y)
    const zF = -i * tread; // front plane
    const zB = zF - tread; // back plane
    const c: V3[] = [
      [-w / 2, 0, zF], [w / 2, 0, zF], [w / 2, -H, zF], [-w / 2, -H, zF], // front 0..3
      [-w / 2, 0, zB], [w / 2, 0, zB], [w / 2, -H, zB], [-w / 2, -H, zB], // back  4..7
    ];
    const P = c.map(project);
    const quad = (idx: number[], fill: string) => {
      faces.push({
        pts: idx.map((k) => ({ x: P[k].x, y: P[k].y })),
        z: idx.reduce((s, k) => s + P[k].z, 0) / idx.length,
        fill,
      });
    };
    quad([0, 1, 2, 3], COL.riser); // front
    quad([4, 5, 6, 7], COL.back); // back
    quad([3, 2, 6, 7], COL.top); // top
    quad([0, 1, 5, 4], COL.bottom); // bottom
    quad([0, 3, 7, 4], COL.side); // left
    quad([1, 2, 6, 5], COL.side); // right
  }

  // Painter's algorithm: draw far (small z) first so near faces cover them.
  faces.sort((a, b) => a.z - b.z);

  const all = faces.flatMap((f) => f.pts);
  const pad = 8;
  const minX = Math.min(...all.map((q) => q.x)) - pad;
  const minY = Math.min(...all.map((q) => q.y)) - pad;
  const maxX = Math.max(...all.map((q) => q.x)) + pad;
  const maxY = Math.max(...all.map((q) => q.y)) + pad;
  const vw = maxX - minX, vh = maxY - minY;

  const body = faces
    .map((f) => {
      const pts = f.pts.map((q) => `${(q.x - minX).toFixed(2)},${(q.y - minY).toFixed(2)}`).join(" ");
      return `  <polygon points="${pts}" fill="${f.fill}" stroke="rgba(0,0,0,0.06)" stroke-width="1"/>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw.toFixed(2)} ${vh.toFixed(2)}" width="${vw.toFixed(0)}" height="${vh.toFixed(0)}">
${body}
</svg>
`;
}
