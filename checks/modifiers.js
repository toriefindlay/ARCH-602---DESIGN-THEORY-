// Repeatable checks for Wind, Stripes, and Reaction.
// Open checks/preview.html. This file is not part of the instrument.

import {
  FRAME_RADIUS,
  STUDIES,
  advanceField,
  createFlock,
  porositySample,
  readReaction,
  readSignature,
  resetField,
  curveFieldAt,
  readModifierFeel,
  setModifier,
  setModifiers,
  setSymmetry,
  publishNodes,
  mirrorOf,
  stepFlock,
  trailLook,
  tubeRadiusFor,
  TUBE_MIN,
  TUBE_MAX,
} from "../sim.js";

function stroke() {
  const points = [];
  for (let i = 0; i < 90; i++) {
    const t = i / 89;
    points.push({ x: 30 + t * 460, y: 80 + Math.sin(t * Math.PI * 2) * 36 });
  }
  return readSignature(points, 520, 240);
}

function sampleAt(values, size, x, y) {
  const span = FRAME_RADIUS * 2;
  const gx = ((x + FRAME_RADIUS) / span) * size;
  const gy = ((y + FRAME_RADIUS) / span) * size;
  const sx = ((gx % size) + size) % size;
  const sy = ((gy % size) + size) % size;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const tx = sx - x0;
  const ty = sy - y0;
  const x1 = (x0 + 1) % size;
  const y1 = (y0 + 1) % size;
  const v00 = values[y0 * size + x0];
  const v10 = values[y0 * size + x1];
  const v01 = values[y1 * size + x0];
  const v11 = values[y1 * size + x1];
  return (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
}

function positions(flock) {
  return flock.agents.map((agent) => [agent.x, agent.y, agent.z, agent.vx, agent.vy, agent.vz]);
}

function maxDelta(left, right) {
  let max = 0;
  for (let i = 0; i < left.length; i++) {
    for (let k = 0; k < 6; k++) max = Math.max(max, Math.abs(left[i][k] - right[i][k]));
  }
  return max;
}

function run(signature, id, strength, steps, study, seed = 4) {
  resetField(seed);
  setModifier({ id, strength });
  const flock = createFlock(signature, study, seed);
  for (let step = 0; step < steps; step++) {
    advanceField();
    stepFlock(flock);
  }
  return flock;
}

function summarise(flock) {
  const agents = flock.agents;
  const field = readReaction();
  let speed = 0;
  let maxRadius = 0;
  let nearest = Infinity;
  let value = 0;
  let finite = true;
  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    if (!Number.isFinite(agent.x + agent.y + agent.z + agent.vx + agent.vy + agent.vz)) finite = false;
    const pace = Math.hypot(agent.vx, agent.vy, agent.vz);
    if (pace > flock.weights.speed + 1e-8) finite = false;
    speed += pace;
    maxRadius = Math.max(maxRadius, Math.hypot(agent.x, agent.y, agent.z));
    sx += agent.x;
    sy += agent.y;
    sz += agent.z;
    value += sampleAt(field.values, field.size, agent.x, agent.y);
    for (let j = i + 1; j < agents.length; j++) {
      const other = agents[j];
      nearest = Math.min(nearest, Math.hypot(agent.x - other.x, agent.y - other.y, agent.z - other.z));
    }
  }
  const count = agents.length;
  const mx = sx / count;
  const my = sy / count;
  const mz = sz / count;
  let spread = 0;
  let align = 0;
  let pairs = 0;
  for (const agent of agents) spread += (agent.x - mx) ** 2 + (agent.y - my) ** 2 + (agent.z - mz) ** 2;
  for (let i = 0; i < count; i += 3) {
    const agent = agents[i];
    const scale = Math.hypot(agent.vx, agent.vy, agent.vz) || 1;
    for (let j = i + 1; j < Math.min(count, i + 8); j++) {
      const other = agents[j];
      const otherScale = Math.hypot(other.vx, other.vy, other.vz) || 1;
      align += (agent.vx * other.vx + agent.vy * other.vy + agent.vz * other.vz) / (scale * otherScale);
      pairs += 1;
    }
  }
  return {
    finite,
    maxRadius,
    nearest,
    spread: Math.sqrt(spread / count),
    meanSpeed: speed / count,
    align: align / pairs,
    value: value / count,
    cruise: flock.weights.speed,
  };
}

