// icar.js — Model iCAR (objek utama)
// Ukuran dibaca dari foto depan dan samping: tinggi atap ±1,85 m, lebar ±1,42 m,
// panjang ±3 m, jarak sumbu roda ±1,6 m (basis golf cart), overhang depan ±0,9 m.
// Arah maju mobil = +Z lokal, kiri mobil = +X lokal.

"use strict";

// ─── Parameter Badan ──────────────────────────────────────────────────────────

const CAR = (() => {
  const hw = 0.71;
  const hl = 1.5;
  const rF = 0.28;
  const rR = 0.24;
  const a1 = hw - rF;
  const a2 = a1 + (rF * Math.PI) / 2;
  const a3 = a2 + (2 * hl - rF - rR);
  const a4 = a3 + (rR * Math.PI) / 2;
  const a5 = a4 + (hw - rR);
  return {
    hw, hl, rF, rR, a1, a2, a3, a4, a5,
    perimeter: a5 * 2,
    axleFront: 0.57,
    axleRear: -1.03,
    trackHalf: 0.615,
    wheelRadius: 0.27,
    archRadius: 0.335,
    archY: 0.29,
    thickness: 0.05,
    texY0: 0.1,
    texY1: 1.95,
    stripeHeight: 0.76,
    stripeEndHeight: 0.6,
    stripeRear: 3.57,
    get stripeFront() { return this.sideS(0.95); },
    get stripeCurveStart() { return this.sideS(0.3); },
    // Koordinat keliling (sf) untuk titik di sisi mobil pada posisi z tertentu
    sideS(z) { return a2 + (hl - rF - z); },
  };
})();

// Profil badan dari bawah ke atap: [tinggi y, seberapa masuk dari outline]
const BODY_PROFILE = [
  [0.16, 0.07], [0.19, 0.02], [0.28, 0.0], [0.55, 0.0], [0.8, 0.015], [1.03, 0.035],
  [1.3, 0.06], [1.6, 0.085], [1.69, 0.055], [1.75, 0.065], [1.8, 0.12],
  [1.845, 0.28], [1.865, 0.52], [1.87, 0.71],
];
const PROFILE_MAX = BODY_PROFILE.length - 1;

// Lubang jendela dalam koordinat (sf, y). cs = pusat sepanjang keliling, hs = setengah lebar.
const CAR_WINDOWS = [
  { cs: 0, hs: 0.72, y0: 1.04, y1: 1.665, rt: 0.1, rb: 0.03 },
  { cs: (0.82 + CAR.sideS(0.67)) / 2, hs: (CAR.sideS(0.67) - 0.82) / 2, y0: 1.04, y1: 1.63, rt: 0.17, rb: 0.07 },
  { cs: (CAR.sideS(0.47) + CAR.sideS(-1.03)) / 2, hs: (CAR.sideS(-1.03) - CAR.sideS(0.47)) / 2, y0: 1.04, y1: 1.63, rt: 0.17, rb: 0.07 },
  { cs: CAR.a5, hs: 0.52, y0: 1.04, y1: 1.58, rt: 0.12, rb: 0.04 },
];

const CAR_ARCHES = [CAR.sideS(CAR.axleFront), CAR.sideS(CAR.axleRear)];

// ─── Permukaan Parametrik ─────────────────────────────────────────────────────

// Interpolasi Catmull-Rom supaya profil badan mulus. w = indeks pecahan pada profil.
function profileAt(w) {
  const v = clamp(w, 0, PROFILE_MAX);
  const i = Math.min(Math.floor(v), PROFILE_MAX - 1);
  const t = v - i;
  const p0 = BODY_PROFILE[Math.max(i - 1, 0)];
  const p1 = BODY_PROFILE[i];
  const p2 = BODY_PROFILE[i + 1];
  const p3 = BODY_PROFILE[Math.min(i + 2, PROFILE_MAX)];
  const curve = (a, b, c, d) =>
    0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  return [curve(p0[0], p1[0], p2[0], p3[0]), curve(p0[1], p1[1], p2[1], p3[1])];
}

