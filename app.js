const { RULES, createField, step, describe, shrinkWrap } = window.FieldModel;

const canvas = document.querySelector("#field");
const ctx = canvas.getContext("2d");
const signCanvas = document.querySelector("#sign");
const stage = canvas.parentElement;
const hint = document.querySelector("#sign-hint");
const reading = document.querySelector("#reading");
const measure = document.querySelector("#measure");
const fixed = document.querySelector("#fixed");
const holdButton = document.querySelector("#hold");
const signButton = document.querySelector("#mode-sign");
const turnButton = document.querySelector("#mode-turn");
const doneButton = document.querySelector("#sign-done");
const ruleCanvas = document.querySelector("#rule-cube");
const ruleCtx = ruleCanvas.getContext("2d");
const ruleCaption = document.querySelector("#rule-caption");

const BOID = "#fe4d7b";
const HALF = RULES.half;
const SIDE = HALF * 2;
const CAMERA_NEAR = 390;
const CAMERA_FAR = 1900;
let CAMERA_Z = 820;
const FOCAL = 760;

// Each face: outward normal, origin corner, and unit axes. u is right, v is up, seen from outside.
const FACES = [
  { n: [0, 0, 1], o: [-HALF, -HALF, HALF], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], o: [HALF, -HALF, -HALF], u: [-1, 0, 0], v: [0, 1, 0] },
  { n: [1, 0, 0], o: [HALF, -HALF, HALF], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], o: [-HALF, -HALF, -HALF], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], o: [-HALF, HALF, -HALF], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, -1, 0], o: [-HALF, -HALF, HALF], u: [1, 0, 0], v: [0, 0, -1] },
];

const EDGES = [
  [-1, -1, -1, 1, -1, -1], [-1, 1, -1, 1, 1, -1], [-1, -1, 1, 1, -1, 1], [-1, 1, 1, 1, 1, 1],
  [-1, -1, -1, -1, 1, -1], [1, -1, -1, 1, 1, -1], [-1, -1, 1, -1, 1, 1], [1, -1, 1, 1, 1, 1],
  [-1, -1, -1, -1, -1, 1], [1, -1, -1, 1, -1, 1], [-1, 1, -1, -1, 1, 1], [1, 1, -1, 1, 1, 1],
];

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let world = null;
let paused = reducedMotion;
let seed = 4;
let stats = { spread: 0, align: 0 };
let frame = 0;
let points = [];
let signed = null;
let drawing = false;
let turning = false;
let mode = "sign";
let yaw = 0;
let pitch = 0;
let cubeYaw = 0.62;
let cubePitch = 0.42;
let lastPointer = null;
let metAt = null;
let settled = false;
let wrapMesh = null;
let wrapAt = null;
const SETTLE_AFTER = 5;
const PATHS_BEFORE_WRAP = 2.2;

function clamp(value, lo = 0, hi = 1) {
  return Math.min(hi, Math.max(lo, value));
}

function measureSignature(pts, w, h) {
  const drawn = pts.filter((point) => Number.isFinite(point.x));
  if (drawn.length < 4) return null;
  let cx = 0;
  let cy = 0;
  for (const point of drawn) {
    cx += point.x;
    cy += point.y;
  }
  cx /= drawn.length;
  cy /= drawn.length;
  let mean = 0;
  let length = 0;
  let agree = 0;
  let agreeCount = 0;
  let previous = null;
  for (const point of pts) {
    mean += Math.hypot(point.x - cx, point.y - cy);
    if (point.break || !previous) {
      previous = { x: point.x, y: point.y, sx: 0, sy: 0, span: 0 };
      continue;
    }
    const sx = point.x - previous.x;
    const sy = point.y - previous.y;
    const span = Math.hypot(sx, sy);
    length += span;
    if (previous.span > 0.5 && span > 0.5) {
      agree += (previous.sx * sx + previous.sy * sy) / (previous.span * span);
      agreeCount += 1;
    }
    previous = { x: point.x, y: point.y, sx, sy, span };
  }
  mean /= pts.length;
  const diagonal = Math.hypot(w, h) || 1;
  const rawAgree = agreeCount ? agree / agreeCount : 0;
  return {
    attract: clamp(1 - mean / (diagonal * 0.2)),
    repel: clamp(length / (diagonal * 1.7)),
    mimic: clamp((rawAgree - 0.2) / 0.75),
  };
}

function strength() {
  if (!signed) return { attract: 0, repel: 0, mimic: 0, free: true };
  return signed;
}