function fieldReport() {
  let min = Infinity;
  let max = -Infinity;
  let finite = true;
  let peaks = 0;
  const field = readReaction();
  const { values, size } = field;
  for (const value of values) {
    if (!Number.isFinite(value)) finite = false;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const current = values[i * size + j];
      if (current < 0.18) continue;
      let peak = true;
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue;
          const ni = (i + di + size) % size;
          const nj = (j + dj + size) % size;
          if (values[ni * size + nj] > current) peak = false;
        }
      }
      if (peak) peaks += 1;
    }
  }
  return { min, max, finite, peaks, field };
}

function meanVoidness(flock) {
  let sum = 0;
  for (const agent of flock.agents) sum += porositySample(agent.x, agent.y, agent.z).voidness;
  return sum / flock.agents.length;
}

function passageReport(seed) {
  resetField(seed);
  const size = 16;
  const span = 1.5;
  const step = (span * 2) / size;
  const open = new Uint8Array(size * size * size);
  let total = 0;
  const index = (x, y, z) => x + size * (y + size * z);
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const sample = porositySample(-span + (x + 0.5) * step, -span + (y + 0.5) * step, -span + (z + 0.5) * step);
        if (sample.voidness < 0.35) {
          open[index(x, y, z)] = 1;
          total += 1;
        }
      }
    }
  }
  const seen = new Uint8Array(open.length);
  const start = open.indexOf(1);
  const stack = [start];
  seen[start] = 1;
  let count = 0;
  while (stack.length) {
    const current = stack.pop();
    count += 1;
    const x = current % size;
    const y = Math.floor(current / size) % size;
    const z = Math.floor(current / (size * size));
    const next = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (let n = 0; n < next.length; n++) {
      const nx = x + next[n][0];
      const ny = y + next[n][1];
      const nz = z + next[n][2];
      if (nx < 0 || ny < 0 || nz < 0 || nx >= size || ny >= size || nz >= size) continue;
      const id = index(nx, ny, nz);
      if (!open[id] || seen[id]) continue;
      seen[id] = 1;
      stack.push(id);
    }
  }
  return { connected: count / total, fraction: total / open.length };
}

function bandValue(flock) {
  const field = readReaction();
  const nodes = flock.signature.nodes;
  let near = 0;
  let nearN = 0;
  let far = 0;
  let farN = 0;
  for (const agent of flock.agents) {
    let close = false;
    for (const node of nodes) {
      if (Math.hypot(agent.x - node.x, agent.y - node.y, agent.z - node.z) < node.radius) close = true;
    }
    const value = sampleAt(field.values, field.size, agent.x, agent.y);
    if (close) {
      near += value;
      nearN += 1;
    } else {
      far += value;
      farN += 1;
    }
  }
  return { near: near / (nearN || 1), far: far / (farN || 1), nearN, farN };
}

