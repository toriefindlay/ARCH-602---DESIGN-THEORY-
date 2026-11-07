// Out of Our Hands
// The field is a cube. Every mark lives inside it.
// The same signature sits on all six faces. Marks meet that ink from within the volume.
//
// Attraction — toward nearby marks, toward the signature, and toward trails already left.
// Repulsion  — apart from nearby marks, and back off the ink when a mark touches it.
// Mimicry    — copies nearby marks, the signature's direction, and the direction of a trail.
// A trail is memory, not a new random force. The same beginning redraws the same paths.
//
// The same seed and the same strengths replay the same sequence. There is no per-frame randomness.

(() => {
const RULES = {
  count: 800,
  half: 200,
  neighborRadius: 78,
  repelRadius: 26,
  cruise: 0.42,
  maxAccel: 0.2,
  strokeReach: 360,
  strokeClearance: 18,
  strokeFound: 48,
  strokeAttract: 2.6,
  strokeRepel: 3.2,
  strokeMimic: 1.35,
  margin: 28,
  bound: 0.035,
  attractScale: 0.45,
  repelScale: 1.7,
  mimicScale: 0.12,
  spacingRadius: 25,
  spacingScale: 0.5,
  trailSpacing: 5,
  trailLength: 240,
  trailReach: 88,
  trailGather: 0.85,
  trailFollow: 1.15,
};

const OPENING = { attract: 0.45, repel: 0.6, mimic: 0.38 };

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function evenPositions(count, span) {
  const side = Math.ceil(Math.cbrt(count));
  const slots = [];
  for (let z = 0; z < side; z++) {
    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) slots.push([x, y, z]);
    }
  }
  const extra = slots.length - count;
  const drop = new Set();
  for (let i = 0; i < extra; i++) drop.add(Math.floor((i + 0.5) * slots.length / extra));
  const kept = [];
  for (let i = 0; i < slots.length; i++) if (!drop.has(i)) kept.push(slots[i]);
  return kept.slice(0, count).map(([x, y, z]) => [
    ((x + 0.5) / side * 2 - 1) * span,
    ((y + 0.5) / side * 2 - 1) * span,
    ((z + 0.5) / side * 2 - 1) * span,
  ]);
}

function createField(seed) {
  const rand = mulberry32(seed);
  const span = RULES.half - RULES.margin;
  const places = evenPositions(RULES.count, span);
  const agents = [];
  for (let i = 0; i < RULES.count; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const speed = RULES.cruise;
    const place = places[i];
    agents.push({
      x: place[0],
      y: place[1],
      z: place[2],
      vx: Math.sin(phi) * Math.cos(theta) * speed,
      vy: Math.sin(phi) * Math.sin(theta) * speed,
      vz: Math.cos(phi) * speed,
      fa: 0,
      fr: 0,
      fm: 0,
      phase: rand() * Math.PI * 2,
      tempo: 0.32 + rand() * 0.38,
      trail: [],
      found: false,
      atEnd: false,
      face: -1,
    });
  }
  return { agents, seed, time: 0 };
}

function buildGrid(agents, cell) {
  const grid = new Map();
  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const key = `${Math.floor(agent.x / cell)},${Math.floor(agent.y / cell)},${Math.floor(agent.z / cell)}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(i);
    else grid.set(key, [i]);
  }
  return grid;
}

function buildStrokeGrid(strokes, cell) {
  const grid = new Map();
  for (let i = 0; i < strokes.length; i++) {
    const stroke = strokes[i];
    const key = `${Math.floor((stroke.x1 + stroke.x2) / 2 / cell)},${Math.floor((stroke.y1 + stroke.y2) / 2 / cell)},${Math.floor((stroke.z1 + stroke.z2) / 2 / cell)}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(stroke);
    else grid.set(key, [stroke]);
  }
  return grid;
}