// Kebalikan profileAt: mencari w dari tinggi y (y selalu naik sepanjang profil)
function profileW(y) {
  let low = 0;
  let high = PROFILE_MAX;
  for (let i = 0; i < 26; i += 1) {
    const mid = (low + high) / 2;
    if (profileAt(mid)[0] < y) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

// Outline denah (rounded rectangle) yang dimasukkan sejauh d. sf dihitung dari
// tengah depan menyusuri sisi kiri sampai tengah belakang.
function outlineAt(sf, d) {
  const hwD = Math.max(CAR.hw - d, 0);
  const hlD = CAR.hl - d;
  const rFd = Math.max(CAR.rF - d, 0.001);
  const rRd = Math.max(CAR.rR - d, 0.001);
  const cxF = Math.max(hwD - rFd, 0);
  const czF = hlD - rFd;
  const cxR = Math.max(hwD - rRd, 0);
  const czR = -(hlD - rRd);

  if (sf <= CAR.a1) {
    return { x: (sf / CAR.a1) * cxF, z: hlD, nx: 0, nz: 1 };
  }
  if (sf <= CAR.a2) {
    const angle = ((sf - CAR.a1) / (CAR.a2 - CAR.a1)) * Math.PI * 0.5;
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    return { x: cxF + rFd * s, z: czF + rFd * c, nx: s, nz: c };
  }
  if (sf <= CAR.a3) {
    const t = (sf - CAR.a2) / (CAR.a3 - CAR.a2);
    return { x: hwD, z: lerp(czF, czR, t), nx: 1, nz: 0 };
  }
  if (sf <= CAR.a4) {
    const angle = ((sf - CAR.a3) / (CAR.a4 - CAR.a3)) * Math.PI * 0.5;
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    return { x: cxR + rRd * c, z: czR - rRd * s, nx: c, nz: -s };
  }
  const t = (sf - CAR.a4) / (CAR.a5 - CAR.a4);
  return { x: cxR * (1 - t), z: -hlD, nx: 0, nz: -1 };
}

function wrapS(s) {
  return ((s % CAR.perimeter) + CAR.perimeter) % CAR.perimeter;
}

function foldS(s) {
  return s > CAR.a5 ? CAR.perimeter - s : s;
}

// Titik permukaan badan pada (s, w). inner > 0 = cangkang bagian dalam.
function bodyPoint(s, w, inner = 0) {
  const sw = wrapS(s);
  const mirror = sw > CAR.a5;
  const sf = mirror ? CAR.perimeter - sw : sw;

  const profile = profileAt(w);
  let y = profile[0];
  const d = profile[1] + inner;
  if (inner > 0) y -= inner * smoothstep(1.66, 1.8, y);

  const outline = outlineAt(sf, d);

  // Spakbor menggembung di sekitar lengkung roda
  let bulge = 0;
  for (const center of CAR_ARCHES) {
    const distance = Math.hypot(sf - center, y - CAR.archY);
    bulge += 0.032 * (1 - smoothstep(CAR.archRadius - 0.02, CAR.archRadius + 0.24, distance));
  }

  let x = outline.x + outline.nx * bulge;
  let z = outline.z + outline.nz * bulge;

  // Atap melengkung turun ke arah ujung depan dan belakang
  const ratio = z / CAR.hl;
  y -= smoothstep(1.0, 1.75, y) * (z > 0 ? 0.05 : 0.09) * ratio * ratio;

  // Alis atap maju sedikit di atas kaca depan
  z += 0.06 * smoothstep(1.56, 1.7, y) * Math.max(outline.nz, 0);

  return [mirror ? -x : x, y, z];
}

function bodyNormal(s, w, inner = 0) {
  const a = bodyPoint(s - 0.004, w, inner);
  const b = bodyPoint(s + 0.004, w, inner);
  const c = bodyPoint(s, Math.max(w - 0.02, 0), inner);
  const d = bodyPoint(s, Math.min(w + 0.02, PROFILE_MAX), inner);
  const n = Vec3.normalize(Vec3.cross(Vec3.subtract(b, a), Vec3.subtract(d, c)));
  return Vec3.length(n) > 0.5 ? n : [0, 1, 0];
}

// Rentang y lubang jendela pada kolom sf (rounded rectangle), null jika tidak kena
function windowSpan(sf) {
  for (let i = 0; i < CAR_WINDOWS.length; i += 1) {
    const hole = CAR_WINDOWS[i];
    const t = Math.abs(sf - hole.cs);
    if (t >= hole.hs) continue;
    let top = hole.y1;
    let bottom = hole.y0;
    if (t > hole.hs - hole.rt) {
      const k = t - (hole.hs - hole.rt);
      top = hole.y1 - hole.rt + Math.sqrt(Math.max(hole.rt * hole.rt - k * k, 0));
    }
    if (t > hole.hs - hole.rb) {
      const k = t - (hole.hs - hole.rb);
      bottom = hole.y0 + hole.rb - Math.sqrt(Math.max(hole.rb * hole.rb - k * k, 0));
    }
    return { bottom, top, index: i };
  }
  return null;
}

function archTop(sf) {
  for (const center of CAR_ARCHES) {
    const t = Math.abs(sf - center);
    if (t < CAR.archRadius) {
      return CAR.archY + Math.sqrt(CAR.archRadius * CAR.archRadius - t * t);
    }
  }
  return BODY_PROFILE[0][0];
}

// ─── Membangun Cangkang Badan ─────────────────────────────────────────────────

// Permukaan dibuat kolom demi kolom sepanjang keliling. Setiap kolom punya dua
// strip: bawah (lengkung roda → bawah jendela) dan atas (atas jendela → puncak atap).
// Dengan begitu tepi jendela dan lengkung roda mengikuti kurva dengan tepat.
function buildBodyShell() {
  const outer = createMeshData();
  const inner = createMeshData();
  const MID_Y = 1.3;
  const ROWS_LOWER = 10;
  const ROWS_UPPER = 22;

  const sfList = new Set();
  for (let sf = 0; sf <= CAR.a5; sf += 0.04) sfList.add(sf);
  sfList.add(CAR.a5);

  const addFeature = (sf) => {
    if (sf >= 0 && sf <= CAR.a5) sfList.add(sf);
  };
  for (const hole of CAR_WINDOWS) {
    for (const side of [-1, 1]) {
      addFeature(hole.cs + side * (hole.hs - 1e-4));
      addFeature(hole.cs + side * (hole.hs + 1e-4));
      for (let k = 0; k <= 12; k += 1) {
        const angle = (k / 12) * Math.PI * 0.5;
        addFeature(hole.cs + side * (hole.hs - hole.rt + hole.rt * Math.sin(angle)));
        addFeature(hole.cs + side * (hole.hs - hole.rb + hole.rb * Math.sin(angle)));
      }
    }
  }
  for (const center of CAR_ARCHES) {
    for (const side of [-1, 1]) {
      addFeature(center + side * (CAR.archRadius - 1e-4));
      addFeature(center + side * (CAR.archRadius + 1e-4));
      for (let k = 0; k <= 18; k += 1) {
        addFeature(center + side * CAR.archRadius * Math.sin((k / 18) * Math.PI * 0.5));
      }
    }
  }

  const values = [];
  sfList.forEach((sf) => {
    values.push(sf);
    if (sf > 1e-6 && sf < CAR.a5 - 1e-6) values.push(CAR.perimeter - sf);
  });
  values.push(CAR.perimeter);
  values.sort((a, b) => a - b);

  const vertexAt = (s, w, inset) => {
    const p = bodyPoint(s, w, inset);
    const n = bodyNormal(s, w, inset);
    return {
      p,
      n: inset > 0 ? Vec3.scale(n, -1) : n,
      uv: [s / CAR.perimeter, (p[1] - CAR.texY0) / (CAR.texY1 - CAR.texY0)],
    };
  };

  const strip = (s, w0, w1, rows, inset) => {
    const list = [];
    for (let r = 0; r <= rows; r += 1) list.push(vertexAt(s, lerp(w0, w1, r / rows), inset));
    return list;
  };

  const columns = values.map((s) => {
    const sf = foldS(s);
    const span = windowSpan(sf);
    const wStart = profileW(archTop(sf));
    const wBelow = profileW(span ? span.bottom : MID_Y);
    const wAbove = profileW(span ? span.top : MID_Y);
    return {
      s,
      holeIndex: span ? span.index : -1,
      lower: strip(s, wStart, wBelow, ROWS_LOWER, 0),
      upper: strip(s, wAbove, PROFILE_MAX, ROWS_UPPER, 0),
      lowerIn: strip(s, wStart, wBelow, ROWS_LOWER, CAR.thickness),
      upperIn: strip(s, wAbove, PROFILE_MAX, ROWS_UPPER, CAR.thickness),
    };
  });

  const emitStrip = (mesh, a, b) => {
    for (let r = 0; r < a.length - 1; r += 1) {
      pushQuad(mesh, a[r].p, b[r].p, b[r + 1].p, a[r + 1].p, a[r].n, b[r].n, b[r + 1].n, a[r + 1].n, a[r].uv, b[r].uv, b[r + 1].uv, a[r + 1].uv);
    }
  };

  // Tepi tebal yang menghubungkan cangkang luar dan dalam; normal menghadap referensi
  const emitRim = (a, aIn, bIn, b, reference) => {
    let n = Vec3.normalize(Vec3.cross(Vec3.subtract(b.p, a.p), Vec3.subtract(aIn.p, a.p)));
    if (Vec3.length(n) < 0.5) return;
    const mid = Vec3.scale(Vec3.add(a.p, b.p), 0.5);
    if (Vec3.dot(n, Vec3.subtract(reference, mid)) < 0) n = Vec3.scale(n, -1);
    pushQuad(outer, a.p, aIn.p, bIn.p, b.p, n, n, n, n, a.uv, a.uv, b.uv, b.uv);
  };

  const holeCenters = CAR_WINDOWS.map((hole) => bodyPoint(hole.cs, profileW((hole.y0 + hole.y1) / 2)));

  for (let i = 0; i < columns.length - 1; i += 1) {
    const A = columns[i];
    const B = columns[i + 1];
    if (B.s - A.s < 1e-6) continue;

    emitStrip(outer, A.lower, B.lower);
    emitStrip(outer, A.upper, B.upper);
    emitStrip(inner, A.lowerIn, B.lowerIn);
    emitStrip(inner, A.upperIn, B.upperIn);

    const holeIndex = A.holeIndex >= 0 ? A.holeIndex : B.holeIndex;
    if (holeIndex >= 0) {
      const center = holeCenters[holeIndex];
      emitRim(A.lower[ROWS_LOWER], A.lowerIn[ROWS_LOWER], B.lowerIn[ROWS_LOWER], B.lower[ROWS_LOWER], center);
      emitRim(A.upper[0], A.upperIn[0], B.upperIn[0], B.upper[0], center);
    }

    // Tepi bawah badan dan tepi lengkung roda
    const mid = Vec3.scale(Vec3.add(A.lower[0].p, B.lower[0].p), 0.5);
    emitRim(A.lower[0], A.lowerIn[0], B.lowerIn[0], B.lower[0], [mid[0], mid[1] - 1, mid[2]]);
  }
  return { outer, inner };
}

// Bantalan menempel di badan (grille hitam, dua bar putih). Pinggirnya turun ke
// permukaan badan sehingga terlihat timbul.
function bodyPadData(cs, halfWidth, yCenter, halfHeight, radius, height, bevel) {
  const mesh = createMeshData();
  const COLUMNS = 30;
  const ROWS = 12;

  const edgeDistance = (x, y) => {
    const qx = Math.abs(x) - (halfWidth - radius);
    const qy = Math.abs(y - yCenter) - (halfHeight - radius);
    return -(Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius);
  };

  const surface = (x, y) => {
    const s = cs + x;
    const w = profileW(y);
    const raise = 0.0015 + height * smoothstep(0, bevel, edgeDistance(x, y));
    return Vec3.add(bodyPoint(s, w), Vec3.scale(bodyNormal(s, w), raise));
  };

  const vertex = (x, t) => {
    const k = Math.max(Math.abs(x) - (halfWidth - radius), 0);
    const extent = halfHeight - radius + Math.sqrt(Math.max(radius * radius - k * k, 0));
    const y = yCenter + extent * t;
    const p = surface(x, y);
    const e = 0.004;
    let n = Vec3.normalize(Vec3.cross(
      Vec3.subtract(surface(x + e, y), surface(x - e, y)),
      Vec3.subtract(surface(x, y + e), surface(x, y - e))
    ));
    const reference = bodyNormal(cs + x, profileW(y));
    if (Vec3.dot(n, reference) < 0) n = Vec3.scale(n, -1);
    return { p, n, uv: [0.5, 0.5] };
  };

  // Jarak kolom dan baris dirapatkan di tepi supaya bevel terbentuk halus
  const stops = (count) => {
    const list = [];
    for (let i = 0; i <= count; i += 1) list.push(-Math.cos((i / count) * Math.PI));
    return list;
  };
  const xs = stops(COLUMNS).map((v) => v * (halfWidth - 1e-3));
  const ts = stops(ROWS);

  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ts.length - 1; j += 1) {
      const a = vertex(xs[i], ts[j]);
      const b = vertex(xs[i + 1], ts[j]);
      const c = vertex(xs[i + 1], ts[j + 1]);
      const d = vertex(xs[i], ts[j + 1]);
      pushQuad(mesh, a.p, b.p, c.p, d.p, a.n, b.n, c.n, d.n, a.uv, b.uv, c.uv, d.uv);
    }
  }
  return mesh;
}

