"use strict";
// Plant engine. Coordinates: base at (0,0), up is negative y.
// A species is a list of stems (sampled curves) and slots in growth order.
// One slot = one completion: outline while open, leaf when done, flower on a reward.
const R2D = 180 / Math.PI,
  D2R = Math.PI / 180;
const f = (n) => Math.round(n * 10) / 10;
const f3 = (n) => Math.round(n * 1000) / 1000;

function cb(p0, p1, p2, p3, n = 28) {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      u = 1 - t;
    o.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return o;
}
function mkStem(pts) {
  const len = [0];
  for (let i = 1; i < pts.length; i++)
    len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, len, total: len[len.length - 1] };
}
function ptAt(st, t) {
  const L = Math.max(0, Math.min(1, t)) * st.total;
  let i = 1;
  while (i < st.len.length - 1 && st.len[i] < L) i++;
  const a = st.pts[i - 1],
    b = st.pts[i],
    seg = st.len[i] - st.len[i - 1] || 1,
    k = (L - st.len[i - 1]) / seg;
  return {
    x: a[0] + (b[0] - a[0]) * k,
    y: a[1] + (b[1] - a[1]) * k,
    a: Math.atan2(b[1] - a[1], b[0] - a[0]) * R2D,
    i,
  };
}
function subPath(st, t) {
  const e = ptAt(st, t);
  let d = "M" + f(st.pts[0][0]) + " " + f(st.pts[0][1]);
  for (let i = 1; i < e.i; i++) d += "L" + f(st.pts[i][0]) + " " + f(st.pts[i][1]);
  return d + "L" + f(e.x) + " " + f(e.y);
}
const poly = (pts) => "M" + pts.map((p) => f(p[0]) + " " + f(p[1])).join("L");