function nearestStroke(x, y, z, grid, cell, reach, strokeId) {
  const cx = Math.floor(x / cell);
  const cy = Math.floor(y / cell);
  const cz = Math.floor(z / cell);
  const reach2 = reach * reach;
  let best = null;
  for (let gz = cz - 1; gz <= cz + 1; gz++) {
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        const bucket = grid.get(`${gx},${gy},${gz}`);
        if (!bucket) continue;
        for (let n = 0; n < bucket.length; n++) {
          const stroke = bucket[n];
          if (strokeId != null && stroke.stroke !== strokeId) continue;
          const t = Math.max(0, Math.min(1, ((x - stroke.x1) * stroke.dx + (y - stroke.y1) * stroke.dy + (z - stroke.z1) * stroke.dz) / (stroke.len * stroke.len)));
          const px = stroke.x1 + stroke.dx * t;
          const py = stroke.y1 + stroke.dy * t;
          const pz = stroke.z1 + stroke.dz * t;
          const ddx = x - px;
          const ddy = y - py;
          const ddz = z - pz;
          const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
          if (d2 > reach2 || (best && d2 >= best.d2)) continue;
          best = {
            px, py, pz, d2,
            dx: stroke.dx, dy: stroke.dy, dz: stroke.dz, len: stroke.len,
            face: stroke.face == null ? 0 : stroke.face,
            along: (stroke.along0 || 0) + t * ((stroke.along1 == null ? 1 : stroke.along1) - (stroke.along0 || 0)),
          };
        }
      }
    }
  }
  if (!best) return null;
  best.dist = Math.sqrt(best.d2);
  return best;
}

function buildTrailGrid(agents, cell) {
  const grid = new Map();
  for (let i = 0; i < agents.length; i++) {
    const trail = agents[i].trail;
    for (let k = 0; k < trail.length; k++) {
      const point = trail[k];
      const key = `${Math.floor(point.x / cell)},${Math.floor(point.y / cell)},${Math.floor(point.z / cell)}`;
      const sample = {
        x: point.x, y: point.y, z: point.z,
        dx: point.dx, dy: point.dy, dz: point.dz,
        owner: i,
        age: 1,
      };
      const bucket = grid.get(key);
      if (bucket) bucket.push(sample);
      else grid.set(key, [sample]);
    }
  }
  return grid;
}

function readTrail(agent, index, grid, cell) {
  const cx = Math.floor(agent.x / cell);
  const cy = Math.floor(agent.y / cell);
  const cz = Math.floor(agent.z / cell);
  const reach = RULES.trailReach;
  const reach2 = reach * reach;
  let px = 0;
  let py = 0;
  let pz = 0;
  let pw = 0;
  let dx = 0;
  let dy = 0;
  let dz = 0;
  let dw = 0;
  for (let gz = cz - 1; gz <= cz + 1; gz++) {
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        const bucket = grid.get(`${gx},${gy},${gz}`);
        if (!bucket) continue;
        for (let n = 0; n < bucket.length; n++) {
          const point = bucket[n];
          if (point.owner === index && point.age > 0.78) continue;
          const ox = point.x - agent.x;
          const oy = point.y - agent.y;
          const oz = point.z - agent.z;
          const d2 = ox * ox + oy * oy + oz * oz;
          if (d2 < 9 || d2 > reach2) continue;
          const weight = point.age * (1 - Math.sqrt(d2) / reach);
          px += ox * weight;
          py += oy * weight;
          pz += oz * weight;
          pw += weight;
          dx += point.dx * weight;
          dy += point.dy * weight;
          dz += point.dz * weight;
          dw += weight;
        }
      }
    }
  }
  return { px, py, pz, pw, dx, dy, dz, dw };
}

function faceGather(agents) {
  const bins = new Map();
  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    if (!agent.atEnd || agent.face < 0) continue;
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
  return bins;
}

