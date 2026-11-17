import * as THREE from "three";
import { OrbitControls } from "./vendor/OrbitControls.js";
import { FRAME_RADIUS, advanceField, getModifiers, maxTubeRadius, reactionSample, separationTubeRadius, stepFlock, trailLook } from "./sim.js?v=turns45";
import { PALETTE, markOn } from "./palette.js?v=palette";

const SPACING = 0.016;
const TUBE_EASE = 0.085;
const MAX_PER_AGENT = 520;
const MAX_SEGMENTS = 170 * MAX_PER_AGENT;
const FIT_MARGIN = 1.14;
const HOME = [3.35, 1.85, 5.15];

export const STEP_SECONDS = 1 / 60;
export const MAX_STEPS_PER_FRAME = 4;

const playback = { speed: 0.7, paused: false };
export function getTube() {
  return { base: 0.02, response: 0.5, maxRadius: maxTubeRadius(0.02, 0.5) };
}

export function frameDistance(fovDeg, aspect, radius = FRAME_RADIUS) {
  const vHalf = (fovDeg * Math.PI) / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * Math.max(aspect, 0.05));
  const half = Math.min(vHalf, hHalf);
  return (radius * FIT_MARGIN) / Math.sin(half);
}

export function consumeSteps(accum, elapsed, speed) {
  let bank = accum + Math.max(0, elapsed) * speed;
  let steps = 0;
  while (bank >= STEP_SECONDS && steps < MAX_STEPS_PER_FRAME) {
    bank -= STEP_SECONDS;
    steps += 1;
  }
  if (steps === MAX_STEPS_PER_FRAME && bank > STEP_SECONDS) bank = STEP_SECONDS;
  return { accum: bank, steps };
}

const ORIGINAL_LINE = 0xf7f4ee;
const ORIGINAL_HEAD = 0x2a241f;

const LINE = new THREE.MeshPhysicalMaterial({
  color: ORIGINAL_LINE,
  roughness: 0.42,
  metalness: 0.03,
  clearcoat: 0,
  clearcoatRoughness: 0.2,
  ior: 1.45,
  reflectivity: 0.5,
});
LINE.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
attribute float radius0;
attribute float radius1;
attribute float extend0;
attribute float extend1;`,
    )
    .replace(
      "#include <begin_vertex>",
      `float tubeRadius = mix(radius0, radius1, position.y + 0.5);
float tubeShift = position.y < 0.0 ? -extend0 : extend1;
vec3 transformed = vec3(position.x * tubeRadius, position.y + tubeShift, position.z * tubeRadius);`,
    );
};
LINE.customProgramCacheKey = () => "tapered-tube";

const FIELD_PLAIN = new THREE.MeshBasicMaterial({ color: 0xffffff });
FIELD_PLAIN.toneMapped = false;
const FIELD_TUBE = new THREE.MeshBasicMaterial({ color: 0xffffff });
FIELD_TUBE.toneMapped = false;
FIELD_TUBE.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
attribute float radius0;
attribute float radius1;
attribute float extend0;
attribute float extend1;`,
    )
    .replace(
      "#include <begin_vertex>",
      `float tubeRadius = mix(radius0, radius1, position.y + 0.5);
float tubeShift = position.y < 0.0 ? -extend0 : extend1;
vec3 transformed = vec3(position.x * tubeRadius, position.y + tubeShift, position.z * tubeRadius);`,
    );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <opaque_fragment>",
    "gl_FragColor = vec4(1.0);",
  );
};
FIELD_TUBE.customProgramCacheKey = () => "reflection-field";

const reflectionBlur = new THREE.ShaderMaterial({
  uniforms: {
    tField: { value: null },
    texel: { value: new THREE.Vector2() },
    direction: { value: new THREE.Vector2(1, 0) },
  },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
  fragmentShader: `precision highp float;
uniform sampler2D tField;
uniform vec2 texel;
uniform vec2 direction;
varying vec2 vUv;
void main() {
  vec2 step = texel * direction;
  vec4 sum = texture2D(tField, vUv) * 0.227;
  sum += texture2D(tField, vUv + step) * 0.194;
  sum += texture2D(tField, vUv - step) * 0.194;
  sum += texture2D(tField, vUv + step * 2.0) * 0.122;
  sum += texture2D(tField, vUv - step * 2.0) * 0.122;
  sum += texture2D(tField, vUv + step * 3.0) * 0.075;
  sum += texture2D(tField, vUv - step * 3.0) * 0.075;
  sum += texture2D(tField, vUv + step * 4.0) * 0.045;
  sum += texture2D(tField, vUv - step * 4.0) * 0.045;
  gl_FragColor = sum;
}`,
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
});

const reflectionGlass = new THREE.ShaderMaterial({
  uniforms: {
    tSharp: { value: null },
    tSoft: { value: null },
    tField: { value: null },
    tCover: { value: null },
    gloss: { value: 1 },
  },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
  fragmentShader: `precision highp float;
uniform sampler2D tSharp;
uniform sampler2D tSoft;
uniform sampler2D tField;
uniform sampler2D tCover;
uniform float gloss;
varying vec2 vUv;
void main() {
  float mask = smoothstep(0.4, 0.66, texture2D(tCover, vUv).r);
  vec3 sharp = texture2D(tSharp, vUv).rgb;
  vec3 soft = texture2D(tSoft, vUv).rgb;
  vec3 body = mix(sharp, soft, mask * (0.84 + gloss * 0.16));
  float lift = max(sharp.r - soft.r, max(sharp.g - soft.g, sharp.b - soft.b));
  float glint = smoothstep(0.05, 0.32, lift) * mask;
  vec3 color = mix(body, sharp, glint * (0.4 + gloss * 0.6));
  gl_FragColor = vec4(color, 1.0);
}`,
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
});

const reflectionScene = new THREE.Scene();
const reflectionCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const reflectionQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), reflectionBlur);
reflectionScene.add(reflectionQuad);
let reflectionField = null;
let reflectionBlurred = null;
let reflectionColor = null;
let reflectionSoft = null;
let reflectionCover = null;

function reflectionTargets(width, height) {
  if (!reflectionField) {
    reflectionField = new THREE.WebGLRenderTarget(width, height);
    reflectionBlurred = new THREE.WebGLRenderTarget(width, height);
    reflectionColor = new THREE.WebGLRenderTarget(width, height);
    reflectionSoft = new THREE.WebGLRenderTarget(width, height);
    reflectionCover = new THREE.WebGLRenderTarget(width, height);
    return;
  }
  if (reflectionField.width !== width || reflectionField.height !== height) {
    reflectionField.setSize(width, height);
    reflectionBlurred.setSize(width, height);
    reflectionColor.setSize(width, height);
    reflectionSoft.setSize(width, height);
    reflectionCover.setSize(width, height);
  }
}

function blurSeparable(renderer, source, dest, spread, width, height) {
  reflectionBlur.uniforms.texel.value.set(spread / width, spread / height);
  reflectionBlur.uniforms.tField.value = source.texture;
  reflectionBlur.uniforms.direction.value.set(1, 0);
  reflectionQuad.material = reflectionBlur;
  renderer.setRenderTarget(reflectionBlurred);
  renderer.clear();
  renderer.render(reflectionScene, reflectionCamera);
  reflectionBlur.uniforms.tField.value = reflectionBlurred.texture;
  reflectionBlur.uniforms.direction.value.set(0, 1);
  renderer.setRenderTarget(dest);
  renderer.clear();
  renderer.render(reflectionScene, reflectionCamera);
}