function word(value) {
  if (value < 0.08) return "off";
  if (value < 0.3) return "faint";
  if (value < 0.55) return "present";
  if (value < 0.8) return "strong";
  return "dominant";
}

function paintReadouts() {
  const now = strength();
  paintRuleCube(now.attract, now.repel, now.mimic);
  ruleCaption.textContent = `The signature sits in the cube at attraction ${word(now.attract)} ${now.attract.toFixed(2)}, repulsion ${word(now.repel)} ${now.repel.toFixed(2)}, mimicry ${word(now.mimic)} ${now.mimic.toFixed(2)}.`;
}

function paintRuleCube(attract, repel, mimic) {
  const cssW = ruleCanvas.clientWidth || 280;
  const cssH = ruleCanvas.clientHeight || 220;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ruleCanvas.width = Math.round(cssW * dpr);
  ruleCanvas.height = Math.round(cssH * dpr);
  ruleCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ruleCtx.clearRect(0, 0, cssW, cssH);

  const yaw = -0.62;
  const pitch = 0.46;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const scale = Math.min(cssW, cssH) * 0.58;
  const project = (x, y, z) => {
    const px = x - 0.5;
    const py = y - 0.5;
    const pz = z - 0.5;
    const x1 = px * cy - pz * sy;
    const z1 = px * sy + pz * cy;
    const y1 = py * cp - z1 * sp;
    const z2 = py * sp + z1 * cp;
    return { x: cssW * 0.5 + x1 * scale, y: cssH * 0.5 - y1 * scale, depth: z2 };
  };
  const corners = [];
  for (let z = 0; z <= 1; z++) {
    for (let y = 0; y <= 1; y++) {
      for (let x = 0; x <= 1; x++) corners.push(project(x, y, z));
    }
  }
  const edges = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  ruleCtx.lineWidth = 1;
  ruleCtx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  for (const [a, b] of edges) {
    ruleCtx.beginPath();
    ruleCtx.moveTo(corners[a].x, corners[a].y);
    ruleCtx.lineTo(corners[b].x, corners[b].y);
    ruleCtx.stroke();
  }

  ruleCtx.lineWidth = 1.4;
  const axes = [
    [[0, 0, 0], [1, 0, 0], "rgba(254, 77, 123, 0.45)"],
    [[0, 0, 0], [0, 1, 0], "rgba(2, 255, 196, 0.45)"],
    [[0, 0, 0], [0, 0, 1], "rgba(255, 255, 255, 0.45)"],
  ];
  for (const [a, b, color] of axes) {
    const pa = project(a[0], a[1], a[2]);
    const pb = project(b[0], b[1], b[2]);
    ruleCtx.strokeStyle = color;
    ruleCtx.beginPath();
    ruleCtx.moveTo(pa.x, pa.y);
    ruleCtx.lineTo(pb.x, pb.y);
    ruleCtx.stroke();
  }

  const box = [
    [[0, 0, 0], [attract, 0, 0], "#fe4d7b"],
    [[0, 0, 0], [0, repel, 0], "#02ffc4"],
    [[0, 0, 0], [0, 0, mimic], "#ffffff"],
    [[attract, 0, 0], [attract, repel, 0], "rgba(2, 255, 196, 0.85)"],
    [[0, repel, 0], [attract, repel, 0], "rgba(254, 77, 123, 0.85)"],
    [[attract, 0, mimic], [attract, repel, mimic], "rgba(2, 255, 196, 0.85)"],
    [[0, repel, mimic], [attract, repel, mimic], "rgba(254, 77, 123, 0.85)"],
    [[attract, 0, 0], [attract, 0, mimic], "rgba(255, 255, 255, 0.8)"],
    [[0, repel, 0], [0, repel, mimic], "rgba(255, 255, 255, 0.8)"],
    [[0, 0, mimic], [attract, 0, mimic], "rgba(254, 77, 123, 0.85)"],
    [[0, 0, mimic], [0, repel, mimic], "rgba(2, 255, 196, 0.85)"],
    [[attract, repel, 0], [attract, repel, mimic], "rgba(255, 255, 255, 0.8)"],
  ];
  ruleCtx.lineWidth = 1.6;
  for (const [a, b, color] of box) {
    const pa = project(a[0], a[1], a[2]);
    const pb = project(b[0], b[1], b[2]);
    ruleCtx.strokeStyle = color;
    ruleCtx.beginPath();
    ruleCtx.moveTo(pa.x, pa.y);
    ruleCtx.lineTo(pb.x, pb.y);
    ruleCtx.stroke();
  }

  const mark = project(attract, repel, mimic);
  ruleCtx.fillStyle = "#fe4d7b";
  ruleCtx.beginPath();
  ruleCtx.arc(mark.x, mark.y, 3.5, 0, Math.PI * 2);
  ruleCtx.fill();

  ruleCtx.font = "600 10px \"Avenir Next\", Avenir, sans-serif";
  ruleCtx.textBaseline = "middle";
  const center = project(0.5, 0.5, 0.5);
  const labels = [
    [1, 0, 0, "ATTRACT", "#fe4d7b"],
    [0, 1, 0, "REPEL", "#02ffc4"],
    [0, 0, 1, "MIMIC", "#ffffff"],
  ];
  for (const [x, y, z, text, color] of labels) {
    const point = project(x, y, z);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const span = Math.hypot(dx, dy) || 1;
    ruleCtx.fillStyle = color;
    ruleCtx.textAlign = dx >= 0 ? "left" : "right";
    ruleCtx.fillText(text, point.x + (dx / span) * 18, point.y + (dy / span) * 14);
  }
}

