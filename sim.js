// The signature is an initial condition and a field.
// Cohesion, separation, and alignment are Reynolds' steering rules.
// A flock is stepped one frame at a time. The line behind each agent is the record.

export const AGENT_COUNT = 170;

// The signature spans 1.65. The soft boundary begins early enough to turn
// at the existing acceleration limit, and is fully inward at the old edge.
export const SOFT_RADIUS = 1.55;
export const FIRM_RADIUS = 1.85;
export const FRAME_RADIUS = 2.05;
export const SEPARATION_NODE_ZONE = 0.24;

export function neighborhoodRadius(cohesion) {
  return 0.18 + cohesion * 0.12;
}

export const STUDIES = [
  {
    id: "cohesion",
    index: "01",
    title: "Cohesion",
    also: "attraction",
    cohesion: 1,
    separation: 0.05,
    alignment: 0.08,
    note: "Agents gather. The mark draws local clusters into mass. The knots were not placed.",
  },
  {
    id: "separation",
    index: "02",
    title: "Separation",
    also: "repulsion",
    cohesion: 0.08,
    separation: 1,
    alignment: 0.06,
    note: "Agents refuse one another. The same mark opens into a porous volume.",
  },
  {
    id: "alignment",
    index: "03",
    title: "Alignment",
    also: "mimicry",
    cohesion: 0.1,
    separation: 0.24,
    alignment: 1,
    note: "Agents copy a heading, and the heading of the stroke. The mark becomes streams.",
  },
];

export function weightsFrom(cohesion, separation, alignment, neighborhood = neighborhoodRadius(cohesion)) {
  return {
    cohesion: 0.12 + cohesion * 1.65,
    separation: separation * 1.25,
    alignment: alignment * 1.35,
    signature: 0.42 + cohesion * 0.4,
    tangent: 0.06 + alignment * 1.2,
    separateRadius: 0.07 + separation * 0.18,
    neighborRadius: neighborhood,
    speed: 0.0068 + alignment * 0.0028,
    hold: 0.0007,
  };
}

export const MODIFIER_GROUPS = [
  {
    id: "texture",
    label: "Texture",
    options: [
      { id: "reflection", label: "Reflection", ready: true },
      { id: "stripes", label: "Stripes", ready: true },
    ],
  },
  {
    id: "volume",
    label: "Volume",
    options: [
      { id: "bubbles", label: "Bubbles", ready: true },
      { id: "porosity", label: "Porosity", ready: true },
    ],
  },
  {
    id: "motion",
    label: "Motion",
    options: [
      { id: "reaction", label: "Reaction", ready: true },
      { id: "murmuration", label: "Murmuration", ready: true },
    ],
  },
];

const CATEGORY_OF = {
  stripes: "texture",
  reaction: "motion",
  reflection: "texture",
  bubbles: "volume",
  porosity: "volume",
  gesture: "volume",
  wind: "motion",
  smoke: "motion",
  murmuration: "motion",
};

const modifiers = {
  texture: { id: "none", strength: 0.6 },
  volume: { id: "none", strength: 0.6 },
  motion: { id: "none", strength: 0.6 },
  intensity: 0.6,
};
let symmetryOn = false;
const field = { time: 0 };

function clampStrength(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

export function setModifiers(next = {}) {
  for (const key of ["texture", "volume", "motion"]) {
    if (!next[key]) continue;
    if (next[key].id != null) modifiers[key].id = next[key].id;
    if (next[key].strength != null) modifiers[key].strength = clampStrength(next[key].strength);
  }
  if (next.intensity != null) {
    const level = clampStrength(next.intensity);
    modifiers.intensity = level;
    for (const key of ["texture", "volume", "motion"]) {
      if (!next[key] || next[key].strength == null) modifiers[key].strength = level;
    }
  } else {
    modifiers.intensity = Math.max(modifiers.texture.strength, modifiers.volume.strength, modifiers.motion.strength);
  }
}

export function setModifier(next) {
  for (const key of ["texture", "volume", "motion"]) {
    modifiers[key].id = "none";
    modifiers[key].strength = 0;
  }
  const level = next.strength != null ? clampStrength(next.strength) : modifiers.intensity;
  modifiers.intensity = level;
  const id = next.id || "none";
  const category = CATEGORY_OF[id];
  if (!category) return;
  modifiers[category].id = id;
  modifiers[category].strength = level;
}

export function setIntensity(value) {
  const level = clampStrength(value);
  modifiers.intensity = level;
  modifiers.texture.strength = level;
  modifiers.volume.strength = level;
  modifiers.motion.strength = level;
  return level;
}

export function setSymmetry(on) {
  symmetryOn = Boolean(on);
  return symmetryOn;
}

export function getSymmetry() {
  return symmetryOn;
}

export function getModifier() {
  for (const key of ["texture", "volume", "motion"]) {
    if (modifiers[key].id !== "none") return { id: modifiers[key].id, strength: modifiers[key].strength };
  }
  return { id: "none", strength: modifiers.intensity };
}

export function getModifiers() {
  return {
    texture: { id: modifiers.texture.id, strength: modifiers.texture.strength },
    volume: { id: modifiers.volume.id, strength: modifiers.volume.strength },
    motion: { id: modifiers.motion.id, strength: modifiers.motion.strength },
    intensity: modifiers.intensity,
    symmetry: symmetryOn,
  };
}

function modifierOn(category, id) {
  return modifiers[category].id === id && modifiers[category].strength > 0;
}

const FELT_IDS = [
  ["texture", "stripes"],
  ["motion", "reaction"],
  ["volume", "bubbles"],
  ["volume", "porosity"],
  ["motion", "wind"],
  ["motion", "murmuration"],
];

export function curveFieldAt(nodes, x, y, z) {
  const list = nodes || [];
  let influence = 0;
  let tx = 0;
  let ty = 0;
  let tz = 0;
  let ix = 0;
  let iy = 0;
  let iz = 0;
  let turn = 0;
  let weight = 0;
  let near = Infinity;
  let reach = 0.5;
  for (let i = 0; i < list.length; i++) {
    const current = list[i];
    const distance = Math.hypot(x - current.x, y - current.y, z - current.z);
    if (!(current.radius > 0) || distance >= current.radius) continue;
    const t = distance / current.radius;
    const fall = 1 - t * t * (3 - 2 * t);
    influence += (1 - influence) * fall;
    tx += (current.ox ?? current.tx) * fall;
    ty += (current.oy ?? current.ty) * fall;
    tz += (current.oz ?? current.tz) * fall;
    ix += (current.ix ?? current.tx) * fall;
    iy += (current.iy ?? current.ty) * fall;
    iz += (current.iz ?? current.tz) * fall;
    turn += current.turn * fall;
    weight += fall;
    if (distance < near) {
      near = distance;
      reach = current.radius;
    }
  }
  const length = Math.hypot(tx, ty, tz);
  if (length > 1e-6) {
    tx /= length;
    ty /= length;
    tz /= length;
  } else {
    tx = 0;
    ty = 1;
    tz = 0;
  }
  const incoming = Math.hypot(ix, iy, iz);
  return {
    influence,
    tx,
    ty,
    tz,
    ix: incoming > 1e-6 ? ix / incoming : tx,
    iy: incoming > 1e-6 ? iy / incoming : ty,
    iz: incoming > 1e-6 ? iz / incoming : tz,
    turn: weight > 0 ? turn / weight : 0,
    distance: near,
    radius: reach,
  };
}

function releaseFromNodes(x, y, z, vx, vy, vz, speed, nodes) {
  const clear = separationNodeClear(x, y, z, nodes);
  if (!clear) return [vx, vy, vz];
  const inward = vx * clear.x + vy * clear.y + vz * clear.z;
  if (inward < 0) {
    vx -= clear.x * inward;
    vy -= clear.y * inward;
    vz -= clear.z * inward;
  }
  const outward = speed * (0.35 + 0.65 * clear.depth);
  return limit(
    vx + clear.x * outward * clear.depth,
    vy + clear.y * outward * clear.depth,
    vz + clear.z * outward * clear.depth,
    speed,
  );
}

function separationNodeClear(x, y, z, nodes) {
  const list = nodes || [];
  let ux = 0;
  let uy = 0;
  let uz = 0;
  let depth = 0;
  for (let i = 0; i < list.length; i++) {
    const node = list[i];
    const dx = x - node.x;
    const dy = y - node.y;
    const dz = z - node.z;
    const distance = Math.hypot(dx, dy, dz);
    if (!(distance < SEPARATION_NODE_ZONE)) continue;
    const span = distance || 1e-4;
    const t = 1 - span / SEPARATION_NODE_ZONE;
    const fall = t * t * (3 - 2 * t);
    if (fall <= depth) continue;
    depth = fall;
    ux = dx / span;
    uy = dy / span;
    uz = dz / span;
  }
  if (!(depth > 0)) return null;
  return { x: ux, y: uy, z: uz, depth };
}

export function separationTubeRadius(radius, x, y, z, nodes) {
  const list = nodes || [];
  let nearest = Infinity;
  for (let i = 0; i < list.length; i++) {
    const node = list[i];
    const distance = Math.hypot(x - node.x, y - node.y, z - node.z);
    if (distance < nearest) nearest = distance;
  }
  const room = nearest - SEPARATION_NODE_ZONE;
  if (room >= radius) return radius;
  return Math.max(0.0035, room);
}

function smoothstep(edge0, edge1, x) {
  const span = edge1 - edge0;
  if (span === 0) return x < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - edge0) / span));
  return t * t * (3 - 2 * t);
}