function renderReflection(renderer, scene, camera, sculpture, gloss) {
  const width = renderer.domElement.width;
  const height = renderer.domElement.height;
  if (width < 2 || height < 2) {
    renderer.render(scene, camera);
    return;
  }
  reflectionTargets(width, height);
  const body = [];
  const hidden = [];
  const conceal = [];
  for (const child of sculpture.children) {
    const material = child.material;
    if (child.isMesh && material === HEAD) {
      conceal.push(child);
      child.visible = false;
    } else if (child.isMesh && (material === LINE || material === VOLUME)) body.push(child);
    else if (child.visible) {
      hidden.push(child);
      child.visible = false;
    }
  }
  if (!body.length) {
    for (const child of hidden) child.visible = true;
    for (const child of conceal) child.visible = true;
    renderer.render(scene, camera);
    return;
  }
  const saved = body.map((child) => child.material);
  const background = scene.background;
  const clear = renderer.getClearColor(new THREE.Color());
  const alpha = renderer.getClearAlpha();
  renderer.setClearColor(PALETTE.stone, 1);
  renderer.setRenderTarget(reflectionColor);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.setClearColor(0x000000, 1);
  blurSeparable(renderer, reflectionColor, reflectionSoft, 1.8 + gloss * 6.5, width, height);
  for (const child of body) child.material = child.material === LINE ? FIELD_TUBE : FIELD_PLAIN;
  scene.background = null;
  renderer.setRenderTarget(reflectionField);
  renderer.clear();
  renderer.render(scene, camera);
  blurSeparable(renderer, reflectionField, reflectionCover, 1.4 + gloss * 5.0, width, height);
  for (let i = 0; i < body.length; i++) {
    body[i].material = saved[i];
    body[i].visible = false;
  }
  for (const child of hidden) child.visible = true;
  reflectionGlass.uniforms.tSharp.value = reflectionColor.texture;
  reflectionGlass.uniforms.tSoft.value = reflectionSoft.texture;
  reflectionGlass.uniforms.tField.value = reflectionField.texture;
  reflectionGlass.uniforms.tCover.value = reflectionCover.texture;
  reflectionGlass.uniforms.gloss.value = gloss;
  reflectionQuad.material = reflectionGlass;
  renderer.setRenderTarget(null);
  renderer.setClearColor(PALETTE.stone, 1);
  renderer.clear();
  renderer.autoClear = false;
  renderer.render(reflectionScene, reflectionCamera);
  scene.background = null;
  renderer.render(scene, camera);
  renderer.autoClear = true;
  renderer.setClearColor(clear, alpha);
  scene.background = background;
  for (const child of body) child.visible = true;
  for (const child of conceal) child.visible = true;
}

const VOLUME = new THREE.MeshPhysicalMaterial({
  color: ORIGINAL_LINE,
  roughness: 0.38,
  metalness: 0.02,
  clearcoat: 0,
  clearcoatRoughness: 0.2,
  ior: 1.45,
});

const SMOKE = new THREE.MeshStandardMaterial({
  color: ORIGINAL_LINE,
  roughness: 0.86,
  metalness: 0,
  transparent: true,
  opacity: 0.78,
  depthWrite: false,
});

const GESTURE = new THREE.MeshStandardMaterial({
  color: ORIGINAL_LINE,
  roughness: 0.4,
  metalness: 0.04,
});

const HEAD = new THREE.MeshStandardMaterial({
  color: ORIGINAL_HEAD,
  roughness: 0.4,
  metalness: 0.02,
});

const sculptureColour = { original: true, hue: 28, tone: 0.7, swatch: "" };

export function setSculptureColour(next = {}) {
  if (next.original) {
    LINE.color.setHex(ORIGINAL_LINE);
    HEAD.color.setHex(ORIGINAL_HEAD);
    sculptureColour.original = true;
    sculptureColour.swatch = "";
  } else if (next.hex) {
    LINE.color.set(next.hex);
    HEAD.color.set(markOn(next.hex));
    sculptureColour.original = false;
    sculptureColour.swatch = next.name || next.hex;
  } else {
    const hue = ((Number(next.hue) % 360) + 360) % 360;
    const tone = Math.min(1, Math.max(0, Number(next.tone == null ? sculptureColour.tone : next.tone)));
    const saturation = 0.12 + tone * 0.8;
    const lightness = 0.78 - tone * 0.58;
    LINE.color.setHSL(hue / 360, saturation, lightness);
    HEAD.color.setHSL(hue / 360, Math.max(0.08, saturation * 0.65), Math.min(0.88, lightness + 0.42));
    sculptureColour.original = false;
    sculptureColour.hue = hue;
    sculptureColour.tone = tone;
    sculptureColour.swatch = "";
  }
  LINE.needsUpdate = true;
  HEAD.needsUpdate = true;
  GESTURE.color.copy(LINE.color);
  GESTURE.needsUpdate = true;
  applyGlass(reflectionLevel());
  return {
    original: sculptureColour.original,
    hue: sculptureColour.hue,
    tone: sculptureColour.tone,
    swatch: sculptureColour.swatch,
    trail: `#${LINE.color.getHexString()}`,
    head: `#${HEAD.color.getHexString()}`,
  };
}

export function getSculptureColour() {
  return {
    original: sculptureColour.original,
    hue: sculptureColour.hue,
    tone: sculptureColour.tone,
    swatch: sculptureColour.swatch,
    trail: `#${LINE.color.getHexString()}`,
    head: `#${HEAD.color.getHexString()}`,
  };
}

const INK = new THREE.LineBasicMaterial({
  color: PALETTE.charcoal,
  transparent: true,
  opacity: 0.45,
});

const yAxis = new THREE.Vector3(0, 1, 0);
const direction = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const position = new THREE.Vector3();
const scale = new THREE.Vector3();
const matrix = new THREE.Matrix4();

const views = new Set();
let looping = false;
let lastNow = 0;
let sharedAccum = 0;
const tubeShade = new THREE.Color();

const markerMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.charcoal });
const shellMaterial = new THREE.LineBasicMaterial({
  color: PALETTE.charcoal,
  transparent: true,
  opacity: 0.35,
});
const influenceTint = new THREE.Color(0xe39a45);
const white = new THREE.Color(1, 1, 1);
const tinted = new THREE.Color();

export function setTrailDim(on) {
  LINE.transparent = Boolean(on);
  LINE.opacity = on ? 0.16 : 1;
  LINE.depthWrite = !on;
  LINE.needsUpdate = true;
}

export function setPlayback(next) {
  if (next.speed != null) playback.speed = next.speed;
  if (next.paused != null) playback.paused = next.paused;
}

let glassEnv = null;

function reflectionLevel() {
  const modifiers = getModifiers();
  return modifiers.texture.id === "reflection" ? modifiers.texture.strength : 0;
}

function ensureGlassEnv(renderer) {
  if (glassEnv || !renderer) return glassEnv;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new THREE.Scene();
  room.add(new THREE.Mesh(
    new THREE.SphereGeometry(16, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xc5ccc8, side: THREE.BackSide }),
  ));
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  pane.position.set(3.4, 2.6, 4.2);
  pane.lookAt(0, 0.4, 0);
  room.add(pane);
  const warm = new THREE.Mesh(new THREE.PlaneGeometry(5, 4.5), new THREE.MeshBasicMaterial({ color: 0xf2d537 }));
  warm.position.set(-4.2, 0.6, -2.2);
  warm.lookAt(0, 0.4, 0);
  room.add(warm);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.6), new THREE.MeshBasicMaterial({ color: 0x87c8ce }));
  sky.position.set(0.4, 5.2, -1);
  sky.lookAt(0, 0, 0);
  room.add(sky);
  glassEnv = pmrem.fromScene(room, 0.05).texture;
  pmrem.dispose();
  return glassEnv;
}

