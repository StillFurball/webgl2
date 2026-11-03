// ui.js — Halaman utama: data kelompok, galeri foto, panel kontrol, HUD, diagram tree

"use strict";

// ─── Data Kelompok (ganti bagian ini) ─────────────────────────────────────────

const DATA_KELOMPOK = {
  nama: "Halte Icar",
  anggota: [
    { nama: "Rafi Attar Maulana", nrp: "5025241141" },
    { nama: "Ananda Aryasatya Zhafran Aqila", nrp: "5025241142" },
  ],

  // Video objek asli. Isi youtubeId dengan kode setelah "v=" pada alamat video YouTube,
  // atau biarkan kosong dan letakkan file di videoLokal.
  youtubeId: "",
  videoLokal: "gallery/video/icar.mp4",

  // Ubah menjadi false setelah pembagian di bawah sesuai dengan kelompok
  pembagianMasihUsulan: true,
  pembagian: [
    {
      anggota: "Nama Anggota 1",
      tugas: "nihil",
      file: "walahi",
    },
    {
      anggota: "Nama Anggota 2",
      tugas: "hidup",
      file: "jokowi",
    },
    {
      anggota: "Bersama",
      tugas: "Foto dan video lokasi, halaman utama, rendering loop",
      file: "index.html, style.css, ui.js, main.js",
    },
  ],
};

// ─── Foto Asli ────────────────────────────────────────────────────────────────

// crop = [x, y, lebar, tinggi] dalam piksel asli. Screenshot iCAR punya bar hitam dan
// tombol ponsel, jadi hanya bagian videonya yang ditampilkan; file aslinya tidak diubah.
const FOTO = [
  {
    file: "gallery/scene/WhatsApp Image 2026-11-02 at 17.11.24.jpeg",
    kelompok: "Halte Robotika",
    label: "Arah datang",
    keterangan: "Halte dari arah datang kendaraan",
    preset: "foto1",
    ukuran: [1200, 1600],
    crop: [0, 0, 1200, 1600],
  },
  {
    file: "gallery/scene/WhatsApp Image 2026-11-02 at 17.11.24 (1).jpeg",
    kelompok: "Halte Robotika",
    label: "Arah berlawanan",
    keterangan: "Halte dari arah berlawanan",
    preset: "foto2",
    ukuran: [1200, 1600],
    crop: [0, 0, 1200, 1600],
  },
  {
    file: "gallery/scene/WhatsApp Image 2026-11-02 at 17.11.24 (2).jpeg",
    kelompok: "Halte Robotika",
    label: "Sisi papan",
    keterangan: "Dua papan mengapit tiang biru",
    preset: "foto3",
    ukuran: [1200, 1600],
    crop: [0, 0, 1200, 1600],
  },
  {
    file: "gallery/object/icar/WhatsApp Image 2026-11-02 at 18.15.50 (1).jpeg",
    kelompok: "iCAR",
    label: "Samping",
    keterangan: "iCAR dari samping, cuplikan video ITS TV",
    preset: "icarSamping",
    ukuran: [1600, 720],
    crop: [160, 0, 1280, 720],
  },
  {
    file: "gallery/object/icar/WhatsApp Image 2026-11-02 at 18.15.50.jpeg",
    kelompok: "iCAR",
    label: "Depan",
    keterangan: "iCAR dari depan, cuplikan video ITS TV",
    preset: "icarDepan",
    ukuran: [1600, 720],
    crop: [224, 0, 1067, 600],
  },
  {
    file: "gallery/object/icar/WhatsApp Image 2026-11-02 at 18.15.49.jpeg",
    kelompok: "iCAR",
    label: "Sudut rendah",
    keterangan: "iCAR dari sudut rendah, cuplikan video ITS TV",
    preset: "icarRendah",
    ukuran: [1600, 720],
    crop: [160, 0, 1280, 720],
  },
];

// ─── Materi ───────────────────────────────────────────────────────────────────

const MATERI = [
  { sumber: "Praktikum 01", isi: "Canvas 2D: semua texture digambar dengan kode di textures.js, termasuk papan halte dan velg iCAR." },
  { sumber: "Praktikum 02", isi: "Buffer, attribute, vertex dan fragment shader, draw call, gl.LINES untuk kabel listrik, requestAnimationFrame." },
  { sumber: "Praktikum 03", isi: "Translasi, rotasi, skala, urutan T × R × S, pivot sendi, delta time, keyboard state-based dan event-based." },
  { sumber: "Praktikum 04", isi: "Mat4.lookAt, perspective dan orthographic, FOV, depth test, VAO, kontrol kamera." },
  { sumber: "Praktikum 06", isi: "Phong per-fragment (ambient, diffuse, specular), Normal Matrix, flat dan smooth shading, UV, filtering, mipmap, wrapping, UV Scale, shininess." },
  { sumber: "Praktikum 07", isi: "createNode, initNodes, traverse dengan stack, theta, instanceMatrix, slider sendi. Pengemudi dan pengendara memakai susunan figure.js." },
  { sumber: "Di luar materi", isi: "Shadow map dengan PCF (dimatikan dengan tombol B), ambient langit-tanah, kabut, lampu sorot pada iCAR.", tambahan: true },
];

