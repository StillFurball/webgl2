// main.js — Inisialisasi, pencahayaan siang/malam, rendering loop, kontrol keyboard

"use strict";

// ─── Pencahayaan Siang-Malam ──────────────────────────────────────────────────

const daylight = {
  hour: 9.6,
  autoTime: false,
  lampsMode: "AUTO",
};

// Nilai per jam: warna matahari, ambient langit, ambient tanah, kabut, tint langit
const DAY_KEYS = [
  { hour: 0, sun: [0.1, 0.13, 0.2], sky: [0.11, 0.14, 0.24], ground: [0.05, 0.05, 0.08], fog: [0.03, 0.04, 0.08], tint: [0.06, 0.08, 0.16], fogDensity: 0.0075 },
  { hour: 5, sun: [0.1, 0.13, 0.2], sky: [0.11, 0.14, 0.24], ground: [0.05, 0.05, 0.08], fog: [0.04, 0.05, 0.1], tint: [0.08, 0.1, 0.2], fogDensity: 0.0075 },
  { hour: 6.3, sun: [0.78, 0.46, 0.26], sky: [0.58, 0.56, 0.66], ground: [0.42, 0.36, 0.32], fog: [0.75, 0.62, 0.55], tint: [0.8, 0.62, 0.55], fogDensity: 0.0048 },
  { hour: 8.5, sun: [0.7, 0.67, 0.6], sky: [0.9, 0.93, 0.98], ground: [0.74, 0.7, 0.62], fog: [0.8, 0.87, 0.94], tint: [1, 1, 1], fogDensity: 0.0032 },
  { hour: 12, sun: [0.72, 0.7, 0.66], sky: [0.92, 0.95, 0.99], ground: [0.76, 0.72, 0.64], fog: [0.82, 0.89, 0.96], tint: [1, 1, 1], fogDensity: 0.003 },
  { hour: 15.5, sun: [0.76, 0.7, 0.6], sky: [0.86, 0.9, 0.98], ground: [0.72, 0.66, 0.56], fog: [0.82, 0.85, 0.9], tint: [1, 0.98, 0.95], fogDensity: 0.0034 },
  { hour: 17.7, sun: [0.86, 0.5, 0.26], sky: [0.62, 0.56, 0.62], ground: [0.46, 0.36, 0.3], fog: [0.86, 0.6, 0.48], tint: [0.95, 0.62, 0.48], fogDensity: 0.0048 },
  { hour: 19, sun: [0.1, 0.13, 0.2], sky: [0.13, 0.15, 0.27], ground: [0.06, 0.06, 0.09], fog: [0.06, 0.06, 0.12], tint: [0.1, 0.11, 0.22], fogDensity: 0.0075 },
  { hour: 24, sun: [0.1, 0.13, 0.2], sky: [0.11, 0.14, 0.24], ground: [0.05, 0.05, 0.08], fog: [0.03, 0.04, 0.08], tint: [0.06, 0.08, 0.16], fogDensity: 0.0075 },
];

const frameLighting = {
  sunDirection: [0, 1, 0],
  sunColor: [1, 1, 1],
  skyAmbient: [1, 1, 1],
  groundAmbient: [1, 1, 1],
  fogColor: [1, 1, 1],
  fogDensity: 0,
  isDark: false,
};