function writeLedger() {
  fixed.innerHTML = [
    `Ours. ${RULES.count} marks, all of them inside the cube. The count is a choice, not a finding.`,
    `Ours. The cube is ${SIDE} units on a side. Leaving it is not allowed.`,
    `Ball. Attraction looks ${RULES.neighborRadius} units out, a local constraint. The distance is ours.`,
    `Ball. Repulsion between marks acts only inside ${RULES.repelRadius} units. The distance is ours.`,
    `Kwinter. Mimicry copies a heading already in motion. How far it looks is ours.`,
    `Ours. Marks hold ${RULES.cruise.toFixed(2)} units per step. Speed does not fall after the signature.`,
    `Ours. A trail begins only after a mark meets the ink, and the trail stays. Five seconds after the marks meet, the cube leaves. The paths are shown, then shrink-wrapped. That skin is the final form.`,
    `Ours. The signature is copied onto all six faces. Every stroke is followed.`,
    `Ours. A mark travels its stroke to the end. There, the marks on that stroke are drawn to each other.`,
    `Ours. Until you sign, the marks stay evenly spaced and move freely. The three variables wait.`,
    "Ours. A beginning is a seeded set of positions and directions. Replay repeats it. Another beginning changes only the start.",
    "Ours. There is no randomness after the start. If the figure surprises you, the rules and the start still determined it.",
  ].map((line) => `<li>${line}</li>`).join("");
}