function stripeFrame(x, y, z, nodes) {
  const list = nodes || [];
  let nearest = null;
  let nearestD = Infinity;
  for (let i = 0; i < list.length; i++) {
    const node = list[i];
    const distance = Math.hypot(x - node.x, y - node.y, z - node.z);
    if (distance < nearestD) {
      nearestD = distance;
      nearest = node;
    }
  }
  const refX = nearest ? nearest.tx || nearest.ox || 1 : 0;
  const refY = nearest ? nearest.ty || nearest.oy || 1 : 1;
  const refZ = nearest ? nearest.tz || nearest.oz || 0 : 0;
  let tx = 0;
  let ty = 0;
  let tz = 0;
  let turn = 0;
  let weight = 0;
  for (let i = 0; i < list.length; i++) {
    const node = list[i];
    const dx = node.tx || node.ox || 0;
    const dy = node.ty || node.oy || 0;
    const dz = node.tz || node.oz || 0;
    const agree = dx * refX + dy * refY + dz * refZ;
    const sign = agree < 0 ? -1 : 1;
    const distance = Math.hypot(x - node.x, y - node.y, z - node.z);
    const fall = 1 / (0.12 + distance * distance);
    tx += dx * sign * fall;
    ty += dy * sign * fall;
    tz += dz * sign * fall;
    turn += (node.turn || 0) * sign * fall;
    weight += fall;
  }
  if (weight > 0) {
    tx /= weight;
    ty /= weight;
    tz /= weight;
    turn /= weight;
  } else {
    tx = refX;
    ty = refY;
    tz = refZ;
  }
  const tangent = Math.hypot(tx, ty, tz) || 1;
  tx /= tangent;
  ty /= tangent;
  tz /= tangent;
  let sx = -ty;
  let sy = tx;
  let sz = 0;
  let sideLength = Math.hypot(sx, sy, sz);
  if (sideLength < 0.25) {
    sx = 0;
    sy = -tz;
    sz = ty;
    sideLength = Math.hypot(sx, sy, sz) || 1;
  }
  sx /= sideLength;
  sy /= sideLength;
  sz /= sideLength;
  return {
    tx, ty, tz, sx, sy, sz,
    bx: ty * sz - tz * sy,
    by: tz * sx - tx * sz,
    bz: tx * sy - ty * sx,
    turn,
  };
}

function stripeSample(x, y, z, nodes) {
  const frame = stripeFrame(x, y, z, nodes);
  const along = x * frame.tx + y * frame.ty + z * frame.tz;
  const side = x * frame.sx + y * frame.sy + z * frame.sz;
  const lift = x * frame.bx + y * frame.by + z * frame.bz;
  const turn = frame.turn || 0;
  const twist = Math.sin(along * 0.62 + turn * 1.7) * 0.85 + turn * 0.35;
  const across = side * Math.cos(twist) + lift * Math.sin(twist);
  const around = side * Math.sin(twist) - lift * Math.cos(twist);
  const bend = Math.sin(along * 0.55 + around * 0.34) * 1.15
    + Math.sin(around * 0.42 - along * 0.22 + turn * 2.4) * 0.9
    + Math.sin(along * 0.18 + across * 0.12) * Math.sin(around * 0.27 + 1.7) * 1.05;
  const forkWave = Math.sin(along * 0.31 + around * 0.19 + turn * 1.3);
  const fork = smoothstep(0.62, 0.94, forkWave);
  const spacing = 0.78 + 0.34 * Math.sin(along * 0.16 + around * 0.11);
  const phase = (across * 6.2 + along * 0.55 + bend) * spacing;
  const wave = Math.sin(phase) * (1 - fork) + Math.sin(phase * 2 + 0.6) * fork;
  const taper = 0.5 + 0.5 * Math.sin(along * 0.41 + around * 0.23 + 0.4);
  const pinch = 0.2 + taper * 0.28;
  const shift = (taper - 0.5) * 0.85;
  return {
    band: smoothstep(-pinch + shift, pinch + shift, wave),
    pull: Math.max(-1, Math.min(1, Math.cos(phase) * 0.3)),
  };
}

function orientPoint(x, y, z, field) {
  const blend = field.influence;
  if (blend <= 0) return { x, y, z };
  const yaw = Math.atan2(field.tx, field.ty || 1e-6) * blend;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: x * c - y * s, y: x * s + y * c, z };
}

function presenceOf(influence) {
  if (influence <= 0) return 0;
  const t = Math.min(1, influence / 0.5);
  return t * t * (3 - 2 * t);
}

function feelAt(x, y, z, nodes) {
  const field = curveFieldAt(nodes, x, y, z);
  const presence = presenceOf(field.influence);
  const values = {};
  const take = {};
  let total = 0;
  for (let i = 0; i < FELT_IDS.length; i++) {
    const category = FELT_IDS[i][0];
    const id = FELT_IDS[i][1];
    const strength = modifiers[category].id === id ? modifiers[category].strength * presence : 0;
    values[id] = strength;
    take[id] = field.influence;
    total += strength;
  }
  return { values, take, total, fall: field.influence, field };
}

export function readModifierFeel(x, y, z, nodes = []) {
  const felt = feelAt(x, y, z, nodes);
  return { values: { ...felt.values }, take: { ...felt.take }, total: felt.total, fall: felt.fall };
}

function turnFall(field) {
  if (!(field.radius > 0) || !Number.isFinite(field.distance)) return 0;
  const t = Math.min(1, field.distance / field.radius);
  return 1 - t * t * (3 - 2 * t);
}

export function trailLook(x, y, z, density, nodes) {
  const field = curveFieldAt(nodes, x, y, z);
  const presence = presenceOf(field.influence);
  const atTurn = turnFall(field);
  let bead = 0;
  if (modifierOn("volume", "bubbles")) bead = atTurn * presence * modifiers.volume.strength;
  const crowd = tubeRadiusFor(density, 0.02, 0.5);
  const radius = Math.min(TUBE_MAX, Math.max(TUBE_MIN, crowd * (1 + (modifierOn("volume", "bubbles") ? 1.55 : 0.16) * bead)));
  const intensity = Math.min(1, Math.max(0.7, 0.9 + 0.08 * bead));
  let tone = intensity;
  if (modifierOn("texture", "stripes")) {
    const sample = stripeSample(x, y, z, nodes);
    const contrast = modifiers.texture.strength;
    const dark = 1 - contrast * 0.82;
    const light = 1 + contrast * 0.85;
    tone = dark + (light - dark) * sample.band;
  }
  return { radius, intensity, influence: field.influence, gap: 0, tone };
}

// Reaction is a two-dimensional Gray–Scott field on the signature plane.
// X and Y carry the pattern. Depth does not: the same concentrations are felt
// at every Z. One shared grid advances once per simulation step.
const REACTION_SIZE = 48;
const REACTION_FEED = 0.029;
const REACTION_KILL = 0.057;
const REACTION_DU = 0.16;
const REACTION_DV = 0.08;
const REACTION_DT = 1;
const REACTION_SUBSTEPS = 4;
const REACTION_WARMUP = 900;
const reactionU = [new Float32Array(REACTION_SIZE * REACTION_SIZE), new Float32Array(REACTION_SIZE * REACTION_SIZE)];
const reactionV = [new Float32Array(REACTION_SIZE * REACTION_SIZE), new Float32Array(REACTION_SIZE * REACTION_SIZE)];
let reactionFront = 0;

function paintReactionDisc(targetU, targetV, cx, cy, radius) {
  const n = REACTION_SIZE;
  const r2 = radius * radius;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let dx = j - cx;
      let dy = i - cy;
      dx -= Math.round(dx / n) * n;
      dy -= Math.round(dy / n) * n;
      if (dx * dx + dy * dy <= r2) {
        const id = i * n + j;
        targetU[id] = 0.5;
        targetV[id] = 0.25;
      }
    }
  }
}

function seedReaction(seed) {
  const n = REACTION_SIZE;
  const targetU = reactionU[0];
  const targetV = reactionV[0];
  targetU.fill(1);
  targetV.fill(0);
  const rand = mulberry32((seed >>> 0) + 17);
  paintReactionDisc(targetU, targetV, n / 2, n / 2, 2.4);
  for (let blob = 0; blob < 5; blob++) {
    const cx = n * (0.22 + rand() * 0.56);
    const cy = n * (0.22 + rand() * 0.56);
    paintReactionDisc(targetU, targetV, cx, cy, 1.4 + rand() * 1.8);
  }
  for (let i = 0; i < n * n; i++) targetV[i] = Math.min(1, targetV[i] + rand() * 0.02);
  reactionFront = 0;
  reactionU[1].set(targetU);
  reactionV[1].set(targetV);
}

