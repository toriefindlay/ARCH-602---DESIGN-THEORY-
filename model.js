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
  count: 1200,
  half: 200,
  neighborRadius: 78,
  repelRadius: 26,
  cruise: 0.42,
  maxAccel: 0.08,
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
  trailGather: 0.42,
  trailFollow: 0.55,
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

function nearestStroke(x, y, z, grid, cell, reach) {
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
          const t = Math.max(0, Math.min(1, ((x - stroke.x1) * stroke.dx + (y - stroke.y1) * stroke.dy + (z - stroke.z1) * stroke.dz) / (stroke.len * stroke.len)));
          const px = stroke.x1 + stroke.dx * t;
          const py = stroke.y1 + stroke.dy * t;
          const pz = stroke.z1 + stroke.dz * t;
          const ddx = x - px;
          const ddy = y - py;
          const ddz = z - pz;
          const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
          if (d2 > reach2 || (best && d2 >= best.d2)) continue;
          best = { px, py, pz, d2, dx: stroke.dx, dy: stroke.dy, dz: stroke.dz, len: stroke.len };
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

function step(world, input, strokes) {
  const { agents } = world;
  const cell = RULES.neighborRadius;
  const grid = buildGrid(agents, cell);
  const strokeCell = RULES.strokeReach;
  const strokeGrid = buildStrokeGrid(strokes || [], strokeCell);
  const trailCell = RULES.trailReach;
  const trailGrid = input.free ? null : buildTrailGrid(agents, trailCell);
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

    const ink = nearestStroke(agent.x, agent.y, agent.z, strokeGrid, strokeCell, RULES.strokeReach);
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
      } else if (ink.dist < 70) {
        const steer = (1 - ink.dist / 70) * input.mimic * RULES.strokeMimic;
        const mx = (ink.dx / ink.len * RULES.cruise - agent.vx) * steer;
        const my = (ink.dy / ink.len * RULES.cruise - agent.vy) * steer;
        const mz = (ink.dz / ink.len * RULES.cruise - agent.vz) * steer;
        acc[i].ax += mx;
        acc[i].ay += my;
        acc[i].az += mz;
        acc[i].fm += Math.hypot(mx, my, mz);
        if (ink.dist < 55) {
          const shove = (1 - ink.dist / 55) * Math.max(input.repel, 0.35) * RULES.strokeRepel;
          acc[i].ax -= ixn * shove;
          acc[i].ay -= iyn * shove;
          acc[i].az -= izn * shove;
          acc[i].fr += shove;
        }
      }
    }

    const trail = readTrail(agent, i, trailGrid, trailCell);
    if (trail.pw > 0.001) {
      const pd = Math.hypot(trail.px, trail.py, trail.pz) || 1;
      const sat = trail.pw / (trail.pw + 1.4);
      const gather = (0.5 + input.attract) * sat * RULES.trailGather;
      acc[i].ax += (trail.px / pd) * gather;
      acc[i].ay += (trail.py / pd) * gather;
      acc[i].az += (trail.pz / pd) * gather;
      acc[i].fa += gather;
    }
    if (trail.dw > 0.001) {
      const dd = Math.hypot(trail.dx, trail.dy, trail.dz) || 1;
      const sat = trail.dw / (trail.dw + 1.4);
      const follow = (0.35 + input.mimic) * sat * RULES.trailFollow;
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
      const curl = Math.sin(world.time * agent.tempo + agent.phase) * 0.011;
      const curl2 = Math.cos(world.time * agent.tempo * 0.73 + agent.phase) * 0.011;
      const vx = agent.vx;
      const vy = agent.vy;
      const vz = agent.vz;
      agent.vx += vy * curl - vz * curl2;
      agent.vy += vz * curl * 0.65 - vx * curl;
      agent.vz += vx * curl2 - vy * curl * 0.65;
    }
    const speed = Math.hypot(agent.vx, agent.vy, agent.vz) || 1;
    const breathe = input.free ? 1 : 0.84 + 0.16 * Math.sin(world.time * agent.tempo * 0.62 + agent.phase);
    const eased = input.free ? RULES.cruise : speed + (RULES.cruise * breathe - speed) * 0.1;
    agent.vx = (agent.vx / speed) * eased;
    agent.vy = (agent.vy / speed) * eased;
    agent.vz = (agent.vz / speed) * eased;
    agent.x = Math.min(limit, Math.max(-limit, agent.x + agent.vx));
    agent.y = Math.min(limit, Math.max(-limit, agent.y + agent.vy));
    agent.z = Math.min(limit, Math.max(-limit, agent.z + agent.vz));
    if (input.free) {
      agent.found = false;
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
  const sum = input.attract + input.repel + input.mimic;
  const clustered = stats.spread > 0 && stats.spread < 32;
  const open = stats.spread > 48;
  const agreed = stats.align > 0.55;
  if (sum < 0.2) {
    return "The rules are nearly off. What remains is the beginning, slowing down.";
  }
  if (input.attract > 0.62 && input.repel > 0.62) {
    return clustered
      ? "Attraction and repulsion are both strong, and the volume has gathered anyway. Neither strength placed these clusters."
      : "Attraction and repulsion are both strong. The figure is the argument between them, not a shape either one owns.";
  }
  if (input.attract > 0.62 && !clustered) {
    return "Attraction is set high, and the volume has not gathered. The strength you chose is not yet the form.";
  }
  if (input.attract > 0.62 && clustered) {
    return "The marks have gathered. You did not place the clusters. Attraction, the ink, and the start did.";
  }
  if (input.repel > 0.62 && open && input.attract < 0.35) {
    return "The volume is staying open. Repulsion is refusing a figure more than it is drawing one.";
  }
  if (input.mimic > 0.62 && !agreed) {
    return "Mimicry is on, and agreement is still incomplete. Copying takes time, and the other rules interrupt it.";
  }
  if (input.mimic > 0.62 && agreed) {
    return "Directions are lining up. Mimicry copies the stroke and whoever is near. Nobody selected this heading.";
  }
  return "The three rules are acting through the cube. The trails left behind are the pattern the next marks follow.";
}

window.FieldModel = { RULES, OPENING, createField, step, describe };
})();