function sizeSurface(surface, context, w, h) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  surface.width = Math.round(w * dpr);
  surface.height = Math.round(h * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resize() {
  const rect = stage.getBoundingClientRect();
  const w = Math.max(2, rect.width);
  const h = Math.max(2, rect.height);
  sizeSurface(canvas, ctx, w, h);
  signCanvas.width = canvas.width;
  signCanvas.height = canvas.height;
  if (!world) world = createField(seed);
  draw();
  paintReadouts();
}

function cosYaw() { return Math.cos(yaw); }
function sinYaw() { return Math.sin(yaw); }
function cosPitch() { return Math.cos(pitch); }
function sinPitch() { return Math.sin(pitch); }

function toCamera(x, y, z) {
  const x1 = x * cosYaw() + z * sinYaw();
  const z1 = -x * sinYaw() + z * cosYaw();
  return {
    x: x1,
    y: y * cosPitch() - z1 * sinPitch(),
    z: y * sinPitch() + z1 * cosPitch(),
  };
}

function cameraToWorld(x, y, z) {
  const y1 = y * cosPitch() + z * sinPitch();
  const z1 = -y * sinPitch() + z * cosPitch();
  return {
    x: x * cosYaw() - z1 * sinYaw(),
    y: y1,
    z: x * sinYaw() + z1 * cosYaw(),
  };
}

function arrowOutline(x, y, z, vx, vy, vz) {
  const speed = Math.hypot(vx, vy, vz) || 1;
  const origin = project(x, y, z);
  const ahead = project(x + vx / speed * 10, y + vy / speed * 10, z + vz / speed * 10);
  let dx = ahead.x - origin.x;
  let dy = ahead.y - origin.y;
  let span = Math.hypot(dx, dy);
  if (span < 0.4) {
    dx = 1;
    dy = 0;
    span = 1;
  }
  const ux = dx / span;
  const uy = dy / span;
  const px = -uy;
  const py = ux;
  const size = 11 * Math.max(0.75, Math.min(1.25, origin.s));
  const forward = size * 0.52;
  const back = size * 0.3;
  const head = size * 0.5;
  const barb = size * 0.42;
  const shaft = size * 0.12;
  const at = (along, across) => [
    origin.x + ux * along + px * across,
    origin.y + uy * along + py * across,
  ];
  return {
    poly: [
      at(forward, 0),
      at(forward - head, barb),
      at(forward - head, shaft),
      at(-back, shaft),
      at(-back, -shaft),
      at(forward - head, -shaft),
      at(forward - head, -barb),
    ],
    depth: origin.depth,
  };
}

function planScale() {
  const span = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.68;
  return span / SIDE;
}

function project(x, y, z) {
  if (mode === "sign" && !settled) {
    const s = planScale();
    return {
      x: canvas.clientWidth / 2 + x * s,
      y: canvas.clientHeight / 2 - y * s,
      depth: HALF - z,
      s,
    };
  }
  const p = toCamera(x, y, z);
  const depth = CAMERA_Z - p.z;
  const s = FOCAL / Math.max(40, depth);
  return {
    x: canvas.clientWidth / 2 + p.x * s,
    y: canvas.clientHeight / 2 - p.y * s,
    depth,
    s,
  };
}

function uvToWorld(face, u, v) {
  return {
    x: face.o[0] + (face.u[0] * u + face.v[0] * v) * SIDE,
    y: face.o[1] + (face.u[1] * u + face.v[1] * v) * SIDE,
    z: face.o[2] + (face.u[2] * u + face.v[2] * v) * SIDE,
  };
}

function frontFace() {
  const cam = cameraToWorld(0, 0, CAMERA_Z);
  let best = FACES[0];
  let bestDot = -Infinity;
  for (const face of FACES) {
    const dot = face.n[0] * cam.x + face.n[1] * cam.y + face.n[2] * cam.z;
    if (dot > bestDot) {
      bestDot = dot;
      best = face;
    }
  }
  return best;
}

function pointerUV(event) {
  const rect = signCanvas.getBoundingClientRect();
  const sx = event.clientX - rect.left - canvas.clientWidth / 2;
  const sy = -(event.clientY - rect.top - canvas.clientHeight / 2);
  if (mode === "sign") {
    const s = planScale();
    const u = (sx / s + HALF) / SIDE;
    const v = (sy / s + HALF) / SIDE;
    if (u < -0.01 || u > 1.01 || v < -0.01 || v > 1.01) return null;
    return { u: clamp(u), v: clamp(v), break: false };
  }
  const dirC = { x: sx, y: sy, z: -FOCAL };
  const len = Math.hypot(dirC.x, dirC.y, dirC.z) || 1;
  const origin = cameraToWorld(0, 0, CAMERA_Z);
  const dir = cameraToWorld(dirC.x / len, dirC.y / len, dirC.z / len);
  const face = frontFace();
  const denom = dir.x * face.n[0] + dir.y * face.n[1] + dir.z * face.n[2];
  if (Math.abs(denom) < 1e-5) return null;
  const plane = HALF;
  const t = (face.n[0] * (face.n[0] * plane - origin.x) + face.n[1] * (face.n[1] * plane - origin.y) + face.n[2] * (face.n[2] * plane - origin.z)) / denom;
  if (t <= 0) return null;
  const x = origin.x + dir.x * t;
  const y = origin.y + dir.y * t;
  const z = origin.z + dir.z * t;
  const lx = x - face.o[0];
  const ly = y - face.o[1];
  const lz = z - face.o[2];
  const u = (lx * face.u[0] + ly * face.u[1] + lz * face.u[2]) / SIDE;
  const v = (lx * face.v[0] + ly * face.v[1] + lz * face.v[2]) / SIDE;
  if (u < -0.01 || u > 1.01 || v < -0.01 || v > 1.01) return null;
  return { u: clamp(u), v: clamp(v), break: false };
}

function strokeSegments(pts) {
  const runs = [];
  let run = [];
  let previous = null;
  const flush = () => {
    if (run.length) runs.push(run);
    run = [];
  };
  for (const point of pts) {
    if (point.break || !previous) {
      flush();
      previous = point;
      continue;
    }
    const span = Math.hypot(point.u - previous.u, point.v - previous.v) * SIDE;
    if (span > 0.4) {
      run.push({ u1: previous.u, v1: previous.v, u2: point.u, v2: point.v, len: span });
    }
    previous = point;
  }
  flush();

  const segments = [];
  for (let face = 0; face < FACES.length; face++) {
    const plane = FACES[face];
    for (let stroke = 0; stroke < runs.length; stroke++) {
      const samples = runs[stroke];
      const total = samples.reduce((sum, sample) => sum + sample.len, 0) || 1;
      let walked = 0;
      for (const sample of samples) {
        const a = uvToWorld(plane, sample.u1, sample.v1);
        const b = uvToWorld(plane, sample.u2, sample.v2);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const along0 = walked / total;
        walked += sample.len;
        segments.push({
          x1: a.x, y1: a.y, z1: a.z, x2: b.x, y2: b.y, z2: b.z,
          dx, dy, dz, len: Math.hypot(dx, dy, dz),
          face, stroke, along0, along1: walked / total,
        });
      }
    }
  }
  return segments;
}

function faceCorners(face) {
  const { o, u, v } = face;
  return [
    [o[0], o[1], o[2]],
    [o[0] + u[0] * SIDE, o[1] + u[1] * SIDE, o[2] + u[2] * SIDE],
    [o[0] + (u[0] + v[0]) * SIDE, o[1] + (u[1] + v[1]) * SIDE, o[2] + (u[2] + v[2]) * SIDE],
    [o[0] + v[0] * SIDE, o[1] + v[1] * SIDE, o[2] + v[2] * SIDE],
  ];
}

function draw() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  const cam = cameraToWorld(0, 0, 1);
  if (!settled && mode !== "sign") {
    const walls = [];
    for (const face of FACES) {
      const facing = face.n[0] * cam.x + face.n[1] * cam.y + face.n[2] * cam.z;
      if (facing > 0.02) continue;
      const projected = faceCorners(face).map(([x, y, z]) => project(x, y, z));
      walls.push({
        projected,
        depth: projected.reduce((sum, point) => sum + point.depth, 0) / projected.length,
      });
    }
    walls.sort((a, b) => b.depth - a.depth);
    ctx.fillStyle = "#00b4b5";
    for (const wall of walls) {
      ctx.beginPath();
      wall.projected.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      ctx.fill();
    }
  } else if (!settled) {
    const s = planScale();
    const half = HALF * s;
    const left = w / 2 - half;
    const top = h / 2 - half;
    ctx.fillStyle = "#00b4b5";
    ctx.fillRect(left, top, half * 2, half * 2);
    ctx.strokeStyle = "rgba(5, 32, 43, 0.72)";
    ctx.lineWidth = 1.25;
    ctx.strokeRect(left, top, half * 2, half * 2);
  }

  const lines = [];
  const add = (x1, y1, z1, x2, y2, z2, color, width) => {
    const a = project(x1, y1, z1);
    const b = project(x2, y2, z2);
    lines.push({
      ax: a.x, ay: a.y, bx: b.x, by: b.y,
      depth: (a.depth + b.depth) / 2,
      color,
      width: width * Math.max(0.45, (a.s + b.s) * 0.5),
    });
  };

  if (!settled && mode !== "sign") {
    for (const edge of EDGES) {
      add(edge[0] * HALF, edge[1] * HALF, edge[2] * HALF, edge[3] * HALF, edge[4] * HALF, edge[5] * HALF, "rgba(5, 32, 43, 0.72)", 1.15);
    }

    for (const face of FACES) {
      const facing = face.n[0] * cam.x + face.n[1] * cam.y + face.n[2] * cam.z;
      const color = facing > 0.15 ? "#05202b" : "rgba(5, 32, 43, 0.34)";
      const width = facing > 0.15 ? 1.7 : 1.05;
      let previous = null;
      for (const point of points) {
        if (point.break || !previous) {
          previous = point;
          continue;
        }
        const a = uvToWorld(face, previous.u, previous.v);
        const b = uvToWorld(face, point.u, point.v);
        add(a.x, a.y, a.z, b.x, b.y, b.z, color, width);
        previous = point;
      }
    }
  } else if (!settled) {
    const face = FACES[0];
    let previous = null;
    for (const point of points) {
      if (point.break || !previous) {
        previous = point;
        continue;
      }
      const a = uvToWorld(face, previous.u, previous.v);
      const b = uvToWorld(face, point.u, point.v);
      add(a.x, a.y, a.z, b.x, b.y, b.z, "#05202b", 1.7);
      previous = point;
    }
  }

  for (const agent of world.agents) {
    const trail = agent.trail;
    if (!wrapMesh && trail && trail.length > 1) {
      const parts = 4;
      const span = Math.ceil(trail.length / parts);
      for (let part = 0; part < parts; part++) {
        const start = part * span;
        let end = Math.min(trail.length, start + span + 1);
        if (end - start < 2) continue;
        const projected = [];
        let depth = 0;
        for (let k = start; k < end; k++) {
          const point = project(trail[k].x, trail[k].y, trail[k].z);
          projected.push(point);
          depth += point.depth;
        }
        if (part === parts - 1 && !settled) {
          const head = project(agent.x, agent.y, agent.z);
          projected.push(head);
          depth += head.depth;
        }
        depth /= projected.length;
        const scale = projected[projected.length - 1].s;
        lines.push({
          points: projected,
          depth,
          color: "#fe4d7b",
          width: (settled ? 2.4 : 1.35) * Math.max(0.55, scale),
        });
      }
    }

    if (!settled) {
      const arrow = arrowOutline(agent.x, agent.y, agent.z, agent.vx, agent.vy, agent.vz);
      lines.push({
        poly: arrow.poly,
        depth: arrow.depth,
        fill: BOID,
        width: 0,
      });
    }
  }

  if (wrapMesh) addWrap(lines);

  lines.sort((a, b) => b.depth - a.depth);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const line of lines) {
    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.width;
    ctx.beginPath();
    if (line.poly) {
      ctx.moveTo(line.poly[0][0], line.poly[0][1]);
      for (let i = 1; i < line.poly.length; i++) ctx.lineTo(line.poly[i][0], line.poly[i][1]);
      ctx.closePath();
      ctx.fillStyle = line.fill;
      ctx.fill();
      continue;
    }
    if (line.points) {
      ctx.moveTo(line.points[0].x, line.points[0].y);
      for (let i = 1; i < line.points.length; i++) ctx.lineTo(line.points[i].x, line.points[i].y);
    } else {
      ctx.moveTo(line.ax, line.ay);
      ctx.lineTo(line.bx, line.by);
    }
    ctx.stroke();
  }
}