function reactOnce() {
  const n = REACTION_SIZE;
  const source = reactionFront;
  const dest = source ^ 1;
  const uu = reactionU[source];
  const vv = reactionV[source];
  const nu = reactionU[dest];
  const nv = reactionV[dest];
  const feed = REACTION_FEED;
  const kill = REACTION_KILL;
  for (let i = 0; i < n; i++) {
    const im = (i - 1 + n) % n;
    const ip = (i + 1) % n;
    const row = i * n;
    const up = im * n;
    const down = ip * n;
    for (let j = 0; j < n; j++) {
      const jm = (j - 1 + n) % n;
      const jp = (j + 1) % n;
      const id = row + j;
      const uc = uu[id];
      const vc = vv[id];
      const lu = uu[row + jm] + uu[row + jp] + uu[up + j] + uu[down + j] - 4 * uc;
      const lv = vv[row + jm] + vv[row + jp] + vv[up + j] + vv[down + j] - 4 * vc;
      const uvv = uc * vc * vc;
      nu[id] = uc + (REACTION_DU * lu - uvv + feed * (1 - uc)) * REACTION_DT;
      nv[id] = vc + (REACTION_DV * lv + uvv - (feed + kill) * vc) * REACTION_DT;
    }
  }
  reactionFront = dest;
}

export function advanceField() {
  field.time += 1;
  const reactionSelected = modifiers.motion.id === "reaction" || modifiers.texture.id === "reaction";
  if (!reactionSelected) return;
  for (let step = 0; step < REACTION_SUBSTEPS; step++) reactOnce();
}

const POROSITY_SCALE = 2.65;
const POROSITY_SOLID = -0.22;
const POROSITY_VOID = 0.7;
const porosity = { x: 0, y: 0, z: 0 };

function seedPorosity(seed) {
  const rand = mulberry32((seed >>> 0) + 41);
  porosity.x = rand() * Math.PI * 2;
  porosity.y = rand() * Math.PI * 2;
  porosity.z = rand() * Math.PI * 2;
}

export function porositySample(x, y, z) {
  const k = POROSITY_SCALE;
  const a = k * x + porosity.x;
  const b = k * y + porosity.y;
  const c = k * z + porosity.z;
  const value = Math.sin(a) * Math.cos(b) + Math.sin(b) * Math.cos(c) + Math.sin(c) * Math.cos(a);
  const gx = k * (Math.cos(a) * Math.cos(b) - Math.sin(c) * Math.sin(a));
  const gy = k * (-Math.sin(a) * Math.sin(b) + Math.cos(b) * Math.cos(c));
  const gz = k * (-Math.sin(b) * Math.sin(c) + Math.cos(c) * Math.cos(a));
  const span = POROSITY_VOID - POROSITY_SOLID;
  const t = Math.min(1, Math.max(0, (value - POROSITY_SOLID) / span));
  return { value, voidness: t * t * (3 - 2 * t), gx, gy, gz };
}

export function resetField(seed = 0) {
  field.time = 0;
  seedPorosity(seed);
  seedReaction(seed);
  for (let step = 0; step < REACTION_WARMUP; step++) reactOnce();
}

export function readReaction() {
  return {
    size: REACTION_SIZE,
    span: FRAME_RADIUS,
    values: Float32Array.from(reactionV[reactionFront]),
  };
}

// A course around the nearest signature node. The orbit reverses and leans
// into the node's own direction, so neighbouring groups do not share one ring.
function murmurNode(x, y, z, nodes) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const distance = Math.hypot(x - node.x, y - node.y, z - node.z);
    if (distance < bestD) {
      bestD = distance;
      best = node;
    }
  }
  if (!best) return null;
  return { node: best, distance: bestD };
}

function murmurCourse(x, y, z, nodes, time, level) {
  const found = murmurNode(x, y, z, nodes);
  if (!found) return null;
  const node = found.node;
  const phase = time * (0.009 + level * 0.011) + (node.along || 0) * 2.7 + (node.turn || 0) * 1.4;
  let rx = x - node.x;
  let ry = y - node.y;
  let rz = z - node.z;
  let span = Math.hypot(rx, ry, rz);
  if (span < 0.045) {
    rx = -(node.ty || 0);
    ry = node.tx || 1;
    rz = node.tz || 0;
    span = Math.hypot(rx, ry, rz) || 1;
  }
  rx /= span;
  ry /= span;
  rz /= span;
  const tx = node.ox || node.tx || 0;
  const ty = node.oy || node.ty || 1;
  const tz = node.oz || node.tz || 0;
  const tilt = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(phase * 0.37));
  let ax = tx * tilt;
  let ay = 0.4 + 0.6 * Math.cos(phase * 0.23);
  let az = tz * tilt;
  const axis = Math.hypot(ax, ay, az) || 1;
  ax /= axis;
  ay /= axis;
  az /= axis;
  let ox = ay * rz - az * ry;
  let oy = az * rx - ax * rz;
  let oz = ax * ry - ay * rx;
  const orbit = Math.hypot(ox, oy, oz) || 1;
  ox /= orbit;
  oy /= orbit;
  oz /= orbit;
  const spin = Math.sin(phase * 0.5);
  const breathe = Math.sin(phase * 0.8) * (0.22 + level * 0.48);
  const sweep = Math.cos(phase * 0.45) * (0.32 + level * 0.42);
  const whirl = (0.7 + level * 0.4) * spin;
  const dx = ox * whirl + rx * breathe + tx * sweep;
  const dy = oy * whirl + ry * breathe + ty * sweep;
  const dz = oz * whirl + rz * breathe + tz * sweep;
  const length = Math.hypot(dx, dy, dz) || 1;
  return { x: dx / length, y: dy / length, z: dz / length, phase };
}

function windSample(x, y, z, time) {
  const t = time * 0.011;
  const wave = 1.15;
  const gust = 0.64 + 0.36 * Math.sin(x * wave + t) * Math.cos(y * wave * 0.62 + z * 0.4 + t * 0.72);
  const wx = 0.88;
  const wy = 0.26 * Math.sin(y * wave * 0.75 + t * 0.84);
  const wz = 0.2 * Math.cos(z * wave + x * 0.32 + t * 0.58);
  const length = Math.hypot(wx, wy, wz) || 1;
  return { x: wx / length, y: wy / length, z: wz / length, gust };
}

const BUBBLE_GAP = 0.17;
const BUBBLE_REACH = 0.36;

function bubbleSigned(distance) {
  if (distance >= BUBBLE_REACH || distance < 1e-5) return 0;
  const x = distance / BUBBLE_REACH;
  const equilibrium = BUBBLE_GAP / BUBBLE_REACH;
  const raw = (x - equilibrium) * (1 - x) * (1 - x);
  return raw > 0 ? raw * 3.4 : raw;
}

function reactionAt(x, y) {
  const n = REACTION_SIZE;
  const span = FRAME_RADIUS * 2;
  const gx = ((x + FRAME_RADIUS) / span) * n;
  const gy = ((y + FRAME_RADIUS) / span) * n;
  const values = reactionV[reactionFront];
  const at = (px, py) => {
    let sx = ((px % n) + n) % n;
    let sy = ((py % n) + n) % n;
    const x0 = Math.floor(sx);
    const y0 = Math.floor(sy);
    const tx = sx - x0;
    const ty = sy - y0;
    const x1 = (x0 + 1) % n;
    const y1 = (y0 + 1) % n;
    const v00 = values[y0 * n + x0];
    const v10 = values[y0 * n + x1];
    const v01 = values[y1 * n + x0];
    const v11 = values[y1 * n + x1];
    const a = v00 * (1 - tx) + v10 * tx;
    const b = v01 * (1 - tx) + v11 * tx;
    return a * (1 - ty) + b * ty;
  };
  const eps = 0.85;
  return {
    value: at(gx, gy),
    gx: at(gx + eps, gy) - at(gx - eps, gy),
    gy: at(gx, gy + eps) - at(gx, gy - eps),
  };
}

export function reactionSample(x, y) {
  return reactionAt(x, y);
}

export function describeMix(cohesion, separation, alignment) {
  const ranked = [
    ["Cohesion", cohesion],
    ["Separation", separation],
    ["Alignment", alignment],
  ].sort((a, b) => b[1] - a[1]);
  if (ranked[0][1] < 0.12) {
    return "The rules are faint. What remains is mostly the beginning.";
  }
  if (ranked[0][1] - ranked[1][1] < 0.12) {
    return "No single rule is leading. The object is their argument.";
  }
  return `${ranked[0][0]} is leading. The form is still not a drawing of the signature.`;
}

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dist2(ax, ay, az, bx, by, bz) {
  const dx = ax - bx;
  const dy = ay - by;
  const dz = az - bz;
  return dx * dx + dy * dy + dz * dz;
}