function mix3(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function computeLighting() {
  const hour = daylight.hour;
  let index = 0;
  while (index < DAY_KEYS.length - 2 && DAY_KEYS[index + 1].hour <= hour) index += 1;
  const a = DAY_KEYS[index];
  const b = DAY_KEYS[index + 1];
  const t = clamp((hour - a.hour) / (b.hour - a.hour), 0, 1);

  frameLighting.sunColor = mix3(a.sun, b.sun, t);
  frameLighting.skyAmbient = mix3(a.sky, b.sky, t);
  frameLighting.groundAmbient = mix3(a.ground, b.ground, t);
  frameLighting.fogColor = mix3(a.fog, b.fog, t);
  frameLighting.fogDensity = lerp(a.fogDensity, b.fogDensity, t);
  ENV_MAT.sky.color = mix3(a.tint, b.tint, t);

  frameLighting.isDark = hour < 5.9 || hour > 18.2;

  // Matahari bergerak dari timur (+X) ke barat; malam hari diganti cahaya bulan
  if (hour >= 5.9 && hour <= 18.2) {
    const angle = ((hour - 5.9) / 12.3) * Math.PI;
    frameLighting.sunDirection = Vec3.normalize([Math.cos(angle), Math.max(Math.sin(angle), 0.07) * 1.05, 0.38]);
  } else {
    frameLighting.sunDirection = Vec3.normalize([-0.4, 0.8, 0.45]);
  }

  // Bola lampu dan lampu mobil
  const lampsOn = daylight.lampsMode === "ON" || (daylight.lampsMode === "AUTO" && frameLighting.isDark);
  frameLighting.lampsOn = lampsOn;
  ENV_MAT.lampGlobe.emissive = lampsOn ? [1.0, 0.92, 0.72] : [0, 0, 0];
  CAR_MAT.headlamp.emissive = lampsOn ? [1, 1, 0.95] : [0.35, 0.36, 0.37];
}

function setPointLights() {
  const positions = [];
  const colors = [];
  const directions = [];
  const cutoffs = [];
  const ranges = [];

  const add = (position, color, direction, cutoff, range) => {
    positions.push(...position);
    colors.push(...color);
    directions.push(...direction);
    cutoffs.push(cutoff);
    ranges.push(range);
  };

  if (frameLighting.lampsOn) {
    // Dua lampu sorot mengikuti node lampu depan, sehingga ikut sasis dan mobil
    const chassis = figure[icar.chassis].world;
    const forward = Vec3.normalize(Mat4.transformDirection(chassis, [0, -0.09, 1]));
    add(worldPointOf(icar.lampLeft, [0, 0, 0.05]), [1.7, 1.6, 1.35], forward, 0.84, 34);
    add(worldPointOf(icar.lampRight, [0, 0, 0.05]), [1.7, 1.6, 1.35], forward, 0.84, 34);

    // Enam lampu jalan terdekat dengan kamera
    const eye = camera.rendered.position;
    const nearest = lampPositions
      .map((p) => ({ p, d: Vec3.length(Vec3.subtract(p, eye)) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_POINT_LIGHTS - 2);
    for (const lamp of nearest) add(lamp.p, [1.25, 1.05, 0.72], [0, 0, 0], -1, 17);
  }

  gl.uniform1i(u.pointLightCount, cutoffs.length);
  if (cutoffs.length > 0) {
    gl.uniform3fv(pointLightUniforms.position, positions);
    gl.uniform3fv(pointLightUniforms.color, colors);
    gl.uniform3fv(pointLightUniforms.direction, directions);
    gl.uniform1fv(pointLightUniforms.cutoff, cutoffs);
    gl.uniform1fv(pointLightUniforms.range, ranges);
  }
}

// ─── Shadow Pass ──────────────────────────────────────────────────────────────

const SHADOW_RADIUS = 46;
let shadowFocus = [0, 0, 0];
let lightSpaceMatrix = Mat4.identity();

function computeLightSpace() {
  const focus = camera.rendered.target;
  const eye = camera.rendered.position;
  // Pusat area bayangan di depan kamera, mengikuti ke mana kamera menghadap
  const center = [lerp(eye[0], focus[0], 0.6), 0, lerp(eye[2], focus[2], 0.6)];
  shadowFocus = center;

  const lightDistance = 180;
  const direction = frameLighting.sunDirection;
  const up = Math.abs(direction[1]) > 0.98 ? [0, 0, 1] : [0, 1, 0];

  const view = Mat4.lookAt(Vec3.add(center, Vec3.scale(direction, lightDistance)), center, up);
  const projection = Mat4.orthographic(-SHADOW_RADIUS, SHADOW_RADIUS, -SHADOW_RADIUS, SHADOW_RADIUS, 10, 360);
  const matrix = Mat4.multiply(projection, view);

  // Pusat dikunci ke kelipatan satu texel supaya tepi bayangan tidak bergetar saat kamera bergerak
  const texel = 2 / SHADOW_SIZE;
  const originX = matrix[12];
  const originY = matrix[13];
  matrix[12] += Math.round(originX / texel) * texel - originX;
  matrix[13] += Math.round(originY / texel) * texel - originY;
  lightSpaceMatrix = matrix;
}

function renderShadowPass() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);
  gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);

  gl.useProgram(shadowProgram);
  gl.uniformMatrix4fv(uShadow.lightSpace, false, lightSpaceMatrix);
  gl.uniform1i(uShadow.texture, 0);

  renderPass = "shadow";
  modelMatrix = Mat4.identity();
  traverse(rootId);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

// ─── Main Pass ────────────────────────────────────────────────────────────────

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function renderMainPass() {
  resizeCanvas();
  gl.viewport(0, 0, canvas.width, canvas.height);

  const fog = frameLighting.fogColor;
  gl.clearColor(fog[0], fog[1], fog[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(program);
  activeMaterial = null;
  lastHighlightSent = -1;

  const view = camera.rendered;
  gl.uniformMatrix4fv(u.view, false, createViewMatrix());
  gl.uniformMatrix4fv(u.projection, false, createProjectionMatrix(canvas.width / canvas.height));
  gl.uniformMatrix4fv(u.lightSpace, false, lightSpaceMatrix);
  gl.uniform3fv(u.cameraPosition, view.position);
  gl.uniform1f(u.time, animation.time);

  const sun = frameLighting.sunDirection;
  gl.uniform3f(u.lightPosition, sun[0] * 1000, sun[1] * 1000, sun[2] * 1000);
  gl.uniform3fv(u.lightColor, frameLighting.sunColor);
  gl.uniform3fv(u.skyAmbient, frameLighting.skyAmbient);
  gl.uniform3fv(u.groundAmbient, frameLighting.groundAmbient);
  gl.uniform1f(u.ambientStrength, renderState.ambientOn ? 0.95 * renderState.ambientScale : 0);
  gl.uniform3fv(u.fogColor, fog);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, shadowDepthTexture);
  gl.uniform1i(u.shadowMap, 1);
  gl.uniform1i(u.shadowEnabled, renderState.shadowEnabled ? 1 : 0);
  gl.uniform1f(u.shadowTexel, 2.2 / SHADOW_SIZE);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(u.texture, 0);

  setPointLights();

  if (renderState.depthTest) gl.enable(gl.DEPTH_TEST);
  else gl.disable(gl.DEPTH_TEST);

  renderPass = "main";
  gl.disable(gl.DEPTH_TEST);
  drawSky();
  if (renderState.depthTest) gl.enable(gl.DEPTH_TEST);

  modelMatrix = Mat4.identity();
  traverse(rootId);
}

// ─── Kontrol Keyboard (event-based, praktikum 03 dan 06) ──────────────────────

const FILTER_MODES = ["LINEAR_MIPMAP_LINEAR", "LINEAR", "NEAREST"];

const sceneActions = {
  toggleShading() { renderState.flatShading = !renderState.flatShading; },
  nextFilter() {
    const index = FILTER_MODES.indexOf(renderState.filterMode);
    renderState.filterMode = FILTER_MODES[(index + 1) % FILTER_MODES.length];
    applyAllTextureState();
  },
  nextWrap() {
    renderState.wrapIndex = (renderState.wrapIndex + 1) % wrapModes.length;
    applyAllTextureState();
  },
  toggleProjection() {
    camera.projection = camera.projection === "PERSPECTIVE" ? "ORTHOGRAPHIC" : "PERSPECTIVE";
  },
  toggleDepth() { renderState.depthTest = !renderState.depthTest; },
  toggleTexture() { renderState.textureEnabled = !renderState.textureEnabled; },
  toggleShadow() { renderState.shadowEnabled = !renderState.shadowEnabled; },
  toggleWireframe() { renderState.wireframe = !renderState.wireframe; },
  toggleLamps() {
    const order = ["AUTO", "ON", "OFF"];
    daylight.lampsMode = order[(order.indexOf(daylight.lampsMode) + 1) % order.length];
  },
  toggleDayNight() { daylight.hour = frameLighting.isDark ? 9.6 : 20; },
  togglePlay() { animation.playing = !animation.playing; },
  reset() {
    renderState.flatShading = false;
    renderState.textureEnabled = true;
    renderState.shadowEnabled = true;
    renderState.depthTest = true;
    renderState.wireframe = false;
    renderState.ambientOn = true;
    renderState.diffuseOn = true;
    renderState.specularOn = true;
    renderState.ambientScale = 1;
    renderState.diffuseScale = 1;
    renderState.specularScale = 1;
    renderState.shininessScale = 1;
    renderState.uvScale = 1;
    renderState.filterMode = FILTER_MODES[0];
    renderState.wrapIndex = 0;
    applyAllTextureState();
    daylight.hour = 9.6;
    daylight.autoTime = false;
    daylight.lampsMode = "AUTO";
    animation.playing = true;
    animation.manual = {};
    animation.speedScale = 1;
    animation.windStrength = 1;
    camera.projection = "PERSPECTIVE";
    selectedNode = null;
    setCameraPreset("foto1");
  },
};

const KEY_ACTIONS = {
  f: sceneActions.toggleShading,
  t: sceneActions.nextFilter,
  g: sceneActions.nextWrap,
  p: sceneActions.toggleProjection,
  z: sceneActions.toggleDepth,
  y: sceneActions.toggleTexture,
  b: sceneActions.toggleShadow,
  x: sceneActions.toggleWireframe,
  l: sceneActions.toggleLamps,
  n: sceneActions.toggleDayNight,
  r: sceneActions.reset,
  c: nextCameraPreset,
  " ": sceneActions.togglePlay,
  // Challenge F praktikum 06: menyalakan komponen cahaya satu per satu
  1: () => { renderState.ambientOn = !renderState.ambientOn; },
  2: () => { renderState.diffuseOn = !renderState.diffuseOn; },
  3: () => { renderState.specularOn = !renderState.specularOn; },
  "[": () => { renderState.uvScale = clamp(renderState.uvScale - 0.25, 0.25, 6); },
  "]": () => { renderState.uvScale = clamp(renderState.uvScale + 0.25, 0.25, 6); },
  "-": () => { renderState.shininessScale = clamp(renderState.shininessScale / 1.25, 0.1, 8); },
  "=": () => { renderState.shininessScale = clamp(renderState.shininessScale * 1.25, 0.1, 8); },
  "+": () => { renderState.shininessScale = clamp(renderState.shininessScale * 1.25, 0.1, 8); },
};

window.addEventListener("keydown", (event) => {
  if (!canvasHasFocus() || event.repeat) return;
  const action = KEY_ACTIONS[event.key.toLowerCase()];
  if (action) {
    action();
    event.preventDefault();
    if (typeof syncControls === "function") syncControls();
  }
});

// ─── Rendering Loop ───────────────────────────────────────────────────────────

let rootId = null;
let lastTime = 0;
let frameCount = 0;
let fps = 0;
let fpsTimer = 0;
let fpsFrames = 0;

function render(time) {
  let dt = (time - lastTime) * 0.001;
  lastTime = time;
  dt = Math.min(dt, 0.05);

  fpsTimer += dt;
  fpsFrames += 1;
  if (fpsTimer > 0.5) {
    fps = fpsFrames / fpsTimer;
    fpsTimer = 0;
    fpsFrames = 0;
  }

  if (daylight.autoTime) daylight.hour = (daylight.hour + dt * 0.25) % 24;

  updateAnimation(dt);

  // Hitung world matrix semua node dulu, karena kamera dan lampu membacanya
  renderPass = "update";
  modelMatrix = Mat4.identity();
  traverse(rootId);

  updateCamera(dt);
  computeLighting();
  computeLightSpace();

  renderState.drawCalls = 0;
  if (renderState.shadowEnabled) renderShadowPass();
  renderMainPass();

  frameCount += 1;
  if (typeof updateHUD === "function") updateHUD();

  requestAnimationFrame(render);
}

function initScene() {
  loadTextures();
  loadIcarAssets();
  loadMotorAssets();
  loadEnvironmentAssets();

  rootId = addNode("Dunia", null, Mat4.identity(), null, { note: "Akar scene graph" });
  createEnvironment(rootId);
  createIcar(rootId);

  const trafficId = addNode("Lalu Lintas", rootId, Mat4.identity(), null, { note: "Dua motor seperti foto pertama" });
  createMotor(trafficId, 1, { start: HALTE_STOP + 18, offset: 3.4, speed: 7.2 });
  createMotor(trafficId, 2, { start: HALTE_STOP + 44, offset: 2.2, speed: 6.4 });

  setCameraPreset("foto1", true);
  camera.rendered = camera.current;

  if (typeof initUI === "function") initUI();

  requestAnimationFrame((time) => {
    lastTime = time;
    render(time);
  });
}

// Texture prosedural butuh beberapa detik; beri browser kesempatan menggambar halaman dulu
window.addEventListener("load", () => setTimeout(initScene, 30));