// ---- leaf shapes: drawn along +x from the origin -------------------------
function lens(L, wf, c1, c2) {
  const w = L * wf;
  return `M0 0C${f(L * c1)} ${f(-w * 1.3)} ${f(L * c2)} ${f(-w * 1.25)} ${f(L)} 0C${f(L * c2)} ${f(w * 1.25)} ${f(L * c1)} ${f(w * 1.3)} 0 0Z`;
}
const rib = (L, k = 0.86) => `<path class="vein" d="M0 0L${f(L * k)} 0"/>`;
const SHAPE = {
  oval: (L) => `<path class="lshape" d="${lens(L, 0.4, 0.16, 0.72)}"/>` + rib(L),
  broad: (L) => `<path class="lshape" d="${lens(L, 0.47, 0.06, 0.58)}"/>` + rib(L),
  pinna: (L) => `<path class="lshape" d="${lens(L, 0.24, 0.12, 0.6)}"/>`,
  lance: (L) => `<path class="lshape" d="${lens(L, 0.17, 0.3, 0.7)}"/>`,
  floret: (L) => `<path class="lshape" d="${lens(L, 0.36, 0.3, 0.75)}"/>`,
  heart: (L) => {
    const w = L * 0.47,
      n = L * 0.13;
    return (
      `<path class="lshape" d="M${f(n)} 0C${f(-L * 0.07)} ${f(-w * 0.75)} ${f(L * 0.16)} ${f(-w * 1.5)} ${f(L * 0.46)} ${f(-w * 0.98)}C${f(L * 0.72)} ${f(-w * 0.55)} ${f(L * 0.9)} ${f(-w * 0.2)} ${f(L)} 0C${f(L * 0.9)} ${f(w * 0.2)} ${f(L * 0.72)} ${f(w * 0.55)} ${f(L * 0.46)} ${f(w * 0.98)}C${f(L * 0.16)} ${f(w * 1.5)} ${f(-L * 0.07)} ${f(w * 0.75)} ${f(n)} 0Z"/>` +
      `<path class="vein" d="M${f(n)} 0L${f(L * 0.86)} 0"/>`
    );
  },
  pad: (L) => {
    const w = L * 0.4;
    const dots = [
      [0.34, -0.3],
      [0.56, 0.28],
      [0.74, -0.3],
      [0.5, -0.02],
      [0.82, 0.2],
    ]
      .map(([u, v]) => `<circle class="spk" cx="${f(L * u)}" cy="${f(w * v)}" r="${f(L * 0.022)}"/>`)
      .join("");
    return (
      `<path class="lshape" d="M0 0C${f(L * 0.1)} ${f(-w * 0.7)} ${f(L * 0.3)} ${f(-w * 1.2)} ${f(L * 0.6)} ${f(-w * 1.1)}C${f(L * 0.9)} ${f(-w)} ${f(L * 1.02)} ${f(-w * 0.45)} ${f(L)} 0C${f(L * 1.02)} ${f(w * 0.45)} ${f(L * 0.9)} ${f(w)} ${f(L * 0.6)} ${f(w * 1.1)}C${f(L * 0.3)} ${f(w * 1.2)} ${f(L * 0.1)} ${f(w * 0.7)} 0 0Z"/>` +
      dots
    );
  },
  // peltate leaf: L is the radius, the stalk meets it off-center
  round: (R) => {
    const c = R * 0.25;
    let v = "";
    for (let k = 0; k < 5; k++) {
      const a = (k * 72 + 36) * D2R;
      v += `M${f(c)} 0L${f(c + Math.cos(a) * R * 0.72)} ${f(Math.sin(a) * R * 0.72)}`;
    }
    return `<circle class="lshape" cx="${f(c)}" cy="0" r="${f(R)}"/><path class="vein" d="${v}"/>`;
  },
  trefoil: (L) =>
    [-62, 0, 62]
      .map((r) => `<path class="lshape" transform="rotate(${r})" d="${lens(L, 0.42, 0.2, 0.74)}"/>`)
      .join(""),
};
// a blade whose whole stalk is the leaf (chive): tapered outline around sampled points
function strap(pts, w0) {
  const L = [],
    Rr = [],
    n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      m = Math.hypot(dx, dy) || 1;
    const t = i / (n - 1),
      w = w0 * Math.pow(1 - t, 0.55) + 0.25;
    L.push([pts[i][0] - (dy / m) * w - pts[0][0], pts[i][1] + (dx / m) * w - pts[0][1]]);
    Rr.push([pts[i][0] + (dy / m) * w - pts[0][0], pts[i][1] - (dx / m) * w - pts[0][1]]);
  }
  return `<path class="lshape" d="${poly(L.concat(Rr.reverse()))}Z"/>`;
}

// ---- flowers ---------------------------------------------------------------
const LV = { small: 0.82, medium: 1, big: 1.26 };
function ring(n, R, kind, rot, cls) {
  let s = "";
  for (let k = 0; k < n; k++) {
    const a = rot + (k * 360) / n;
    if (kind === "disc") {
      const r = R * (n > 5 ? 0.36 : 0.47),
        d = R - r;
      s += `<circle class="${cls}" cx="${f(Math.cos(a * D2R) * d)}" cy="${f(Math.sin(a * D2R) * d)}" r="${f(r)}"/>`;
    } else {
      const wf = kind === "thin" ? 0.13 : kind === "wide" ? 0.34 : 0.24;
      s += `<path class="${cls}" transform="rotate(${f(a)})" d="${kind === "wide" ? lens(R, wf, 0.35, 0.95) : lens(R, wf, 0.3, 0.75)}"/>`;
    }
  }
  return s;
}
function bloom(sp, level, scale = 1) {
  const fl = sp.fl,
    R = fl.R * LV[level] * scale;
  let s = ring(fl.n, R, fl.kind, -90, "petal");
  if (level === "big") s += ring(fl.n, R * 0.6, fl.kind, -90 + 180 / fl.n, "petal2");
  const eye = `<circle class="eye" r="${f(R * (fl.eye || 0.24))}"/>`;
  return `<g class="bloom">${s}${eye}</g>`;
}

// ---- species ---------------------------------------------------------------
const SP = {},
  ORDER = [];