// ─── Helper DOM ───────────────────────────────────────────────────────────────

function byId(id) {
  return document.getElementById(id);
}

function el(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function angka(value, digits = 2) {
  return value.toFixed(digits).replace(".", ",");
}

function formatJam(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour - Math.floor(hour)) * 60);
  return `${String(h).padStart(2, "0")}.${String(m).padStart(2, "0")}`;
}

function geserHalus() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

// ─── Bagian Statis (tersedia walau WebGL gagal) ───────────────────────────────

function isiDataKelompok() {
  const box = byId("teamSummary");
  box.append(el("div", "team-name", DATA_KELOMPOK.nama));

  const list = el("ul", "team-members");
  for (const anggota of DATA_KELOMPOK.anggota) {
    list.append(el("li", "", `${anggota.nama}, ${anggota.nrp}`));
  }
  box.append(list);

  if (DATA_KELOMPOK.nama === "Nama Kelompok") {
    box.append(el("p", "team-hint", "Data masih contoh. Ganti di DATA_KELOMPOK, bagian atas js/ui.js."));
  }

  const tbody = byId("teamTable");
  if (!tbody) return;
  for (const baris of DATA_KELOMPOK.pembagian) {
    const row = el("tr");
    row.append(el("td", "", baris.anggota), el("td", "", baris.tugas), el("td", "", baris.file));
    tbody.append(row);
  }
  byId("teamDraftNote").hidden = !DATA_KELOMPOK.pembagianMasihUsulan;
}

function isiMateri() {
  const tbody = byId("materialTable");
  if (!tbody) return;
  for (const baris of MATERI) {
    const row = el("tr", baris.tambahan ? "row-extra" : "");
    row.append(el("td", "", baris.sumber), el("td", "", baris.isi));
    tbody.append(row);
  }
}

function tampilkanPetunjukVideo() {
  const slot = byId("videoSlot");
  slot.replaceChildren();

  const box = el("div", "video-hint");
  box.append(el("h3", "", "Video belum dipasang"));

  const langkah = el("p");
  langkah.append("Salin video iCAR ke ");
  langkah.append(el("code", "", DATA_KELOMPOK.videoLokal));
  langkah.append(", atau isi ");
  langkah.append(el("code", "", "youtubeId"));
  langkah.append(" di ");
  langkah.append(el("code", "", "DATA_KELOMPOK"));
  langkah.append(" pada js/ui.js.");
  box.append(langkah);

  const sumber = el("p", "video-link");
  const link = el("a", "", "Cari videonya di kanal ITS TV");
  link.href = "https://www.youtube.com/@itseurekatv";
  link.target = "_blank";
  link.rel = "noopener";
  sumber.append(link);
  sumber.append(", sumber cuplikan foto iCAR di atas.");
  box.append(sumber);

  slot.append(box);
}