export function runChecks() {
  setSymmetry(false);
  const failures = [];
  const fail = (name, detail) => failures.push({ name, detail });
  const signature = stroke();
  const none = run(signature, "none", 1, 500, STUDIES[0]);
  const reactionZero = run(signature, "reaction", 0, 500, STUDIES[0]);
  const stripesZero = run(signature, "stripes", 0, 500, STUDIES[0]);
  if (maxDelta(positions(none), positions(reactionZero)) !== 0) fail("reaction-zero", "strength 0 changed the flock");
  if (maxDelta(positions(none), positions(stripesZero)) !== 0) fail("stripes-zero", "strength 0 changed the flock");

  const calm = summarise(run(signature, "reaction", 0, 1400, STUDIES[0]));
  const reactionFlock = run(signature, "reaction", 1, 1400, STUDIES[0]);
  const cohesion = summarise(reactionFlock);
  const separation = summarise(run(signature, "reaction", 0.85, 1400, STUDIES[1]));
  const alignment = summarise(run(signature, "reaction", 0.85, 1400, STUDIES[2]));
  const reactionNear = bandValue(reactionFlock);
  if (!(reactionNear.nearN > 4 && reactionNear.near > reactionNear.far + 0.02)) fail("reaction-gather", reactionNear);
  if (!(cohesion.nearest < separation.nearest * 0.5)) fail("studies-spacing", "separation is not more open");
  if (!(alignment.align > 0.9 && alignment.meanSpeed > alignment.cruise * 0.5)) fail("studies-streams", "alignment lost its stream");
  if (!(cohesion.spread > 0.08 && cohesion.spread < separation.spread)) fail("studies-spread", "cohesion collapsed or matched separation");
  for (const report of [cohesion, separation, alignment]) {
    if (!report.finite || report.maxRadius > FRAME_RADIUS) fail("bounds", report);
  }

  const first = positions(run(signature, "reaction", 0.7, 400, STUDIES[2], 4));
  const second = positions(run(signature, "reaction", 0.7, 400, STUDIES[2], 4));
  if (maxDelta(first, second) !== 0) fail("deterministic", "same seed diverged");

  setModifier({ id: "reaction", strength: 1 });
  resetField(4);
  for (let step = 0; step < 3600; step++) advanceField();
  const developed = fieldReport();
  if (!developed.finite || developed.max > 1 || developed.min < 0 || developed.peaks < 4) {
    fail("field", developed);
  }
  const held = readReaction().values[0];
  if (readReaction().values[0] !== held) fail("pause", "field changed without a step");

  const bubblesZero = run(signature, "bubbles", 0, 500, STUDIES[0]);
  if (maxDelta(positions(none), positions(bubblesZero)) !== 0) fail("bubbles-zero", "strength 0 changed the flock");
  const plain = summarise(run(signature, "none", 1, 1400, STUDIES[0]));
  const bubbled = summarise(run(signature, "bubbles", 1, 1400, STUDIES[0]));
  const bubbledSeparation = summarise(run(signature, "bubbles", 1, 1400, STUDIES[1]));
  const bubbledAlignment = summarise(run(signature, "bubbles", 1, 1400, STUDIES[2]));
  if (!(bubbled.spread > plain.spread * 1.05 && bubbled.meanSpeed > 0.001)) fail("bubbles-open", { plain, bubbled });
  if (!(bubbledSeparation.nearest > bubbled.nearest && bubbledSeparation.spread > bubbled.spread)) fail("bubbles-studies", { bubbled, bubbledSeparation });
  if (!(bubbledAlignment.align > 0.85 && bubbledAlignment.meanSpeed > bubbledAlignment.cruise * 0.55)) fail("bubbles-streams", bubbledAlignment);
  for (const report of [bubbled, bubbledSeparation, bubbledAlignment]) {
    if (!report.finite || report.maxRadius > FRAME_RADIUS) fail("bubbles-bounds", report);
  }
  const bubbleAgain = positions(run(signature, "bubbles", 0.8, 300, STUDIES[0], 6));
  const bubbleRepeat = positions(run(signature, "bubbles", 0.8, 300, STUDIES[0], 6));
  if (maxDelta(bubbleAgain, bubbleRepeat) !== 0) fail("bubbles-deterministic", "same seed diverged");
  for (const id of ["wind", "stripes", "reaction", "bubbles", "porosity", "murmuration"]) {
    const flock = run(signature, id, 0.6, 240, STUDIES[2], 3);
    const report = summarise(flock);
    if (!report.finite || report.maxRadius > FRAME_RADIUS) fail("switch-" + id, report);
  }

  const poresZero = run(signature, "porosity", 0, 500, STUDIES[0]);
  if (maxDelta(positions(none), positions(poresZero)) !== 0) fail("porosity-zero", "strength 0 changed the flock");
  const porePlainFlock = run(signature, "none", 1, 1000, STUDIES[0], 31);
  const poreCohesionFlock = run(signature, "porosity", 1, 1000, STUDIES[0], 31);
  const poreCohesion = summarise(poreCohesionFlock);
  const poreSeparation = summarise(run(signature, "porosity", 1, 1000, STUDIES[1], 31));
  const poreAlignment = summarise(run(signature, "porosity", 1, 1000, STUDIES[2], 31));
  const plainVoid = meanVoidness(porePlainFlock);
  const poreVoid = meanVoidness(poreCohesionFlock);
  if (!(maxDelta(positions(porePlainFlock), positions(poreCohesionFlock)) > 0.02)) fail("porosity-avoid", { plainVoid, poreVoid });
  if (!(poreSeparation.nearest > poreCohesion.nearest * 2 && poreSeparation.spread > poreCohesion.spread * 1.2)) {
    fail("porosity-studies", { poreCohesion, poreSeparation });
  }
  if (!(poreAlignment.align > 0.9 && poreAlignment.meanSpeed > poreAlignment.cruise * 0.55)) fail("porosity-streams", poreAlignment);
  for (const report of [poreCohesion, poreSeparation, poreAlignment]) {
    if (!report.finite || report.maxRadius > FRAME_RADIUS) fail("porosity-bounds", report);
  }
  const poreAgain = positions(run(signature, "porosity", 0.8, 250, STUDIES[1], 12));
  if (maxDelta(poreAgain, positions(run(signature, "porosity", 0.8, 250, STUDIES[1], 12))) !== 0) fail("porosity-deterministic", "same seed diverged");
  const passages = passageReport(4);
  if (!(passages.connected > 0.95 && passages.fraction > 0.4 && passages.fraction < 0.75)) fail("porosity-passages", passages);

  const textures = ["none", "stripes", "reaction"];
  const volumes = ["none", "bubbles", "porosity"];
  const motions = ["none", "wind"];
  for (const strength of [0.55, 1]) {
    for (const texture of textures) {
      for (const volume of volumes) {
        for (const motion of motions) {
          if (texture === "none" && volume === "none" && motion === "none") continue;
          resetField(8);
          setModifiers({
            texture: { id: texture, strength },
            volume: { id: volume, strength },
            motion: { id: motion, strength },
          });
          const cohesionFlock = createFlock(signature, STUDIES[0], 8);
          const separationFlock = createFlock(signature, STUDIES[1], 8);
          const alignmentFlock = createFlock(signature, STUDIES[2], 8);
          for (let step = 0; step < 360; step++) {
            advanceField();
            stepFlock(cohesionFlock);
            stepFlock(separationFlock);
            stepFlock(alignmentFlock);
          }
          const reports = [summarise(cohesionFlock), summarise(separationFlock), summarise(alignmentFlock)];
          const name = `${texture}+${volume}+${motion}@${strength}`;
          for (const report of reports) {
            if (!report.finite || report.maxRadius > FRAME_RADIUS || report.meanSpeed <= 0.0004) fail("combo-" + name, report);
          }
          if (!(reports[1].nearest > reports[0].nearest && reports[2].align > 0.7 && reports[2].meanSpeed > reports[2].cruise * 0.4)) {
            fail("combo-studies-" + name, reports);
          }
        }
      }
    }
  }
  setModifiers({
    texture: { id: "reaction", strength: 0 },
    volume: { id: "porosity", strength: 0 },
    motion: { id: "wind", strength: 0 },
  });
  const quiet = run(signature, "none", 1, 240, STUDIES[0], 5);
  resetField(5);
  setModifiers({
    texture: { id: "reaction", strength: 0 },
    volume: { id: "porosity", strength: 0 },
    motion: { id: "wind", strength: 0 },
  });
  const quietFlock = createFlock(signature, STUDIES[0], 5);
  for (let step = 0; step < 240; step++) {
    advanceField();
    stepFlock(quietFlock);
  }
  if (maxDelta(positions(quiet), positions(quietFlock)) !== 0) fail("combo-zero", "zero strengths changed the flock");

  function drawn(points) {
    return readSignature(points, 520, 240);
  }
  const straightPoints = [];
  for (let i = 0; i < 80; i++) straightPoints.push({ x: 40 + i * 5, y: 120 });
  const straight = drawn(straightPoints);
  const again = drawn(straightPoints);
  if (!straight || straight.nodes.length !== 1) fail("curve-straight", straight && straight.nodes.length);
  if (JSON.stringify(straight.nodes) !== JSON.stringify(again.nodes)) fail("curve-stable", "the same signature placed different nodes");
  const corner = [{ x: 40, y: 40 }];
  for (let i = 1; i <= 40; i++) corner.push({ x: 40 + i * 6, y: 40 });
  for (let i = 1; i <= 40; i++) corner.push({ x: 280, y: 40 + i * 5 });
  const angular = drawn(corner);
  if (!angular || angular.nodes.length < 1) fail("curve-corner", angular && angular.nodes.length);
  const loop = [];
  for (let i = 0; i <= 72; i++) {
    const angle = (i / 72) * Math.PI * 2;
    loop.push({ x: 260 + Math.cos(angle) * 90, y: 140 + Math.sin(angle) * 90 });
  }
  const looped = drawn(loop);
  if (!looped || looped.nodes.length < 3) fail("curve-loop", looped && looped.nodes.length);
  const split = [];
  for (let i = 0; i < 40; i++) split.push({ x: 30 + i * 4, y: 60 });
  split.push({ break: true });
  for (let i = 0; i < 40; i++) split.push({ x: 30 + i * 4, y: 200 });
  const many = drawn(split);
  if (!many || many.nodes.length < 2) fail("curve-strokes", many && many.nodes.length);
  const straightSpot = straight.nodes[0];
  const loopSpot = looped.nodes[0];
  if (Math.hypot(straightSpot.x - loopSpot.x, straightSpot.y - loopSpot.y, straightSpot.z - loopSpot.z) < 0.05) {
    fail("curve-different", "straight and looped signatures placed the same node");
  }
  const sharedA = createFlock(straight, STUDIES[0], 4).signature.nodes;
  const sharedB = createFlock(straight, STUDIES[1], 4).signature.nodes;
  const sharedC = createFlock(straight, STUDIES[2], 4).signature.nodes;
  if (sharedA !== sharedB || sharedB !== sharedC) fail("curve-shared", "studies do not share one node list");
  const atCurve = curveFieldAt(straight.nodes, straightSpot.x, straightSpot.y, straightSpot.z);
  const farCurve = curveFieldAt(straight.nodes, straightSpot.x + 3, straightSpot.y, straightSpot.z);
  if (atCurve.influence !== 1 || farCurve.influence !== 0) fail("curve-falloff", { atCurve, farCurve });
  let previous = 1;
  let jump = 0;
  for (let i = 1; i <= 20; i++) {
    const t = i / 20;
    const sample = curveFieldAt(straight.nodes, straightSpot.x + straightSpot.radius * t, straightSpot.y, straightSpot.z);
    jump = Math.max(jump, Math.abs(previous - sample.influence));
    if (sample.influence > previous + 1e-6) fail("curve-mono", sample.influence);
    previous = sample.influence;
  }
  if (jump > 0.2 || previous !== 0) fail("curve-edge", { jump, previous });
  setModifier({ id: "wind", strength: 1 });
  const feltNear = readModifierFeel(straightSpot.x, straightSpot.y, straightSpot.z, straight.nodes);
  const feltFar = readModifierFeel(straightSpot.x + 3, straightSpot.y, straightSpot.z, straight.nodes);
  if (!(feltNear.values.wind > 0.95 && feltFar.values.wind === 0)) {
    fail("curve-wind", { feltNear, feltFar });
  }
  setModifier({ id: "none", strength: 0 });
  const plainLook = trailLook(straightSpot.x, straightSpot.y, straightSpot.z, 2, straight.nodes);
  if (plainLook.intensity < 0.85) fail("curve-intensity", plainLook);
  setModifier({ id: "stripes", strength: 1 });
  let light = false;
  let dark = false;
  for (let i = 0; i < 24; i++) {
    const y = straightSpot.y - 0.4 + i * 0.04;
    const banded = trailLook(straightSpot.x, y, straightSpot.z, 2, straight.nodes);
    if (banded.intensity < 0.7) fail("curve-readable", banded.intensity);
    if (Math.abs(banded.radius - plainLook.radius) > 0.004) fail("curve-shape", banded.radius);
    if (banded.tone < 0.45) dark = true;
    if (banded.tone > 1.15) light = true;
  }
  if (!dark || !light) fail("curve-gap", { dark, light });
  setModifier({ id: "stripes", strength: 0.3 });
  let softSpan = 0;
  for (let i = 0; i < 24; i++) {
    const y = straightSpot.y - 0.4 + i * 0.04;
    const banded = trailLook(straightSpot.x, y, straightSpot.z, 2, straight.nodes);
    softSpan = Math.max(softSpan, Math.abs(banded.tone - 1));
  }
  if (!(softSpan < 0.7)) fail("curve-contrast", softSpan);
  setModifier({ id: "none", strength: 0 });
  const plainWind = run(signature, "none", 1, 400, STUDIES[2], 4);
  const blown = run(signature, "wind", 1, 400, STUDIES[2], 4);
  if (maxDelta(positions(plainWind), positions(blown)) < 0.05) fail("wind-visible", "wind did not move the flock");
  const murmurZero = run(signature, "murmuration", 0, 200, STUDIES[2], 4);
  if (maxDelta(positions(run(signature, "none", 1, 200, STUDIES[2], 4)), positions(murmurZero)) !== 0) {
    fail("murmur-zero", "strength 0 changed the flock");
  }
  const locked = summarise(run(signature, "none", 1, 500, STUDIES[2], 4));
  const murmured = summarise(run(signature, "murmuration", 1, 500, STUDIES[2], 4));
  if (!(murmured.align < locked.align - 0.02 && murmured.meanSpeed > murmured.cruise * 0.45 && murmured.finite && murmured.maxRadius <= FRAME_RADIUS)) {
    fail("murmur-turn", { locked, murmured });
  }
  setModifier({ id: "none", strength: 0 });
  if (tubeRadiusFor(0, 0.02, 0) !== 0.02 || tubeRadiusFor(30, 0.02, 0) !== 0.02) fail("tube-uniform", "response 0 changed the radius");
  const openTube = tubeRadiusFor(0, 0.02, 1);
  const midTube = tubeRadiusFor(4, 0.02, 1);
  const packedTube = tubeRadiusFor(80, 0.02, 1);
  if (!(openTube > midTube && midTube > packedTube)) fail("tube-order", { openTube, midTube, packedTube });
  if (openTube > TUBE_MAX || packedTube < TUBE_MIN || openTube <= 0 || packedTube <= 0) fail("tube-bounds", { openTube, packedTube });
  const fresh = createFlock(signature, STUDIES[0], 4);
  let saturated = 0;
  for (let i = 0; i < fresh.agents.length; i++) {
    const radius = tubeRadiusFor(fresh.crowd[i], 0.02, 0.55);
    if (!Number.isFinite(radius) || radius < TUBE_MIN || radius > TUBE_MAX) fail("tube-finite", radius);
    if (radius <= tubeRadiusFor(1e6, 0.02, 0.55) + 1e-4 || radius >= tubeRadiusFor(0, 0.02, 0.55) - 1e-4) saturated += 1;
  }
  if (saturated > fresh.agents.length * 0.45) fail("tube-saturate", saturated);

  const zigzag = [];
  for (let i = 0; i < 7; i++) zigzag.push({ x: 40 + i * 70, y: i % 2 ? 30 : 190 });
  const zagged = drawn(zigzag);
  if (!zagged || zagged.nodes.length < 3 || JSON.stringify(zagged.nodes) === JSON.stringify(straight.nodes)) {
    fail("curve-zigzag", zagged && zagged.nodes.length);
  }
  setSymmetry(true);
  publishNodes(looped);
  let uncovered = 0;
  for (const node of looped.baseNodes) {
    const image = mirrorOf(node.x, node.y, node.z, looped.plane);
    let found = false;
    for (const other of looped.nodes) {
      if (Math.hypot(image[0] - other.x, image[1] - other.y, image[2] - other.z) < 0.08) found = true;
    }
    if (!found) uncovered += 1;
  }
  if (!looped.symmetry || uncovered) fail("symmetry-nodes", { uncovered, count: looped.nodes.length });
  const mirrored = createFlock(looped, STUDIES[2], 9);
  for (let step = 0; step < 80; step++) stepFlock(mirrored);
  const mirrorHalf = mirrored.agents.length / 2;
  let mirrorGap = 0;
  for (let i = 0; i < mirrorHalf; i++) {
    const agent = mirrored.agents[i];
    const partner = mirrored.agents[i + mirrorHalf];
    const image = mirrorOf(agent.x, agent.y, agent.z, looped.plane);
    mirrorGap = Math.max(mirrorGap, Math.hypot(image[0] - partner.x, image[1] - partner.y, image[2] - partner.z));
    if (Math.hypot(agent.x, agent.y, agent.z) > FRAME_RADIUS) fail("symmetry-frame", agent);
  }
  if (mirrorGap > 1e-6) fail("symmetry-pair", mirrorGap);
  setSymmetry(false);
  publishNodes(looped);
  setModifier({ id: "none", strength: 0 });
  return {
    ok: failures.length === 0,
    failures,
    preview: developed.field,
    cohesion,
    separation,
    alignment,
  };
}