function applyGlass(level) {
  const on = level > 0;
  LINE.roughness = on ? 0.3 - level * 0.24 : 0.42;
  LINE.metalness = on ? 0.02 + level * 0.04 : 0.03;
  LINE.clearcoat = on ? 0.4 + level * 0.6 : 0;
  LINE.clearcoatRoughness = on ? 0.16 - level * 0.1 : 0.2;
  LINE.reflectivity = on ? 0.5 + level * 0.45 : 0.5;
  LINE.envMapIntensity = on ? 0.9 + level * 1.7 : 1;
  LINE.envMap = on ? glassEnv : null;
  LINE.needsUpdate = true;
  VOLUME.color.copy(LINE.color);
  VOLUME.roughness = on ? LINE.roughness : 0.38;
  VOLUME.metalness = on ? LINE.metalness : 0.02;
  VOLUME.clearcoat = on ? LINE.clearcoat : 0;
  VOLUME.clearcoatRoughness = LINE.clearcoatRoughness;
  VOLUME.envMap = LINE.envMap;
  VOLUME.envMapIntensity = LINE.envMapIntensity;
  VOLUME.needsUpdate = true;
}

function nearestDistances(agents) {
  const count = agents.length;
  const gaps = new Float64Array(count);
  for (let i = 0; i < count; i++) gaps[i] = 1;
  for (let i = 0; i < count; i++) {
    const a = agents[i];
    let best = 1;
    for (let j = 0; j < count; j++) {
      if (i === j) continue;
      const b = agents[j];
      const distance = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      if (distance < best) best = distance;
    }
    gaps[i] = best;
  }
  return gaps;
}

function meltRadius(radius, nearest, level) {
  if (!(level > 0) || !Number.isFinite(nearest)) return radius;
  const gap = nearest - radius * 2;
  if (gap > 0.09) return radius;
  const close = gap > 0 ? (0.09 - gap) / 0.09 : 1;
  const grow = level * close * Math.min(0.046, Math.max(0.008, radius * 0.9));
  return Math.min(0.12, radius + grow);
}

function loop(now) {
  looping = true;
  const elapsed = lastNow ? (now - lastNow) / 1000 : STEP_SECONDS;
  lastNow = now;
  if (!playback.paused) {
    const consumed = consumeSteps(sharedAccum, elapsed, playback.speed);
    sharedAccum = consumed.accum;
    for (let step = 0; step < consumed.steps; step++) {
      advanceField();
      for (const view of views) view.step();
    }
  }
  for (const view of views) view.draw();
  requestAnimationFrame(loop);
}

function clearObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
  });
  object.clear();
}

function volumeSize(level) {
  const t = Math.min(1, Math.max(0, Number(level) || 0));
  const full = (0.36 + 0.82) * 0.58 * 1.75 * 2 / 3 * 0.5;
  const eased = t * t * (3 - 2 * t);
  return full * (0.012 + 0.988 * eased);
}

function packBetween(agents) {
  const count = agents.length;
  const packed = new Float64Array(count);
  const reach = 0.24;
  for (let i = 0; i < count; i++) {
    const a = agents[i];
    let press = 0;
    for (let j = 0; j < count; j++) {
      if (i === j) continue;
      const b = agents[j];
      const distance = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      if (distance >= reach) continue;
      const close = 1 - distance / reach;
      press += close * close;
    }
    packed[i] = Math.min(1, press / 2.2);
  }
  return packed;
}

function erodeRadius(radius, packed, level) {
  if (!(level > 0) || !(packed > 0)) return radius;
  return Math.max(0.0035, radius * (1 - level * 0.84 * packed));
}

function porosityLevel() {
  const modifiers = getModifiers();
  return modifiers.volume.id === "porosity" ? modifiers.volume.strength : 0;
}

function addSignature(group, line) {
  const positions = [];
  for (let i = 0; i < line.length - 1; i++) {
    if (line[i][3]) continue;
    positions.push(line[i][0], line[i][1], line[i][2], line[i + 1][0], line[i + 1][1], line[i + 1][2]);
  }
  if (!positions.length) return;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  group.add(new THREE.LineSegments(geometry, INK));
}

function unit(x, y, z) {
  const length = Math.hypot(x, y, z);
  if (length < 1e-6) return [0, 1, 0];
  return [x / length, y / length, z / length];
}

function tendrilPath(node, fan, level) {
  const limit = FRAME_RADIUS * 0.9;
  let [tx, ty, tz] = unit(node.tx || node.ox || 1, node.ty || node.oy || 0, node.tz || node.oz || 0);
  let [sx, sy, sz] = unit(-ty, tx, 0);
  if (Math.abs(tx * sx + ty * sy + tz * sz) > 0.9) [sx, sy, sz] = unit(0, -tz, ty);
  const bx = ty * sz - tz * sy;
  const by = tz * sx - tx * sz;
  const bz = tx * sy - ty * sx;
  const angle = fan * 1.15;
  let [dx, dy, dz] = unit(
    sx * Math.cos(angle) + bx * Math.sin(angle) + tx * 0.2,
    sy * Math.cos(angle) + by * Math.sin(angle) + ty * 0.2,
    sz * Math.cos(angle) + bz * Math.sin(angle) + tz * 0.2,
  );
  const reach = 0.42 + level * 0.95;
  const steps = 34;
  const samples = [{ x: node.x, y: node.y, z: node.z }];
  let x = node.x;
  let y = node.y;
  let z = node.z;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const wave = Math.sin(t * Math.PI * 3.1 + fan * 1.4 + (node.turn || 0));
    const lift = Math.cos(t * Math.PI * 2.2 + fan * 0.6);
    let nx = dx + sx * wave * 0.22 + bx * lift * 0.16;
    let ny = dy + sy * wave * 0.22 + by * lift * 0.16;
    let nz = dz + sz * wave * 0.22 + bz * lift * 0.16;
    const sample = reactionSample(x, y);
    const slope = Math.hypot(sample.gx, sample.gy);
    if (slope > 0.008) {
      let cx = -sample.gy / slope;
      let cy = sample.gx / slope;
      if (cx * nx + cy * ny < 0) {
        cx = -cx;
        cy = -cy;
      }
      nx = nx * 0.68 + cx * 0.32;
      ny = ny * 0.68 + cy * 0.32;
    }
    [dx, dy, dz] = unit(nx, ny, nz);
    const step = reach / steps;
    const px = x + dx * step;
    const py = y + dy * step;
    const pz = z + dz * step;
    if (Math.hypot(px, py, pz) > limit) break;
    x = px;
    y = py;
    z = pz;
    samples.push({ x, y, z });
  }
  if (samples.length < 4) return [];
  const base = 0.05 + level * 0.11;
  const last = samples.length - 1;
  for (let i = 0; i < samples.length; i++) {
    const t = i / last;
    samples[i].radius = Math.max(0.003, base * Math.pow(1 - t, 1.15));
  }
  return samples;
}