// Bidang datar mengikuti denah badan (lantai, dashboard), dipotong pada zMin..zMax.
// Karena mengikuti outline yang sama, sudutnya tidak menembus badan.
function bodyDeckData(y, inset, zMin = -9, zMax = 9) {
  const mesh = createMeshData();
  const points = [];
  const STEPS = 72;
  for (let i = 0; i < STEPS; i += 1) {
    const s = (i / STEPS) * CAR.perimeter;
    const outline = outlineAt(foldS(s), inset);
    points.push([s > CAR.a5 ? -outline.x : outline.x, clamp(outline.z, zMin, zMax)]);
  }
  const centerZ = (Math.max(zMin, -CAR.hl) + Math.min(zMax, CAR.hl)) / 2;
  const n = [0, 1, 0];
  for (let i = 0; i < STEPS; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % STEPS];
    pushVertex(mesh, [0, y, centerZ], n, [0.5, 0.5]);
    pushVertex(mesh, [a[0], y, a[1]], n, [0.5, 0.5]);
    pushVertex(mesh, [b[0], y, b[1]], n, [0.5, 0.5]);
  }
  return mesh;
}

// Matrix penempatan benda di permukaan badan: +Z lokal mengikuti normal badan
function placeOnBody(s, y, offset = 0) {
  const w = profileW(y);
  const p = bodyPoint(s, w);
  const n = bodyNormal(s, w);
  return Mat4.chain(
    Mat4.translation(p[0] + n[0] * offset, p[1] + n[1] * offset, p[2] + n[2] * offset),
    Mat4.rotationY(Math.atan2(n[0], n[2]))
  );
}