function skinColor(light) {
  const t = 0.22 + 0.78 * clamp(light);
  const r = Math.round(5 + (254 - 5) * t);
  const g = Math.round(32 + (77 - 32) * t);
  const b = Math.round(43 + (123 - 43) * t);
  return `rgb(${r},${g},${b})`;
}

function addWrap(lines) {
  const pos = wrapMesh.pos;
  const quads = wrapMesh.quads;
  const cam = cameraToWorld(0, 0, CAMERA_Z);
  for (let q = 0; q < quads.length; q += 4) {
    const ids = [quads[q], quads[q + 1], quads[q + 2], quads[q + 3]];
    const corners = ids.map((id) => [pos[id * 3], pos[id * 3 + 1], pos[id * 3 + 2]]);
    const ax = corners[1][0] - corners[0][0];
    const ay = corners[1][1] - corners[0][1];
    const az = corners[1][2] - corners[0][2];
    const bx = corners[2][0] - corners[0][0];
    const by = corners[2][1] - corners[0][1];
    const bz = corners[2][2] - corners[0][2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    const cx = (corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) * 0.25;
    const cy = (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) * 0.25;
    const cz = (corners[0][2] + corners[1][2] + corners[2][2] + corners[3][2]) * 0.25;
    const vx = cam.x - cx;
    const vy = cam.y - cy;
    const vz = cam.z - cz;
    const vl = Math.hypot(vx, vy, vz) || 1;
    const light = Math.abs(nx * vx + ny * vy + nz * vz) / (nl * vl);
    const projected = corners.map(([x, y, z]) => project(x, y, z));
    let depth = 0;
    const poly = projected.map((point) => {
      depth += point.depth;
      return [point.x, point.y];
    });
    lines.push({
      poly,
      depth: depth / projected.length,
      fill: skinColor(light),
      width: 0,
    });
  }
}

function renderText() {
  const now = strength();
  let line;
  if (settled && wrapMesh) line = "The skin was not drawn. The signature set the strengths. The rules and the beginning set the paths. That skin is the form.";
  else if (settled) line = "These paths were not drawn. They are the record of the rules. The skin has not closed yet.";
  else if (!signed) line = "The three variables are waiting on a signature. Until then the field is only the rules we set.";
  else line = describe(now, stats);
  reading.textContent = line;
  const spacing = stats.spread ? `${stats.spread.toFixed(0)}` : "—";
  const agreement = stats.spread ? stats.align.toFixed(2) : "—";
  const since = metAt == null ? null : Math.max(0, SETTLE_AFTER - (performance.now() - metAt) / 1000);
  measure.textContent = settled
    ? `Outcome  ·  ${wrapMesh ? "the skin" : "the paths"}  ·  beginning ${String(world.seed).padStart(2, "0")}  ·  held at ${world.time.toFixed(1)} s`
    : since == null
      ? `Outcome  ·  spacing ${spacing}  ·  agreement ${agreement}  ·  beginning ${String(world.seed).padStart(2, "0")}  ·  ${world.time.toFixed(1)} s`
      : `Outcome  ·  spacing ${spacing}  ·  agreement ${agreement}  ·  the skin in ${since.toFixed(0)} s`;
}

function settleSculpture() {
  if (settled) return;
  settled = true;
  wrapMesh = null;
  wrapAt = performance.now() + (reducedMotion ? 0 : PATHS_BEFORE_WRAP * 1000);
  stage.classList.add("settled");
  hint.classList.add("hidden");
  const note = document.querySelector(".frame-note");
  if (note) note.textContent = "Drag to turn the paths. Scroll to zoom.";
  setMode("turn");
  draw();
  renderText();
}

function marksMeet() {
  const agents = world.agents;
  const bins = new Map();
  let ended = 0;
  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    if (!agent.atEnd || agent.face < 0) continue;
    ended += 1;
    const key = agent.face + ":" + (agent.stroke || 0);
    let bin = bins.get(key);
    if (!bin) {
      bin = { x: 0, y: 0, z: 0, n: 0 };
      bins.set(key, bin);
    }
    bin.x += agent.x;
    bin.y += agent.y;
    bin.z += agent.z;
    bin.n += 1;
  }
  if (ended < agents.length * 0.4) return false;
  let spread = 0;
  let counted = 0;
  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    if (!agent.atEnd || agent.face < 0) continue;
    const bin = bins.get(agent.face + ":" + (agent.stroke || 0));
    if (!bin || bin.n < 4) continue;
    const dx = agent.x - bin.x / bin.n;
    const dy = agent.y - bin.y / bin.n;
    const dz = agent.z - bin.z / bin.n;
    spread += Math.hypot(dx, dy, dz);
    counted += 1;
  }
  return counted >= agents.length * 0.4 && spread / counted < 42;
}