function def(key, name, note, ink, fl, fn) {
  const stems = [],
    slots = [];
  const P = (pts, o = {}) => {
    const st = mkStem(pts);
    st.parent = o.parent ?? -1;
    st.attach = o.attach ?? 0;
    st.w = o.w ?? 1;
    st.cls = o.cls || "";
    st.always = !!o.always;
    st.base = st.parent < 0 ? 0 : stems[st.parent].base + st.attach * stems[st.parent].total;
    stems.push(st);
    return stems.length - 1;
  };
  const S = (p0, p1, p2, p3, o) => P(cb(p0, p1, p2, p3), o);
  const at = (si, t) => {
    const p = ptAt(stems[si], t);
    return [p.x, p.y];
  };
  const tan = (si, t) => ptAt(stems[si], t).a;
  const leaf = (si, t, turn, L, shape, o = {}) => {
    const p = ptAt(stems[si], t);
    slots.push({
      x: p.x,
      y: p.y,
      a: o.abs ?? p.a + turn,
      L,
      shape,
      stem: si,
      t,
      d: stems[si].base + t * stems[si].total + (o.dd || 0),
      ...o,
    });
  };
  const own = (pts, L, shape, d, o = {}) => {
    const e = ptAt(mkStem(pts), 1);
    slots.push({ x: e.x, y: e.y, a: o.abs ?? e.a, L, shape, stalk: pts, d, ...o });
  };
  const free = (x, y, a, L, shape, d, o = {}) => slots.push({ x, y, a, L, shape, d, ...o });
  fn({ S, P, at, tan, leaf, own, free, stems, slots });
  slots.forEach((s, i) => (s.k = i));
  slots.sort((a, b) => a.d - b.d || a.k - b.k);
  // bounds at full growth
  let x0 = 1e9,
    x1 = -1e9,
    y0 = 1e9;
  const add = (x, y) => {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
  };
  stems.forEach((st) => st.pts.forEach((p) => add(p[0], p[1])));
  slots.forEach((s) => {
    if (s.stalk) s.stalk.forEach((p) => add(p[0], p[1]));
    const c = Math.cos(s.a * D2R),
      sn = Math.sin(s.a * D2R);
    if (s.shape === "round" || s.shape === "trefoil") {
      const r = s.L * 1.15;
      add(s.x - r, s.y - r);
      add(s.x + r, s.y - r);
    } else if (s.shape !== "strap") {
      const w = s.L * (s.shape === "pad" ? 0.44 : 0.3);
      add(s.x + c * s.L, s.y + sn * s.L);
      add(s.x + c * s.L * 0.5 - sn * w, s.y + sn * s.L * 0.5 + c * w);
      add(s.x + c * s.L * 0.5 + sn * w, s.y + sn * s.L * 0.5 - c * w);
    }
  });
  const m = fl.R * 0.9;
  x0 -= m;
  x1 += m;
  y0 -= m;
  SP[key] = { key, name, note, ink, fl, stems, slots, N: slots.length, W: x1 - x0, H: -y0, cx: (x0 + x1) / 2 };
  ORDER.push(key);
}

const INK = ["#294c3c", "#3c5a2e", "#24525a", "#34476a", "#553a63", "#5a4a2a"];

def("chive", "Chive", "Nine blades from one crown", INK[1], { n: 12, kind: "thin", R: 15, eye: 0.3 }, ({ own }) => {
  const hs = [236, 216, 222, 190, 198, 160, 170, 130, 138],
    th = [1, -8, 10, -17, 19, -27, 29, -38, 40];
  hs.forEach((h, i) => {
    const s = Math.sin(th[i] * D2R),
      c = Math.cos(th[i] * D2R),
      bx = th[i] * 0.3;
    own(
      cb([bx, 0], [bx + s * h * 0.12, -h * 0.42], [bx + s * h * 0.6, -c * h * 0.8], [bx + s * h, -c * h], 20),
      h,
      "strap",
      i,
      { keep: 1 },
    );
  });
});