export function readSignature(points, width, height) {
  const strokes = [];
  let current = [];
  for (const point of points) {
    if (point.break) {
      if (current.length > 1) strokes.push(current);
      current = [];
      continue;
    }
    current.push(point);
  }
  if (current.length > 1) strokes.push(current);
  if (!strokes.length) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let length = 0;
  for (const stroke of strokes) {
    for (let i = 0; i < stroke.length; i++) {
      const point = stroke[i];
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
      if (i) length += Math.hypot(point.x - stroke[i - 1].x, point.y - stroke[i - 1].y);
    }
  }
  if (length < 36) return null;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY, 1);
  const scale = 1.65 / span;
  const line = [];
  for (let s = 0; s < strokes.length; s++) {
    const stroke = strokes[s];
    let strokeLength = 0;
    for (let i = 1; i < stroke.length; i++) {
      strokeLength += Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y);
    }
    let walked = 0;
    for (let i = 0; i < stroke.length; i++) {
      const point = stroke[i];
      if (i) walked += Math.hypot(point.x - stroke[i - 1].x, point.y - stroke[i - 1].y);
      const along = strokeLength > 0 ? walked / strokeLength : 0;
      line.push({
        x: (point.x - cx) * scale,
        y: (cy - point.y) * scale,
        z: (along - 0.5) * 0.32 + s * 0.08,
        stroke: s,
      });
    }
    line[line.length - 1].end = true;
  }

  const samples = [];
  let covered = 0;
  for (let i = 0; i < line.length - 1; i++) {
    if (line[i].end) continue;
    const a = line[i];
    const b = line[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const seg = Math.hypot(dx, dy, dz);
    if (seg < 0.0001) continue;
    const steps = Math.max(1, Math.ceil(seg / 0.045));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      samples.push({
        x: a.x + dx * t,
        y: a.y + dy * t,
        z: a.z + dz * t,
        tx: dx / seg,
        ty: dy / seg,
        tz: dz / seg,
        stroke: a.stroke || 0,
        s: covered + seg * t,
      });
    }
    covered += seg;
  }
  if (samples.length < 2) return null;
  const signature = {
    line,
    samples,
    pixelLength: length,
    width,
    height,
    baseNodes: placeCurveNodes(line),
    plane: mirrorPlane(line),
    nodes: [],
    links: [],
    frame: { cx, cy, scale },
    symmetry: false,
  };
  publishNodes(signature);
  return signature;
}

function mirrorPlane(line) {
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let i = 0; i < line.length; i++) {
    cx += line[i].x;
    cy += line[i].y;
    cz += line[i].z;
  }
  const count = line.length || 1;
  cx /= count;
  cy /= count;
  cz /= count;
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (let i = 0; i < line.length; i++) {
    const x = line[i].x - cx;
    const y = line[i].y - cy;
    xx += x * x;
    yy += y * y;
    xy += x * y;
  }
  const trace = xx + yy;
  const det = xx * yy - xy * xy;
  const root = Math.sqrt(Math.max(0, trace * trace * 0.25 - det));
  const major = trace * 0.5 + root;
  const minor = trace * 0.5 - root;
  let dx = 1;
  let dy = 0;
  if (!(minor > 1e-8 && major / minor < 1.2)) {
    dx = Math.abs(xy) + Math.abs(xx - major) > 1e-8 ? xy : 1;
    dy = Math.abs(xy) + Math.abs(xx - major) > 1e-8 ? major - xx : 0;
  }
  let nx = -dy;
  let ny = dx;
  if (minor > 1e-8 && major / minor < 1.2) {
    nx = 1;
    ny = 0;
  }
  const length = Math.hypot(nx, ny) || 1;
  nx /= length;
  ny /= length;
  if (nx < -1e-8 || (Math.abs(nx) <= 1e-8 && ny < 0)) {
    nx = -nx;
    ny = -ny;
  }
  return { x: cx, y: cy, z: cz, nx, ny, nz: 0 };
}

function reflectVector(x, y, z, plane) {
  const drop = x * plane.nx + y * plane.ny + z * plane.nz;
  return [x - 2 * drop * plane.nx, y - 2 * drop * plane.ny, z - 2 * drop * plane.nz];
}

function reflectPosition(x, y, z, plane) {
  const shifted = reflectVector(x - plane.x, y - plane.y, z - plane.z, plane);
  return [shifted[0] + plane.x, shifted[1] + plane.y, shifted[2] + plane.z];
}

export function mirrorOf(x, y, z, plane) {
  return reflectPosition(x, y, z, plane);
}

function reflectNode(node, plane) {
  const point = reflectPosition(node.x, node.y, node.z, plane);
  const incoming = reflectVector(node.ix || node.tx, node.iy || node.ty, node.iz || node.tz, plane);
  const outgoing = reflectVector(node.ox || node.tx, node.oy || node.ty, node.oz || node.tz, plane);
  return {
    ...node,
    x: point[0],
    y: point[1],
    z: point[2],
    ix: incoming[0],
    iy: incoming[1],
    iz: incoming[2],
    ox: outgoing[0],
    oy: outgoing[1],
    oz: outgoing[2],
    tx: outgoing[0],
    ty: outgoing[1],
    tz: outgoing[2],
    turn: -node.turn,
    stroke: node.stroke + 100,
  };
}

function linkNodes(nodes) {
  const groups = new Map();
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const key = node.stroke || 0;
    const list = groups.get(key);
    if (list) list.push(node);
    else groups.set(key, [node]);
  }
  const links = [];
  for (const list of groups.values()) {
    list.sort((a, b) => a.along - b.along);
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i];
      const b = list[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const length = Math.hypot(dx, dy, dz);
      if (length < 0.04) continue;
      links.push({
        ax: a.x, ay: a.y, az: a.z,
        bx: b.x, by: b.y, bz: b.z,
        tx: dx / length, ty: dy / length, tz: dz / length,
        length,
      });
    }
  }
  return links;
}

export function publishNodes(signature) {
  if (!signature) return;
  const source = signature.baseNodes || signature.nodes || [];
  const active = source.map((node) => ({ ...node }));
  signature.symmetry = symmetryOn;
  if (symmetryOn && signature.plane) {
    for (let i = 0; i < source.length; i++) {
      const copy = reflectNode(source[i], signature.plane);
      const gap = Math.hypot(copy.x - source[i].x, copy.y - source[i].y, copy.z - source[i].z);
      if (gap < 0.05) continue;
      let crowded = false;
      for (let j = 0; j < active.length; j++) {
        const other = active[j];
        if (Math.hypot(copy.x - other.x, copy.y - other.y, copy.z - other.z) < 0.05) crowded = true;
      }
      if (!crowded) active.push(copy);
    }
  }
  signature.nodes = active;
  signature.links = linkNodes(active);
}

const CURVE_STEP = 0.05;
const CURVE_SPACING = 0.12;

function resampleStroke(stroke, step) {
  const points = [{ x: stroke[0].x, y: stroke[0].y, z: stroke[0].z, s: 0 }];
  let previous = stroke[0];
  let travelled = 0;
  let nextAt = step;
  for (let i = 1; i < stroke.length; i++) {
    const point = stroke[i];
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    const dz = point.z - previous.z;
    const segment = Math.hypot(dx, dy, dz);
    if (segment < 1e-6) {
      previous = point;
      continue;
    }
    while (travelled + segment >= nextAt - 1e-8) {
      const t = (nextAt - travelled) / segment;
      points.push({
        x: previous.x + dx * t,
        y: previous.y + dy * t,
        z: previous.z + dz * t,
        s: nextAt,
      });
      nextAt += step;
    }
    travelled += segment;
    previous = point;
  }
  return points;
}

function smoothStroke(points) {
  let current = points.map((point) => ({ ...point }));
  for (let pass = 0; pass < 3; pass++) {
    const next = current.map((point) => ({ ...point }));
    for (let i = 1; i < current.length - 1; i++) {
      next[i].x = current[i - 1].x * 0.25 + current[i].x * 0.5 + current[i + 1].x * 0.25;
      next[i].y = current[i - 1].y * 0.25 + current[i].y * 0.5 + current[i + 1].y * 0.25;
      next[i].z = current[i - 1].z * 0.25 + current[i].z * 0.5 + current[i + 1].z * 0.25;
    }
    current = next;
  }
  return current;
}

function strokeTurns(points) {
  const count = points.length;
  const tx = new Float64Array(count);
  const ty = new Float64Array(count);
  const tz = new Float64Array(count);
  const turn = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(count - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dy, dz) || 1;
    tx[i] = dx / length;
    ty[i] = dy / length;
    tz[i] = dz / length;
  }
  for (let i = 1; i < count - 1; i++) {
    const dot = Math.max(-1, Math.min(1, tx[i - 1] * tx[i + 1] + ty[i - 1] * ty[i + 1] + tz[i - 1] * tz[i + 1]));
    const signed = tx[i - 1] * ty[i + 1] - ty[i - 1] * tx[i + 1];
    turn[i] = Math.atan2(signed, dot);
  }
  return { tx, ty, tz, turn };
}

