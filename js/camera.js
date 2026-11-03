// camera.js — Kamera: lookAt, perspective/orthographic, kontrol keyboard dan mouse
// Pola state-based mengikuti praktikum 04. Preset "foto" disamakan dengan sudut
// pengambilan foto asli sehingga hasilnya bisa dibandingkan dengan fotonya.

"use strict";

// follow: posisi relatif terhadap iCAR (kamera menjadi "child" mobil).
// offset dan look ditulis dalam koordinat lokal mobil.
const CAMERA_PRESETS = {
  foto1: { label: "Halte dari arah datang", position: [0.44, 1.4, 4.02], target: [-1.35, 2.66, 0], fov: 75 },
  foto2: { label: "Halte dari arah berlawanan", position: [0.24, 1.55, -5.74], target: [-1.3, 2.75, -0.09], fov: 75 },
  foto3: { label: "Sisi papan halte", position: [0.41, 1.5, -0.42], target: [-3.2, 2.45, 0.43], fov: 100 },
  icarSamping: { label: "iCAR dari samping", follow: true, offset: [-4.7, 1.0, 3.0], look: [-0.15, 1.02, 0.3], fov: 33 },
  icarDepan: { label: "iCAR dari depan", follow: true, offset: [0.5, 1.12, 9.2], look: [0, 0.96, 0.4], fov: 23 },
  icarRendah: { label: "iCAR sudut rendah", follow: true, offset: [-2.9, 0.42, 2.15], look: [0.35, 1.3, 0.55], fov: 60 },
  ikuti: { label: "Mengikuti iCAR", follow: true, offset: [0.9, 2.5, -7.2], look: [0, 1.1, 1.5], fov: 50 },
  pengemudi: { label: "Pandangan pengemudi", driver: true, fov: 72 },
  atas: { label: "Seluruh kawasan", position: [24, 26, 34], target: [-6, 0, -6], fov: 50 },
};

const camera = {
  current: {
    position: [...CAMERA_PRESETS.foto1.position],
    target: [...CAMERA_PRESETS.foto1.target],
    up: [0, 1, 0],
    fov: CAMERA_PRESETS.foto1.fov,
  },
  presetName: "foto1",
  follow: null,
  driver: false,
  projection: "PERSPECTIVE",
  near: 0.1,
  far: 1400,
  transition: 0,
  from: null,
};

function setCameraPreset(name, instant = false) {
  const preset = CAMERA_PRESETS[name];
  if (!preset) return;

  camera.presetName = name;
  camera.from = instant ? null : {
    position: [...camera.current.position],
    target: [...camera.current.target],
    fov: camera.current.fov,
  };
  camera.transition = instant ? 1 : 0;
  camera.current.fov = preset.fov;
  camera.driver = Boolean(preset.driver);

  if (preset.follow) {
    camera.follow = { offset: [...preset.offset], look: [...preset.look] };
  } else {
    camera.follow = null;
    if (!preset.driver) {
      camera.current.position = [...preset.position];
      camera.current.target = [...preset.target];
    }
  }
}

function nextCameraPreset() {
  const names = Object.keys(CAMERA_PRESETS);
  setCameraPreset(names[(names.indexOf(camera.presetName) + 1) % names.length]);
}

// ─── Input ────────────────────────────────────────────────────────────────────

const keys = {};
const CAMERA_SPEED = 6;
const LOOK_SPEED = 1.1;

function canvasHasFocus() {
  return document.activeElement === canvas;
}

window.addEventListener("keydown", (event) => {
  if (!canvasHasFocus()) return;
  keys[event.key.toLowerCase()] = true;
  if (event.key.startsWith("Arrow") || event.key === " ") event.preventDefault();
});

window.addEventListener("keyup", (event) => {
  keys[event.key.toLowerCase()] = false;
});

window.addEventListener("blur", () => {
  Object.keys(keys).forEach((key) => { keys[key] = false; });
});

// Memutar titik relatif mengelilingi sumbu Y dan menaikkan/menurunkan sudutnya
function orbitOffset(offset, deltaYaw, deltaPitch) {
  const radius = Math.max(Vec3.length(offset), 1e-3);
  const yaw = Math.atan2(offset[0], offset[2]) + deltaYaw;
  const pitch = clamp(Math.asin(clamp(offset[1] / radius, -1, 1)) + deltaPitch, -0.15, 1.45);
  return [
    radius * Math.cos(pitch) * Math.sin(yaw),
    radius * Math.sin(pitch),
    radius * Math.cos(pitch) * Math.cos(yaw),
  ];
}

let dragging = false;
let lastPointer = [0, 0];

canvas.addEventListener("pointerdown", (event) => {
  dragging = true;
  lastPointer = [event.clientX, event.clientY];
  canvas.setPointerCapture(event.pointerId);
  canvas.focus();
});