// ─── Mesh dan Material iCAR ───────────────────────────────────────────────────

const CAR_MESH = {};
const CAR_MAT = {};

function loadIcarAssets() {
  TEX.icarBody = createTexture(icarBodyTexture(CAR));

  const shell = buildBodyShell();
  CAR_MESH.shellOuter = uploadMesh(shell.outer);
  CAR_MESH.shellInner = uploadMesh(shell.inner);

  CAR_MESH.grille = uploadMesh(bodyPadData(0, 0.505, 0.64, 0.168, 0.085, 0.006, 0.012));
  CAR_MESH.barTop = uploadMesh(bodyPadData(0, 0.24, 0.688, 0.037, 0.034, 0.03, 0.022));
  CAR_MESH.barBottom = uploadMesh(bodyPadData(0, 0.2, 0.57, 0.034, 0.032, 0.03, 0.022));
  CAR_MESH.cabinFloor = uploadMesh(bodyDeckData(0.42, 0.06));
  CAR_MESH.underTray = uploadMesh(bodyDeckData(0.2, 0.09));
  CAR_MESH.dashboard = uploadMesh(bodyDeckData(1.065, 0.095, 1.02));

  // Lengkung spakbor mengikuti permukaan badan di sisi kiri dan kanan
  const archLip = createMeshData();
  for (const center of CAR_ARCHES) {
    for (const mirror of [false, true]) {
      const path = [];
      for (let k = 0; k <= 34; k += 1) {
        const angle = lerp(-0.12, Math.PI + 0.12, k / 34);
        const sf = center + (CAR.archRadius + 0.01) * Math.cos(angle);
        const y = Math.max(CAR.archY + (CAR.archRadius + 0.01) * Math.sin(angle), 0.17);
        const s = mirror ? CAR.perimeter - sf : sf;
        const w = profileW(y);
        path.push(Vec3.add(bodyPoint(s, w), Vec3.scale(bodyNormal(s, w), 0.008)));
      }
      mergeMeshData(archLip, tubeData(path, 0.021, 8, { capEnd: false }));
    }
  }
  CAR_MESH.archLip = uploadMesh(archLip);

  const unitBox = boxData();
  CAR_MESH.box = uploadMesh(unitBox);
  CAR_MESH.roundBox = uploadMesh(roundedBoxData(1, 1, 1, 0.08, 3));
  CAR_MESH.softBox = uploadMesh(roundedBoxData(1, 1, 1, 0.22, 4));
  CAR_MESH.sphere = uploadMesh(sphereData(1, 14, 22));
  CAR_MESH.cylinder = uploadMesh(cylinderData(1, 1, 1, 16));

  // Roda: sumbu lathe Y diputar menjadi sumbu X (rotationZ -90°)
  const axleToX = Mat4.rotationZ(-Math.PI / 2);
  const tire = latheData(
    [[0.175, -0.08], [0.175, -0.08], [0.245, -0.08], [0.265, -0.062], [0.27, -0.03], [0.27, 0.03], [0.265, 0.062], [0.245, 0.08], [0.19, 0.08], [0.175, 0.07]],
    32
  );
  CAR_MESH.tire = uploadMesh(transformMeshData(tire, axleToX));

  const rim = latheData(
    [[0.19, 0.078], [0.178, 0.058], [0.15, 0.044], [0.07, 0.05], [0.03, 0.06], [0, 0.062]],
    32,
    { planarUV: true }
  );
  CAR_MESH.rim = uploadMesh(transformMeshData(rim, axleToX));

  const rimBack = cylinderData(0.178, 0.178, 0.1, 24);
  CAR_MESH.rimBack = uploadMesh(transformMeshData(rimBack, Mat4.chain(axleToX, Mat4.translation(0, -0.06, 0))));

  // Lampu depan: +Z lokal menghadap keluar
  const faceZ = Mat4.rotationX(Math.PI / 2);
  CAR_MESH.bezel = uploadMesh(transformMeshData(
    latheData([[0.05, 0.001], [0.075, 0.018], [0.086, 0.012], [0.09, 0.0]].reverse(), 28),
    faceZ
  ));
  CAR_MESH.lens = uploadMesh(transformMeshData(latheData([[0.07, 0.014], [0.04, 0.02], [0, 0.022]], 28, { planarUV: true }), faceZ));
  CAR_MESH.marker = uploadMesh(transformMeshData(latheData([[0.033, 0], [0.03, 0.01], [0.018, 0.018], [0, 0.021]], 18), faceZ));
  CAR_MESH.markerRing = uploadMesh(transformMeshData(latheData([[0.038, 0], [0.038, 0.006], [0.031, 0.008]], 18), faceZ));

  // Setir
  CAR_MESH.wheelRing = uploadMesh(torusData(0.17, 0.016, 10, 30));

  // Kubah GPS bentuk jamur
  CAR_MESH.gpsDome = uploadMesh(latheData(
    [[0.012, -0.05], [0.015, 0], [0.06, 0.045], [0.088, 0.055], [0.088, 0.062], [0.05, 0.07], [0, 0.072]],
    24
  ));

  // Fiberglass putih: diffuse diturunkan agar lekuk badan tidak hilang jenuh putih
  // di bawah sinar matahari, seperti pencahayaan lembut pada foto.
  const white = [0.9, 0.92, 0.94];
  CAR_MAT.body = createMaterial({ texture: TEX.icarBody, color: [0.96, 0.98, 1.0], diffuse: 0.42, specular: 0.14, shininess: 40 });
  CAR_MAT.bodyPlain = createMaterial({ color: white, diffuse: 0.42, specular: 0.14, shininess: 40 });
  CAR_MAT.interior = createMaterial({ color: [0.42, 0.43, 0.45], specular: 0.03, shininess: 10 });
  CAR_MAT.glossBlack = createMaterial({ color: [0.045, 0.045, 0.05], specular: 0.6, shininess: 70 });
  CAR_MAT.matteBlack = createMaterial({ color: [0.07, 0.07, 0.08], specular: 0.12, shininess: 20 });
  CAR_MAT.barWhite = createMaterial({ color: [1.04, 1.05, 1.05], diffuse: 0.45, specular: 0.3, shininess: 50 });
  CAR_MAT.rubber = createMaterial({ color: [0.05, 0.05, 0.055], specular: 0.07, shininess: 14 });
  CAR_MAT.rim = createMaterial({ texture: TEX.rim, specular: 0.55, shininess: 60 });
  CAR_MAT.chrome = createMaterial({ color: [0.75, 0.77, 0.79], specular: 0.85, shininess: 90 });
  CAR_MAT.headlamp = createMaterial({ texture: TEX.headlamp, specular: 0.7, shininess: 90, emissive: [0.25, 0.25, 0.25] });
  CAR_MAT.indicatorLeft = createMaterial({ color: [0.86, 0.55, 0.12], specular: 0.6, shininess: 60 });
  CAR_MAT.indicatorRight = createMaterial({ color: [0.86, 0.55, 0.12], specular: 0.6, shininess: 60 });
  CAR_MAT.brake = createMaterial({ color: [0.55, 0.05, 0.04], specular: 0.6, shininess: 60 });
  CAR_MAT.orange = createMaterial({ color: [0.9, 0.42, 0.14], specular: 0.5, shininess: 50 });
  CAR_MAT.seat = createMaterial({ color: [0.11, 0.115, 0.125], specular: 0.1, shininess: 18 });
  CAR_MAT.floor = createMaterial({ color: [0.16, 0.16, 0.17], specular: 0.04, shininess: 10 });
  CAR_MAT.steering = createMaterial({ color: [0.04, 0.05, 0.07], specular: 0.35, shininess: 40 });
  CAR_MAT.steeringBlue = createMaterial({ color: [0.07, 0.18, 0.48], specular: 0.4, shininess: 40 });
  CAR_MAT.sensorBody = createMaterial({ color: [0.86, 0.87, 0.88], diffuse: 0.5, specular: 0.4, shininess: 50 });
  CAR_MAT.lensGlass = createMaterial({ color: [0.03, 0.04, 0.06], specular: 0.9, shininess: 120 });
  CAR_MAT.skin = createMaterial({ color: [0.67, 0.47, 0.34], specular: 0.12, shininess: 16 });
  CAR_MAT.hair = createMaterial({ color: [0.04, 0.03, 0.03], specular: 0.1, shininess: 20 });
  CAR_MAT.shirt = createMaterial({ color: [0.075, 0.08, 0.09], specular: 0.05, shininess: 10 });
  CAR_MAT.trousers = createMaterial({ color: [0.12, 0.13, 0.17], specular: 0.05, shininess: 10 });
}

