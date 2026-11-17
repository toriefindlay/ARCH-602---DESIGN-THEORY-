import { STUDIES, neighborhoodRadius, readSignature, createFlock, resetField, setModifiers, publishNodes } from "./sim.js?v=turns45";
import { createView, setPlayback, setSculptureColour } from "./view.js?v=turns46";
import { PALETTE, applyPalette } from "./palette.js?v=palette";

applyPalette();

const signCanvas = document.querySelector("#sign");
const signCtx = signCanvas.getContext("2d");
const hint = document.querySelector("#sign-hint");
const clearButton = document.querySelector("#clear");
const commitButton = document.querySelector("#commit");
const status = document.querySelector("#status");
const studiesEl = document.querySelector("#studies");
const experimentNote = document.querySelector("#experiment-note");
const anotherButton = document.querySelector("#another");
const pauseButton = document.querySelector("#pause");
const restartButton = document.querySelector("#restart");
const fitButton = document.querySelector("#fit");
const speedSlider = document.querySelector("#speed");
const speedReadout = document.querySelector("#speed-val");
const modifierNote = document.querySelector("#modifier-note");
const clearModifiers = document.querySelector("#clear-modifiers");
const symmetryButton = document.querySelector("#symmetry");
const hueSlider = document.querySelector("#hue");
const hueReadout = document.querySelector("#hue-val");
const hueSwatch = document.querySelector("#hue-swatch");
const hueOriginal = document.querySelector("#hue-original");
const toneSlider = document.querySelector("#tone");
const toneReadout = document.querySelector("#tone-val");
const categories = ["texture", "volume", "motion"];
const modifierNames = {
  reflection: "Reflection",
  stripes: "Stripes",
  bubbles: "Bubbles",
  porosity: "Porosity",
  reaction: "Reaction",
  murmuration: "Murmuration",
};
const modifierNotes = {
  reflection: "Reflection melts adjoining tubes into glass",
  stripes: "Stripes wrap the form in irregular bands of the chosen colour",
  bubbles: "One bubble sits on each turn",
  porosity: "Porosity opens the spaces between the tubes",
  reaction: "Reaction grows tapering tendrils from the turns",
  murmuration: "Murmuration swirls around the turns, then stretches and rejoins",
};
const hueNames = ["red", "orange", "yellow", "yellow green", "green", "cyan", "azure", "blue", "violet", "magenta", "rose", "red"];
const sliders = {
  cohesion: document.querySelector("#cohesion"),
  separation: document.querySelector("#separation"),
  alignment: document.querySelector("#alignment"),
};
const readouts = {
  cohesion: document.querySelector("#cohesion-val"),
  separation: document.querySelector("#separation-val"),
  alignment: document.querySelector("#alignment-val"),
};

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function trailLimit(id) {
  return (full) => {
    const note = document.querySelector(`#trail-${id}`);
    if (note) note.hidden = !full;
  };
}

const views = {
  cohesion: createView(document.querySelector("#view-cohesion"), { autoRotate: true, onTrailLimit: trailLimit("cohesion") }),
  separation: createView(document.querySelector("#view-separation"), { autoRotate: true, onTrailLimit: trailLimit("separation") }),
  alignment: createView(document.querySelector("#view-alignment"), { autoRotate: true, onTrailLimit: trailLimit("alignment") }),
  experiment: createView(document.querySelector("#view-experiment"), { autoRotate: false, onTrailLimit: trailLimit("experiment") }),
};

views.experiment.mirror(() => [
  { view: views.cohesion, scale: Number(sliders.cohesion.value) },
  { view: views.separation, scale: Number(sliders.separation.value) },
  { view: views.alignment, scale: Number(sliders.alignment.value) },
]);

let points = [];
let drawing = false;
let signature = null;
let seed = 4;
let paused = reducedMotion;

function resizeSign() {
  const rect = signCanvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  signCanvas.width = Math.max(1, Math.round(rect.width * pixelRatio));
  signCanvas.height = Math.max(1, Math.round(rect.height * pixelRatio));
  signCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  paintSign();
}

function paintSign() {
  const width = signCanvas.clientWidth;
  const height = signCanvas.clientHeight;
  signCtx.clearRect(0, 0, width, height);
  signCtx.lineWidth = 1.7;
  signCtx.lineCap = "round";
  signCtx.lineJoin = "round";
  signCtx.strokeStyle = PALETTE.charcoal;
  signCtx.beginPath();
  let open = false;
  for (const point of points) {
    if (point.break || !open) {
      if (!point.break) {
        signCtx.moveTo(point.x, point.y);
        open = true;
      }
      continue;
    }
    signCtx.lineTo(point.x, point.y);
  }
  signCtx.stroke();
  const marks = signature && (signature.baseNodes || signature.nodes);
  if (!signature || !marks || !signature.frame) return;
  const { cx, cy, scale } = signature.frame;
  signCtx.fillStyle = PALETTE.charcoal;
  for (const node of marks) {
    signCtx.beginPath();
    signCtx.arc(node.x / scale + cx, cy - node.y / scale, 3.4, 0, Math.PI * 2);
    signCtx.fill();
  }
}