function step(world, input, strokes) {
  const { agents } = world;
  const cell = RULES.neighborRadius;
  const grid = buildGrid(agents, cell);
  const strokeCell = RULES.strokeReach;
  const strokeList = strokes || [];
  const strokeGrid = buildStrokeGrid(strokeList, strokeCell);
  let strokeCount = 0;
  for (let s = 0; s < strokeList.length; s++) {
    const id = strokeList[s].stroke || 0;
    if (id + 1 > strokeCount) strokeCount = id + 1;
  }
  if (!input.free && strokeCount > 0) {
    for (let i = 0; i < agents.length; i++) agents[i].stroke = i % strokeCount;
  }
  const trailCell = RULES.trailReach;
  const trailGrid = input.free ? null : buildTrailGrid(agents, trailCell);
  const facePull = input.free ? null : faceGather(agents);
  const reach2 = cell * cell;
  const repel = RULES.repelRadius;
  const limit = RULES.half - 4;
  const acc = agents.map(() => ({
    ax: 0, ay: 0, az: 0, fa: 0, fr: 0, fm: 0, nearest: Infinity, align: null,
  }));

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const ix = Math.floor(agent.x / cell);
    const iy = Math.floor(agent.y / cell);
    const iz = Math.floor(agent.z / cell);
    let count = 0;
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let svx = 0;
    let svy = 0;
    let svz = 0;
    let alignDots = 0;
    let alignCount = 0;
    const speed = Math.hypot(agent.vx, agent.vy, agent.vz) || 1;
    let rax = 0;
    let ray = 0;
    let raz = 0;
    let max = 0;
    let may = 0;
    let maz = 0;

    for (let gz = iz - 1; gz <= iz + 1; gz++) {
      for (let gy = iy - 1; gy <= iy + 1; gy++) {
        for (let gx = ix - 1; gx <= ix + 1; gx++) {
          const bucket = grid.get(`${gx},${gy},${gz}`);
          if (!bucket) continue;
          for (let n = 0; n < bucket.length; n++) {
            const j = bucket[n];
            if (j === i) continue;
            const other = agents[j];
            const dx = other.x - agent.x;
            const dy = other.y - agent.y;
            const dz = other.z - agent.z;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 === 0 || d2 > reach2) continue;
            const d = Math.sqrt(d2);
            if (d < acc[i].nearest) acc[i].nearest = d;
            if (input.free) {
              if (d < RULES.spacingRadius) {
                const push = 1 - d / RULES.spacingRadius;
                rax -= (dx / d) * push;
                ray -= (dy / d) * push;
                raz -= (dz / d) * push;
              }
              continue;
            }
            count += 1;
            sx += other.x;
            sy += other.y;
            sz += other.z;
            svx += other.vx;
            svy += other.vy;
            svz += other.vz;
            const os = Math.hypot(other.vx, other.vy, other.vz);
            if (os > 0.05 && speed > 0.05) {
              alignDots += (agent.vx * other.vx + agent.vy * other.vy + agent.vz * other.vz) / (speed * os);
              alignCount += 1;
            }
            if (d < repel) {
              const push = (1 - d / repel) * (repel / d);
              rax -= (dx / d) * push;
              ray -= (dy / d) * push;
              raz -= (dz / d) * push;
            }
          }
        }
      }
    }

    if (input.free) {
      acc[i].ax += rax * RULES.spacingScale;
      acc[i].ay += ray * RULES.spacingScale;
      acc[i].az += raz * RULES.spacingScale;
      acc[i].fr = Math.hypot(rax, ray, raz) * RULES.spacingScale;
    } else if (count > 0) {
      const px = sx / count - agent.x;
      const py = sy / count - agent.y;
      const pz = sz / count - agent.z;
      const pd = Math.hypot(px, py, pz) || 1;
      const pull = Math.min(pd, 48) / 48;
      max = (px / pd) * pull * input.attract * RULES.attractScale;
      may = (py / pd) * pull * input.attract * RULES.attractScale;
      maz = (pz / pd) * pull * input.attract * RULES.attractScale;
      acc[i].ax += max + (svx / count - agent.vx) * input.mimic * RULES.mimicScale;
      acc[i].ay += may + (svy / count - agent.vy) * input.mimic * RULES.mimicScale;
      acc[i].az += maz + (svz / count - agent.vz) * input.mimic * RULES.mimicScale;
      acc[i].fm = Math.hypot(svx / count - agent.vx, svy / count - agent.vy, svz / count - agent.vz) * input.mimic * RULES.mimicScale;
    }

    if (!input.free) {
    acc[i].ax += rax * input.repel * RULES.repelScale;
    acc[i].ay += ray * input.repel * RULES.repelScale;
    acc[i].az += raz * input.repel * RULES.repelScale;
    acc[i].fa = Math.hypot(max, may, maz);
    acc[i].fr = Math.hypot(rax, ray, raz) * input.repel * RULES.repelScale;
    if (alignCount) acc[i].align = alignDots / alignCount;

    const ink = nearestStroke(agent.x, agent.y, agent.z, strokeGrid, strokeCell, RULES.strokeReach, strokeCount ? agent.stroke : null);
    if (ink && ink.dist > 0.001) {
      const arrived = agent.found;
      if (ink.dist < RULES.strokeFound) agent.found = true;
      const ixn = (ink.px - agent.x) / ink.dist;
      const iyn = (ink.py - agent.y) / ink.dist;
      const izn = (ink.pz - agent.z) / ink.dist;
      if (!arrived) {
        const far = Math.max(0, 1 - ink.dist / RULES.strokeReach);
        const along = 0.4 + 0.6 * far;
        const pull = along * input.attract * RULES.strokeAttract;
        acc[i].ax += ixn * pull;
        acc[i].ay += iyn * pull;
        acc[i].az += izn * pull;
        acc[i].fa += Math.abs(pull);
      } else if (ink.len > 0.001) {
        const finished = agent.atEnd || (ink.along > 0.78 && ink.dist < 90);
        if (finished) {
          agent.face = agent.atEnd ? agent.face : ink.face;
          agent.atEnd = true;
          const bin = facePull.get(agent.face + ":" + (agent.stroke || 0));
          if (bin && bin.n > 1) {
            const ox = bin.x / bin.n - agent.x;
            const oy = bin.y / bin.n - agent.y;
            const oz = bin.z / bin.n - agent.z;
            const od = Math.hypot(ox, oy, oz) || 1;
            const pull = Math.min(od, 90) / 90 * 0.7;
            acc[i].ax += (ox / od) * pull;
            acc[i].ay += (oy / od) * pull;
            acc[i].az += (oz / od) * pull;
            acc[i].fa += pull;
          }
          const hold = 0.22;
          acc[i].ax += ixn * hold;
          acc[i].ay += iyn * hold;
          acc[i].az += izn * hold;
        } else {
          const ahead = 0.16;
          acc[i].ax += (ink.dx / ink.len) * ahead;
          acc[i].ay += (ink.dy / ink.len) * ahead;
          acc[i].az += (ink.dz / ink.len) * ahead;
          if (ink.dist < 180) {
            const steer = (1 - ink.dist / 180) * input.mimic * RULES.strokeMimic;
            const mx = (ink.dx / ink.len * RULES.cruise - agent.vx) * steer;
            const my = (ink.dy / ink.len * RULES.cruise - agent.vy) * steer;
            const mz = (ink.dz / ink.len * RULES.cruise - agent.vz) * steer;
            acc[i].ax += mx;
            acc[i].ay += my;
            acc[i].az += mz;
            acc[i].fm += Math.hypot(mx, my, mz);
          }
          if (ink.dist < 110) {
            const shove = (1 - ink.dist / 110) * input.repel * RULES.strokeRepel;
            acc[i].ax -= ixn * shove;
            acc[i].ay -= iyn * shove;
            acc[i].az -= izn * shove;
            acc[i].fr += shove;
          }
        }
      }
    }

    const trail = readTrail(agent, i, trailGrid, trailCell);
    if (trail.pw > 0.001) {
      const pd = Math.hypot(trail.px, trail.py, trail.pz) || 1;
      const sat = trail.pw / (trail.pw + 1.4);
      const gather = (0.15 + input.attract) * sat * RULES.trailGather;
      acc[i].ax += (trail.px / pd) * gather;
      acc[i].ay += (trail.py / pd) * gather;
      acc[i].az += (trail.pz / pd) * gather;
      acc[i].fa += gather;
    }
    if (trail.dw > 0.001) {
      const dd = Math.hypot(trail.dx, trail.dy, trail.dz) || 1;
      const sat = trail.dw / (trail.dw + 1.4);
      const follow = (0.1 + input.mimic) * sat * RULES.trailFollow;
      const tx = (trail.dx / dd) * RULES.cruise - agent.vx;
      const ty = (trail.dy / dd) * RULES.cruise - agent.vy;
      const tz = (trail.dz / dd) * RULES.cruise - agent.vz;
      acc[i].ax += tx * follow;
      acc[i].ay += ty * follow;
      acc[i].az += tz * follow;
      acc[i].fm += follow;
    }
    }

    const inset = RULES.half - RULES.margin;
    if (agent.x < -inset) acc[i].ax += (-inset - agent.x) * RULES.bound;
    else if (agent.x > inset) acc[i].ax -= (agent.x - inset) * RULES.bound;
    if (agent.y < -inset) acc[i].ay += (-inset - agent.y) * RULES.bound;
    else if (agent.y > inset) acc[i].ay -= (agent.y - inset) * RULES.bound;
    if (agent.z < -inset) acc[i].az += (-inset - agent.z) * RULES.bound;
    else if (agent.z > inset) acc[i].az -= (agent.z - inset) * RULES.bound;

    const magnitude = Math.hypot(acc[i].ax, acc[i].ay, acc[i].az);
    if (magnitude > RULES.maxAccel) {
      const scale = RULES.maxAccel / magnitude;
      acc[i].ax *= scale;
      acc[i].ay *= scale;
      acc[i].az *= scale;
    }
  }

  let spreadSum = 0;
  let spreadCount = 0;
  let alignSum = 0;
  let alignCount = 0;

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const force = acc[i];
    agent.vx += force.ax;
    agent.vy += force.ay;
    agent.vz += force.az;
    if (!input.free) {
      // A slow curve fixed at the start. It reverses, so the path weaves instead of circling.
      const weave = 0.35 + 0.85 * (1 - input.mimic);
      const curl = Math.sin(world.time * agent.tempo + agent.phase) * 0.018 * weave;
      const curl2 = Math.cos(world.time * agent.tempo * 0.73 + agent.phase) * 0.018 * weave;
      const vx = agent.vx;
      const vy = agent.vy;
      const vz = agent.vz;
      agent.vx += vy * curl - vz * curl2;
      agent.vy += vz * curl * 0.65 - vx * curl;
      agent.vz += vx * curl2 - vy * curl * 0.65;
    }
    const speed = Math.hypot(agent.vx, agent.vy, agent.vz) || 1;
    agent.vx = (agent.vx / speed) * RULES.cruise;
    agent.vy = (agent.vy / speed) * RULES.cruise;
    agent.vz = (agent.vz / speed) * RULES.cruise;
    agent.x = Math.min(limit, Math.max(-limit, agent.x + agent.vx));
    agent.y = Math.min(limit, Math.max(-limit, agent.y + agent.vy));
    agent.z = Math.min(limit, Math.max(-limit, agent.z + agent.vz));
    if (input.free) {
      agent.found = false;
      agent.atEnd = false;
      agent.face = -1;
      if (agent.trail.length) agent.trail.length = 0;
    } else if (agent.found) {
      const last = agent.trail[agent.trail.length - 1];
      const moved = last
        ? Math.hypot(agent.x - last.x, agent.y - last.y, agent.z - last.z)
        : RULES.trailSpacing;
      if (moved >= RULES.trailSpacing) {
        agent.trail.push({
          x: agent.x, y: agent.y, z: agent.z,
          dx: agent.vx, dy: agent.vy, dz: agent.vz,
          t: world.time,
        });
        if (agent.trail.length > RULES.trailLength) agent.trail.shift();
      }
    }
    agent.fa = force.fa;
    agent.fr = force.fr;
    agent.fm = force.fm;
    if (force.nearest < Infinity) {
      spreadSum += force.nearest;
      spreadCount += 1;
    }
    if (force.align !== null) {
      alignSum += force.align;
      alignCount += 1;
    }
  }

  world.time += 1 / 60;
  return {
    spread: spreadCount ? spreadSum / spreadCount : 0,
    align: alignCount ? alignSum / alignCount : 0,
  };
}