function tick() {
  if (!paused && world && !settled) {
    stats = step(world, strength(), strokeSegments(points));
    if (signed && metAt == null && marksMeet()) metAt = performance.now();
    if (metAt != null && performance.now() - metAt >= SETTLE_AFTER * 1000) settleSculpture();
  }
  if (settled && !wrapMesh && wrapAt != null && !paused && performance.now() >= wrapAt) {
    wrapMesh = shrinkWrap(world.agents);
    wrapAt = null;
    const note = document.querySelector(".frame-note");
    if (note && wrapMesh) note.textContent = "Drag to turn the form. Scroll to zoom.";
    renderText();
  }
  if (world) draw();
  frame += 1;
  if (frame % 20 === 0) renderText();
  requestAnimationFrame(tick);
}

function replay(nextSeed) {
  seed = nextSeed;
  world = createField(seed);
  stats = { spread: 0, align: 0 };
  settled = false;
  metAt = null;
  wrapMesh = null;
  wrapAt = null;
  stage.classList.remove("settled");
  const note = document.querySelector(".frame-note");
  if (note) note.textContent = mode === "sign" ? "Sign on the plan." : "Drag to turn the cube. Scroll to zoom.";
  if (!signed && mode === "sign") hint.classList.remove("hidden");
  else hint.classList.add("hidden");
  draw();
  renderText();
}