function splitStrokes(line) {
  const strokes = [];
  let current = [];
  for (let i = 0; i < line.length; i++) {
    current.push(line[i]);
    if (line[i].end) {
      if (current.length > 1) strokes.push(current);
      current = [];
    }
  }
  if (current.length > 1) strokes.push(current);
  return strokes;
}

function acceptNode(nodes, candidate) {
  for (let i = 0; i < nodes.length; i++) {
    const other = nodes[i];
    const distance = Math.hypot(candidate.x - other.x, candidate.y - other.y, candidate.z - other.z);
    if (distance >= CURVE_SPACING) continue;
    if (Math.abs(candidate.turn) > Math.abs(other.turn)) nodes[i] = candidate;
    return;
  }
  nodes.push(candidate);
}

export function placeCurveNodes(line) {
  const nodes = [];
  const strokes = splitStrokes(line);
  for (let s = 0; s < strokes.length; s++) {
    const sampled = smoothStroke(resampleStroke(strokes[s], CURVE_STEP));
    if (sampled.length < 3) {
      const mid = sampled[Math.floor(sampled.length / 2)] || strokes[s][0];
      const start = strokes[s][0];
      const end = strokes[s][strokes[s].length - 1];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const dz = end.z - start.z;
      const span = Math.hypot(dx, dy, dz) || 1;
      acceptNode(nodes, {
        x: mid.x, y: mid.y, z: mid.z,
        tx: dx / span, ty: dy / span, tz: dz / span,
        ix: dx / span, iy: dy / span, iz: dz / span,
        ox: dx / span, oy: dy / span, oz: dz / span,
        turn: 0, radius: 0.56, along: mid.s || 0, stroke: s,
      });
      continue;
    }
    const { tx, ty, tz, turn } = strokeTurns(sampled);
    const found = [];
    for (let i = 1; i < sampled.length - 1; i++) {
      const magnitude = Math.abs(turn[i]);
      if (magnitude < 0.28) continue;
      if (magnitude < Math.abs(turn[i - 1]) || magnitude <= Math.abs(turn[i + 1])) continue;
      found.push(i);
    }
    let accumulated = 0;
    let since = 0;
    for (let i = 1; i < sampled.length; i++) {
      if (Math.abs(turn[i]) >= 0.28) {
        accumulated = 0;
        since = i;
        continue;
      }
      accumulated += turn[i];
      if (Math.abs(accumulated) < 0.9 || i - since < 4) continue;
      found.push(i);
      accumulated = 0;
      since = i;
    }
    if (!found.length) found.push(Math.floor(sampled.length / 2));
    for (let i = 0; i < found.length; i++) {
      const index = found[i];
      const point = sampled[index];
      const incoming = Math.max(0, index - 1);
      acceptNode(nodes, {
        x: point.x,
        y: point.y,
        z: point.z,
        tx: tx[index],
        ty: ty[index],
        tz: tz[index],
        ix: tx[incoming],
        iy: ty[incoming],
        iz: tz[incoming],
        ox: tx[index],
        oy: ty[index],
        oz: tz[index],
        turn: Math.max(-1.4, Math.min(1.4, turn[index])),
        radius: 0.5,
        along: point.s || 0,
        stroke: s,
      });
    }
  }
  if (!nodes.length && line.length) {
    const mid = line[Math.floor(line.length / 2)];
    nodes.push({
      x: mid.x, y: mid.y, z: mid.z, tx: 1, ty: 0, tz: 0,
      ix: 1, iy: 0, iz: 0, ox: 1, oy: 0, oz: 0,
      turn: 0, radius: 0.56, along: 0, stroke: 0,
    });
  }
  nodes.sort((a, b) => a.along - b.along || a.stroke - b.stroke);
  const kept = nodes;
  for (let i = 0; i < kept.length; i++) {
    let nearest = 1.15;
    for (let j = 0; j < kept.length; j++) {
      if (i === j) continue;
      nearest = Math.min(nearest, Math.hypot(kept[i].x - kept[j].x, kept[i].y - kept[j].y, kept[i].z - kept[j].z));
    }
    const tight = Math.min(1, Math.abs(kept[i].turn) / 1.2);
    const reach = kept.length === 1 ? 0.34 : Math.min(0.4, Math.max(0.18, nearest * 0.46));
    kept[i].radius = Math.max(0.16, reach - tight * 0.04);
  }
  kept.sort((a, b) => a.z - b.z);
  return kept;
}

function sampleAt(samples, u) {
  const end = samples[samples.length - 1].s || 0;
  const target = Math.min(end, Math.max(0, u * end));
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].s < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function buildGrid(px, py, pz, cell) {
  const grid = new Map();
  const inv = 1 / cell;
  for (let i = 0; i < px.length; i++) {
    const key = `${Math.floor(px[i] * inv)},${Math.floor(py[i] * inv)},${Math.floor(pz[i] * inv)}`;
    let bin = grid.get(key);
    if (!bin) grid.set(key, (bin = []));
    bin.push(i);
  }
  return { grid, inv };
}

function neighborsOf(px, py, pz, index, grid, inv, radius) {
  const cx = Math.floor(px[index] * inv);
  const cy = Math.floor(py[index] * inv);
  const cz = Math.floor(pz[index] * inv);
  const reach = radius * radius;
  const found = [];
  for (let z = cz - 1; z <= cz + 1; z++) {
    for (let y = cy - 1; y <= cy + 1; y++) {
      for (let x = cx - 1; x <= cx + 1; x++) {
        const bin = grid.get(`${x},${y},${z}`);
        if (!bin) continue;
        for (let k = 0; k < bin.length; k++) {
          const j = bin[k];
          if (j === index) continue;
          const d = dist2(px[index], py[index], pz[index], px[j], py[j], pz[j]);
          if (d < reach && d > 1e-8) found.push({ index: j, d: Math.sqrt(d) });
        }
      }
    }
  }
  return found;
}

export const CROWD_RADIUS = 0.32;
export const CROWD_LOW = Math.log1p(0.2);
export const CROWD_HIGH = Math.log1p(100);
export const TUBE_MIN = 0.004;
export const TUBE_MAX = 0.09;

export function measureCrowd(px, py, pz) {
  const count = px.length;
  const out = new Float64Array(count);
  if (!count) return out;
  const { grid, inv } = buildGrid(px, py, pz, CROWD_RADIUS);
  for (let i = 0; i < count; i++) {
    const near = neighborsOf(px, py, pz, i, grid, inv, CROWD_RADIUS);
    let sum = 0;
    for (let k = 0; k < near.length; k++) {
      const t = near[k].d / CROWD_RADIUS;
      const shaped = t * t * (3 - 2 * t);
      sum += 1 - shaped;
    }
    out[i] = sum;
  }
  return out;
}

export function tubeRadiusFor(density, base = 0.02, response = 0) {
  const safeBase = Math.min(0.06, Math.max(0.008, Number(base) || 0.02));
  const feel = Math.min(1, Math.max(0, Number(response) || 0));
  const sensed = Math.log1p(Math.max(0, Number(density) || 0));
  let t = (sensed - CROWD_LOW) / (CROWD_HIGH - CROWD_LOW);
  t = Math.min(1, Math.max(0, t));
  t = t * t * (3 - 2 * t);
  const thick = safeBase * 2.05;
  const thin = safeBase * 0.42;
  const shaped = thick + (thin - thick) * t;
  const radius = safeBase + (shaped - safeBase) * feel;
  return Math.min(TUBE_MAX, Math.max(TUBE_MIN, radius));
}

export function maxTubeRadius(base = 0.02, response = 0) {
  return Math.max(tubeRadiusFor(0, base, response), tubeRadiusFor(CROWD_HIGH, base, response));
}

function storeCrowd(flock, px, py, pz) {
  // Rendering reads this. Steering does not.
  flock.crowd = measureCrowd(px, py, pz);
}

function ensureBuffers(flock, count) {
  const buf = flock.buffer;
  if (buf && buf.count === count) return buf;
  const next = {
    count,
    px: new Float64Array(count),
    py: new Float64Array(count),
    pz: new Float64Array(count),
    vx: new Float64Array(count),
    vy: new Float64Array(count),
    vz: new Float64Array(count),
    nx: new Float64Array(count),
    ny: new Float64Array(count),
    nz: new Float64Array(count),
  };
  flock.buffer = next;
  return next;
}

function limit(x, y, z, max) {
  const length = Math.hypot(x, y, z);
  if (length > max && length > 0) {
    const scale = max / length;
    return [x * scale, y * scale, z * scale];
  }
  return [x, y, z];
}