function tendrilGeometry(samples) {
  const sides = 7;
  const positions = [];
  const indices = [];
  let sx = 0;
  let sy = 0;
  let sz = 1;
  for (let i = 0; i < samples.length; i++) {
    const point = samples[i];
    const before = samples[Math.max(0, i - 1)];
    const after = samples[Math.min(samples.length - 1, i + 1)];
    const [tx, ty, tz] = unit(after.x - before.x, after.y - before.y, after.z - before.z);
    let dot = sx * tx + sy * ty + sz * tz;
    sx -= tx * dot;
    sy -= ty * dot;
    sz -= tz * dot;
    [sx, sy, sz] = unit(sx, sy, sz);
    const bx = ty * sz - tz * sy;
    const by = tz * sx - tx * sz;
    const bz = tx * sy - ty * sx;
    for (let k = 0; k < sides; k++) {
      const angle = (k / sides) * Math.PI * 2;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const radius = point.radius;
      positions.push(
        point.x + (sx * c + bx * s) * radius,
        point.y + (sy * c + by * s) * radius,
        point.z + (sz * c + bz * s) * radius,
      );
    }
  }
  for (let i = 0; i < samples.length - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const a = i * sides + k;
      const b = i * sides + ((k + 1) % sides);
      const c = (i + 1) * sides + k;
      const d = (i + 1) * sides + ((k + 1) % sides);
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function placeTendrils(parent, nodes) {
  const modifiers = getModifiers();
  const level = modifiers.motion.id === "reaction" ? modifiers.motion.strength : modifiers.texture.strength;
  const selected = modifiers.motion.id === "reaction" || modifiers.texture.id === "reaction";
  if (!(level > 0) || !selected) return;
  for (let i = 0; i < nodes.length; i++) {
    for (const fan of [-1, 1]) {
      const samples = tendrilPath(nodes[i], fan, level);
      if (samples.length < 4) continue;
      parent.add(new THREE.Mesh(tendrilGeometry(samples), VOLUME));
    }
  }
}

function smokeRadius(t, level) {
  const thread = 0.006 + level * 0.005;
  const plume = (0.028 + level * 0.09) * Math.sin(Math.PI * Math.pow(t, 0.8));
  const tip = 1 - Math.pow(t, 1.45);
  return Math.max(0.0022, thread * (1 - t) + plume * (0.3 + 0.7 * tip));
}

function smokePath(start, heading, level, grown, phase, scale) {
  const length = (0.42 + level * 1.15) * grown * scale;
  if (length < 0.05) return [];
  const steps = Math.max(14, Math.ceil(length / 0.028));
  const origin = unit(heading[0], heading[1], heading[2]);
  let [dx, dy, dz] = origin;
  let x = start.x;
  let y = start.y;
  let z = start.z;
  const samples = [{ x, y, z, radius: smokeRadius(0, level) }];
  const limit = FRAME_RADIUS * 0.86;
  const stride = length / steps;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const along = t * length;
    const leaving = Math.pow(1 - t, 0.85);
    const spin = (0.035 + level * 0.11) * (0.2 + t);
    const turn = Math.cos(spin);
    const sway = Math.sin(spin + phase * 0.15);
    let nx = dx * turn - dz * sway;
    let nz = dx * sway + dz * turn;
    let ny = dy + (0.01 + level * 0.018) * (1 - leaving);
    const wobble = Math.sin(along * (1.6 + level * 2.2) + phase);
    nx += wobble * (0.08 + level * 0.22) * (1 - leaving);
    nz += Math.cos(along * (1.3 + level * 1.8) + phase) * (0.06 + level * 0.18) * (1 - leaving);
    nx = nx * (1 - leaving * 0.72) + origin[0] * leaving * 0.72;
    ny = ny * (1 - leaving * 0.72) + origin[1] * leaving * 0.72;
    nz = nz * (1 - leaving * 0.72) + origin[2] * leaving * 0.72;
    [dx, dy, dz] = unit(nx, ny, nz);
    let px = x + dx * stride;
    let py = y + dy * stride;
    let pz = z + dz * stride;
    const dist = Math.hypot(px, py, pz);
    if (dist > limit) {
      const keep = limit / dist;
      px *= keep;
      py *= keep;
      pz *= keep;
      [dx, dy, dz] = unit(dx - px * 0.15, dy - py * 0.15, dz - pz * 0.15);
    }
    x = px;
    y = py;
    z = pz;
    samples.push({ x, y, z, radius: smokeRadius(t, level) * (0.75 + 0.25 * scale) });
  }
  samples[samples.length - 1].radius = 0.0022;
  return samples;
}

function smokeHeading(samples, at, amount) {
  const index = Math.min(samples.length - 2, Math.max(1, Math.floor(samples.length * at)));
  const a = samples[index - 1];
  const b = samples[index + 1] || samples[index];
  const [dx, dy, dz] = unit(b.x - a.x, b.y - a.y, b.z - a.z);
  const [sx, sy, sz] = unit(-dy, dx, 0.15);
  return unit(dx + sx * amount, dy + sy * amount, dz + sz * amount);
}

function smokePaths(nodes, level, age) {
  const grown = 1 - Math.exp(-age / (220 - level * 40));
  const paths = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const trunk = smokePath(node, [node.tx, node.ty, node.tz], level, grown, node.turn || 0, 1);
    if (trunk.length < 4) continue;
    paths.push(trunk);
    if (grown > 0.4) {
      const at = trunk[Math.floor(trunk.length * 0.36)];
      const branch = smokePath(at, smokeHeading(trunk, 0.36, 0.7), level * 0.9, Math.min(1, (grown - 0.4) / 0.6), (node.turn || 0) + 1.3, 0.66);
      if (branch.length >= 4) paths.push(branch);
    }
    if (grown > 0.64) {
      const at = trunk[Math.floor(trunk.length * 0.55)];
      const branch = smokePath(at, smokeHeading(trunk, 0.55, -0.55), level * 0.75, Math.min(1, (grown - 0.64) / 0.46), (node.turn || 0) + 2.4, 0.5);
      if (branch.length >= 4) paths.push(branch);
    }
  }
  return paths;
}

function stayInFrame(x, y, z) {
  const limit = FRAME_RADIUS * 0.88;
  const dist = Math.hypot(x, y, z);
  if (dist <= limit) return [x, y, z];
  const keep = limit / dist;
  return [x * keep, y * keep, z * keep];
}

function gestureSource(line) {
  const strokes = [];
  let current = [];
  for (let i = 0; i < line.length; i++) {
    current.push({ x: line[i][0], y: line[i][1], z: line[i][2] });
    if (line[i][3]) {
      if (current.length > 1) strokes.push(current);
      current = [];
    }
  }
  if (current.length > 1) strokes.push(current);
  if (!strokes.length) return null;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  let count = 0;
  for (let s = 0; s < strokes.length; s++) {
    for (let i = 0; i < strokes[s].length; i++) {
      cx += strokes[s][i].x;
      cy += strokes[s][i].y;
      cz += strokes[s][i].z;
      count += 1;
    }
  }
  cx /= count;
  cy /= count;
  cz /= count;
  const primary = strokes[0];
  const start = primary[0];
  const end = primary[primary.length - 1];
  const [ax, ay, az] = unit(end.x - start.x, end.y - start.y, end.z - start.z);
  let [sx, sy, sz] = unit(-ay, ax, 0);
  if (Math.abs(ax * sx + ay * sy + az * sz) > 0.9) [sx, sy, sz] = unit(0, -az, ay);
  const bx = ay * sz - az * sy;
  const by = az * sx - ax * sz;
  const bz = ax * sy - ay * sx;
  let span = 0;
  const local = [];
  for (let s = 0; s < strokes.length; s++) {
    const stroke = [];
    for (let i = 0; i < strokes[s].length; i++) {
      const dx = strokes[s][i].x - cx;
      const dy = strokes[s][i].y - cy;
      const dz = strokes[s][i].z - cz;
      const point = {
        u: dx * ax + dy * ay + dz * az,
        v: dx * sx + dy * sy + dz * sz,
        w: dx * bx + dy * by + dz * bz,
      };
      if (i) {
        const prev = stroke[i - 1];
        span += Math.hypot(point.u - prev.u, point.v - prev.v, point.w - prev.w);
      }
      stroke.push(point);
    }
    if (stroke.length > 1) local.push(stroke);
  }
  if (!local.length || span < 0.04) return null;
  return { strokes: local, span };
}