canvas.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  const dx = (event.clientX - lastPointer[0]) * 0.005;
  const dy = (event.clientY - lastPointer[1]) * 0.005;
  lastPointer = [event.clientX, event.clientY];

  if (camera.follow) {
    camera.follow.offset = orbitOffset(Vec3.subtract(camera.follow.offset, camera.follow.look), -dx, dy);
    camera.follow.offset = Vec3.add(camera.follow.offset, camera.follow.look);
  } else if (!camera.driver) {
    const relative = Vec3.subtract(camera.current.position, camera.current.target);
    camera.current.position = Vec3.add(camera.current.target, orbitOffset(relative, -dx, dy));
  }
});

canvas.addEventListener("pointerup", () => { dragging = false; });
canvas.addEventListener("pointercancel", () => { dragging = false; });

// Canvas memenuhi layar, jadi gulir baru menjadi zoom setelah canvas diklik.
// Tanpa syarat ini halaman tidak bisa digulir ke bagian di bawah canvas.
canvas.addEventListener("wheel", (event) => {
  if (!canvasHasFocus()) return;
  event.preventDefault();
  const factor = Math.exp(event.deltaY * 0.001);
  if (camera.follow) {
    const relative = Vec3.subtract(camera.follow.offset, camera.follow.look);
    camera.follow.offset = Vec3.add(camera.follow.look, Vec3.scale(relative, factor));
  } else if (!camera.driver) {
    const relative = Vec3.subtract(camera.current.position, camera.current.target);
    camera.current.position = Vec3.add(camera.current.target, Vec3.scale(relative, factor));
  }
}, { passive: false });

// ─── Update Kamera per Frame ──────────────────────────────────────────────────

function updateFreeCamera(dt) {
  const view = camera.current;
  const forward = Vec3.normalize(Vec3.subtract(view.target, view.position));
  const flatForward = Vec3.normalize([forward[0], 0, forward[2]]);
  const right = Vec3.normalize(Vec3.cross(flatForward, [0, 1, 0]));

  let move = [0, 0, 0];
  if (keys.w) move = Vec3.add(move, flatForward);
  if (keys.s) move = Vec3.subtract(move, flatForward);
  if (keys.d) move = Vec3.add(move, right);
  if (keys.a) move = Vec3.subtract(move, right);
  if (keys.e) move = Vec3.add(move, [0, 1, 0]);
  if (keys.q) move = Vec3.subtract(move, [0, 1, 0]);

  if (Vec3.length(move) > 0) {
    const step = Vec3.scale(Vec3.normalize(move), CAMERA_SPEED * dt);
    view.position = Vec3.add(view.position, step);
    view.target = Vec3.add(view.target, step);
  }

  // Panah memutar arah pandang di tempat
  const yaw = (keys.arrowleft ? 1 : 0) - (keys.arrowright ? 1 : 0);
  const pitch = (keys.arrowup ? 1 : 0) - (keys.arrowdown ? 1 : 0);
  if (yaw !== 0 || pitch !== 0) {
    const relative = Vec3.subtract(view.target, view.position);
    view.target = Vec3.add(view.position, orbitOffset(relative, yaw * LOOK_SPEED * dt, pitch * LOOK_SPEED * dt));
  }
}

function updateCamera(dt) {
  const view = camera.current;

  if (camera.driver) {
    // Mata pengemudi = titik lokal pada node kepala, jadi ikut semua induknya
    const head = figure[icar.head].world;
    view.position = Mat4.transformPoint(head, [0, 0.17, 0.12]);
    view.target = Mat4.transformPoint(head, [0, 0.13, 5]);
  } else if (camera.follow) {
    const car = figure[icar.root].world;
    view.position = Mat4.transformPoint(car, camera.follow.offset);
    view.target = Mat4.transformPoint(car, camera.follow.look);
  } else {
    updateFreeCamera(dt);
  }

  // Transisi halus antar preset
  if (camera.transition < 1 && camera.from) {
    camera.transition = Math.min(1, camera.transition + dt / 0.9);
    const t = smoothstep(0, 1, camera.transition);
    camera.rendered = {
      position: Vec3.lerp(camera.from.position, view.position, t),
      target: Vec3.lerp(camera.from.target, view.target, t),
      fov: lerp(camera.from.fov, view.fov, t),
      up: view.up,
    };
  } else {
    camera.rendered = view;
  }
}

function createViewMatrix() {
  const view = camera.rendered || camera.current;
  return Mat4.lookAt(view.position, view.target, view.up);
}

function createProjectionMatrix(aspect) {
  const view = camera.rendered || camera.current;
  if (camera.projection === "PERSPECTIVE") {
    return Mat4.perspective(degToRad(view.fov), aspect, camera.near, camera.far);
  }
  // Tinggi orthographic mengikuti jarak target agar ukuran objek tetap (praktikum 04)
  const distance = Vec3.length(Vec3.subtract(view.target, view.position));
  const halfHeight = Math.max(distance, 1) * Math.tan(degToRad(view.fov) / 2);
  return Mat4.orthographic(-halfHeight * aspect, halfHeight * aspect, -halfHeight, halfHeight, -400, camera.far);
}