function respawn(flock) {
  const rand = mulberry32(flock.seed);
  const weights = weightsFrom(
    flock.mix.cohesion,
    flock.mix.separation,
    flock.mix.alignment,
    flock.mix.neighborhood,
  );
  const samples = flock.signature.samples;
  const agents = [];
  const symmetric = symmetryOn && flock.signature.plane;
  const budget = symmetric ? AGENT_COUNT / 2 : AGENT_COUNT;
  for (let i = 0; i < budget; i++) {
    const u = Math.min(0.999, Math.max(0, (i + 0.5) / budget + (rand() - 0.5) * 0.65 / budget));
    const index = sampleAt(samples, u);
    const sample = samples[index];
    const side = 0.05;
    const pace = weights.speed * 0.55;
    agents.push({
      x: sample.x + (rand() - 0.5) * side,
      y: sample.y + (rand() - 0.5) * side,
      z: sample.z + (rand() - 0.5) * side,
      vx: sample.tx * pace,
      vy: sample.ty * pace,
      vz: sample.tz * pace,
      anchor: index,
      origin: index,
    });
  }
  if (symmetric) {
    const plane = flock.signature.plane;
    const half = agents.length;
    for (let i = 0; i < half; i++) {
      const agent = agents[i];
      const signed = (agent.x - plane.x) * plane.nx + (agent.y - plane.y) * plane.ny + (agent.z - plane.z) * plane.nz;
      if (Math.abs(signed) < 0.03) {
        const lift = (signed >= 0 ? 0.03 : -0.03) - signed;
        agent.x += plane.nx * lift;
        agent.y += plane.ny * lift;
        agent.z += plane.nz * lift;
      }
      const point = reflectPosition(agent.x, agent.y, agent.z, plane);
      const velocity = reflectVector(agent.vx, agent.vy, agent.vz, plane);
      agents.push({ x: point[0], y: point[1], z: point[2], vx: velocity[0], vy: velocity[1], vz: velocity[2] });
    }
  }
  flock.weights = weights;
  flock.agents = agents;
  const px = new Float64Array(agents.length);
  const py = new Float64Array(agents.length);
  const pz = new Float64Array(agents.length);
  for (let i = 0; i < agents.length; i++) {
    px[i] = agents[i].x;
    py[i] = agents[i].y;
    pz[i] = agents[i].z;
  }
  storeCrowd(flock, px, py, pz);
}

export function createFlock(signature, mix, seed) {
  const flock = {
    signature,
    study: mix && mix.id ? mix.id : "",
    mix: {
      cohesion: mix.cohesion,
      separation: mix.separation,
      alignment: mix.alignment,
      neighborhood: mix.neighborhood,
    },
    seed,
    agents: [],
    weights: null,
    line: signature.line.filter((point) => Number.isFinite(point.x)).map((point) => [point.x, point.y, point.z, point.end ? 1 : 0]),
  };
  respawn(flock);
  return flock;
}

export function restartFlock(flock) {
  respawn(flock);
}