function gestureFrame(node) {
  const [tx, ty, tz] = unit(node.tx || node.ox || 1, node.ty || node.oy || 0, node.tz || node.oz || 0);
  let [sx, sy, sz] = unit(-ty, tx, 0);
  if (Math.abs(tx * sx + ty * sy + tz * sz) > 0.9) [sx, sy, sz] = unit(0, -tz, ty);
  const bx = ty * sz - tz * sy;
  const by = tz * sx - tx * sz;
  const bz = tx * sy - ty * sx;
  const twist = (node.turn || 0) * 0.42 + Math.sin((node.along || 0) * 3.1 + (node.stroke || 0)) * 0.38;
  const c = Math.cos(twist);
  const s = Math.sin(twist);
  return {
    t: [tx, ty, tz],
    s: [sx * c + bx * s, sy * c + by * s, sz * c + bz * s],
    b: [bx * c - sx * s, by * c - sy * s, bz * c - sz * s],
  };
}

function placeGesturePoint(node, frame, u, v, w, scale) {
  return stayInFrame(
    node.x + (frame.t[0] * u + frame.s[0] * v + frame.b[0] * w) * scale,
    node.y + (frame.t[1] * u + frame.s[1] * v + frame.b[1] * w) * scale,
    node.z + (frame.t[2] * u + frame.s[2] * v + frame.b[2] * w) * scale,
  );
}

function gestureTurn(prev, next) {
  const dot = Math.max(-1, Math.min(1, prev[0] * next[0] + prev[1] * next[1] + prev[2] * next[2]));
  const signed = prev[0] * next[1] - prev[1] * next[0];
  return Math.atan2(signed, dot);
}

function revealStroke(mapped, node, reach, level) {
  if (mapped.length < 2) return { samples: [], turns: [] };
  const arc = [0];
  for (let i = 1; i < mapped.length; i++) {
    arc.push(arc[i - 1] + Math.hypot(mapped[i].x - mapped[i - 1].x, mapped[i].y - mapped[i - 1].y, mapped[i].z - mapped[i - 1].z));
  }
  let near = 0;
  let best = Infinity;
  for (let i = 0; i < mapped.length; i++) {
    const distance = Math.hypot(mapped[i].x - node.x, mapped[i].y - node.y, mapped[i].z - node.z);
    if (distance < best) {
      best = distance;
      near = i;
    }
  }
  const anchor = arc[near];
  let lo = near;
  let hi = near;
  while (lo > 0 && anchor - arc[lo - 1] <= reach) lo -= 1;
  while (hi < mapped.length - 1 && arc[hi + 1] - anchor <= reach) hi += 1;
  const samples = [];
  for (let i = lo; i <= hi; i++) {
    const t = reach > 0 ? Math.min(1, Math.abs(arc[i] - anchor) / reach) : 1;
    const body = Math.pow(1 - t, 0.55);
    const swell = 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.15));
    samples.push({
      x: mapped[i].x,
      y: mapped[i].y,
      z: mapped[i].z,
      radius: Math.max(0.0022, (0.013 + level * 0.032) * body * swell),
    });
  }
  const tangents = [];
  for (let i = 0; i < mapped.length; i++) {
    const a = mapped[Math.max(0, i - 1)];
    const b = mapped[Math.min(mapped.length - 1, i + 1)];
    tangents.push(unit(b.x - a.x, b.y - a.y, b.z - a.z));
  }
  const turns = [];
  for (let i = 2; i < mapped.length - 2; i++) {
    const from = Math.abs(arc[i] - anchor);
    if (from > reach) continue;
    const angle = gestureTurn(tangents[i - 1], tangents[i + 1]);
    const magnitude = Math.abs(angle);
    if (magnitude < 0.42) continue;
    const before = Math.abs(gestureTurn(tangents[i - 2], tangents[i]));
    const after = Math.abs(gestureTurn(tangents[i], tangents[i + 2]));
    if (magnitude < before || magnitude < after) continue;
    turns.push({
      x: mapped[i].x,
      y: mapped[i].y,
      z: mapped[i].z,
      heading: tangents[i],
      turn: angle,
      arc: from,
    });
  }
  let accumulated = 0;
  let since = -99;
  for (let i = 1; i < mapped.length; i++) {
    accumulated += gestureTurn(tangents[i - 1], tangents[i]);
    if (Math.abs(accumulated) < 1.2 || i - since < 4) continue;
    const from = Math.abs(arc[i] - anchor);
    const bend = accumulated;
    accumulated = 0;
    since = i;
    if (from > reach) continue;
    let crowded = false;
    for (let k = 0; k < turns.length; k++) {
      if (Math.hypot(turns[k].x - mapped[i].x, turns[k].y - mapped[i].y, turns[k].z - mapped[i].z) < 0.05) crowded = true;
    }
    if (crowded) continue;
    turns.push({
      x: mapped[i].x,
      y: mapped[i].y,
      z: mapped[i].z,
      heading: tangents[i],
      turn: Math.max(-1.4, Math.min(1.4, bend)),
      arc: from,
    });
  }
  return { samples, turns };
}

function gestureBranch(turn, length, level) {
  if (length < 0.05) return [];
  const heading = turn.heading;
  let [sx, sy, sz] = unit(-heading[1], heading[0], 0);
  if (Math.abs(heading[0] * sx + heading[1] * sy + heading[2] * sz) > 0.9) [sx, sy, sz] = unit(0, -heading[2], heading[1]);
  const bx = heading[1] * sz - heading[2] * sy;
  const by = heading[2] * sx - heading[0] * sz;
  const bz = heading[0] * sy - heading[1] * sx;
  const flick = Math.max(-1.1, Math.min(1.1, turn.turn || 0)) * 0.9;
  const c0 = Math.cos(flick * 0.45);
  const s0 = Math.sin(flick * 0.45);
  let [dx, dy, dz] = unit(
    heading[0] * c0 + bx * s0,
    heading[1] * c0 + by * s0,
    heading[2] * c0 + bz * s0,
  );
  const steps = Math.max(10, Math.ceil(length / 0.028));
  const stride = length / steps;
  const spin = flick / steps;
  let x = turn.x;
  let y = turn.y;
  let z = turn.z;
  const samples = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const swell = 0.62 + 0.38 * Math.sin(Math.PI * t);
    const placed = stayInFrame(x, y, z);
    samples.push({
      x: placed[0],
      y: placed[1],
      z: placed[2],
      radius: Math.max(0.0016, (0.007 + level * 0.015) * Math.pow(1 - t, 1.2) * swell),
    });
    if (i === steps) break;
    const c = Math.cos(spin);
    const s = Math.sin(spin);
    [dx, dy, dz] = unit(dx * c + bx * s, dy * c + by * s, dz * c + bz * s);
    x += dx * stride;
    y += dy * stride;
    z += dz * stride;
  }
  samples[samples.length - 1].radius = 0.0016;
  return samples;
}

function gesturePaths(line, nodes, level, age) {
  if (!line || !line.length) return [];
  const source = gestureSource(line);
  if (!source) return [];
  const grown = 1 - Math.exp(-age / (230 - level * 48));
  const slots = Math.max(0, Math.round(level * 3));
  const paths = [];
  for (let n = 0; n < nodes.length; n++) {
    const node = nodes[n];
    const frame = gestureFrame(node);
    const vary = 0.88 + 0.14 * Math.sin((node.along || 0) * 4.2 + (node.turn || 0));
    const fullReach = (0.36 + level * 0.82) * vary;
    const reach = fullReach * grown;
    if (reach < 0.06) continue;
    const scale = fullReach / source.span;
    const turns = [];
    for (let s = 0; s < source.strokes.length; s++) {
      const mapped = source.strokes[s].map((point) => {
        const placed = placeGesturePoint(node, frame, point.u, point.v, point.w, scale);
        return { x: placed[0], y: placed[1], z: placed[2] };
      });
      const revealed = revealStroke(mapped, node, reach, level);
      if (revealed.samples.length >= 4) paths.push(revealed.samples);
      for (let i = 0; i < revealed.turns.length; i++) turns.push(revealed.turns[i]);
    }
    if (!slots || !turns.length) continue;
    turns.sort((a, b) => Math.abs(b.turn) - Math.abs(a.turn));
    const picked = turns.slice(0, slots);
    for (let i = 0; i < picked.length; i++) {
      const turn = picked[i];
      const branchGrown = Math.min(1, Math.max(0, (reach - turn.arc) / (fullReach * 0.4)));
      const length = (0.12 + level * 0.42) * branchGrown * vary;
      const branch = gestureBranch(turn, length, level);
      if (branch.length >= 4) paths.push(branch);
    }
  }
  return paths;
}