def("pear", "Prickly Pear", "Nine stacked pads", INK[2], { n: 9, kind: "pt", R: 15, eye: 0.26 }, ({ free }) => {
  // [parent, u along parent, v across parent (+ is right), turn, length]
  const spec = [
    [-1, 0, 0, 0, 98],
    [0, 0.76, -0.86, -44, 72],
    [0, 0.8, 0.86, 38, 80],
    [1, 0.93, -0.3, -6, 56],
    [2, 0.7, 0.9, 50, 50],
    [2, 0.94, -0.35, -24, 62],
    [1, 0.56, -0.95, -58, 42],
    [5, 0.92, 0.3, 20, 42],
    [3, 0.86, -0.7, -40, 34],
  ];
  const pads = [];
  spec.forEach(([p, u, v, turn, L], i) => {
    let x = 0,
      y = 0,
      a = -90;
    if (p >= 0) {
      const q = pads[p],
        c = Math.cos(q.a * D2R),
        s = Math.sin(q.a * D2R),
        w = q.L * 0.4 * Math.sin(Math.PI * Math.pow(u, 0.85)) * v;
      x = q.x + c * q.L * u - s * w;
      y = q.y + s * q.L * u + c * w;
      a = q.a + turn;
    }
    pads.push({ x, y, a, L });
    free(x, y, a, L, "pad", i, { keep: 1 });
  });
});

def("pea", "Pea Shoot", "One stem, alternate leaves", INK[0], { n: 5, kind: "disc", R: 14, eye: 0.26 }, ({ S, leaf }) => {
  const s = S([0, 0], [12, -92], [-38, -172], [8, -262], { w: 1.25 });
  for (let i = 0; i < 10; i++) leaf(s, 0.13 + i * 0.094, (i % 2 ? 1 : -1) * (58 - i * 1.5), 47 - i * 2.4, "oval");
});

def("basil", "Basil", "One stem, six opposite pairs", INK[1], { n: 5, kind: "pt", R: 13, eye: 0.22 }, ({ S, leaf }) => {
  const s = S([0, 0], [6, -70], [-6, -150], [0, -228], { w: 1.4 });
  for (let n = 0; n < 6; n++) {
    const t = 0.17 + n * 0.16,
      L = 52 - n * 5.6;
    leaf(s, t, -64 + n * 4, L, "broad");
    leaf(s, t, 64 - n * 4, L, "broad");
  }
});

def("nasturtium", "Nasturtium", "Round leaves on long stalks", INK[3], { n: 5, kind: "wide", R: 17, eye: 0.2 }, ({ own }) => {
  const tiers = [
    [
      [-54, 74],
      [-24, 96],
      [6, 106],
      [34, 92],
      [62, 70],
    ],
    [
      [-80, 128],
      [-62, 150],
      [-43, 164],
      [-22, 176],
      [-2, 172],
      [20, 178],
      [42, 166],
      [62, 150],
      [80, 126],
    ],
  ];
  tiers.forEach((tier, ti) =>
    tier.forEach(([th, r]) => {
      const s = Math.sin(th * D2R),
        c = Math.cos(th * D2R);
      own(
        cb([0, 0], [s * r * 0.1, -r * 0.5], [s * r * 0.62, -c * r - r * 0.12], [s * r, -c * r - 8], 16),
        15 + r * 0.045,
        "round",
        ti * 100 + Math.abs(th),
        { abs: th - 90 },
      );
    }),
  );
});

def("strawberry", "Strawberry", "Three crowns on a runner", INK[4], { n: 5, kind: "disc", R: 15, eye: 0.34 }, ({ S, own }) => {
  const cx = [-74, 0, 74];
  const r1 = S([-74, -2], [-52, -28], [-22, -28], [0, -2], { cls: "runner", w: 0.8 });
  const r2 = S([0, -2], [22, -28], [52, -28], [74, -2], { cls: "runner", w: 0.8 });
  cx.forEach((x, ci) =>
    [
      [0, 84],
      [-33, 72],
      [33, 72],
      [-64, 54],
      [64, 54],
    ].forEach(([th, r], k) => {
      const s = Math.sin(th * D2R),
        c = Math.cos(th * D2R);
      own(cb([x, 0], [x + s * r * 0.1, -r * 0.5], [x + s * r * 0.7, -c * r * 0.95], [x + s * r, -c * r], 12), 23, "trefoil", ci * 100 + k, {
        abs: th - 90,
        needs: ci === 0 ? [] : ci === 1 ? [r1] : [r1, r2],
      });
    }),
  );
});