export function stepFlock(flock) {
  const weights = flock.weights;
  const agents = flock.agents;
  const samples = flock.signature.samples;
  const count = agents.length;
  const buf = ensureBuffers(flock, count);
  const { px, py, pz, vx, vy, vz, nx, ny, nz } = buf;
  for (let i = 0; i < count; i++) {
    const agent = agents[i];
    px[i] = agent.x;
    py[i] = agent.y;
    pz[i] = agent.z;
    vx[i] = agent.vx;
    vy[i] = agent.vy;
    vz[i] = agent.vz;
  }

  const symmetric = symmetryOn && flock.signature.plane && count % 2 === 0;
  const half = count >> 1;
  const plane = flock.signature.plane;
  if (symmetric) {
    for (let i = 0; i < half; i++) {
      const j = i + half;
      const point = reflectPosition(px[i], py[i], pz[i], plane);
      px[j] = point[0];
      py[j] = point[1];
      pz[j] = point[2];
      const velocity = reflectVector(vx[i], vy[i], vz[i], plane);
      vx[j] = velocity[0];
      vy[j] = velocity[1];
      vz[j] = velocity[2];
    }
  }
  const lead = symmetric ? half : count;

  const bubblesOn = modifierOn("volume", "bubbles");
  const murmurLive = modifiers.motion.id === "murmuration";
  const nodes = flock.signature.nodes || [];
  const cell = Math.max(weights.neighborRadius, weights.separateRadius, bubblesOn ? BUBBLE_REACH : 0, 0.2);
  const maxForce = weights.speed * 0.075;
  const maxAccel = maxForce * 1.15;
  const comfort = weights.separateRadius;
  const { grid, inv } = buildGrid(px, py, pz, cell);

  for (let i = 0; i < lead; i++) {
    const felt = feelAt(px[i], py[i], pz[i], nodes);
    const local = nearestNode(px[i], py[i], pz[i], nodes);
    const lane = nearestLink(px[i], py[i], pz[i], flock.signature.links);
    const bubbleHere = felt.values.bubbles;
    const near = neighborsOf(px, py, pz, i, grid, inv, cell);
    let cx = 0;
    let cy = 0;
    let cz = 0;
    let cCount = 0;
    let ax = 0;
    let ay = 0;
    let az = 0;
    let aCount = 0;
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let sCount = 0;
    let speedSum = 0;
    let nearest = Infinity;
    let nearestIndex = -1;
    let bubbleX = 0;
    let bubbleY = 0;
    let bubbleZ = 0;
    let crowdX = 0;
    let crowdY = 0;
    let crowdZ = 0;
    let crowdPress = 0;
    let murmurX = 0;
    let murmurY = 0;
    let murmurZ = 0;
    let murmurMass = 0;
    let murmurCount = 0;

    for (let k = 0; k < near.length; k++) {
      const j = near[k].index;
      const d = near[k].d;
      if (d < nearest) {
        nearest = d;
        nearestIndex = j;
      }
      if (murmurLive && d < weights.neighborRadius) {
        const nearFeel = feelAt(px[j], py[j], pz[j], nodes).values.murmuration;
        if (nearFeel > 0) {
          const course = murmurCourse(px[j], py[j], pz[j], nodes, field.time, modifiers.motion.strength);
          if (course) {
            murmurX += course.x * nearFeel;
            murmurY += course.y * nearFeel;
            murmurZ += course.z * nearFeel;
            murmurMass += nearFeel;
            murmurCount += 1;
          }
        }
      }
      if (d < weights.neighborRadius) {
        cx += px[j];
        cy += py[j];
        cz += pz[j];
        cCount += 1;
        ax += vx[j];
        ay += vy[j];
        az += vz[j];
        speedSum += Math.hypot(vx[j], vy[j], vz[j]);
        aCount += 1;
      }
      if (bubbleHere > 0 && d < BUBBLE_REACH) {
        const signed = bubbleSigned(d);
        const invD = signed / d;
        bubbleX += (px[j] - px[i]) * invD;
        bubbleY += (py[j] - py[i]) * invD;
        bubbleZ += (pz[j] - pz[i]) * invD;
        if (d < BUBBLE_GAP) {
          const weight = (BUBBLE_GAP - d) / BUBBLE_GAP;
          crowdX += ((px[i] - px[j]) / d) * weight;
          crowdY += ((py[i] - py[j]) / d) * weight;
          crowdZ += ((pz[i] - pz[j]) / d) * weight;
          if (weight > crowdPress) crowdPress = weight;
        }
      }
      if (d < weights.separateRadius) {
        const push = (weights.separateRadius - d) / (d * weights.separateRadius);
        sx += (px[i] - px[j]) * push;
        sy += (py[i] - py[j]) * push;
        sz += (pz[i] - pz[j]) * push;
        sCount += 1;
      }
    }

    const closeness = nearest < comfort ? (comfort - nearest) / comfort : 0;
    const urgency = closeness <= 0 ? 0 : Math.min(1, closeness / 0.45);
    const calm = 1 - urgency * 0.55;
    const baseSeparation = weights.separation * 0.72;
    let fx = 0;
    let fy = 0;
    let fz = 0;
    let mx = 0;
    let my = 0;
    let mz = 0;
    const addSteer = (desiredX, desiredY, desiredZ, weight, intoModifier) => {
      if (weight <= 0) return;
      const steer = limit(desiredX - vx[i], desiredY - vy[i], desiredZ - vz[i], maxForce);
      if (intoModifier) {
        mx += steer[0] * weight;
        my += steer[1] * weight;
        mz += steer[2] * weight;
      } else {
        fx += steer[0] * weight;
        fy += steer[1] * weight;
        fz += steer[2] * weight;
      }
    };
    const shareOf = (id) => (felt.total > 0 ? felt.values[id] / felt.total : 0);

    if (cCount) {
      const invC = 1 / cCount;
      const dx = cx * invC - px[i];
      const dy = cy * invC - py[i];
      const dz = cz * invC - pz[i];
      const length = Math.hypot(dx, dy, dz) || 1;
      addSteer((dx / length) * weights.speed, (dy / length) * weights.speed, (dz / length) * weights.speed, weights.cohesion * calm);
    }
    if (sCount) {
      const length = Math.hypot(sx, sy, sz) || 1;
      addSteer((sx / length) * weights.speed, (sy / length) * weights.speed, (sz / length) * weights.speed, baseSeparation * (1 + urgency * 0.8));
    }
    if (aCount) {
      const invA = 1 / aCount;
      const mx = ax * invA;
      const my = ay * invA;
      const mz = az * invA;
      const mag = Math.hypot(mx, my, mz);
      const cruise = weights.speed;
      if (mag > cruise * 0.08) {
        const pace = mag + (cruise - mag) * 0.42;
        addSteer((mx / mag) * pace, (my / mag) * pace, (mz / mag) * pace, weights.alignment * calm);
      } else {
        const own = Math.hypot(vx[i], vy[i], vz[i]);
        const pace = speedSum * invA;
        if (own > 1e-6) {
          addSteer((vx[i] / own) * pace, (vy[i] / own) * pace, (vz[i] / own) * pace, weights.alignment * calm * 0.45);
        }
      }
    }

    const origin = agents[i].origin ?? agents[i].anchor ?? 0;
    agents[i].anchor = origin;
    const home = samples[origin];
    const dx = home.x - px[i];
    const dy = home.y - py[i];
    const dz = home.z - pz[i];
    const markD = Math.hypot(dx, dy, dz);
    const mark = { d: markD, sample: home, index: origin };
    const band = 0.42;
    if (markD > 0.03) {
      const influence = markD < band ? 1 - markD / band : Math.min(1, 0.55 + (markD - band) / 0.8);
      addSteer((dx / markD) * weights.speed, (dy / markD) * weights.speed, (dz / markD) * weights.speed, weights.signature * influence);
    }
    const headed = Math.max(0.35, 1 - markD / 0.8);
    addSteer(home.tx * weights.speed, home.ty * weights.speed, home.tz * weights.speed, weights.tangent * headed);

    if (local && local.distance > 0.02) {
      const dx = local.node.x - px[i];
      const dy = local.node.y - py[i];
      const dz = local.node.z - pz[i];
      const length = local.distance;
      const shell = Math.min(1, local.distance / 0.14);
      addSteer((dx / length) * weights.speed, (dy / length) * weights.speed, (dz / length) * weights.speed, weights.cohesion * 0.1 * local.fall * shell);
    }
    if (local && local.distance > 1e-4) {
      const core = Math.max(0, 1 - local.distance / (local.node.radius * 0.72));
      const open = core * core * (3 - 2 * core);
      const dx = px[i] - local.node.x;
      const dy = py[i] - local.node.y;
      const dz = pz[i] - local.node.z;
      const length = local.distance;
      addSteer((dx / length) * weights.speed, (dy / length) * weights.speed, (dz / length) * weights.speed, weights.separation * 0.32 * open);
    }
    if (lane) {
      addSteer(lane.link.tx * weights.speed, lane.link.ty * weights.speed, lane.link.tz * weights.speed, weights.alignment * 0.24 * lane.fall);
    } else if (local) {
      addSteer(local.node.ox * weights.speed, local.node.oy * weights.speed, local.node.oz * weights.speed, weights.alignment * 0.14 * local.fall);
    }

    const neighborStrength = murmurCount ? murmurMass / murmurCount : 0;
    const murmurSelf = felt.values.murmuration;
    const murmurLevel = modifiers.motion.strength;
    const selfCourse = murmurLive ? murmurCourse(px[i], py[i], pz[i], nodes, field.time, murmurLevel) : null;
    const carried = murmurSelf > neighborStrength * 0.4 ? murmurSelf : neighborStrength * 0.4;
    if (carried > 0.02 && (selfCourse || murmurMass > 0)) {
      let aimX = selfCourse ? selfCourse.x * (murmurSelf > 0 ? 0.62 : 0.2) : 0;
      let aimY = selfCourse ? selfCourse.y * (murmurSelf > 0 ? 0.62 : 0.2) : 0;
      let aimZ = selfCourse ? selfCourse.z * (murmurSelf > 0 ? 0.62 : 0.2) : 0;
      if (murmurMass > 0) {
        aimX += (murmurX / murmurMass) * (0.38 + murmurLevel * 0.28);
        aimY += (murmurY / murmurMass) * (0.38 + murmurLevel * 0.28);
        aimZ += (murmurZ / murmurMass) * (0.38 + murmurLevel * 0.28);
      }
      const aim = Math.hypot(aimX, aimY, aimZ) || 1;
      const pace = weights.speed * (0.7 + murmurLevel * 0.22);
      addSteer(
        (aimX / aim) * pace,
        (aimY / aim) * pace,
        (aimZ / aim) * pace,
        (0.4 + murmurLevel * 0.22) * carried * (murmurSelf > 0 ? shareOf("murmuration") : 0.65),
        true,
      );
    }

    if (felt.values.wind > 0) {
      const sample = windSample(px[i], py[i], pz[i], field.time);
      const aim = 0.82;
      const wx = sample.x * (1 - aim) + felt.field.tx * aim;
      const wy = sample.y * (1 - aim) + felt.field.ty * aim;
      const wz = sample.z * (1 - aim) + felt.field.tz * aim;
      const aimed = Math.hypot(wx, wy, wz) || 1;
      sample.x = wx / aimed;
      sample.y = wy / aimed;
      sample.z = wz / aimed;
      const pace = weights.speed * 0.5 * felt.values.wind * sample.gust;
      addSteer(
        sample.x * pace,
        sample.y * pace,
        sample.z * pace,
        0.36 * felt.values.wind * sample.gust * shareOf("wind"),
        true,
      );
    }

    if (bubbleHere > 0) {
      const length = Math.hypot(bubbleX, bubbleY, bubbleZ);
      if (length > 0.05) {
        const moving = Math.hypot(vx[i], vy[i], vz[i]);
        const pace = Math.max(weights.speed * 0.62, moving * 0.9);
        addSteer(
          (bubbleX / length) * pace,
          (bubbleY / length) * pace,
          (bubbleZ / length) * pace,
          0.92 * bubbleHere * shareOf("bubbles"),
          true,
        );
      }
      if (local && local.distance > 0.03) {
        const node = local.node;
        const rx = px[i] - node.x;
        const ry = py[i] - node.y;
        const rz = pz[i] - node.z;
        let spinX = ry * node.oz - rz * node.oy;
        let spinY = rz * node.ox - rx * node.oz;
        let spinZ = rx * node.oy - ry * node.ox;
        let spin = Math.hypot(spinX, spinY, spinZ);
        if (spin < 1e-4) {
          spinX = -ry;
          spinY = rx;
          spinZ = 0;
          spin = Math.hypot(spinX, spinY, spinZ) || 1;
        }
        const moving = Math.hypot(vx[i], vy[i], vz[i]);
        const pace = Math.max(weights.speed * 0.5, moving * 0.85);
        addSteer((spinX / spin) * pace, (spinY / spin) * pace, (spinZ / spin) * pace, 0.28 * bubbleHere * shareOf("bubbles"), true);
      }
    }

    if (felt.values.reaction > 0) {
      const oriented = orientPoint(px[i], py[i], pz[i], felt.field);
      const sample = reactionAt(oriented.x, oriented.y);
      const mag = Math.hypot(sample.gx, sample.gy);
      const slope = Math.min(1, mag / 0.035);
      if (slope > 0.08) {
        const nx = sample.gx / mag;
        const ny = sample.gy / mag;
        let tx = -ny;
        let ty = nx;
        if (vx[i] * tx + vy[i] * ty < 0) {
          tx = -tx;
          ty = -ty;
        }
        const climb = weights.speed * 0.62 * slope;
        const along = weights.speed * 0.24 * Math.min(1, sample.value * 3);
        addSteer(
          nx * climb + tx * along,
          ny * climb + ty * along,
          vz[i],
          0.7 * felt.values.reaction * (0.4 + 0.6 * slope) * shareOf("reaction"),
          true,
        );
      }
    }

    if (felt.values.porosity > 0) {
      const oriented = orientPoint(px[i], py[i], pz[i], felt.field);
      const sample = porositySample(oriented.x, oriented.y, oriented.z);
      const influence = sample.voidness;
      let gx = sample.gx;
      let gy = sample.gy;
      let gz = sample.gz;
      let mag = Math.hypot(gx, gy, gz);
      if (influence > 0.55 && mag < 0.35) {
        const probe = 0.16;
        let lowest = sample.value;
        let bx = 1;
        let by = 0;
        let bz = 0;
        const offsets = [[probe, 0, 0], [-probe, 0, 0], [0, probe, 0], [0, -probe, 0], [0, 0, probe], [0, 0, -probe]];
        for (let p = 0; p < offsets.length; p++) {
          const next = porositySample(px[i] + offsets[p][0], py[i] + offsets[p][1], pz[i] + offsets[p][2]);
          if (next.value < lowest) {
            lowest = next.value;
            bx = offsets[p][0];
            by = offsets[p][1];
            bz = offsets[p][2];
          }
        }
        gx = -bx;
        gy = -by;
        gz = -bz;
        mag = Math.hypot(gx, gy, gz) || 1;
      }
      if (influence > 0.05 && mag > 1e-4) {
        const nx = gx / mag;
        const ny = gy / mag;
        const nz = gz / mag;
        const radial = vx[i] * nx + vy[i] * ny + vz[i] * nz;
        let tx = vx[i] - nx * radial;
        let ty = vy[i] - ny * radial;
        let tz = vz[i] - nz * radial;
        let tangent = Math.hypot(tx, ty, tz);
        if (tangent < weights.speed * 0.12) {
          const ax = Math.abs(ny) < 0.85 ? 0 : 1;
          const ay = Math.abs(ny) < 0.85 ? 1 : 0;
          tx = ny * 0 - nz * ay;
          ty = nz * ax - nx * 0;
          tz = nx * ay - ny * ax;
          tangent = Math.hypot(tx, ty, tz) || 1;
        }
        const outward = weights.speed * (0.28 + 0.5 * influence);
        const along = weights.speed * (0.46 - 0.16 * influence);
        addSteer(
          -nx * outward + (tx / tangent) * along,
          -ny * outward + (ty / tangent) * along,
          -nz * outward + (tz / tangent) * along,
          felt.values.porosity * (0.42 + influence) * shareOf("porosity"),
          true,
        );
      }
      if (local && local.distance > 1e-4) {
        const node = local.node;
        const dx = px[i] - node.x;
        const dy = py[i] - node.y;
        const dz = pz[i] - node.z;
        const length = local.distance;
        const pace = weights.speed * 0.4;
        addSteer(
          (dx / length) * pace * 0.7 + node.ox * pace,
          (dy / length) * pace * 0.7 + node.oy * pace,
          (dz / length) * pace * 0.7 + node.oz * pace,
          felt.values.porosity * local.fall * shareOf("porosity"),
          true,
        );
      }
    }

    const radius = Math.hypot(px[i], py[i], pz[i]);
    let accel = limit(fx, fy, fz, maxAccel);
    if (mark.d > 0.1) {
      const hold = Math.min(0.58, (mark.d - 0.1) / 0.42);
      const ux = (home.x - px[i]) / mark.d;
      const uy = (home.y - py[i]) / mark.d;
      const uz = (home.z - pz[i]) / mark.d;
      accel = [
        accel[0] * (1 - hold) + ux * maxAccel * hold,
        accel[1] * (1 - hold) + uy * maxAccel * hold,
        accel[2] * (1 - hold) + uz * maxAccel * hold,
      ];
    }
    const modifierLength = Math.hypot(mx, my, mz);
    if (modifierLength > 0) {
      const modAccel = limit(mx, my, mz, maxAccel);
      const mix = Math.min(0.42, Math.hypot(modAccel[0], modAccel[1], modAccel[2]) / maxAccel);
      accel = [
        accel[0] * (1 - mix) + modAccel[0] * mix,
        accel[1] * (1 - mix) + modAccel[1] * mix,
        accel[2] * (1 - mix) + modAccel[2] * mix,
      ];
    }
    if (urgency > 0 && nearest > 1e-8) {
      const ux = (px[i] - px[nearestIndex]) / nearest;
      const uy = (py[i] - py[nearestIndex]) / nearest;
      const uz = (pz[i] - pz[nearestIndex]) / nearest;
      accel = [
        accel[0] * (1 - urgency) + ux * maxAccel * urgency,
        accel[1] * (1 - urgency) + uy * maxAccel * urgency,
        accel[2] * (1 - urgency) + uz * maxAccel * urgency,
      ];
    }
    if (bubbleHere > 0 && crowdPress > 0) {
      const length = Math.hypot(crowdX, crowdY, crowdZ);
      if (length > 0.05) {
        const blend = Math.min(0.5, crowdPress * 1.15 * bubbleHere * shareOf("bubbles"));
        const ux = crowdX / length;
        const uy = crowdY / length;
        const uz = crowdZ / length;
        accel = [
          accel[0] * (1 - blend) + ux * maxAccel * blend,
          accel[1] * (1 - blend) + uy * maxAccel * blend,
          accel[2] * (1 - blend) + uz * maxAccel * blend,
        ];
      }
    }
    if (radius > SOFT_RADIUS) {
      const contain = Math.min(1, (radius - SOFT_RADIUS) / (FIRM_RADIUS - SOFT_RADIUS));
      const inward = maxAccel * contain;
      const ux = px[i] / radius;
      const uy = py[i] / radius;
      const uz = pz[i] / radius;
      accel = [
        accel[0] * (1 - contain) - ux * inward,
        accel[1] * (1 - contain) - uy * inward,
        accel[2] * (1 - contain) - uz * inward,
      ];
    }

    let nvx = (vx[i] + accel[0]) * 0.997;
    let nvy = (vy[i] + accel[1]) * 0.997;
    let nvz = (vz[i] + accel[2]) * 0.997;
    const velocity = limit(nvx, nvy, nvz, weights.speed);
    nvx = velocity[0];
    nvy = velocity[1];
    nvz = velocity[2];
    if (radius > FIRM_RADIUS) {
      const ux = px[i] / radius;
      const uy = py[i] / radius;
      const uz = pz[i] / radius;
      const radial = nvx * ux + nvy * uy + nvz * uz;
      if (radial > 0) {
        const excess = Math.min(1, (radius - FIRM_RADIUS) / 0.4);
        const bleed = radial * (0.06 + 0.22 * excess);
        nvx -= ux * bleed;
        nvy -= uy * bleed;
        nvz -= uz * bleed;
      }
    }
    if (murmurSelf > 0.02 && selfCourse) {
      const pull = Math.min(0.08, (0.028 + modifiers.motion.strength * 0.05) * murmurSelf);
      const speed = Math.hypot(nvx, nvy, nvz) || weights.speed;
      const held = limit(
        nvx * (1 - pull) + selfCourse.x * speed * pull,
        nvy * (1 - pull) + selfCourse.y * speed * pull,
        nvz * (1 - pull) + selfCourse.z * speed * pull,
        weights.speed,
      );
      nvx = held[0];
      nvy = held[1];
      nvz = held[2];
    }
    if (flock.study === "separation") {
      const released = releaseFromNodes(px[i], py[i], pz[i], nvx, nvy, nvz, weights.speed, nodes);
      nvx = released[0];
      nvy = released[1];
      nvz = released[2];
    }
    nx[i] = nvx;
    ny[i] = nvy;
    nz[i] = nvz;
  }

  if (symmetric) {
    for (let i = 0; i < half; i++) {
      const velocity = reflectVector(nx[i], ny[i], nz[i], plane);
      nx[i + half] = velocity[0];
      ny[i + half] = velocity[1];
      nz[i + half] = velocity[2];
    }
  }

  for (let i = 0; i < count; i++) {
    const agent = agents[i];
    agent.vx = nx[i];
    agent.vy = ny[i];
    agent.vz = nz[i];
    agent.x = px[i] + nx[i];
    agent.y = py[i] + ny[i];
    agent.z = pz[i] + nz[i];
  }
  if (symmetric) {
    for (let i = 0; i < half; i++) {
      const primary = agents[i];
      const partner = agents[i + half];
      const point = reflectPosition(primary.x, primary.y, primary.z, plane);
      const velocity = reflectVector(primary.vx, primary.vy, primary.vz, plane);
      partner.x = point[0];
      partner.y = point[1];
      partner.z = point[2];
      partner.vx = velocity[0];
      partner.vy = velocity[1];
      partner.vz = velocity[2];
    }
  }
  storeCrowd(flock, px, py, pz);
}