function jointExtend(radius, previous, next) {
  const overlap = Math.max(0.004, radius) * 0.22;
  if (!previous || !next) return overlap;
  const cos = Math.max(-1, Math.min(1, previous[0] * next[0] + previous[1] * next[1] + previous[2] * next[2]));
  const half = Math.acos(cos) * 0.5;
  const tan = Math.tan(half);
  if (!Number.isFinite(tan)) return radius * 2.2;
  return Math.min(radius * 2.2, Math.max(overlap, radius * tan));
}

function writeSegment(state, index, ax, ay, az, bx, by, bz, radius0, radius1, extendStart, extendEnd) {
  direction.set(bx - ax, by - ay, bz - az);
  const length = direction.length();
  if (length < 0.0001 || !Number.isFinite(length)) return false;
  direction.multiplyScalar(1 / length);
  if (direction.y < -0.999) quaternion.set(1, 0, 0, 0);
  else quaternion.setFromUnitVectors(yAxis, direction);
  position.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
  scale.set(1, length, 1);
  matrix.compose(position, quaternion, scale);
  state.strokes.setMatrixAt(index, matrix);
  state.radius0.setX(index, radius0);
  state.radius1.setX(index, radius1);
  state.extend0.setX(index, extendStart / length);
  state.extend1.setX(index, extendEnd / length);
  return true;
}