// ─── Hierarki iCAR ────────────────────────────────────────────────────────────

const icar = { joints: [] };

// Nilai sendi awal. Sudut lengan dan kaki memakai konvensi figure.js: bagian tumbuh
// ke +Y lokal, lalu rotationX(theta) mengarahkannya.
Object.assign(theta, {
  steer: 0,
  wheelSpin: 0,
  steeringWheel: 0,
  sensorYaw: 0,
  cameraPitch: -6,
  chassisPitch: 0,
  chassisRoll: 0,
  chassisBounce: 0,
  headYaw: 0,
  headPitch: 0,
  armUpperLeft: 115,
  armLowerLeft: -12,
  armUpperRight: 115,
  armLowerRight: -12,
  legUpper: 88,
  legLower: 88,
});

function partT(x, y, z) {
  return Mat4.translation(x, y, z);
}

function partTS(x, y, z, sx, sy, sz) {
  return Mat4.multiply(Mat4.translation(x, y, z), Mat4.scaling(sx, sy, sz));
}

function createIcar(parentId) {
  const box = () => CAR_MESH.box;

  icar.root = addNode("iCAR", parentId, () => Mat4.chain(
    Mat4.translation(icar.x || 0, 0, icar.z || 0),
    Mat4.rotationY(icar.yaw || 0)
  ), null, { note: "Posisi dan arah mengikuti rute" });

  // Sasis mengayun di atas suspensi; roda sengaja bukan child sasis
  icar.chassis = addNode("Sasis", icar.root, () => Mat4.chain(
    Mat4.translation(0, theta.chassisBounce, 0),
    Mat4.rotationX(degToRad(theta.chassisPitch)),
    Mat4.rotationZ(degToRad(theta.chassisRoll))
  ), null, { note: "Ayunan suspensi" });

  addNode("Badan", icar.chassis, Mat4.identity(), () => {
    drawPart(CAR_MESH.shellOuter, CAR_MAT.body);
    drawPart(CAR_MESH.shellInner, CAR_MAT.interior);
    drawPart(CAR_MESH.archLip, CAR_MAT.bodyPlain);
    drawPart(CAR_MESH.underTray, CAR_MAT.matteBlack);
    drawPart(box(), CAR_MAT.matteBlack, partTS(0, 0.24, CAR.axleFront, 1.1, 0.05, 0.07));
    drawPart(box(), CAR_MAT.matteBlack, partTS(0, 0.24, CAR.axleRear, 1.1, 0.05, 0.07));

    // Bak roda hitam: atap, dinding dalam, dinding depan-belakang. Sisi luar terbuka.
    for (const axle of [CAR.axleFront, CAR.axleRear]) {
      for (const side of [-1, 1]) {
        drawPart(box(), CAR_MAT.matteBlack, partTS(side * 0.5, 0.665, axle, 0.26, 0.02, 0.7));
        drawPart(box(), CAR_MAT.matteBlack, partTS(side * 0.37, 0.42, axle, 0.02, 0.5, 0.7));
        drawPart(box(), CAR_MAT.matteBlack, partTS(side * 0.5, 0.42, axle + 0.345, 0.26, 0.5, 0.02));
        drawPart(box(), CAR_MAT.matteBlack, partTS(side * 0.5, 0.42, axle - 0.345, 0.26, 0.5, 0.02));
      }
    }
  }, { note: "Cangkang parametrik dengan lubang jendela" });

  addNode("Interior", icar.chassis, Mat4.identity(), () => {
    // Lantai kabin dan dashboard hitam yang tampak sedikit di atas sabuk badan
    drawPart(CAR_MESH.cabinFloor, CAR_MAT.floor);
    drawPart(CAR_MESH.dashboard, CAR_MAT.matteBlack);
    drawPart(box(), CAR_MAT.matteBlack, partTS(0, 0.74, 1.02, 1.1, 0.65, 0.02));

    // Sandaran rendah di bawah garis jendela, sehingga kabin tampak tembus seperti foto
    for (const [z, width] of [[0.34, 0.62], [-0.32, 1.12], [-0.96, 1.12]]) {
      drawPart(CAR_MESH.roundBox, CAR_MAT.seat, partTS(0, 0.72, z, width, 0.12, 0.46));
      drawPart(CAR_MESH.roundBox, CAR_MAT.seat, partTS(0, 0.86, z - 0.19, width, 0.28, 0.09));
      drawPart(box(), CAR_MAT.floor, partTS(0, 0.56, z, width * 0.8, 0.28, 0.34));
    }

    // Sisi dalam pilar tengah dan belakang dilapisi panel hitam tipis yang miring
    // mengikuti dinding. Dari luar tertutup pilar putih; yang tampak adalah panel sisi
    // seberang, terlihat lewat jendela.
    for (const side of [-1, 1]) {
      for (const [z, width] of [[0.57, 0.2], [-1.11, 0.16]]) {
        drawPart(box(), CAR_MAT.matteBlack, Mat4.chain(
          Mat4.translation(side * 0.589, 1.33, z),
          Mat4.rotationZ(side * 0.089),
          Mat4.scaling(0.012, 0.64, width)
        ));
      }
    }

    // Modul hitam di bawah alis atap
    drawPart(CAR_MESH.roundBox, CAR_MAT.matteBlack, partTS(0, 1.585, 1.34, 0.25, 0.11, 0.11));
    drawPart(box(), CAR_MAT.matteBlack, partTS(0, 1.665, 1.18, 0.3, 0.05, 0.22));
    drawPart(box(), CAR_MAT.chrome, partTS(0, 1.57, 1.4, 0.12, 0.05, 0.01));
    drawPart(CAR_MESH.roundBox, CAR_MAT.matteBlack, partTS(0, 1.63, -1.43, 0.17, 0.08, 0.08));
  }, { note: "Lantai, kursi, dashboard, pilar hitam" });

  // ── Muka depan ──
  icar.front = addNode("Muka Depan", icar.chassis, Mat4.identity(), () => {
    drawPart(CAR_MESH.grille, CAR_MAT.glossBlack);
    drawPart(CAR_MESH.barTop, CAR_MAT.barWhite);
    drawPart(CAR_MESH.barBottom, CAR_MAT.barWhite);
  }, { note: "Grille hitam dan dua bar putih" });

  const lamp = (name, s, material) =>
    addNode(name, icar.front, placeOnBody(s, 0.62, 0.006), () => {
      drawPart(CAR_MESH.bezel, CAR_MAT.chrome);
      drawPart(CAR_MESH.lens, material);
    }, { note: "Lampu sorot, cahayanya ikut posisi sasis" });

  icar.lampLeft = lamp("Lampu Depan Kiri", 0.385, CAR_MAT.headlamp);
  icar.lampRight = lamp("Lampu Depan Kanan", CAR.perimeter - 0.385, CAR_MAT.headlamp);

  const marker = (name, s, y, material) =>
    addNode(name, icar.chassis, placeOnBody(s, y, 0.001), () => {
      drawPart(CAR_MESH.markerRing, CAR_MAT.chrome);
      drawPart(CAR_MESH.marker, material);
    }, { note: "Lampu kecil di badan" });

  marker("Sein Depan Kiri", 0.595, 0.645, CAR_MAT.indicatorLeft);
  marker("Sein Depan Kanan", CAR.perimeter - 0.595, 0.645, CAR_MAT.indicatorRight);
  marker("Sein Belakang Kiri", CAR.a5 - 0.42, 0.72, CAR_MAT.indicatorLeft);
  marker("Sein Belakang Kanan", CAR.perimeter - CAR.a5 + 0.42, 0.72, CAR_MAT.indicatorRight);
  marker("Rem Kiri", CAR.a5 - 0.26, 0.72, CAR_MAT.brake);
  marker("Rem Kanan", CAR.perimeter - CAR.a5 + 0.26, 0.72, CAR_MAT.brake);
  marker("Lampu Sudut Kiri", CAR.sideS(-1.38), 0.9, CAR_MAT.matteBlack);
  marker("Lampu Sudut Kanan", CAR.perimeter - CAR.sideS(-1.38), 0.9, CAR_MAT.matteBlack);
  marker("Penanda Pilar Kiri", CAR.sideS(0.57), 1.5, CAR_MAT.orange);
  marker("Penanda Pilar Kanan", CAR.perimeter - CAR.sideS(0.57), 1.5, CAR_MAT.orange);

  // ── Sensor di atap ──
  icar.mast = addNode("Tiang Sensor", icar.chassis, Mat4.translation(0, 1.81, 1.2), () => {
    drawPart(CAR_MESH.roundBox, CAR_MAT.matteBlack, partTS(0, 0.0, 0.02, 0.3, 0.05, 0.26));
    drawPart(CAR_MESH.roundBox, CAR_MAT.matteBlack, partTS(0, 0.03, -0.27, 0.34, 0.07, 0.16));
    drawPart(CAR_MESH.cylinder, CAR_MAT.sensorBody, Mat4.multiply(partT(0, 0, 0), Mat4.scaling(0.018, 0.2, 0.018)));
  }, { note: "Dudukan sensor otonom" });

  icar.sensorHead = addNode("Kepala Sensor", icar.mast, () => Mat4.chain(
    Mat4.translation(0, 0.12, 0.03),
    Mat4.rotationY(degToRad(theta.sensorYaw))
  ), () => {
    drawPart(CAR_MESH.roundBox, CAR_MAT.sensorBody, partTS(0, 0, 0, 0.1, 0.05, 0.1));
  }, { note: "Berputar memindai (sensorYaw)" });

  icar.camera = addNode("Kamera", icar.sensorHead, () => Mat4.chain(
    Mat4.translation(0, 0.015, 0.1),
    Mat4.rotationX(degToRad(-theta.cameraPitch))
  ), () => {
    drawPart(CAR_MESH.roundBox, CAR_MAT.sensorBody, partTS(0, 0, 0, 0.16, 0.09, 0.2));
    drawPart(box(), CAR_MAT.lensGlass, partTS(0, 0, 0.1, 0.12, 0.065, 0.006));
  }, { note: "Menunduk/mendongak (cameraPitch)" });

  addNode("Kubah GPS", icar.mast, Mat4.translation(0, 0.2, 0), () => {
    drawPart(CAR_MESH.gpsDome, CAR_MAT.sensorBody);
  }, { note: "Antena GPS presisi tinggi" });

  // ── Setir: child kolom, berputar di sumbu sendiri ──
  icar.column = addNode("Kolom Setir", icar.chassis, Mat4.chain(Mat4.translation(0, 1.085, 0.87), Mat4.rotationX(degToRad(-30))), () => {
    drawPart(CAR_MESH.cylinder, CAR_MAT.matteBlack, partTS(0, -0.34, 0, 0.024, 0.34, 0.024));
  }, { note: "Kemiringan setir tetap" });

  icar.steeringWheel = addNode("Roda Setir", icar.column, () => Mat4.rotationY(degToRad(theta.steeringWheel)), () => {
    drawPart(CAR_MESH.wheelRing, CAR_MAT.steering);
    for (let i = 0; i < 3; i += 1) {
      const angle = (i / 3) * Math.PI * 2 + 0.5;
      drawPart(box(), CAR_MAT.steeringBlue, Mat4.chain(
        Mat4.rotationY(angle), partTS(0.085, 0, 0, 0.17, 0.012, 0.035)
      ));
    }
    drawPart(CAR_MESH.cylinder, CAR_MAT.steeringBlue, Mat4.multiply(partT(0, -0.02, 0), Mat4.scaling(0.042, 0.03, 0.042)));
  }, { note: "Berputar sesuai belokan roda depan" });

  createDriver(icar.chassis);

  icar.joints.push(icar.root, icar.chassis, icar.sensorHead, icar.camera, icar.steeringWheel, icar.head);

  // ── Roda: child iCAR, bukan child sasis, supaya tetap di tanah saat sasis mengayun ──
  const wheel = (label, x, z, isFront, isRight) => {
    const hub = addNode(`Hub ${label}`, icar.root, () => Mat4.chain(
      Mat4.translation(x, CAR.wheelRadius, z),
      Mat4.rotationY(isFront ? degToRad(theta.steer) : 0)
    ), null, { note: isFront ? "Sendi belok (steer)" : "Sumbu roda tetap" });

    const spin = addNode(`Roda ${label}`, hub, () => Mat4.chain(
      Mat4.rotationX(degToRad(theta.wheelSpin)),
      isRight ? Mat4.rotationY(Math.PI) : Mat4.identity()
    ), () => {
      drawPart(CAR_MESH.tire, CAR_MAT.rubber);
      drawPart(CAR_MESH.rimBack, CAR_MAT.matteBlack);
      drawPart(CAR_MESH.rim, CAR_MAT.rim);
    }, { note: "Berputar sesuai jarak tempuh (wheelSpin)" });

    icar.joints.push(hub, spin);
  };

  wheel("Depan Kiri", CAR.trackHalf, CAR.axleFront, true, false);
  wheel("Depan Kanan", -CAR.trackHalf, CAR.axleFront, true, true);
  wheel("Belakang Kiri", CAR.trackHalf, CAR.axleRear, false, false);
  wheel("Belakang Kanan", -CAR.trackHalf, CAR.axleRear, false, true);
}