function nearestNode(x, y, z, nodes) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const distance = Math.hypot(x - node.x, y - node.y, z - node.z);
    if (distance < bestD) {
      bestD = distance;
      best = node;
    }
  }
  if (!best || !(best.radius > 0) || bestD >= best.radius) return null;
  const t = bestD / best.radius;
  return { node: best, distance: bestD, fall: 1 - t * t * (3 - 2 * t) };
}

function nearestLink(x, y, z, links) {
  const list = links || [];
  const reach = 0.36;
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < list.length; i++) {
    const link = list[i];
    const abx = link.bx - link.ax;
    const aby = link.by - link.ay;
    const abz = link.bz - link.az;
    const length2 = link.length * link.length;
    let t = length2 > 1e-8 ? ((x - link.ax) * abx + (y - link.ay) * aby + (z - link.az) * abz) / length2 : 0;
    t = Math.max(0, Math.min(1, t));
    const distance = Math.hypot(x - (link.ax + abx * t), y - (link.ay + aby * t), z - (link.az + abz * t));
    if (distance < bestD) {
      bestD = distance;
      best = link;
    }
  }
  if (!best || bestD >= reach) return null;
  const t = bestD / reach;
  return { link: best, distance: bestD, fall: 1 - t * t * (3 - 2 * t) };
}