function describe(input, stats) {
  const clustered = stats.spread > 0 && stats.spread < 32;
  const open = stats.spread > 48;
  const agreed = stats.align > 0.55;
  if (input.attract > 0.62 && input.repel > 0.62) {
    return "Attraction and repulsion are both strong. The figure is their argument. The signature set the strengths. It did not draw this.";
  }
  if (input.attract > 0.62 && clustered) {
    return "The marks have gathered. Attraction, the ink, and the start did that. The clusters were not placed.";
  }
  if (input.attract > 0.62) {
    return "Attraction is high, and the volume has not gathered. The strength in the signature is not yet the form.";
  }
  if (input.repel > 0.62 && open) {
    return "The volume stays open. Repulsion is refusing a figure more than it is drawing one.";
  }
  if (input.mimic > 0.62 && agreed) {
    return "Directions are lining up. Mimicry copied the stroke and whoever was near. Nobody selected this heading.";
  }
  if (input.mimic > 0.62) {
    return "Mimicry is on, and agreement is still incomplete. Copying takes time, and the other rules interrupt it.";
  }
  return "The signature set the strengths. The rules and the beginning are steering. The form is not a shape that was drawn.";
}

// Inflate the trails, then pull the surface back. Gaps smaller than the inflation close.
// The skin that remains is the final form.
function shrinkWrap(agents) {
  const RES = 42;
  const DILATE = 3;
  const ERODE = 2;
  const limit = RULES.half - 4;
  const reach = 40;
  const span = (limit + reach) * 2;
  const cell = span / RES;
  const origin = -(limit + reach);
  const size = RES * RES * RES;
  const solid = new Uint8Array(size);
  const at = (x, y, z) => {
    const i = Math.floor((x - origin) / cell);
    const j = Math.floor((y - origin) / cell);
    const k = Math.floor((z - origin) / cell);
    if (i < 0 || j < 0 || k < 0 || i >= RES || j >= RES || k >= RES) return -1;
    return i + RES * (j + RES * k);
  };
  let marks = 0;
  for (let a = 0; a < agents.length; a++) {
    const trail = agents[a].trail;
    if (!trail) continue;
    for (let p = 0; p < trail.length; p++) {
      const id = at(trail[p].x, trail[p].y, trail[p].z);
      if (id < 0 || solid[id]) continue;
      solid[id] = 1;
      marks += 1;
    }
  }
  if (!marks) return null;

  const ball = (radius) => {
    const list = [];
    const r2 = radius * radius + 1e-4;
    for (let z = -radius; z <= radius; z++) {
      for (let y = -radius; y <= radius; y++) {
        for (let x = -radius; x <= radius; x++) {
          if (x * x + y * y + z * z <= r2) list.push([x, y, z]);
        }
      }
    }
    return list;
  };
  const growBy = ball(DILATE);
  const pullBy = ball(ERODE);
  const grown = new Uint8Array(size);
  for (let z = 0; z < RES; z++) {
    for (let y = 0; y < RES; y++) {
      for (let x = 0; x < RES; x++) {
        if (!solid[x + RES * (y + RES * z)]) continue;
        for (let n = 0; n < growBy.length; n++) {
          const nx = x + growBy[n][0];
          const ny = y + growBy[n][1];
          const nz = z + growBy[n][2];
          if (nx < 0 || ny < 0 || nz < 0 || nx >= RES || ny >= RES || nz >= RES) continue;
          grown[nx + RES * (ny + RES * nz)] = 1;
        }
      }
    }
  }
  const skin = new Uint8Array(size);
  for (let z = 0; z < RES; z++) {
    for (let y = 0; y < RES; y++) {
      const base = RES * (y + RES * z);
      for (let x = 0; x < RES; x++) {
        let keep = 1;
        for (let n = 0; n < pullBy.length; n++) {
          const nx = x + pullBy[n][0];
          const ny = y + pullBy[n][1];
          const nz = z + pullBy[n][2];
          if (nx < 0 || ny < 0 || nz < 0 || nx >= RES || ny >= RES || nz >= RES || !grown[nx + RES * (ny + RES * nz)]) {
            keep = 0;
            break;
          }
        }
        skin[base + x] = keep;
      }
    }
  }

  const vmap = new Map();
  const pos = [];
  const quads = [];
  const vertex = (i, j, k) => {
    const key = i + (RES + 1) * (j + (RES + 1) * k);
    let id = vmap.get(key);
    if (id == null) {
      id = pos.length / 3;
      vmap.set(key, id);
      pos.push(origin + i * cell, origin + j * cell, origin + k * cell);
    }
    return id;
  };
  const occupied = (x, y, z) => (
    x >= 0 && y >= 0 && z >= 0 && x < RES && y < RES && z < RES && skin[x + RES * (y + RES * z)]
  );
  for (let z = 0; z < RES; z++) {
    for (let y = 0; y < RES; y++) {
      for (let x = 0; x < RES; x++) {
        if (!occupied(x, y, z)) continue;
        if (!occupied(x + 1, y, z)) quads.push(vertex(x + 1, y, z), vertex(x + 1, y + 1, z), vertex(x + 1, y + 1, z + 1), vertex(x + 1, y, z + 1));
        if (!occupied(x - 1, y, z)) quads.push(vertex(x, y, z), vertex(x, y, z + 1), vertex(x, y + 1, z + 1), vertex(x, y + 1, z));
        if (!occupied(x, y + 1, z)) quads.push(vertex(x, y + 1, z), vertex(x, y + 1, z + 1), vertex(x + 1, y + 1, z + 1), vertex(x + 1, y + 1, z));
        if (!occupied(x, y - 1, z)) quads.push(vertex(x, y, z), vertex(x + 1, y, z), vertex(x + 1, y, z + 1), vertex(x, y, z + 1));
        if (!occupied(x, y, z + 1)) quads.push(vertex(x, y, z + 1), vertex(x + 1, y, z + 1), vertex(x + 1, y + 1, z + 1), vertex(x, y + 1, z + 1));
        if (!occupied(x, y, z - 1)) quads.push(vertex(x, y, z), vertex(x, y + 1, z), vertex(x + 1, y + 1, z), vertex(x + 1, y, z));
      }
    }
  }
  if (!quads.length) return null;

  const count = pos.length / 3;
  const acc = new Float32Array(pos.length);
  const hits = new Uint16Array(count);
  for (let iter = 0; iter < 6; iter++) {
    acc.fill(0);
    hits.fill(0);
    for (let q = 0; q < quads.length; q += 4) {
      for (let e = 0; e < 4; e++) {
        const a = quads[q + e];
        const b = quads[q + ((e + 1) % 4)];
        acc[a * 3] += pos[b * 3];
        acc[a * 3 + 1] += pos[b * 3 + 1];
        acc[a * 3 + 2] += pos[b * 3 + 2];
        hits[a] += 1;
      }
    }
    for (let i = 0; i < count; i++) {
      if (!hits[i]) continue;
      pos[i * 3] = pos[i * 3] * 0.5 + (acc[i * 3] / hits[i]) * 0.5;
      pos[i * 3 + 1] = pos[i * 3 + 1] * 0.5 + (acc[i * 3 + 1] / hits[i]) * 0.5;
      pos[i * 3 + 2] = pos[i * 3 + 2] * 0.5 + (acc[i * 3 + 2] / hits[i]) * 0.5;
    }
  }
  return { pos, quads };
}

window.FieldModel = { RULES, OPENING, createField, step, describe, shrinkWrap };
})();