// Pengemudi: susunan persis figure.js (torso → kepala, lengan atas → bawah, kaki atas → bawah)
function createDriver(parentId) {
  const torsoHeight = 0.5;
  const torsoWidth = 0.38;
  const upperArmHeight = 0.29;
  const lowerArmHeight = 0.28;
  const upperLegHeight = 0.42;
  const lowerLegHeight = 0.38;

  const limb = (height, width) => partTS(0, 0.5 * height, 0, width, height, width);

  icar.torso = addNode("Torso Pengemudi", parentId, Mat4.translation(0, 0.82, 0.335), () => {
    drawPart(CAR_MESH.softBox, CAR_MAT.shirt, partTS(0, 0.5 * torsoHeight, 0, torsoWidth, torsoHeight, 0.21));
  }, { note: "Sama seperti torso pada figure.js" });

  icar.head = addNode("Kepala Pengemudi", icar.torso, () => Mat4.chain(
    Mat4.translation(0, torsoHeight + 0.015, 0.015),
    Mat4.rotationY(degToRad(theta.headYaw)),
    Mat4.rotationX(degToRad(theta.headPitch))
  ), () => {
    drawPart(CAR_MESH.cylinder, CAR_MAT.skin, Mat4.scaling(0.045, 0.07, 0.045));
    drawPart(CAR_MESH.sphere, CAR_MAT.skin, partTS(0, 0.15, 0.005, 0.088, 0.108, 0.1));
    drawPart(CAR_MESH.sphere, CAR_MAT.hair, partTS(0, 0.178, -0.012, 0.094, 0.098, 0.104));
  }, { note: "Menoleh ke arah belokan (headYaw)" });

  const arm = (label, side, upperKey, lowerKey) => {
    const upper = addNode(`Lengan Atas ${label}`, icar.torso, () => Mat4.chain(
      Mat4.translation(side * (torsoWidth * 0.5 + 0.04), torsoHeight - 0.05, 0),
      Mat4.rotationX(degToRad(theta[upperKey])),
      Mat4.rotationZ(side * degToRad(10))
    ), () => {
      drawPart(CAR_MESH.softBox, CAR_MAT.shirt, limb(upperArmHeight, 0.09));
    }, { note: "Sendi bahu" });

    const lower = addNode(`Lengan Bawah ${label}`, upper, () => Mat4.chain(
      Mat4.translation(0, upperArmHeight, 0),
      Mat4.rotationX(degToRad(theta[lowerKey]))
    ), () => {
      drawPart(CAR_MESH.softBox, CAR_MAT.shirt, limb(lowerArmHeight, 0.075));
      drawPart(CAR_MESH.sphere, CAR_MAT.skin, partTS(0, lowerArmHeight, 0, 0.042, 0.042, 0.042));
    }, { note: "Sendi siku" });

    icar.joints.push(upper, lower);
  };

  arm("Kiri", 1, "armUpperLeft", "armLowerLeft");
  arm("Kanan", -1, "armUpperRight", "armLowerRight");

  const leg = (label, side) => {
    const upper = addNode(`Kaki Atas ${label}`, icar.torso, () => Mat4.chain(
      Mat4.translation(side * 0.1, 0.03, 0),
      Mat4.rotationX(degToRad(theta.legUpper))
    ), () => {
      drawPart(CAR_MESH.softBox, CAR_MAT.trousers, limb(upperLegHeight, 0.13));
    }, { note: "Sendi pinggul" });

    addNode(`Kaki Bawah ${label}`, upper, () => Mat4.chain(
      Mat4.translation(0, upperLegHeight, 0),
      Mat4.rotationX(degToRad(theta.legLower))
    ), () => {
      drawPart(CAR_MESH.softBox, CAR_MAT.trousers, limb(lowerLegHeight, 0.1));
    }, { note: "Sendi lutut" });
  };

  leg("Kiri", 1);
  leg("Kanan", -1);
}

// Dipanggil setiap frame setelah theta berubah, seperti initNodes() pada slider figure.js
function updateIcarNodes() {
  icar.joints.forEach(initNodes);
}