def("sweetpea", "Sweet Pea", "A vine winding up a cane", INK[5], { n: 4, kind: "wide", R: 14, eye: 0.18 }, ({ P, leaf }) => {
  P(
    [
      [0, 0],
      [0, -304],
    ],
    { cls: "cane", always: 1, w: 1 },
  );
  const pts = [];
  for (let i = 0; i <= 96; i++) {
    const u = i / 96;
    pts.push([17 * Math.sin(u * Math.PI * 2 * 4) * (0.75 + 0.25 * u), -u * 292]);
  }
  const v = P(pts, { w: 1.15 });
  for (let i = 0; i < 16; i++) {
    const right = i % 2 === 0;
    leaf(v, 0.085 + i * 0.058, 0, 31 - i * 0.55, "heart", { abs: right ? -26 - (i % 3) * 6 : -154 + (i % 3) * 6 });
  }
});

def("fennel", "Fennel", "Three umbels of six rays", INK[0], { n: 6, kind: "disc", R: 11, eye: 0.3 }, ({ S, at, tan, own }) => {
  const m = S([0, 0], [4, -44], [-4, -84], [0, -122], { w: 1.6 });
  const bl = S(at(m, 0.58), [-24, -98], [-58, -116], [-76, -160], { parent: m, attach: 0.58, w: 1.15 });
  const br = S(at(m, 0.8), [28, -114], [62, -134], [80, -176], { parent: m, attach: 0.8, w: 1.15 });
  const bc = S(at(m, 1), [0, -150], [3, -176], [0, -204], { parent: m, attach: 1, w: 1.15 });
  [bl, br, bc].forEach((b, bi) => {
    const h = at(b, 1),
      a0 = tan(b, 1);
    for (let k = 0; k < 6; k++) {
      const a = (a0 - 60 + k * 24) * D2R,
        len = 50 - Math.abs(k - 2.5) * 3,
        e = [h[0] + Math.cos(a) * len, h[1] + Math.sin(a) * len];
      own(cb(h, [h[0] + Math.cos(a) * len * 0.4, h[1] + Math.sin(a) * len * 0.3], [e[0], e[1] + 9], e, 8), 15, "floret", bi * 100 + Math.abs(k - 2.5), {
        needs: [b],
        abs: a * R2D * 0.5 - 45,
      });
    }
  });
});

def("lavender", "Lavender", "Five wands, florets at the top", INK[4], { n: 4, kind: "pt", R: 13, eye: 0.22 }, ({ S, leaf }) => {
  const th = [1, -13, 14, -27, 28],
    hs = [226, 208, 214, 184, 190];
  th.forEach((t, w) => {
    const s = Math.sin(t * D2R),
      c = Math.cos(t * D2R),
      h = hs[w],
      bx = t * 0.25;
    const st = S([bx, 0], [bx + s * h * 0.16, -h * 0.4], [bx + s * h * 0.62, -c * h * 0.8], [bx + s * h, -c * h], { w: 1.1 });
    [0.58, 0.71, 0.84, 0.97].forEach((tt, k) => leaf(st, tt, k === 3 ? 0 : (k % 2 ? 1 : -1) * 34, 23 - k * 1.5, "floret", { tip: k === 3 ? 0 : 0.03 }));
  });
});

def("fern", "Sword Fern", "Three fronds of paired pinnae", INK[2], { n: 6, kind: "pt", R: 12, eye: 0.22 }, ({ S, leaf }) => {
  [
    S([0, 0], [2, -110], [14, -206], [60, -250], { w: 1.3 }),
    S([0, 0], [-26, -86], [-82, -152], [-146, -136], { w: 1.3 }),
    S([0, 0], [30, -74], [92, -124], [150, -98], { w: 1.3 }),
  ].forEach((fr) => {
    for (let n = 0; n < 5; n++) {
      const t = 0.24 + n * 0.175,
        L = 40 - n * 5.5;
      leaf(fr, t, -76, L, "pinna");
      leaf(fr, t, 76, L, "pinna");
    }
  });
});