function setHold(next) {
  if (next && !paused) setHold.mark = performance.now();
  if (!next && paused && setHold.mark) {
    const held = performance.now() - setHold.mark;
    if (metAt != null) metAt += held;
    if (wrapAt != null) wrapAt += held;
  }
  paused = next;
  holdButton.textContent = paused ? "Release" : "Hold";
  holdButton.setAttribute("aria-pressed", paused ? "true" : "false");
  renderText();
}

function showDone() {
  const open = mode === "sign" && points.length > 0 && !settled;
  doneButton.classList.toggle("hidden", !open);
  const note = document.querySelector(".frame-note");
  if (note && !settled && open) note.textContent = "Done opens the cube.";
}

function previewSignature() {
  const scaled = points.map((point) => ({ x: point.u * SIDE, y: point.v * SIDE, break: point.break }));
  const measured = measureSignature(scaled, SIDE, SIDE);
  const attract = measured ? measured.attract : 0;
  const repel = measured ? measured.repel : 0;
  const mimic = measured ? measured.mimic : 0;
  paintRuleCube(attract, repel, mimic);
  ruleCaption.textContent = measured
    ? `The signature so far: attraction ${word(attract)} ${attract.toFixed(2)}, repulsion ${word(repel)} ${repel.toFixed(2)}, mimicry ${word(mimic)} ${mimic.toFixed(2)}.`
    : "Draw the signature. Done opens the cube.";
  showDone();
  renderText();
}

