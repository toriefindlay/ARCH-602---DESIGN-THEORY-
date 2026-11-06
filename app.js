const { RULES, createField, step, describe } = window.FieldModel;

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
const meters = {
  attract: document.querySelector("#attract-meter"),
  repel: document.querySelector("#repel-meter"),
  mimic: document.querySelector("#mimic-meter"),
};
const readouts = {
  attract: document.querySelector("#attract-out"),
  repel: document.querySelector("#repel-out"),
  mimic: document.querySelector("#mimic-out"),
};

const BOID = "#fe4d7b";
const HALF = RULES.half;
const SIDE = HALF * 2;
const CAMERA_Z = 820;
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
let yaw = 0.62;
let pitch = 0.42;
let lastPointer = null;
let signatureAt = null;
let settled = false;
const SETTLE_AFTER = 20;

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
  for (const key of Object.keys(meters)) {
    readouts[key].textContent = `${word(now[key])}  ${now[key].toFixed(2)}`;
    meters[key].querySelector("span").style.left = `${now[key] * 100}%`;
    meters[key].setAttribute("aria-valuenow", now[key].toFixed(2));
  }
}

function writeLedger() {
  fixed.innerHTML = [
    `${RULES.count} marks, all of them inside the cube.`,
    `The cube is ${SIDE} units on a side. Leaving it is not allowed.`,
    `Attraction and mimicry look ${RULES.neighborRadius} units out. Beyond that, a mark is alone.`,
    `Repulsion between marks acts only inside ${RULES.repelRadius} units.`,
    `Marks ease around ${RULES.cruise.toFixed(2)} units per step, weaving on a curve fixed at the start. The rules steer.`,
    `Each mark leaves a trail only after it meets the signature. The trail stays. Twenty seconds later the marks and the cube leave, and the trails remain.`,
    `The signature is copied onto all six faces.`,
    `The signature reaches across the cube, through the center. A mark is pulled toward the ink until it meets the line, then pushed back into the volume. The trail begins at that meeting.`,
    `Until you sign, the marks stay evenly spaced and move freely. Attraction, mimicry, and the trails wait.`,
    "A beginning is a seeded set of positions and directions. Replay repeats it. Another beginning changes only the start.",
    "There is no randomness after the start. If the figure surprises you, the rules and the start still determined it.",
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

function project(x, y, z) {
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
  const segments = [];
  for (const face of FACES) {
    let previous = null;
    for (const point of pts) {
      if (point.break || !previous) {
        previous = point;
        continue;
      }
      const a = uvToWorld(face, previous.u, previous.v);
      const b = uvToWorld(face, point.u, point.v);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const span = Math.hypot(dx, dy, dz);
      if (span > 0.4) {
        segments.push({ x1: a.x, y1: a.y, z1: a.z, x2: b.x, y2: b.y, z2: b.z, dx, dy, dz, len: span });
      }
      previous = point;
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
  if (!settled) {
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

  if (!settled) {
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
  }

  for (const agent of world.agents) {
    const trail = agent.trail;
    if (trail && trail.length > 1) {
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
      const speed = Math.hypot(agent.vx, agent.vy, agent.vz) || 1;
      const length = 12;
      add(
        agent.x - agent.vx / speed * length * 0.35,
        agent.y - agent.vy / speed * length * 0.35,
        agent.z - agent.vz / speed * length * 0.35,
        agent.x + agent.vx / speed * length * 0.65,
        agent.y + agent.vy / speed * length * 0.65,
        agent.z + agent.vz / speed * length * 0.65,
        BOID,
        1.45,
      );
    }
  }

  lines.sort((a, b) => b.depth - a.depth);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const line of lines) {
    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.width;
    ctx.beginPath();
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

function renderText() {
  const now = strength();
  let line;
  if (settled) line = "The cube is gone. Drag to turn the sculpture. Only the trails remain.";
  else if (paused) line = "Held. The form is waiting. The signature stays on all six faces.";
  else if (!signed) line = mode === "turn"
    ? "Drag to turn the cube. The marks are moving freely until you sign."
    : "Sign on the front face. Until then, the marks stay evenly spaced and move freely.";
  else line = describe(now, stats);
  reading.textContent = line;
  const spacing = stats.spread ? `${stats.spread.toFixed(0)}` : "—";
  const agreement = stats.spread ? stats.align.toFixed(2) : "—";
  const since = signatureAt == null ? null : Math.max(0, SETTLE_AFTER - (performance.now() - signatureAt) / 1000);
  measure.textContent = settled
    ? `Sculpture  ·  beginning ${String(world.seed).padStart(2, "0")}  ·  held at ${world.time.toFixed(1)} s`
    : since == null
      ? `Spacing ${spacing}  ·  agreement ${agreement}  ·  beginning ${String(world.seed).padStart(2, "0")}  ·  ${world.time.toFixed(1)} s`
      : `Spacing ${spacing}  ·  agreement ${agreement}  ·  sculpture in ${since.toFixed(0)} s`;
}

function settleSculpture() {
  if (settled) return;
  settled = true;
  stage.classList.add("settled");
  hint.classList.add("hidden");
  const note = document.querySelector(".frame-note");
  if (note) note.textContent = "Turn the sculpture.";
  setMode("turn");
  draw();
  renderText();
}

function tick() {
  if (!paused && world && !settled) {
    stats = step(world, strength(), strokeSegments(points));
    if (signatureAt != null && performance.now() - signatureAt >= SETTLE_AFTER * 1000) settleSculpture();
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
  signatureAt = signed ? performance.now() : null;
  stage.classList.remove("settled");
  const note = document.querySelector(".frame-note");
  if (note) note.textContent = "Turn to orbit the cube.";
  if (!signed) hint.classList.remove("hidden");
  draw();
  renderText();
}

function setHold(next) {
  if (next && !paused) setHold.mark = performance.now();
  if (!next && paused && signatureAt != null && setHold.mark) {
    signatureAt += performance.now() - setHold.mark;
  }
  paused = next;
  holdButton.textContent = paused ? "Release" : "Hold";
  holdButton.setAttribute("aria-pressed", paused ? "true" : "false");
  renderText();
}

function setMode(next) {
  mode = next;
  drawing = false;
  turning = false;
  signButton.setAttribute("aria-pressed", next === "sign" ? "true" : "false");
  turnButton.setAttribute("aria-pressed", next === "turn" ? "true" : "false");
  stage.classList.toggle("signing", next === "sign");
  stage.classList.toggle("turning", next === "turn");
  renderText();
}

function applySignature() {
  const scaled = points.map((point) => ({ x: point.u * SIDE, y: point.v * SIDE, break: point.break }));
  signed = measureSignature(scaled, SIDE, SIDE);
  if (signed && signatureAt == null && world) signatureAt = performance.now();
  hint.classList.toggle("hidden", points.length > 0);
  paintReadouts();
  renderText();
}

function clearSignature() {
  points = [];
  signed = null;
  signatureAt = null;
  settled = false;
  stage.classList.remove("settled");
  const note = document.querySelector(".frame-note");
  if (note) note.textContent = "Turn to orbit the cube.";
  hint.classList.remove("hidden");
  paintReadouts();
  renderText();
  draw();
}

function endStroke() {
  if (!drawing) return;
  drawing = false;
  applySignature();
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
  applySignature();
  draw();
});

function endPointer() {
  turning = false;
  stage.classList.remove("dragging");
  endStroke();
}

signCanvas.addEventListener("pointerup", endPointer);
signCanvas.addEventListener("pointercancel", endPointer);

document.querySelector("#replay").addEventListener("click", () => replay(world.seed));
document.querySelector("#another").addEventListener("click", () => replay(world.seed + 1));
document.querySelector("#clear-sign").addEventListener("click", clearSignature);
holdButton.addEventListener("click", () => setHold(!paused));
signButton.addEventListener("click", () => setMode("sign"));
turnButton.addEventListener("click", () => setMode("turn"));

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