def("olive", "Olive", "A forked trunk, six twigs", INK[1], { n: 4, kind: "disc", R: 10, eye: 0.28 }, ({ S, at, leaf }) => {
  const tr = S([0, 0], [-9, -42], [11, -82], [0, -116], { w: 2.6 });
  const tw = [
    [S(at(tr, 0.56), [22, -82], [46, -94], [66, -116], { parent: tr, attach: 0.56, w: 1.2 }), 4],
    [S(at(tr, 1), [-16, -142], [-46, -160], [-80, -178], { parent: tr, attach: 1, w: 1.6 }), 5],
    [S(at(tr, 1), [16, -148], [42, -176], [72, -196], { parent: tr, attach: 1, w: 1.6 }), 5],
    [S(at(tr, 0.94), [4, -160], [-10, -206], [2, -246], { parent: tr, attach: 0.94, w: 1.5 }), 6],
  ];
  tw.push([S(at(tw[1][0], 0.5), [-44, -186], [-40, -212], [-54, -236], { parent: tw[1][0], attach: 0.5, w: 1.1 }), 4]);
  tw.push([S(at(tw[2][0], 0.45), [36, -198], [44, -222], [34, -248], { parent: tw[2][0], attach: 0.45, w: 1.1 }), 4]);
  tw.forEach(([st, n]) => {
    for (let k = 0; k < n; k++) {
      const last = k === n - 1;
      leaf(st, last ? 1 : 0.34 + (k * 0.62) / (n - 1), last ? 0 : (k % 2 ? 1 : -1) * 50, 25, "lance", { tip: 0 });
    }
  });
});

def("willow", "Willow", "Six weeping boughs", INK[3], { n: 8, kind: "thin", R: 11, eye: 0.3 }, ({ S, at, leaf }) => {
  const tr = S([0, 0], [7, -64], [-13, -124], [-2, -182], { w: 3.1 });
  [
    [-128, 0.84],
    [-84, 0.92],
    [-40, 1],
    [42, 1],
    [88, 0.92],
    [132, 0.84],
  ].forEach(([r, t]) => {
    const p = at(tr, t),
      ar = Math.abs(r);
    const b = S(p, [p[0] + r * 0.4, p[1] - 58 - ar * 0.16], [p[0] + r * 1.02, p[1] - 34], [p[0] + r * 1.05, p[1] + 86 + (132 - ar) * 0.42], {
      parent: 0,
      attach: t,
      w: 1.25,
    });
    for (let k = 0; k < 6; k++) leaf(b, 0.44 + k * 0.112, k === 5 ? 0 : (k % 2 ? 1 : -1) * 26, 26, "lance", { tip: k === 5 ? 0 : 0.03 });
  });
});

// ---- rendering -------------------------------------------------------------
function extents(sp, vis) {
  const ext = sp.stems.map((s) => (s.always ? 1 : 0));
  const need = (si, t) => {
    while (si >= 0) {
      if (ext[si] < t) ext[si] = t;
      t = sp.stems[si].attach;
      si = sp.stems[si].parent;
    }
  };
  for (let i = 0; i < vis; i++) {
    const sl = sp.slots[i];
    if (sl.stem != null) need(sl.stem, Math.min(1, sl.t + (sl.tip ?? 0.035)));
    if (sl.needs) sl.needs.forEach((si) => need(si, 1));
  }
  return ext;
}