function setMode(next) {
  if (mode === "sign" && next === "turn" && points.length) applySignature();
  if (next === "sign" && !settled) {
    signed = null;
    metAt = null;
  }
  if (mode === "turn" && next === "sign") {
    cubeYaw = yaw;
    cubePitch = pitch;
  }
  mode = next;
  drawing = false;
  turning = false;
  if (next === "sign") {
    yaw = 0;
    pitch = 0;
  } else {
    yaw = cubeYaw;
    pitch = cubePitch;
  }
  signButton.setAttribute("aria-pressed", next === "sign" ? "true" : "false");
  turnButton.setAttribute("aria-pressed", next === "turn" ? "true" : "false");
  stage.classList.toggle("signing", next === "sign");
  stage.classList.toggle("turning", next === "turn");
  signCanvas.setAttribute("aria-label", next === "sign"
    ? "Plan. Sign on the square. The name is copied onto all six faces."
    : "Cube. Drag to turn. The signature is on all six faces.");
  const note = document.querySelector(".frame-note");
  if (note && !settled) note.textContent = next === "sign" ? "Sign on the plan." : "Drag to turn the cube. Scroll to zoom.";
  hint.classList.toggle("hidden", next !== "sign" || points.length > 0 || settled);
  showDone();
  renderText();
  if (world) draw();
}

function applySignature() {
  const scaled = points.map((point) => ({ x: point.u * SIDE, y: point.v * SIDE, break: point.break }));
  signed = measureSignature(scaled, SIDE, SIDE);
  hint.classList.toggle("hidden", mode !== "sign" || points.length > 0);
  paintReadouts();
  renderText();
}

function clearSignature() {
  points = [];
  signed = null;
  metAt = null;
  settled = false;
  wrapMesh = null;
  wrapAt = null;
  stage.classList.remove("settled");
  const note = document.querySelector(".frame-note");
  if (note) note.textContent = mode === "sign" ? "Sign on the plan." : "Drag to turn the cube. Scroll to zoom.";
  hint.classList.toggle("hidden", mode !== "sign");
  showDone();
  paintReadouts();
  renderText();
  draw();
}

function endStroke() {
  if (!drawing) return;
  drawing = false;
  previewSignature();
}

signCanvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  signCanvas.setPointerCapture(event.pointerId);
  lastPointer = { x: event.clientX, y: event.clientY };
  if (mode === "turn") {
    turning = true;
    stage.classList.add("dragging");
    return;
  }
  const hit = pointerUV(event);
  if (!hit) return;
  drawing = true;
  hit.break = true;
  points.push(hit);
  hint.classList.add("hidden");
  showDone();
  draw();
});

signCanvas.addEventListener("pointermove", (event) => {
  if (turning) {
    yaw += (event.clientX - lastPointer.x) * 0.008;
    pitch = clamp(pitch + (event.clientY - lastPointer.y) * 0.008, -1.15, 1.15);
    lastPointer = { x: event.clientX, y: event.clientY };
    draw();
    return;
  }
  if (!drawing) return;
  const hit = pointerUV(event);
  if (!hit) return;
  const last = points[points.length - 1];
  if (Math.hypot(hit.u - last.u, hit.v - last.v) < 0.004) return;
  points.push(hit);
  previewSignature();
  draw();
});

function endPointer() {
  turning = false;
  stage.classList.remove("dragging");
  endStroke();
}

signCanvas.addEventListener("pointerup", endPointer);
signCanvas.addEventListener("pointercancel", endPointer);

signCanvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const dy = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * 400 : event.deltaY;
  CAMERA_Z = clamp(CAMERA_Z * Math.exp(dy * 0.0014), CAMERA_NEAR, CAMERA_FAR);
}, { passive: false });

document.querySelector("#replay").addEventListener("click", () => replay(world.seed));
document.querySelector("#another").addEventListener("click", () => replay(world.seed + 1));
document.querySelector("#clear-sign").addEventListener("click", clearSignature);
holdButton.addEventListener("click", () => setHold(!paused));
signButton.addEventListener("click", () => setMode("sign"));
turnButton.addEventListener("click", () => setMode("turn"));
doneButton.addEventListener("click", () => {
  drawing = false;
  setMode("turn");
});

window.addEventListener("keydown", (event) => {
  if (event.code !== "Space" || event.repeat) return;
  if (event.target.closest("button, a")) return;
  event.preventDefault();
  setHold(!paused);
});

window.addEventListener("resize", resize);

paintReadouts();
writeLedger();
resize();
setMode("sign");
setHold(paused);
requestAnimationFrame(tick);