function pointerPosition(event) {
  const rect = signCanvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function markLength() {
  let length = 0;
  let previous = null;
  for (const point of points) {
    if (point.break || !previous) {
      previous = point.break ? null : point;
      continue;
    }
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return length;
}

function refreshCommit() {
  const length = markLength();
  const ready = length >= 36;
  commitButton.disabled = !ready;
  hint.classList.toggle("hidden", points.length > 0);
  if (!points.length) {
    status.textContent = "The rules are written. They have not met a signature yet.";
  } else if (!ready) {
    status.textContent = "Draw a little further. A dot is not yet a situation.";
  } else if (!signature) {
    status.textContent = "The mark is long enough. Run the rules when you are ready.";
  }
}

function paintSliderReadouts() {
  for (const key of Object.keys(sliders)) {
    readouts[key].textContent = Number(sliders[key].value).toFixed(2);
  }
  speedReadout.textContent = Number(speedSlider.value).toFixed(2);
  experimentNote.textContent = "The three studies, together. Each slider sets the size of that form.";
}

function syncPlayback() {
  setPlayback({ speed: Number(speedSlider.value), paused });
  pauseButton.textContent = paused ? "Play" : "Pause";
  pauseButton.setAttribute("aria-pressed", paused ? "true" : "false");
  pauseButton.disabled = !signature;
  restartButton.disabled = !signature;
}

function categorySelection(category) {
  const selected = document.querySelector(`[data-category="${category}"][aria-checked="true"]`);
  return { id: selected ? selected.dataset.modifier : "none" };
}

function categoryStrength(category) {
  return Number(document.querySelector(`[data-strength="${category}"]`).value);
}

function emptyChoices() {
  return {
    texture: { id: "none", strength: 0.6 },
    volume: { id: "none", strength: 0.6 },
    motion: { id: "none", strength: 0.6 },
  };
}

let modifierTimer = 0;

function paintModifier(options = {}) {
  const next = emptyChoices();
  const phrases = [];
  const quiet = [];
  for (const category of categories) {
    const choice = categorySelection(category);
    const strength = categoryStrength(category);
    next[category] = { id: choice.id, strength };
    document.querySelector(`#${category}-val`).textContent = strength.toFixed(2);
    if (choice.id === "none") continue;
    phrases.push(modifierNotes[choice.id] || choice.id);
    if (!(strength > 0)) quiet.push(category);
  }
  const bends = signature && signature.baseNodes ? signature.baseNodes.length : 0;
  const where = bends
    ? `At the ${bends} turn${bends === 1 ? "" : "s"} in the signature.`
    : "The same choices in every view.";
  modifierNote.textContent = phrases.length
    ? `${phrases.join(". ")}. ${quiet.length ? `${quiet.join(" and ")} strength is zero, so that choice adds nothing.` : where}`
    : "None. The studies run on their own rules.";
  if (signature) publishNodes(signature);
  setModifiers(next);
  if (options.restart) beginWithModifier();
}

function hueLabel(hue) {
  const name = hueNames[Math.round(hue / 30) % 12];
  return `${Math.round(hue)}°, ${name}`;
}

function paintColour(choice) {
  const original = choice === true || choice?.original;
  const colour = setSculptureColour(
    original ? { original: true } : { hue: Number(hueSlider.value), tone: Number(toneSlider.value) },
  );
  hueOriginal.setAttribute("aria-pressed", colour.original ? "true" : "false");
  hueReadout.textContent = colour.original ? "Original" : hueLabel(colour.hue);
  hueSlider.setAttribute("aria-valuetext", hueReadout.textContent);
  toneReadout.textContent = Number(toneSlider.value).toFixed(2);
  hueSwatch.style.background = colour.trail;
}

function beginWithModifier() {
  if (!signature && markLength() >= 36) {
    signature = readSignature(points, signCanvas.clientWidth, signCanvas.clientHeight);
  }
  if (!signature) return;
  window.clearTimeout(modifierTimer);
  publishNodes(signature);
  paintSign();
  if (!reducedMotion) paused = false;
  startFlocks({ keepPlayback: true });
}

function startFlocks(options = {}) {
  resetField(seed);
  for (const study of STUDIES) views[study.id].follow(createFlock(signature, study, seed));
  if (!options.keepPlayback && !reducedMotion) paused = false;
  syncPlayback();
  const label = String(seed).padStart(2, "0");
  status.textContent = paused
    ? `Beginning ${label} is held. Play to let the flock draw.`
    : `Beginning ${label}. The flock is drawing. Each line is where an agent has been.`;
}

function runAll() {
  signature = readSignature(points, signCanvas.clientWidth, signCanvas.clientHeight);
  if (!signature) return;
  startFlocks();
  paintSign();
  paintModifier();
  paintSliderReadouts();
  if (!reducedMotion) studiesEl.scrollIntoView({ behavior: "smooth", block: "start" });
}


signCanvas.addEventListener("pointerdown", (event) => {
  signCanvas.setPointerCapture(event.pointerId);
  drawing = true;
  if (points.length) points.push({ break: true });
  points.push(pointerPosition(event));
  paintSign();
  refreshCommit();
});

signCanvas.addEventListener("pointermove", (event) => {
  if (!drawing) return;
  points.push(pointerPosition(event));
  paintSign();
});

function endStroke() {
  if (!drawing) return;
  drawing = false;
  refreshCommit();
}

signCanvas.addEventListener("pointerup", endStroke);
signCanvas.addEventListener("pointercancel", endStroke);

clearButton.addEventListener("click", () => {
  points = [];
  signature = null;
  paintSign();
  refreshCommit();
  for (const view of Object.values(views)) view.follow(null);
  for (const note of document.querySelectorAll(".trail-note")) note.hidden = true;
  syncPlayback();
  paintSliderReadouts();
});

commitButton.addEventListener("click", runAll);
anotherButton.addEventListener("click", () => {
  if (!signature) return;
  seed = (seed + 1) % 97;
  runAll();
});
pauseButton.addEventListener("click", () => {
  if (!signature) return;
  paused = !paused;
  syncPlayback();
  const label = String(seed).padStart(2, "0");
  status.textContent = paused
    ? `Beginning ${label} is held. The lines stay where the flock left them.`
    : `Beginning ${label}. The flock is drawing again.`;
});
restartButton.addEventListener("click", () => {
  if (!signature) return;
  startFlocks();
});
fitButton.addEventListener("click", () => {
  for (const view of Object.values(views)) view.fit();
});
speedSlider.addEventListener("input", () => {
  speedReadout.textContent = Number(speedSlider.value).toFixed(2);
  syncPlayback();
});

for (const slider of Object.values(sliders)) {
  slider.addEventListener("input", paintSliderReadouts);
}

for (const button of document.querySelectorAll("[data-category]")) {
  if (button.disabled) continue;
  button.addEventListener("click", () => {
    const category = button.dataset.category;
    for (const other of document.querySelectorAll(`[data-category="${category}"]`)) {
      other.setAttribute("aria-checked", other === button ? "true" : "false");
    }
    paintModifier({ restart: true });
  });
}

clearModifiers.addEventListener("click", () => {
  for (const category of categories) {
    for (const button of document.querySelectorAll(`[data-category="${category}"]`)) {
      button.setAttribute("aria-checked", button.dataset.modifier === "none" ? "true" : "false");
    }
  }
  paintModifier({ restart: true });
});

for (const slider of document.querySelectorAll("[data-strength]")) {
  slider.addEventListener("input", () => {
    const category = slider.dataset.strength;
    document.querySelector(`#${category}-val`).textContent = Number(slider.value).toFixed(2);
    const bubbles = category === "volume" && categorySelection("volume").id === "bubbles";
    if (!signature || bubbles) {
      paintModifier();
      return;
    }
    window.clearTimeout(modifierTimer);
    modifierTimer = window.setTimeout(() => paintModifier({ restart: true }), 160);
  });
}
symmetryButton.addEventListener("click", () => {
  const on = symmetryButton.getAttribute("aria-pressed") !== "true";
  symmetryButton.setAttribute("aria-pressed", on ? "true" : "false");
  views.experiment.mirrorSymmetry(on);
  experimentNote.textContent = on
    ? "Symmetry is on in this window. The original stays, and its mirror stays joined across the centre."
    : "The three studies, together. Each slider sets the size of that form.";
});

hueSlider.addEventListener("input", () => paintColour(false));
toneSlider.addEventListener("input", () => paintColour(false));
hueOriginal.addEventListener("click", () => paintColour(true));

const resizeObserver = new ResizeObserver(() => {
  resizeSign();
  for (const view of Object.values(views)) view.resize();
});
resizeObserver.observe(signCanvas);
for (const view of ["cohesion", "separation", "alignment", "experiment"]) {
  resizeObserver.observe(document.querySelector(`#view-${view}`));
}

for (const study of STUDIES) {
  const line = document.querySelector(`#weights-${study.id}`);
  if (!line) continue;
  const radius = neighborhoodRadius(study.cohesion);
  line.textContent = `Cohesion ${study.cohesion.toFixed(2)} · Separation ${study.separation.toFixed(2)} · Alignment ${study.alignment.toFixed(2)} · Neighbourhood ${radius.toFixed(2)}`;
}

resizeSign();
refreshCommit();
syncPlayback();
paintSliderReadouts();
paintModifier();
paintColour(true);