function pasangVideo() {
  const slot = byId("videoSlot");
  if (!slot) return;
  const { youtubeId, videoLokal } = DATA_KELOMPOK;

  if (youtubeId) {
    const frame = el("iframe");
    frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}`;
    frame.title = "Video iCAR ITS di YouTube";
    frame.allow = "accelerometer; encrypted-media; gyroscope; picture-in-picture";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    slot.append(frame);

    // YouTube kadang menolak embed dari halaman file://, jadi sediakan tautan langsung
    const link = el("a", "video-external", "Buka video di YouTube");
    link.href = `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}`;
    link.target = "_blank";
    link.rel = "noopener";
    const line = el("p");
    line.append(link);
    byId("video").querySelector(".video-text h2").after(line);
    return;
  }

  const video = el("video");
  video.controls = true;
  video.preload = "metadata";
  video.playsInline = true;
  video.setAttribute("aria-label", "Video iCAR ITS");
  video.addEventListener("error", tampilkanPetunjukVideo);
  video.src = encodeURI(videoLokal);
  slot.append(video);
}

// ─── Galeri Foto ──────────────────────────────────────────────────────────────

let sceneSiap = false;

function pasangCrop(img, foto) {
  const [x, y, w, h] = foto.crop;
  const [W, H] = foto.ukuran;
  img.src = encodeURI(foto.file);
  img.style.width = `${(W / w) * 100}%`;
  img.style.height = `${(H / h) * 100}%`;
  img.style.left = `${(-x / w) * 100}%`;
  img.style.top = `${(-y / h) * 100}%`;
}

function rasioFoto(foto) {
  return foto.crop[2] / foto.crop[3];
}

function bangunGaleri() {
  const galeri = byId("photoGallery");
  const kelompok = new Map();

  for (const foto of FOTO) {
    if (!kelompok.has(foto.kelompok)) {
      const group = el("div", "galeri-grup");
      group.append(el("h3", "", foto.kelompok));
      const items = el("div", "galeri-isi");
      group.append(items);
      galeri.append(group);
      kelompok.set(foto.kelompok, items);
    }

    const frame = el("div", "foto-frame");
    frame.style.aspectRatio = rasioFoto(foto);
    const img = el("img");
    img.alt = foto.keterangan;
    img.loading = "lazy";
    pasangCrop(img, foto);
    frame.append(img);

    const caption = el("figcaption");
    caption.append(el("strong", "", foto.label), el("span", "", foto.keterangan));

    // Aktif setelah scene siap, lihat tandaiFoto
    const button = el("button", "btn btn--small", "Lihat sudut ini di canvas");
    button.type = "button";
    button.disabled = true;
    button.dataset.preset = foto.preset;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      setCameraPreset(foto.preset);
      syncControls();
      keCanvas();
    });

    const kartu = el("figure", "foto");
    kartu.append(frame, caption, button);
    kelompok.get(foto.kelompok).append(kartu);
  }
}

// Kamera bisa berganti dari keyboard atau pilihan preset; tanda pada foto mengikuti
function tandaiFoto() {
  document.querySelectorAll(".foto .btn").forEach((button) => {
    button.disabled = false;
    button.setAttribute("aria-pressed", button.dataset.preset === camera.presetName ? "true" : "false");
  });
}

function keCanvas() {
  window.scrollTo({ top: 0, behavior: geserHalus() });
}

// Canvas mengecil di pojok saat viewer tergulir keluar layar
function pasangCanvasMengambang() {
  // Hanya setelah viewer terlewati; di ponsel canvas bisa saja belum tercapai
  const stage = byId("canvasStage");
  const perbarui = () => {
    const rect = stage.getBoundingClientRect();
    document.body.classList.toggle("canvas-floating", rect.bottom < rect.height * 0.15);
  };
  window.addEventListener("scroll", perbarui, { passive: true });
  window.addEventListener("resize", perbarui);
  perbarui();

  const toggle = byId("miniToggle");
  const setTersembunyi = (hidden) => {
    document.body.classList.toggle("mini-hidden", hidden);
    toggle.textContent = hidden ? "Tampilkan canvas" : "Sembunyikan canvas";
  };
  toggle.addEventListener("click", () => setTersembunyi(!document.body.classList.contains("mini-hidden")));

  // Di ponsel canvas kecil menutupi isi, jadi baru muncul bila diminta
  setTersembunyi(window.matchMedia("(max-width: 800px)").matches);
  byId("miniBack").addEventListener("click", keCanvas);
}

// ─── Panel Kontrol ────────────────────────────────────────────────────────────

const sinkronKontrol = [];
const sinkronLangsung = [];

function tambahSlider(parent, opsi) {
  const label = el("label", "slider");
  const output = el("output");
  const input = el("input");
  input.type = "range";
  input.min = opsi.min;
  input.max = opsi.max;
  input.step = opsi.step;
  input.addEventListener("input", () => {
    const value = Number(input.value);
    opsi.set(value);
    output.textContent = opsi.format(value);
    if (opsi.setelah) opsi.setelah();
  });
  label.append(el("span", "", opsi.label), output, input);
  parent.append(label);

  const sync = () => {
    if (input.matches(":active")) return;
    const value = opsi.get();
    input.value = value;
    output.textContent = opsi.format(value);
  };
  (opsi.langsung ? sinkronLangsung : sinkronKontrol).push(sync);
  return input;
}

function tambahTombol(parent, opsi) {
  const button = el("button", "btn");
  button.type = "button";
  button.addEventListener("click", () => {
    opsi.aksi();
    syncControls();
  });
  parent.append(button);

  sinkronKontrol.push(() => {
    button.textContent = typeof opsi.teks === "function" ? opsi.teks() : opsi.teks;
    if (opsi.aktif) button.setAttribute("aria-pressed", opsi.aktif() ? "true" : "false");
    if (opsi.nonaktif) button.disabled = opsi.nonaktif();
  });
  return button;
}

function grupKontrol(judul) {
  const group = el("div", "control-group");
  group.append(el("h3", "", judul));
  byId("controlGrid").append(group);
  return group;
}

function barisTombol(parent) {
  const row = el("div", "btn-row");
  parent.append(row);
  return row;
}

const NAMA_FILTER = {
  LINEAR_MIPMAP_LINEAR: "Mipmap linear",
  LINEAR: "Linear",
  NEAREST: "Nearest",
};

const NAMA_WRAP = {
  REPEAT: "Repeat",
  CLAMP_TO_EDGE: "Clamp to edge",
  MIRRORED_REPEAT: "Mirrored repeat",
};

const NAMA_LAMPU = { AUTO: "Otomatis", ON: "Nyala", OFF: "Mati" };

// Sendi yang bisa digerakkan manual, seperti slider pada figure.js
const SLIDER_SENDI = [
  { key: "steer", label: "Belok roda depan", min: -32, max: 32 },
  { key: "sensorYaw", label: "Putar kepala sensor", min: -90, max: 90 },
  { key: "cameraPitch", label: "Angguk kamera", min: -40, max: 40 },
  { key: "headYaw", label: "Toleh pengemudi", min: -70, max: 70 },
  { key: "chassisPitch", label: "Ayun sasis", min: -6, max: 6 },
];

function bangunKontrolKamera() {
  const group = grupKontrol("Kamera");

  const field = el("label", "select-field");
  field.append(el("span", "", "Sudut pandang"));
  const select = el("select");
  for (const [name, preset] of Object.entries(CAMERA_PRESETS)) {
    const option = el("option", "", preset.label);
    option.value = name;
    select.append(option);
  }
  select.addEventListener("change", () => {
    setCameraPreset(select.value);
    syncControls();
  });
  field.append(select);
  group.append(field);
  sinkronKontrol.push(() => {
    select.value = camera.presetName;
  });

  tambahSlider(group, {
    label: "Field of view",
    min: 15,
    max: 100,
    step: 1,
    langsung: true,
    get: () => camera.current.fov,
    set: (value) => { camera.current.fov = value; },
    format: (value) => `${Math.round(value)}°`,
  });

  const row = barisTombol(group);
  tambahTombol(row, {
    teks: () => (camera.projection === "PERSPECTIVE" ? "Perspective" : "Orthographic"),
    aksi: sceneActions.toggleProjection,
  });
  tambahTombol(row, {
    teks: "Depth test",
    aksi: sceneActions.toggleDepth,
    aktif: () => renderState.depthTest,
  });
}

function bangunKontrolCahaya() {
  const group = grupKontrol("Cahaya");

  tambahSlider(group, {
    label: "Jam",
    min: 0,
    max: 23.9,
    step: 0.1,
    langsung: true,
    get: () => daylight.hour,
    set: (value) => { daylight.hour = value; },
    format: formatJam,
  });

  const waktu = barisTombol(group);
  tambahTombol(waktu, {
    teks: "Waktu berjalan",
    aksi: () => { daylight.autoTime = !daylight.autoTime; },
    aktif: () => daylight.autoTime,
  });
  tambahTombol(waktu, {
    teks: () => `Lampu: ${NAMA_LAMPU[daylight.lampsMode].toLowerCase()}`,
    aksi: sceneActions.toggleLamps,
  });
  tambahTombol(waktu, {
    teks: "Bayangan",
    aksi: sceneActions.toggleShadow,
    aktif: () => renderState.shadowEnabled,
  });

  const komponen = barisTombol(group);
  tambahTombol(komponen, {
    teks: "Ambient",
    aksi: () => { renderState.ambientOn = !renderState.ambientOn; },
    aktif: () => renderState.ambientOn,
  });
  tambahTombol(komponen, {
    teks: "Diffuse",
    aksi: () => { renderState.diffuseOn = !renderState.diffuseOn; },
    aktif: () => renderState.diffuseOn,
  });
  tambahTombol(komponen, {
    teks: "Specular",
    aksi: () => { renderState.specularOn = !renderState.specularOn; },
    aktif: () => renderState.specularOn,
  });

  const skala = (label, key, max) => tambahSlider(group, {
    label,
    min: key === "shininessScale" ? 0.1 : 0,
    max,
    step: 0.05,
    get: () => renderState[key],
    set: (value) => { renderState[key] = value; },
    format: (value) => `× ${angka(value)}`,
  });
  skala("Kuat ambient", "ambientScale", 2);
  skala("Kuat diffuse", "diffuseScale", 2);
  skala("Kuat specular", "specularScale", 3);
  skala("Shininess", "shininessScale", 8);
}

function bangunKontrolTexture() {
  const group = grupKontrol("Texture dan shading");

  const row = barisTombol(group);
  tambahTombol(row, {
    teks: () => (renderState.flatShading ? "Flat shading" : "Smooth shading"),
    aksi: sceneActions.toggleShading,
  });
  tambahTombol(row, {
    teks: "Texture",
    aksi: sceneActions.toggleTexture,
    aktif: () => renderState.textureEnabled,
  });
  tambahTombol(row, {
    teks: "Wireframe",
    aksi: sceneActions.toggleWireframe,
    aktif: () => renderState.wireframe,
  });
  tambahTombol(row, {
    teks: () => `Filter: ${NAMA_FILTER[renderState.filterMode].toLowerCase()}`,
    aksi: sceneActions.nextFilter,
  });
  tambahTombol(row, {
    teks: () => `Wrap: ${NAMA_WRAP[wrapModes[renderState.wrapIndex]].toLowerCase()}`,
    aksi: sceneActions.nextWrap,
  });

  tambahSlider(group, {
    label: "UV Scale jalan dan tanah",
    min: 0.25,
    max: 6,
    step: 0.25,
    get: () => renderState.uvScale,
    set: (value) => { renderState.uvScale = value; },
    format: (value) => angka(value),
  });
}

function bangunKontrolAnimasi() {
  const group = grupKontrol("Animasi");

  const row = barisTombol(group);
  tambahTombol(row, {
    teks: () => (animation.playing ? "Jeda animasi" : "Lanjutkan animasi"),
    aksi: sceneActions.togglePlay,
  });
  tambahTombol(row, { teks: "Reset semua", aksi: sceneActions.reset });

  tambahSlider(group, {
    label: "Laju lalu lintas",
    min: 0,
    max: 3,
    step: 0.05,
    get: () => animation.speedScale,
    set: (value) => { animation.speedScale = value; },
    format: (value) => `× ${angka(value)}`,
  });
  tambahSlider(group, {
    label: "Kekuatan angin",
    min: 0,
    max: 4,
    step: 0.1,
    get: () => animation.windStrength,
    set: (value) => { animation.windStrength = value; },
    format: (value) => `× ${angka(value, 1)}`,
  });

  group.append(el("h4", "", "Sendi iCAR"));
  for (const sendi of SLIDER_SENDI) {
    tambahSlider(group, {
      label: sendi.label,
      min: sendi.min,
      max: sendi.max,
      step: 1,
      langsung: true,
      get: () => theta[sendi.key],
      set: (value) => {
        theta[sendi.key] = value;
        animation.manual[sendi.key] = true;
        if (sendi.key === "steer") theta.steeringWheel = value * 6;
      },
      setelah: syncControls,
      format: (value) => `${Math.round(value)}°`,
    });
  }

  tambahTombol(barisTombol(group), {
    teks: "Kembalikan sendi ke otomatis",
    aksi: () => { animation.manual = {}; },
    nonaktif: () => Object.keys(animation.manual).length === 0,
  });
}

// Dipanggil main.js setelah tombol keyboard, dan oleh panel ini sendiri
function syncControls() {
  sinkronKontrol.forEach((sync) => sync());
  sinkronLangsung.forEach((sync) => sync());
  if (!sceneSiap) return;
  tandaiFoto();
  gambarTreeBilaBerubah();
  isiInfoTree();
}

// ─── HUD (praktikum 06) ───────────────────────────────────────────────────────

let hudBerikutnya = 0;
const hud = {};

function ambilElemenHud() {
  ["Status", "Speed", "Hour", "Lamps", "Camera", "Fps", "Draws", "Shading", "Filter", "Wrap", "Uv", "Shininess", "Projection", "Light"]
    .forEach((name) => { hud[name] = byId(`hud${name}`); });
}

function isiHud() {
  const view = camera.rendered || camera.current;
  const position = view.position;

  hud.Status.textContent = animation.playing ? animation.state : `${animation.state}, dijeda`;
  hud.Speed.textContent = `${Math.round(animation.speed * 3.6)} km/jam`;
  hud.Hour.textContent = formatJam(daylight.hour);
  hud.Lamps.textContent = `${NAMA_LAMPU[daylight.lampsMode]}${frameLighting.lampsOn ? ", menyala" : ""}`;
  hud.Camera.textContent = `${CAMERA_PRESETS[camera.presetName].label} (${angka(position[0], 1)}; ${angka(position[1], 1)}; ${angka(position[2], 1)})`;
  hud.Fps.textContent = Math.round(fps);
  hud.Draws.textContent = renderState.drawCalls;

  hud.Shading.textContent = renderState.flatShading ? "Flat" : "Smooth";
  hud.Filter.textContent = NAMA_FILTER[renderState.filterMode];
  hud.Wrap.textContent = NAMA_WRAP[wrapModes[renderState.wrapIndex]];
  hud.Uv.textContent = angka(renderState.uvScale);
  hud.Shininess.textContent = `× ${angka(renderState.shininessScale)}`;
  hud.Projection.textContent = `${camera.projection === "PERSPECTIVE" ? "Perspective" : "Orthographic"}, ${Math.round(view.fov)}°`;

  const komponen = [
    renderState.ambientOn ? "ambient" : null,
    renderState.diffuseOn ? "diffuse" : null,
    renderState.specularOn ? "specular" : null,
  ].filter(Boolean);
  hud.Light.textContent = komponen.length ? komponen.join(", ") : "Semua komponen mati";
}

function updateHUD() {
  const now = performance.now();
  if (now < hudBerikutnya) return;
  hudBerikutnya = now + 250;

  isiHud();
  sinkronLangsung.forEach((sync) => sync());
  isiPosisiTree();
}

// ─── Diagram Tree ─────────────────────────────────────────────────────────────

const SVG_NS = "http://www.w3.org/2000/svg";
const TREE_BARIS = 27;
const TREE_TINGGI_KOTAK = 21;
const TREE_JARAK = 42;
const TREE_TEPI = 10;

// Node grup yang langsung terbuka di tampilan ringkas
const TREE_TERBUKA_AWAL = new Set([
  "Dunia", "iCAR", "Sasis", "Muka Depan", "Tiang Sensor", "Kepala Sensor", "Halte iCAR 1", "Tiang Biru", "Lalu Lintas",
]);

const treeTerbuka = new Set();
let treeTerpilihTergambar = null;
let treeFokus = null;
const pengukurTeks = document.createElement("canvas").getContext("2d");

// Membaca pointer child lalu sibling, urutan yang sama dengan traverse()
function anakNode(id) {
  const list = [];
  let current = figure[id].child;
  while (current != null) {
    list.push(current);
    current = figure[current].sibling;
  }
  return list;
}

function anakTerlihat(id) {
  return anakNode(id).filter((childId) => !figure[childId].info.hidden);
}

function jumlahTurunan(id) {
  let total = 0;
  for (const childId of anakNode(id)) total += 1 + jumlahTurunan(childId);
  return total;
}

function indukDari(id, ancestorId) {
  let current = figure[id].parent;
  while (current !== null) {
    if (current === ancestorId) return true;
    current = figure[current].parent;
  }
  return false;
}

function bukaTreeRingkas() {
  treeTerbuka.clear();
  figure.forEach((node) => {
    if (node.info.hidden || node.info.collapsed) return;
    if (TREE_TERBUKA_AWAL.has(node.name) || anakTerlihat(node.id).length === 1) treeTerbuka.add(node.id);
  });
  // Jalur menuju node yang sedang dipilih tetap terbuka
  if (selectedNode !== null) {
    let current = figure[selectedNode].parent;
    while (current !== null) {
      treeTerbuka.add(current);
      current = figure[current].parent;
    }
  }
}

function ukurLabel(node) {
  return pengukurTeks.measureText(node.name).width;
}

function teksJumlah(id, terbuka) {
  if (terbuka) {
    const tersembunyi = anakNode(id).filter((childId) => figure[childId].info.hidden).length;
    return tersembunyi ? String(tersembunyi) : "";
  }
  const total = jumlahTurunan(id);
  return total ? String(total) : "";
}

function gambarTree() {
  const svg = byId("treeSvg");
  svg.replaceChildren();
  pengukurTeks.font = `14px ${getComputedStyle(svg).fontFamily}`;

  const baris = [];
  const place = (id, depth) => {
    const kids = anakTerlihat(id);
    const open = treeTerbuka.has(id) && kids.length > 0;
    const item = { id, depth, kids: [], open, punyaAnak: kids.length > 0 };
    if (open) {
      item.kids = kids.map((childId) => place(childId, depth + 1));
      item.y = (item.kids[0].y + item.kids[item.kids.length - 1].y) / 2;
    } else {
      item.y = baris.length * TREE_BARIS + TREE_BARIS / 2 + TREE_TEPI;
      baris.push(item);
    }
    return item;
  };
  const akar = place(rootId, 0);

  // Lebar kolom mengikuti label terpanjang pada kedalaman yang sama
  const semua = [];
  const kumpulkan = (item) => {
    semua.push(item);
    item.kids.forEach(kumpulkan);
  };
  kumpulkan(akar);

  const lebarKolom = [];
  for (const item of semua) {
    const node = figure[item.id];
    const count = teksJumlah(item.id, item.open);
    item.count = count;
    item.width = ukurLabel(node) + 16 + (count ? count.length * 7 + 8 : 0) + (typeof node.local === "function" ? 13 : 0);
    lebarKolom[item.depth] = Math.max(lebarKolom[item.depth] || 0, item.width);
  }
  const xKolom = [TREE_TEPI];
  for (let d = 1; d < lebarKolom.length; d += 1) xKolom[d] = xKolom[d - 1] + lebarKolom[d - 1] + TREE_JARAK;

  const links = document.createElementNS(SVG_NS, "g");
  svg.append(links);

  const buat = (tag, attrs, parent, className) => {
    const element = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
    if (className) element.setAttribute("class", className);
    if (parent) parent.append(element);
    return element;
  };

  // Urutan fokus keyboard mengikuti urutan baris dari atas ke bawah
  const urut = [...semua].sort((a, b) => a.y - b.y);
  const posisiFokus = new Map(urut.map((item, index) => [item.id, index]));

  for (const item of semua) {
    const node = figure[item.id];
    const x = xKolom[item.depth];
    const parentRight = x + item.width;

    for (const kid of item.kids) {
      const kx = xKolom[kid.depth];
      const mid = kx - TREE_JARAK / 2 + 5;
      buat("path", { d: `M${parentRight} ${item.y}H${mid}V${kid.y}H${kx}` }, links, "tlink");
    }

    const selected = item.id === selectedNode;
    const inSubtree = selectedNode !== null && indukDari(item.id, selectedNode);
    const group = buat(
      "g",
      {
        transform: `translate(${x} ${item.y - TREE_TINGGI_KOTAK / 2})`,
        tabindex: (treeFokus === item.id || (treeFokus === null && item.id === rootId)) ? "0" : "-1",
        role: "treeitem",
        "aria-selected": selected ? "true" : "false",
        "data-id": item.id,
      },
      svg,
      `tnode${selected ? " is-selected" : ""}${inSubtree ? " in-subtree" : ""}`
    );
    if (item.punyaAnak) group.setAttribute("aria-expanded", item.open ? "true" : "false");

    buat("rect", { width: item.width, height: TREE_TINGGI_KOTAK }, group, "tbox");
    const title = buat("title", {}, group);
    title.textContent = node.info.note || node.name;

    let textX = 8;
    if (typeof node.local === "function") {
      buat("circle", { cx: 9, cy: TREE_TINGGI_KOTAK / 2, r: 3.5 }, group, "tjoint");
      textX = 18;
    }
    const label = buat("text", { x: textX, y: TREE_TINGGI_KOTAK / 2 }, group, "tlabel");
    label.textContent = node.name;
    if (item.count) {
      const tspan = buat("tspan", { dx: 6 }, label, "tcount");
      tspan.textContent = item.count;
    }

    if (item.punyaAnak) {
      const toggle = buat("g", { transform: `translate(${item.width + 9} ${TREE_TINGGI_KOTAK / 2})` }, group, "ttoggle");
      buat("circle", { r: 7 }, toggle);
      buat("path", { d: item.open ? "M-3.5 0H3.5" : "M-3.5 0H3.5M0 -3.5V3.5" }, toggle);
      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        ubahBukaNode(item.id);
      });
    }

    group.addEventListener("click", () => {
      treeFokus = item.id;
      pilihNode(selectedNode === item.id ? null : item.id);
    });
    group.addEventListener("keydown", (event) => {
      const index = posisiFokus.get(item.id);
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        treeFokus = item.id;
        pilihNode(selectedNode === item.id ? null : item.id);
      } else if (event.key === "ArrowRight" && item.punyaAnak && !item.open) {
        event.preventDefault();
        ubahBukaNode(item.id);
      } else if (event.key === "ArrowLeft" && item.open) {
        event.preventDefault();
        ubahBukaNode(item.id);
      } else if (event.key === "ArrowDown" && urut[index + 1]) {
        event.preventDefault();
        fokusNode(urut[index + 1].id);
      } else if (event.key === "ArrowUp" && urut[index - 1]) {
        event.preventDefault();
        fokusNode(urut[index - 1].id);
      }
    });
  }

  const lebar = Math.ceil(xKolom[xKolom.length - 1] + lebarKolom[lebarKolom.length - 1] + 28);
  const tinggi = Math.ceil(baris.length * TREE_BARIS + TREE_TEPI * 2);
  svg.setAttribute("width", lebar);
  svg.setAttribute("height", tinggi);
  svg.setAttribute("viewBox", `0 0 ${lebar} ${tinggi}`);
  treeTerpilihTergambar = selectedNode;
}

function fokusNode(id) {
  treeFokus = id;
  const svg = byId("treeSvg");
  svg.querySelectorAll(".tnode").forEach((group) => {
    const cocok = Number(group.dataset.id) === id;
    group.setAttribute("tabindex", cocok ? "0" : "-1");
    if (cocok) group.focus({ preventScroll: true });
  });
}

function ubahBukaNode(id) {
  if (treeTerbuka.has(id)) treeTerbuka.delete(id);
  else treeTerbuka.add(id);
  treeFokus = id;
  gambarTree();
  fokusNode(id);
}

function pilihNode(id) {
  selectedNode = id;
  gambarTree();
  isiInfoTree();
  if (treeFokus !== null) fokusNode(treeFokus);
}

function gambarTreeBilaBerubah() {
  if (selectedNode !== treeTerpilihTergambar) gambarTree();
}

let infoTreeTergambar = undefined;

function isiInfoTree() {
  const box = byId("treeInfo");
  if (infoTreeTergambar === selectedNode) return;
  infoTreeTergambar = selectedNode;
  box.replaceChildren();

  if (selectedNode === null) {
    box.append(el("h3", "", "Pilih satu node"));
    box.append(el("p", "", "Subtree-nya menyala oranye di canvas dan di diagram, yaitu semua objek yang ikut bergerak bila node itu ditransformasi."));
    return;
  }

  const node = figure[selectedNode];
  box.append(el("h3", "", node.name));
  if (node.info.note) box.append(el("p", "", node.info.note));

  const path = [];
  for (let current = selectedNode; current !== null; current = figure[current].parent) {
    path.unshift(figure[current].name);
  }
  box.append(el("p", "tree-path", path.join(" / ")));

  const parent = node.parent === null ? null : figure[node.parent].name;
  box.append(el(
    "p",
    "tree-formula",
    parent
      ? `World(${node.name}) = World(${parent}) × Local(${node.name})`
      : `World(${node.name}) = Local(${node.name})`
  ));

  const facts = el("dl", "tree-facts");
  const tambah = (label, value, id) => {
    const dd = el("dd", "", value);
    if (id) dd.id = id;
    facts.append(el("dt", "", label), dd);
  };
  tambah("child", node.child == null ? "tidak ada" : figure[node.child].name);
  tambah("sibling", node.sibling == null ? "tidak ada" : figure[node.sibling].name);
  tambah("Turunan", `${jumlahTurunan(selectedNode)} node`);
  tambah("Local", typeof node.local === "function" ? "Dihitung ulang dari theta" : "Matrix tetap");
  tambah("Posisi world", "-", "treeWorld");
  box.append(facts);

  const lihat = el("button", "btn", "Arahkan kamera ke node ini");
  lihat.type = "button";
  lihat.addEventListener("click", () => arahkanKameraKeNode(selectedNode));
  const hapus = el("button", "btn", "Hapus sorotan");
  hapus.type = "button";
  hapus.addEventListener("click", () => pilihNode(null));
  box.append(lihat, hapus);

  isiPosisiTree();
}

function isiPosisiTree() {
  const output = byId("treeWorld");
  if (!output || selectedNode === null) return;
  const world = figure[selectedNode].world;
  output.textContent = `${angka(world[12], 1)}; ${angka(world[13], 1)}; ${angka(world[14], 1)}`;
}

// Node pada iCAR memakai kamera yang mengikuti mobil; node lain dilihat dari dekat
function arahkanKameraKeNode(id) {
  if (id === icar.root || indukDari(id, icar.root)) {
    setCameraPreset("ikuti");
  } else {
    const world = figure[id].world;
    const target = [world[12], world[13] + 1, world[14]];
    setCameraPreset("atas");
    camera.current.target = target;
    camera.current.position = [target[0] + 7, target[1] + 4, target[2] + 9];
  }
  syncControls();
}

function pasangTombolTree() {
  byId("treeOpenAll").addEventListener("click", () => {
    figure.forEach((node) => {
      if (!node.info.hidden && anakTerlihat(node.id).length > 0) treeTerbuka.add(node.id);
    });
    gambarTree();
  });
  byId("treeSummary").addEventListener("click", () => {
    bukaTreeRingkas();
    gambarTree();
  });
}

// ─── Inisialisasi ─────────────────────────────────────────────────────────────

// Bagian yang tidak butuh scene langsung tampil, jadi foto terlihat saat texture dibangun
function siapkanHalaman() {
  isiDataKelompok();
  isiMateri();
  pasangVideo();
  bangunGaleri();
  pasangCanvasMengambang();
}

// Dipanggil main.js setelah scene dibuat, sebelum frame pertama
function initUI() {
  window.sceneStarted = true;
  sceneSiap = true;

  ambilElemenHud();
  bangunKontrolKamera();
  bangunKontrolCahaya();
  bangunKontrolTexture();
  bangunKontrolAnimasi();

  bukaTreeRingkas();
  pasangTombolTree();
  gambarTree();
  syncControls();

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(gambarTree);

  const stopDuration = byId("stopDuration");
  if (stopDuration) stopDuration.textContent = STOP_DURATION;
  byId("stageStatus").hidden = true;
}

siapkanHalaman();