export function createView(canvas, { autoRotate = false, onTrailLimit = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setClearColor(PALETTE.stone, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  ensureGlassEnv(renderer);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.stone);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 80);
  camera.position.set(HOME[0], HOME[1], HOME[2]);

  scene.add(new THREE.HemisphereLight(0xfff7ee, 0x8d8478, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.45);
  key.position.set(4.2, 6.2, 3.4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd5e4ee, 0.42);
  fill.position.set(-5, 1.2, -2.4);
  scene.add(fill);

  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = autoRotate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  controls.autoRotateSpeed = 0.45;
  controls.minDistance = 2.4;
  controls.maxDistance = 24;
  controls.target.set(0, 0, 0);
  controls.addEventListener("start", () => {
    controls.autoRotate = false;
  });

  const sculpture = new THREE.Group();
  scene.add(sculpture);

  const state = {
    flock: null,
    heads: null,
    strokes: null,
    last: null,
    drawn: null,
    radius: null,
    pointRadius: null,
    shade: null,
    pointShade: null,
    lastDir: null,
    joint: null,
    radius0: null,
    radius1: null,
    extend0: null,
    extend1: null,
    segments: 0,
    accum: 0,
    capped: false,
    inRange: 0,
  };

  function resetInk() {
    clearObject(sculpture);
    state.heads = null;
    state.strokes = null;
    state.last = null;
    state.drawn = null;
    state.radius = null;
    state.pointRadius = null;
    state.shade = null;
    state.pointShade = null;
    state.lastDir = null;
    state.joint = null;
    state.radius0 = null;
    state.radius1 = null;
    state.extend0 = null;
    state.extend1 = null;
    state.segments = 0;
    state.accum = 0;
    state.capped = false;
    canvas.dataset.segments = "0";
    canvas.dataset.capped = "0";
    if (onTrailLimit) onTrailLimit(false);
    if (!state.flock) return;
    const count = state.flock.agents.length;
    state.heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.026, 10, 8), HEAD, count);
    state.heads.frustumCulled = false;
    state.heads.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3);
    const gloss = reflectionLevel();
    const sides = gloss > 0 ? 16 : 8;
    state.strokes = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, sides, 1, true), LINE, MAX_SEGMENTS);
    state.strokes.frustumCulled = false;
    state.strokes.count = 0;
    state.strokes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SEGMENTS * 3).fill(1), 3);
    state.radius0 = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SEGMENTS), 1);
    state.radius1 = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SEGMENTS), 1);
    state.extend0 = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SEGMENTS), 1);
    state.extend1 = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SEGMENTS), 1);
    state.strokes.geometry.setAttribute("radius0", state.radius0);
    state.strokes.geometry.setAttribute("radius1", state.radius1);
    state.strokes.geometry.setAttribute("extend0", state.extend0);
    state.strokes.geometry.setAttribute("extend1", state.extend1);
    state.last = state.flock.agents.map((agent) => [agent.x, agent.y, agent.z]);
    state.drawn = new Array(count).fill(0);
    state.radius = new Float64Array(count);
    state.pointRadius = new Float64Array(count);
    state.shade = new Float64Array(count);
    state.pointShade = new Float64Array(count);
    state.lastDir = new Array(count).fill(null);
    state.joint = new Array(count).fill(null);
    const crowd = state.flock.crowd;
    const nodes = state.flock.signature.nodes;
    const paired = state.flock.signature.symmetry ? count / 2 : count;
    for (let i = 0; i < paired; i++) {
      const agent = state.flock.agents[i];
      const look = trailLook(agent.x, agent.y, agent.z, crowd ? crowd[i] : 0, nodes);
      state.radius[i] = look.radius;
      state.pointRadius[i] = look.radius;
      state.shade[i] = look.tone;
      state.pointShade[i] = look.tone;
    }
    for (let i = paired; i < count; i++) {
      state.radius[i] = state.radius[i - paired];
      state.pointRadius[i] = state.pointRadius[i - paired];
      state.shade[i] = state.shade[i - paired];
      state.pointShade[i] = state.pointShade[i - paired];
    }
    const porous = porosityLevel();
    if (porous > 0) {
      const packed = packBetween(state.flock.agents);
      for (let i = 0; i < count; i++) {
        state.radius[i] = erodeRadius(state.radius[i], packed[i], porous);
        state.pointRadius[i] = state.radius[i];
      }
    }
    if (gloss > 0) {
      const near = nearestDistances(state.flock.agents);
      for (let i = 0; i < count; i++) {
        state.radius[i] = meltRadius(state.radius[i], near[i], gloss);
        state.pointRadius[i] = state.radius[i];
      }
    }
    if (state.flock.study === "separation") {
      for (let i = 0; i < count; i++) {
        const agent = state.flock.agents[i];
        state.radius[i] = separationTubeRadius(state.radius[i], agent.x, agent.y, agent.z, nodes);
        state.pointRadius[i] = state.radius[i];
      }
    }
    applyGlass(gloss);
    sculpture.add(state.strokes);
    sculpture.add(state.heads);
    placeBubbles(sculpture, nodes);
    placeTendrils(sculpture, nodes);
    placeSmoke(sculpture, nodes);
    placeGesture(sculpture, nodes);
    addSignature(sculpture, state.flock.line);
    if (state.markerMat) state.markerMat.dispose();
    state.markerMat = new THREE.MeshBasicMaterial({
      color: PALETTE.lagoon,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    state.markerBorn = performance.now();
    for (let i = 0; i < nodes.length; i++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), state.markerMat);
      dot.position.set(nodes[i].x, nodes[i].y, nodes[i].z);
      sculpture.add(dot);
    }
    syncHeads();
  }

  function placeBubbles(parent, nodes) {
    state.bubbles = [];
    const modifiers = getModifiers();
    if (modifiers.volume.id !== "bubbles") return;
    const radius = volumeSize(modifiers.volume.strength);
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), VOLUME);
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      mesh.position.set(node.x, node.y, node.z);
      mesh.scale.setScalar(radius);
      state.bubbles.push(mesh);
      parent.add(mesh);
    }
  }

  function syncBubbles() {
    if (!state.bubbles || !state.bubbles.length) return;
    const modifiers = getModifiers();
    const radius = modifiers.volume.id === "bubbles" ? volumeSize(modifiers.volume.strength) : 0;
    for (let i = 0; i < state.bubbles.length; i++) state.bubbles[i].scale.setScalar(radius);
  }

  function placeSmoke(parent, nodes) {
    state.smoke = null;
    const modifiers = getModifiers();
    if (modifiers.motion.id !== "smoke" || !(modifiers.motion.strength > 0)) return;
    const group = new THREE.Group();
    parent.add(group);
    state.smoke = {
      age: 0,
      group,
      built: -1,
      level: modifiers.motion.strength,
      nodes: nodes.map((node) => ({
        x: node.x,
        y: node.y,
        z: node.z,
        tx: node.tx || node.ox || 1,
        ty: node.ty || node.oy || 0,
        tz: node.tz || node.oz || 0,
        turn: node.turn || 0,
      })),
    };
  }

  function advanceSmoke() {
    const smoke = state.smoke;
    if (!smoke) return;
    smoke.age += 1;
    const bucket = Math.floor(smoke.age / 4);
    if (bucket === smoke.built) return;
    smoke.built = bucket;
    while (smoke.group.children.length) {
      const child = smoke.group.children.pop();
      if (child.geometry) child.geometry.dispose();
    }
    const paths = smokePaths(smoke.nodes, smoke.level, smoke.age);
    for (let i = 0; i < paths.length; i++) {
      smoke.group.add(new THREE.Mesh(tendrilGeometry(paths[i]), SMOKE));
    }
  }

  function placeGesture(parent, nodes) {
    state.gesture = null;
    const modifiers = getModifiers();
    if (modifiers.volume.id !== "gesture" || !(modifiers.volume.strength > 0)) return;
    const group = new THREE.Group();
    parent.add(group);
    GESTURE.color.copy(LINE.color);
    state.gesture = {
      age: 0,
      group,
      built: -1,
      level: modifiers.volume.strength,
      nodes: nodes.map((node) => ({
        x: node.x,
        y: node.y,
        z: node.z,
        tx: node.tx || node.ox || 1,
        ty: node.ty || node.oy || 0,
        tz: node.tz || node.oz || 0,
        ox: node.ox || node.tx || 1,
        oy: node.oy || node.ty || 0,
        oz: node.oz || node.tz || 0,
        turn: node.turn || 0,
        along: node.along || 0,
        stroke: node.stroke || 0,
      })),
      line: state.flock.line,
    };
  }

  function advanceGesture() {
    const gesture = state.gesture;
    if (!gesture) return;
    gesture.age += 1;
    const bucket = Math.floor(gesture.age / 4);
    if (bucket === gesture.built) return;
    gesture.built = bucket;
    while (gesture.group.children.length) {
      const child = gesture.group.children.pop();
      if (child.geometry) child.geometry.dispose();
    }
    GESTURE.color.copy(LINE.color);
    const paths = gesturePaths(gesture.line, gesture.nodes, gesture.level, gesture.age);
    for (let i = 0; i < paths.length; i++) {
      if (paths[i].length < 4) continue;
      gesture.group.add(new THREE.Mesh(tendrilGeometry(paths[i]), GESTURE));
    }
  }

  function syncHeads() {
    if (!state.heads || !state.flock) return;
    const agents = state.flock.agents;
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      position.set(agent.x, agent.y, agent.z);
      quaternion.identity();
      scale.set(1, 1, 1);
      matrix.compose(position, quaternion, scale);
      state.heads.setMatrixAt(i, matrix);
      tinted.copy(white);
      state.heads.setColorAt(i, tinted);
    }
    state.heads.instanceMatrix.needsUpdate = true;
    if (state.heads.instanceColor) state.heads.instanceColor.needsUpdate = true;
  }

  function relaxRadii() {
    const crowd = state.flock && state.flock.crowd;
    if (!crowd || !state.radius) return;
    const nodes = state.flock.signature.nodes;
    const agents = state.flock.agents;
    const paired = state.flock.signature.symmetry ? agents.length / 2 : agents.length;
    const porous = porosityLevel();
    const packed = porous > 0 ? packBetween(agents) : null;
    const gloss = reflectionLevel();
    const near = gloss > 0 ? nearestDistances(agents) : null;
    const texture = getModifiers().texture;
    const striped = texture.id === "stripes" && texture.strength > 0;
    for (let i = 0; i < paired; i++) {
      const look = trailLook(agents[i].x, agents[i].y, agents[i].z, crowd[i], nodes);
      let target = packed ? erodeRadius(look.radius, packed[i], porous) : look.radius;
      if (near) target = meltRadius(target, near[i], gloss);
      state.radius[i] += (target - state.radius[i]) * TUBE_EASE;
      if (state.flock.study === "separation") {
        state.radius[i] = separationTubeRadius(state.radius[i], agents[i].x, agents[i].y, agents[i].z, nodes);
      }
      state.shade[i] = striped ? look.tone : state.shade[i] + (look.tone - state.shade[i]) * TUBE_EASE;
    }
    for (let i = paired; i < agents.length; i++) {
      state.radius[i] = state.radius[i - paired];
      state.shade[i] = state.shade[i - paired];
    }
  }

  function extendStrokes() {
    if (!state.strokes || !state.flock) return;
    const agents = state.flock.agents;
    let grew = false;
    for (let i = 0; i < agents.length; i++) {
      if (state.drawn[i] >= MAX_PER_AGENT || state.segments >= MAX_SEGMENTS) continue;
      const agent = agents[i];
      const signature = state.flock.signature;
      const half = signature.symmetry ? agents.length / 2 : agents.length;
      if (i >= half && signature.plane) {
        const drop = (agent.x - signature.plane.x) * signature.plane.nx
          + (agent.y - signature.plane.y) * signature.plane.ny
          + (agent.z - signature.plane.z) * signature.plane.nz;
        if (Math.abs(drop) < 0.02) {
          state.last[i][0] = agent.x;
          state.last[i][1] = agent.y;
          state.last[i][2] = agent.z;
          continue;
        }
      }
      const last = state.last[i];
      const dx = agent.x - last[0];
      const dy = agent.y - last[1];
      const dz = agent.z - last[2];
      if (dx * dx + dy * dy + dz * dz < SPACING * SPACING) continue;
      const length = Math.hypot(dx, dy, dz);
      const dir = [dx / length, dy / length, dz / length];
      const radius0 = state.pointRadius[i];
      const radius1 = state.radius[i];
      const extendStart = jointExtend(radius0, state.lastDir[i], dir);
      const extendEnd = jointExtend(radius1, null, null);
      const previous = state.joint[i];
      if (previous) {
        writeSegment(
          state,
          previous.index,
          previous.ax,
          previous.ay,
          previous.az,
          previous.bx,
          previous.by,
          previous.bz,
          previous.radius0,
          previous.radius1,
          previous.extend0,
          jointExtend(previous.radius1, previous.dir, dir),
        );
      }
      if (writeSegment(state, state.segments, last[0], last[1], last[2], agent.x, agent.y, agent.z, radius0, radius1, extendStart, extendEnd)) {
        state.joint[i] = {
          index: state.segments,
          ax: last[0],
          ay: last[1],
          az: last[2],
          bx: agent.x,
          by: agent.y,
          bz: agent.z,
          radius0,
          radius1,
          dir,
          extend0: extendStart,
          shade0: state.pointShade[i],
        };
        state.segments += 1;
        state.drawn[i] += 1;
        state.lastDir[i] = dir;
        state.pointRadius[i] = radius1;
        state.pointShade[i] = state.shade[i];
        tubeShade.setScalar((state.joint[i].shade0 + state.shade[i]) * 0.5);
        state.strokes.setColorAt(state.joint[i].index, tubeShade);
        grew = true;
      }
      last[0] = agent.x;
      last[1] = agent.y;
      last[2] = agent.z;
    }
    if (grew) {
      state.strokes.count = state.segments;
      state.strokes.instanceMatrix.needsUpdate = true;
      state.radius0.needsUpdate = true;
      state.radius1.needsUpdate = true;
      state.extend0.needsUpdate = true;
      state.extend1.needsUpdate = true;
      if (state.strokes.instanceColor) state.strokes.instanceColor.needsUpdate = true;
      canvas.dataset.segments = String(state.segments);
    }
    if (!state.capped && state.drawn && state.drawn.length) {
      let open = state.segments < MAX_SEGMENTS;
      if (open) {
        open = false;
        for (let i = 0; i < state.drawn.length; i++) {
          if (state.drawn[i] < MAX_PER_AGENT) {
            open = true;
            break;
          }
        }
      }
      if (!open) {
        state.capped = true;
        canvas.dataset.capped = "1";
        if (onTrailLimit) onTrailLimit(true);
      }
    }
  }

  let showMirror = false;
  let shownReach = FRAME_RADIUS;
  const reflection = new THREE.Matrix4();
  const scaledMatrix = new THREE.Matrix4();

  function currentPlane() {
    if (!mirrorOf) return null;
    const sources = mirrorOf() || [];
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const plane = source.view && source.view.plane && source.view.plane();
      if (plane) return plane;
    }
    return null;
  }

  function mirrorReach() {
    if (!showMirror) return FRAME_RADIUS;
    const plane = currentPlane();
    if (!plane) return FRAME_RADIUS;
    const drop = Math.abs(plane.x * plane.nx + plane.y * plane.ny + (plane.z || 0) * (plane.nz || 0));
    return FRAME_RADIUS + drop * 2;
  }

  function writeReflection(plane, scale, target) {
    const nx = plane.nx;
    const ny = plane.ny;
    const nz = plane.nz || 0;
    const px = plane.x * scale;
    const py = plane.y * scale;
    const pz = (plane.z || 0) * scale;
    const dot = nx * px + ny * py + nz * pz;
    const tx = 2 * dot * nx;
    const ty = 2 * dot * ny;
    const tz = 2 * dot * nz;
    target.set(
      1 - 2 * nx * nx, -2 * nx * ny, -2 * nx * nz, tx,
      -2 * ny * nx, 1 - 2 * ny * ny, -2 * ny * nz, ty,
      -2 * nz * nx, -2 * nz * ny, 1 - 2 * nz * nz, tz,
      0, 0, 0, 1,
    );
  }

  function openSides(root) {
    const touched = [];
    root.traverse((child) => {
      if (!child.material) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (let i = 0; i < materials.length; i++) {
        const material = materials[i];
        touched.push([material, material.polygonOffset, material.polygonOffsetFactor, material.polygonOffsetUnits]);
        material.polygonOffset = true;
        material.polygonOffsetFactor = 1;
        material.polygonOffsetUnits = 1;
      }
    });
    return touched;
  }

  function restoreSides(touched) {
    for (let i = 0; i < touched.length; i++) {
      const [material, polygonOffset, factor, units] = touched[i];
      material.polygonOffset = polygonOffset;
      material.polygonOffsetFactor = factor;
      material.polygonOffsetUnits = units;
    }
  }

  function placeCamera(resetAngle) {
    const distance = frameDistance(camera.fov, camera.aspect, mirrorReach() + getTube().maxRadius);
    controls.minDistance = Math.min(2.4, distance * 0.45);
    controls.maxDistance = Math.max(24, distance * 1.6);
    const offset = resetAngle
      ? new THREE.Vector3(HOME[0], HOME[1], HOME[2])
      : camera.position.clone().sub(controls.target);
    if (offset.lengthSq() < 1e-8) offset.set(HOME[0], HOME[1], HOME[2]);
    offset.setLength(distance);
    if (resetAngle) controls.target.set(0, 0, 0);
    camera.position.copy(controls.target).add(offset);
    const damping = controls.enableDamping;
    const spinning = controls.autoRotate;
    controls.enableDamping = false;
    controls.autoRotate = false;
    controls.update();
    controls.enableDamping = damping;
    controls.autoRotate = spinning;
  }

  let mirrorOf = null;

  const view = {
    scene,
    sculpture,
    follow(flock) {
      state.flock = flock;
      resetInk();
    },
    mirror(getSources) {
      mirrorOf = getSources;
    },
    plane() {
      const signature = state.flock && state.flock.signature;
      return signature && signature.plane ? signature.plane : null;
    },
    mirrorSymmetry(on) {
      showMirror = Boolean(on);
      shownReach = mirrorReach();
      placeCamera(false);
    },
    step() {
      if (!state.flock || playback.paused) return;
      stepFlock(state.flock);
      relaxRadii();
      extendStrokes();
      advanceSmoke();
      advanceGesture();
    },
    draw() {
      controls.update();
      if (mirrorOf) {
        const reach = mirrorReach();
        if (Math.abs(reach - shownReach) > 0.001) {
          shownReach = reach;
          placeCamera(false);
        }
        const sources = mirrorOf() || [];
        const plane = showMirror ? currentPlane() : null;
        renderer.setRenderTarget(null);
        renderer.autoClear = false;
        renderer.setClearColor(PALETTE.stone, 1);
        renderer.clear(true, true, true);
        let drawn = false;
        for (let i = 0; i < sources.length; i++) {
          const source = sources[i];
          const scale = Math.max(0, Number(source.scale) || 0);
          if (!(scale > 0) || !source.view || !source.view.scene || !source.view.sculpture) continue;
          const studyScene = source.view.scene;
          const group = source.view.sculpture;
          const background = studyScene.background;
          if (drawn) studyScene.background = null;
          group.scale.setScalar(scale);
          group.updateMatrix();
          scaledMatrix.copy(group.matrix);
          try {
            renderer.render(studyScene, camera);
            if (plane) {
              studyScene.background = null;
              writeReflection(plane, scale, reflection);
              group.matrixAutoUpdate = false;
              group.matrix.copy(reflection).multiply(scaledMatrix);
              group.matrixWorldNeedsUpdate = true;
              const touched = openSides(group);
              try {
                renderer.render(studyScene, camera);
              } finally {
                restoreSides(touched);
                group.matrixAutoUpdate = true;
                group.matrix.copy(scaledMatrix);
                group.matrixWorldNeedsUpdate = true;
              }
            }
          } finally {
            group.scale.setScalar(1);
            group.updateMatrix();
            studyScene.background = background;
          }
          drawn = true;
        }
        renderer.autoClear = true;
        return;
      }
      if (state.markerMat && state.markerBorn) {
        const life = Math.max(0, 1 - (performance.now() - state.markerBorn) / 1500);
        state.markerMat.opacity = life * life;
      }
      syncHeads();
      syncBubbles();
      const gloss = reflectionLevel();
      if (gloss > 0 && state.strokes) renderReflection(renderer, scene, camera, sculpture, gloss);
      else renderer.render(scene, camera);
    },
    agentsInRange() {
      return state.inRange;
    },
    resize() {
      const width = canvas.clientWidth || 300;
      const height = canvas.clientHeight || 300;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      placeCamera(false);
    },
    fit() {
      placeCamera(true);
    },
  };

  view.resize();
  views.add(view);
  if (!looping) {
    looping = true;
    requestAnimationFrame(loop);
  }
  return view;
}