// o: {x, y, fitW, fitH, marks:[{level}], open, live, previous}
function plant(key, o) {
  const sp = SP[key],
    marks = o.marks,
    n = Math.min(marks.length, sp.N),
    open = Math.max(0, Math.min(o.open, sp.N - n)),
    vis = n + open,
    ext = extents(sp, vis);
  const previous = o.previous === undefined ? ext : extents(sp, o.previous);
  const s = Math.min(o.fitW / sp.W, o.fitH / sp.H);
  const baseX = f(o.x - s * sp.cx);
  let g = "";
  sp.stems.forEach((st, i) => {
    if (ext[i] <= 0) return;
    const was = previous[i],
      grow = was < ext[i] - 0.001;
    g += `<path class="stem ${st.cls}${grow ? " grow" : ""}"${grow ? ' pathLength="1"' : ""} style="--w:${st.w}${grow ? ";--from:" + f3(1 - was / ext[i]) : ""}" d="${subPath(st, ext[i])}"/>`;
  });
  if (vis === 0) g += `<path class="stem sprout" style="--w:1.2" d="M0 0C1 -7 -3 -13 2 -19C4 -22 8 -21 8 -18"/>`;
  for (let i = 0; i < vis; i++) {
    const sl = sp.slots[i],
      state = i < n ? (marks[i] && marks[i].level ? "flower" : "leaf") : "open",
      level = state === "flower" ? marks[i].level : null,
      enter = o.previous !== undefined && i < n && i >= o.previous;
    let stalk = "",
      body,
      tf;
    if (sl.shape === "strap") {
      tf = `translate(${f(sl.stalk[0][0])} ${f(sl.stalk[0][1])})`;
      body = strap(sl.stalk, 3.4);
      if (level) body += `<g transform="translate(${f(sl.x - sl.stalk[0][0])} ${f(sl.y - sl.stalk[0][1])})">${bloom(sp, level)}</g>`;
    } else {
      tf = `translate(${f(sl.x)} ${f(sl.y)}) rotate(${f(sl.a)})`;
      if (sl.stalk) stalk = `<path class="stalk" d="${poly(sl.stalk)}"/>`;
      if (!level) body = SHAPE[sl.shape](sl.L);
      else if (sl.keep) body = SHAPE[sl.shape](sl.L) + `<g transform="translate(${f(sl.L + sp.fl.R * 0.25)} 0)">${bloom(sp, level)}</g>`;
      else {
        const ped = sl.stalk ? 0 : Math.max(9, sl.L * 0.42),
          R = sp.fl.R * LV[level];
        body = (ped ? `<path class="ped" d="M0 0L${f(ped)} 0"/>` : "") + `<g transform="translate(${f(ped + (ped ? R * 0.55 : 0))} 0)">${bloom(sp, level)}</g>`;
      }
    }
    const interactive = o.live && i < n;
    const hit = interactive && sl.shape !== "strap" && sl.L < 30 ? `<circle class="hit" cx="${f(sl.shape === "round" ? 0 : sl.L * 0.5)}" cy="0" r="13"/>` : "";
    g +=
      `<g class="slot ${state}${level ? " lv-" + level : ""}"${interactive ? ` data-i="${i}" tabindex="0" role="button" aria-label="Inspect ${state} ${i + 1}"` : ""}>${stalk}` +
      `<g transform="${tf}"><g class="lf" style="--d:${f(-((i * 1.37) % 7))}s;--p:${f(6.2 + ((i * 0.83) % 3))}s"><g class="gr${enter ? " enter" : ""}">${hit}${body}</g></g></g></g>`;
  }
  const roots = o.live ? `<path class="root" transform="translate(${baseX} ${o.y})" d="M0 0c-2 5-8 6-10 12M0 0c1 6-2 9 1 14M0 0c3 4 8 5 10 11"/>` : "";
  return `${roots}<g class="plant" transform="translate(${baseX} ${o.y}) scale(${f3(s)})" style="--k:${f3(1 / s)}"><g class="sway">${g}</g></g>`;
}

export const seedPackets = ORDER.map((key) => ({
  key,
  name: SP[key].name,
  note: SP[key].note,
  capacity: SP[key].N,
}));

export const drawSpecimen = (key, levels, open, interactive, previous) =>
  plant(key, {
    x: 144, y: 186, fitW: 238, fitH: 164,
    marks: levels.map((level) => ({ level })),
    open,
    live: interactive,
    previous,
  });
