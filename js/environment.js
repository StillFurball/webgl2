// environment.js — Lingkungan sekitar Halte iCAR 1 "Robotika"
// Tata letak dibaca dari tiga foto di gallery/scene. Jalan satu arah menuju −Z,
// median (tempat halte) di sisi −X jalan, papan halte menghadap ±Z.

"use strict";

const WORLD = {
  roadX0: 0,
  roadX1: 6.6,
  gutter: 0.55,
  roadZ0: -100,
  roadZ1: 180,
  islandX0: -11.1,
  islandX1: -0.13,
  islandZ0: -70,
  islandZ1: 64,
  islandRadius: 3,
  islandY: 0.12,
  wallX: -4.6,
  terraceY: 0.44,
  returnX0: -22,
  returnX1: -11.35,
};

const ENV_MESH = {};
const ENV_MAT = {};
const windJoints = [];
const lampPositions = [];

// ─── Helper Geometri Lingkungan ───────────────────────────────────────────────

// Poligon cembung mendatar: points = [[x, z], ...]
function flatPolygonData(points, y, uvPerMeter) {
  const mesh = createMeshData();
  let cx = 0;
  let cz = 0;
  points.forEach((p) => {
    cx += p[0] / points.length;
    cz += p[1] / points.length;
  });
  const n = [0, 1, 0];
  const uv = (x, z) => [x * uvPerMeter, z * uvPerMeter];
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    pushVertex(mesh, [cx, y, cz], n, uv(cx, cz));
    pushVertex(mesh, [a[0], y, a[1]], n, uv(a[0], a[1]));
    pushVertex(mesh, [b[0], y, b[1]], n, uv(b[0], b[1]));
  }
  return mesh;
}

function islandOutline(inset = 0) {
  const width = WORLD.islandX1 - WORLD.islandX0 - inset * 2;
  const length = WORLD.islandZ1 - WORLD.islandZ0 - inset * 2;
  const r = WORLD.islandRadius;
  const cx = (WORLD.islandX0 + WORLD.islandX1) / 2;
  return roundedRectOutline(width, length, [r, r, r, r], 8).map((p) => [cx + p[0], WORLD.islandZ0 + inset + p[1]]);
}

// Berjalan sepanjang polyline dengan jarak yang sama
function pathSampler(points, closed) {
  const list = closed ? [...points, points[0]] : points;
  const lengths = [0];
  for (let i = 1; i < list.length; i += 1) {
    lengths.push(lengths[i - 1] + Math.hypot(list[i][0] - list[i - 1][0], list[i][1] - list[i - 1][1]));
  }
  return {
    length: lengths[lengths.length - 1],
    at(distance) {
      let i = 1;
      while (i < lengths.length - 1 && lengths[i] < distance) i += 1;
      const segment = lengths[i] - lengths[i - 1] || 1;
      const t = (distance - lengths[i - 1]) / segment;
      const a = list[i - 1];
      const b = list[i];
      return { x: lerp(a[0], b[0], t), z: lerp(a[1], b[1], t), yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) };
    },
  };
}

// Memisahkan segitiga berdasarkan arah normal Z: muka +Z dan muka −Z panel
function splitPanelFaces(face) {
  const front = createMeshData();
  const back = createMeshData();
  for (let i = 0; i < face.normals.length; i += 3) {
    const vertex = i / 3;
    const target = face.normals[i + 2] > 0 ? front : back;
    target.positions.push(face.positions[i], face.positions[i + 1], face.positions[i + 2]);
    target.normals.push(face.normals[i], face.normals[i + 1], face.normals[i + 2]);
    target.uvs.push(face.uvs[vertex * 2], face.uvs[vertex * 2 + 1]);
  }
  return { front, back };
}

// Satu blok curb: profil trapesium dengan puncak membulat, ujung sedikit mengecil
function curbBlockData(uOffset) {
  const mesh = createMeshData();
  const profile = [[-0.125, 0], [-0.125, 0.05], [-0.1, 0.17], [-0.065, 0.235], [-0.02, 0.255], [0.02, 0.255], [0.065, 0.235], [0.1, 0.17], [0.125, 0.05], [0.125, 0]];
  const halfLength = 0.235;
  const rings = [[-halfLength, 0.8], [-halfLength + 0.02, 1], [halfLength - 0.02, 1], [halfLength, 0.8]];

  const normals = profile.map((_, i) => {
    const a = profile[Math.max(i - 1, 0)];
    const b = profile[Math.min(i + 1, profile.length - 1)];
    return Vec3.normalize([-(b[1] - a[1]), b[0] - a[0], 0].map((v, k) => (k === 0 ? v : v)));
  });

  const point = (ring, i) => {
    const [z, scale] = rings[ring];
    return [profile[i][0] * scale, profile[i][1] * (0.82 + 0.18 * scale), z];
  };
  const uv = (ring, i) => [uOffset + 0.5 * ((rings[ring][0] + halfLength) / (2 * halfLength)), profile[i][1] / 0.26];

  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    const lean = ring === 0 ? -0.5 : ring === 2 ? 0.5 : 0;
    for (let i = 0; i < profile.length - 1; i += 1) {
      const n0 = Vec3.normalize([normals[i][0], normals[i][1], lean]);
      const n1 = Vec3.normalize([normals[i + 1][0], normals[i + 1][1], lean]);
      pushQuad(mesh, point(ring, i), point(ring, i + 1), point(ring + 1, i + 1), point(ring + 1, i), n0, n1, n1, n0, uv(ring, i), uv(ring, i + 1), uv(ring + 1, i + 1), uv(ring + 1, i));
    }
  }

  for (const [ring, nz] of [[0, -1], [rings.length - 1, 1]]) {
    const n = [0, 0, nz];
    const center = [0, 0.1, rings[ring][0]];
    for (let i = 0; i < profile.length - 1; i += 1) {
      pushVertex(mesh, center, n, [uOffset + 0.25, 0.4]);
      pushVertex(mesh, point(ring, i), n, uv(ring, i));
      pushVertex(mesh, point(ring, i + 1), n, uv(ring, i + 1));
    }
  }
  return mesh;
}

function buildCurbs() {
  const mesh = createMeshData();
  const yellow = curbBlockData(0);
  const dark = curbBlockData(0.5);
  const STEP = 0.5;

  const placeAlong = (points, closed) => {
    const sampler = pathSampler(points, closed);
    const count = Math.round(sampler.length / STEP);
    for (let i = 0; i < count; i += 1) {
      const p = sampler.at(((i + 0.5) / count) * sampler.length);
      const matrix = Mat4.chain(Mat4.translation(p.x, 0, p.z), Mat4.rotationY(p.yaw));
      mergeMeshData(mesh, i % 2 === 0 ? yellow : dark, matrix);
    }
  };

  placeAlong(islandOutline(0), true);
  placeAlong([[WORLD.roadX1 + 0.13, WORLD.roadZ0], [WORLD.roadX1 + 0.13, WORLD.roadZ1]], false);
  placeAlong([[WORLD.roadX0 - 0.13, 80], [WORLD.roadX0 - 0.13, WORLD.roadZ1]], false);
  placeAlong([[WORLD.returnX0 - 0.13, -84], [WORLD.returnX0 - 0.13, 80]], false);
  return mesh;
}

// Dinding beton di tepi teras pohon: segmen 3 m dengan sambungan seperti foto
function buildConcreteWall() {
  const mesh = createMeshData();
  const x = WORLD.wallX;
  const y0 = WORLD.islandY;
  const y1 = WORLD.terraceY;
  // Urutan titik dari barat ke timur supaya normal prismData menghadap keluar
  const profile = [
    [x - 0.18, y1 - 0.2], [x - 0.18, y1 + 0.005], [x + 0.03, y1], [x + 0.03, y0 + 0.035], [x + 0.42, y0 + 0.035], [x + 0.42, y0 + 0.002],
  ];
  const zStart = WORLD.islandZ0 + 4;
  const zEnd = WORLD.islandZ1 - 4;
  const SEGMENT = 3;
  for (let z = zStart; z < zEnd; z += SEGMENT) {
    mergeMeshData(mesh, prismData(profile, z + 0.02, Math.min(z + SEGMENT - 0.02, zEnd), 0.5));
  }
  return mesh;
}

function addGrassTuft(mesh, x, y, z, height, width, random) {
  const angle = random() * Math.PI;
  const n = [0.1, 1, 0.1];
  for (const a of [angle, angle + Math.PI / 2]) {
    const dx = Math.cos(a) * width * 0.5;
    const dz = Math.sin(a) * width * 0.5;
    const lean = random.range(-0.08, 0.08);
    pushQuad(
      mesh,
      [x - dx, y, z - dz], [x + dx, y, z + dz], [x + dx + lean, y + height, z + dz], [x - dx + lean, y + height, z - dz],
      n, n, n, n,
      [0, 0], [1, 0], [1, 1], [0, 1]
    );
  }
}

function buildGrass() {
  const mesh = createMeshData();
  const random = createRandom(201);

  // Rumpun di median jalan, lebih rapat dekat halte
  for (let i = 0; i < 320; i += 1) {
    const near = random() < 0.35;
    const z = near ? random.range(-12, 12) : random.range(WORLD.islandZ0 + 3, WORLD.islandZ1 - 3);
    const x = random.range(WORLD.wallX + 0.5, WORLD.islandX1 - 0.3);
    addGrassTuft(mesh, x, WORLD.islandY, z, random.range(0.1, 0.26), random.range(0.16, 0.36), random);
  }
  // Teras pohon di belakang dinding beton
  for (let i = 0; i < 160; i += 1) {
    addGrassTuft(
      mesh,
      random.range(WORLD.islandX0 + 0.4, WORLD.wallX - 0.3),
      WORLD.terraceY,
      random.range(WORLD.islandZ0 + 4, WORLD.islandZ1 - 4),
      random.range(0.14, 0.32),
      random.range(0.22, 0.42),
      random
    );
  }
  // Rumput hijau seberang jalan
  for (let i = 0; i < 700; i += 1) {
    addGrassTuft(mesh, random.range(WORLD.roadX1 + 0.4, 22), 0.1, random.range(-95, 110), random.range(0.14, 0.3), random.range(0.3, 0.6), random);
  }
  return mesh;
}

// Daun kering di tepi jalan, menumpuk di dekat curb seperti foto
function buildRoadLeaves() {
  const mesh = createMeshData();
  const random = createRandom(211);
  const n = [0, 1, 0];
  for (let i = 0; i < 900; i += 1) {
    const nearCurb = random() < 0.82;
    const x = nearCurb ? Math.abs(random() * random()) * 1.5 + 0.02 : random.range(0, WORLD.roadX1);
    const z = random.range(-60, 60);
    const size = random.range(0.05, 0.11);
    const angle = random() * Math.PI * 2;
    const cu = Math.cos(angle) * size;
    const su = Math.sin(angle) * size;
    const cellU = Math.floor(random() * 2) / 2;
    const cellV = Math.floor(random() * 2) / 2;
    const y = 0.006 + random() * 0.006;
    pushQuad(
      mesh,
      [x - cu - su, y, z - su + cu], [x + cu - su, y, z + su + cu], [x + cu + su, y, z + su - cu], [x - cu + su, y, z - su - cu],
      n, n, n, n,
      [cellU, cellV], [cellU + 0.5, cellV], [cellU + 0.5, cellV + 0.5], [cellU, cellV + 0.5]
    );
  }
  return mesh;
}

// ─── Pohon ────────────────────────────────────────────────────────────────────

// Texture kulit kayu 1 m per tile, jumlah ulangan mengikuti keliling batang
function barkRepeat(radius) {
  return Math.max(1, Math.round((Math.PI * 2 * radius) / 1.0));
}

// Satu template pohon berisi batang dan cabang-cabang. Setiap cabang adalah node
// tersendiri sehingga angin bisa menggoyangkan sendinya secara berjenjang.
function makeTreeTemplate(seed, options) {
  const random = createRandom(seed);
  const trunkHeight = options.trunkHeight;
  const r0 = options.radius;

  const leanX = random.range(-0.5, 0.5);
  const leanZ = random.range(-0.5, 0.5);
  const wobbleA = random() * 6;
  const trunkPath = [];
  for (let i = 0; i <= 10; i += 1) {
    const t = i / 10;
    trunkPath.push([
      leanX * t * t + 0.05 * Math.sin(t * 6 + wobbleA),
      t * trunkHeight,
      leanZ * t * t + 0.05 * Math.cos(t * 5 + wobbleA),
    ]);
  }

  const lumpA = random() * 7;
  const lumpB = random() * 7;
  const trunkRadius = (t, a) =>
    r0 * (1 - 0.42 * t) *
    (1 + 0.6 * Math.exp(-t * 18) * (1 + 0.5 * Math.sin(a * 4 + lumpA))) *
    (1 + 0.06 * Math.sin(a * 3 + lumpA + t * 7) + 0.05 * Math.sin(a * 5 + lumpB - t * 11) +
      0.045 * Math.sin(t * 41 + a * 2 + lumpB) * Math.sin(a * 4 - t * 23 + lumpA));

  const nodes = [];

  const branchPath = (length, curve, swirl) => {
    const path = [];
    for (let i = 0; i <= 6; i += 1) {
      const t = i / 6;
      path.push([curve * t * t, t * length, swirl * Math.sin(t * 2.4)]);
    }
    return path;
  };

  const pathPoint = (path, t) => {
    const f = t * (path.length - 1);
    const i = Math.min(Math.floor(f), path.length - 2);
    return Vec3.lerp(path[i], path[i + 1], f - i);
  };

  const addBranch = (parentIndex, attach, azimuth, tilt, length, radius, level) => {
    const base = Mat4.chain(
      Mat4.translation(attach[0], attach[1], attach[2]),
      Mat4.rotationY(azimuth),
      Mat4.rotationZ(tilt)
    );
    const path = branchPath(length, length * random.range(0.12, 0.28), length * random.range(-0.08, 0.08));
    const taper = level === 1 ? 0.36 : 0.2;
    const wood = tubeData(path, (t) => radius * lerp(1, taper, t), level === 1 ? 8 : 6, { uRepeat: 1, vPerMeter: 1 });
    const leaves = createMeshData();
    const node = { parentIndex, base, wood, leaves, level };
    nodes.push(node);
    const index = nodes.length - 1;

    if (level === 1) {
      const count = options.twigs + Math.floor(random() * 2);
      for (let i = 0; i < count; i += 1) {
        const t = lerp(0.42, 1, (i + 0.4) / count);
        addBranch(
          index,
          pathPoint(path, t),
          random() * Math.PI * 2,
          degToRad(random.range(26, 58)),
          length * random.range(0.42, 0.68),
          radius * lerp(0.66, 0.36, t),
          2
        );
      }
      addLeafCards(leaves, path[path.length - 1], options.crown * 0.8, Math.round(options.cards * 0.6), random, { size: options.cardSize, squash: options.squash });
    } else {
      for (const t of [0.55, 1]) {
        addLeafCards(leaves, pathPoint(path, t), options.crown, options.cards, random, { size: options.cardSize, squash: options.squash });
      }
    }
  };

  const mainCount = options.branches;
  const startAngle = random() * Math.PI * 2;
  for (let i = 0; i < mainCount; i += 1) {
    const t = lerp(0.6, 1, i / Math.max(mainCount - 1, 1));
    addBranch(
      -1,
      pathPoint(trunkPath, t),
      startAngle + (i / mainCount) * Math.PI * 2 + random.range(-0.4, 0.4),
      degToRad(random.range(14, 36)),
      options.branchLength * random.range(0.85, 1.2),
      r0 * lerp(0.56, 0.44, t),
      1
    );
  }

  return {
    trunk: uploadMesh(tubeData(trunkPath, trunkRadius, 14, { uRepeat: barkRepeat(r0), vPerMeter: 1 })),
    nodes: nodes.map((node) => ({
      parentIndex: node.parentIndex,
      base: node.base,
      level: node.level,
      wood: uploadMesh(node.wood),
      leaves: node.leaves.positions.length ? uploadMesh(node.leaves) : null,
    })),
    source: { trunkPath, trunkRadius, radius: r0, nodes },
  };
}

// Versi pohon jauh: semua digabung menjadi satu mesh, tanpa sendi, hemat draw call
function mergeTreeTemplate(template) {
  const wood = tubeData(template.source.trunkPath, template.source.trunkRadius, 8, { uRepeat: barkRepeat(template.source.radius), vPerMeter: 1 });
  const leaves = createMeshData();
  const totals = [];
  template.source.nodes.forEach((node, index) => {
    const parent = node.parentIndex >= 0 ? totals[node.parentIndex] : Mat4.identity();
    totals[index] = Mat4.multiply(parent, node.base);
    mergeMeshData(wood, node.wood, totals[index]);
    if (node.leaves.positions.length) mergeMeshData(leaves, node.leaves, totals[index]);
  });
  return { wood: uploadMesh(wood), leaves: uploadMesh(leaves) };
}

function plantTree(parentId, template, name, x, z, y, yaw, scale) {
  const treeId = addNode(name, parentId, Mat4.chain(
    Mat4.translation(x, y, z),
    Mat4.rotationY(yaw),
    Mat4.scaling(scale, scale, scale)
  ), null, { note: "Instance dari template pohon", collapsed: true });

  const trunkId = addNode("Batang", treeId, Mat4.identity(), () => {
    drawPart(template.trunk, ENV_MAT.bark);
  }, { note: "Pangkal hierarki pohon" });

  const ids = [];
  template.nodes.forEach((part, index) => {
    const joint = { angleX: 0, angleZ: 0, id: 0, level: part.level, phase: (x * 1.3 + z * 0.7 + index * 1.9) % 6.28 };
    const parent = part.parentIndex >= 0 ? ids[part.parentIndex] : trunkId;
    const id = addNode(part.level === 1 ? `Cabang ${index + 1}` : `Ranting ${index + 1}`, parent, () => Mat4.chain(
      part.base,
      Mat4.rotationX(joint.angleX),
      Mat4.rotationZ(joint.angleZ)
    ), () => {
      drawPart(part.wood, ENV_MAT.bark);
      if (part.leaves) drawPart(part.leaves, ENV_MAT.leaf);
    }, { note: part.level === 1 ? "Sendi cabang utama, goyang pelan" : "Sendi ranting, goyang lebih cepat" });
    joint.id = id;
    ids.push(id);
    windJoints.push(joint);
  });
  return treeId;
}

// ─── Palem ────────────────────────────────────────────────────────────────────

function makePalmTemplate(seed, height) {
  const random = createRandom(seed);
  const trunkPath = [];
  const leanX = random.range(-0.5, 0.5);
  const leanZ = random.range(-0.5, 0.5);
  for (let i = 0; i <= 8; i += 1) {
    const t = i / 8;
    trunkPath.push([leanX * t * t, t * height, leanZ * t * t]);
  }

  const fronds = createMeshData();
  const count = 15;
  for (let i = 0; i < count; i += 1) {
    const azimuth = i * 2.4 + random.range(-0.2, 0.2);
    const length = random.range(2.2, 3.1);
    const rise = random.range(0.5, 1.5);
    const droop = random.range(1.5, 2.9);
    const ax = Math.cos(azimuth);
    const az = Math.sin(azimuth);
    const SEGMENTS = 8;
    const center = (t) => [ax * length * t, rise * t * 1.6 - droop * t * t, az * length * t];
    for (let s = 0; s < SEGMENTS; s += 1) {
      const t0 = s / SEGMENTS;
      const t1 = (s + 1) / SEGMENTS;
      const c0 = center(t0);
      const c1 = center(t1);
      const side = [-az, 0, ax];
      const widthAt = (t) => 0.5 * Math.sin(Math.min(t * 0.92 + 0.08, 1) * Math.PI) + 0.05;
      const w0 = widthAt(t0);
      const w1 = widthAt(t1);
      // Penampang V: anak daun menggantung dari tulang pelepah di tengah
      const edge = (center, offset, width) => Vec3.add(Vec3.add(center, Vec3.scale(side, offset * width)), [0, -0.5 * width, 0]);
      const nLeft = Vec3.normalize([az * 0.5 + ax * 0.2, 1, -ax * 0.5 + az * 0.2]);
      const nRight = Vec3.normalize([-az * 0.5 + ax * 0.2, 1, ax * 0.5 + az * 0.2]);
      pushQuad(fronds, edge(c0, -1, w0), c0, c1, edge(c1, -1, w1), nLeft, nLeft, nLeft, nLeft, [0, t0], [0.5, t0], [0.5, t1], [0, t1]);
      pushQuad(fronds, c0, edge(c0, 1, w0), edge(c1, 1, w1), c1, nRight, nRight, nRight, nRight, [0.5, t0], [1, t0], [1, t1], [0.5, t1]);
    }
  }

  return {
    trunk: uploadMesh(tubeData(trunkPath, (t) => 0.1 * (1 - 0.3 * t) * (1 + 0.5 * Math.exp(-t * 20)), 10, { uRepeat: 1, vPerMeter: 1 })),
    top: trunkPath[trunkPath.length - 1],
    fronds: uploadMesh(fronds),
  };
}

function plantPalm(parentId, template, name, x, z, y, yaw) {
  const palmId = addNode(name, parentId, Mat4.chain(Mat4.translation(x, y, z), Mat4.rotationY(yaw)), () => {
    drawPart(template.trunk, ENV_MAT.bark);
  }, { note: "Batang palem", collapsed: true });

  const joint = { angleX: 0, angleZ: 0, id: 0, level: 1, phase: (x + z) % 6.28 };
  joint.id = addNode("Pelepah", palmId, () => Mat4.chain(
    Mat4.translation(template.top[0], template.top[1], template.top[2]),
    Mat4.rotationX(joint.angleX),
    Mat4.rotationZ(joint.angleZ)
  ), () => {
    drawPart(template.fronds, ENV_MAT.frond);
  }, { note: "Pelepah bergoyang di ujung batang" });
  windJoints.push(joint);
}

// ─── Aset Lingkungan ──────────────────────────────────────────────────────────

function loadEnvironmentAssets() {
  const u = WORLD;

  // Setiap tile paving 1,6 m; UV diputar 45° sehingga herringbone serong seperti foto
  ENV_MESH.road = uploadMesh(planeData(u.roadX0 + u.gutter, u.roadZ0, u.roadX1 - u.gutter, u.roadZ1, 0, 1 / 1.6, Math.PI / 4));
  ENV_MESH.crossA = uploadMesh(planeData(u.returnX0, -84, u.roadX0 + u.gutter, -70, 0, 1 / 1.6, Math.PI / 4));
  ENV_MESH.crossB = uploadMesh(planeData(u.returnX0, 64, u.roadX0 + u.gutter, 80, 0, 1 / 1.6, Math.PI / 4));
  ENV_MESH.returnRoad = uploadMesh(planeData(u.returnX0, -70, u.returnX1 + 0.3, 64, 0, 1 / 6));

  // Strip paving lurus di kedua tepi, satu tile = 4 baris × 8 bata
  const gutters = createMeshData();
  mergeMeshData(gutters, planeData(u.roadX0, -70, u.roadX0 + u.gutter, 64, 0.001));
  mergeMeshData(gutters, planeData(u.roadX1 - u.gutter, u.roadZ0, u.roadX1, u.roadZ1, 0.001));
  mergeMeshData(gutters, planeData(u.roadX0, 80, u.roadX0 + u.gutter, u.roadZ1, 0.001));
  ENV_MESH.gutters = uploadMesh(gutters);

  const seams = createMeshData();
  const seamWidth = 0.035;
  mergeMeshData(seams, planeData(u.roadX0 + u.gutter - seamWidth, -70, u.roadX0 + u.gutter + seamWidth, 64, 0.003));
  mergeMeshData(seams, planeData(u.roadX1 - u.gutter - seamWidth, u.roadZ0, u.roadX1 - u.gutter + seamWidth, u.roadZ1, 0.003));
  ENV_MESH.seams = uploadMesh(seams);

  ENV_MESH.island = uploadMesh(flatPolygonData(islandOutline(0.1), u.islandY, 1 / 9));
  ENV_MESH.terrace = uploadMesh(planeData(u.islandX0 + 0.3, u.islandZ0 + 4, u.wallX - 0.15, u.islandZ1 - 4, u.terraceY, 1 / 9));
  ENV_MESH.lawnEast = uploadMesh(planeData(u.roadX1 + 0.1, u.roadZ0 - 40, 240, u.roadZ1 + 60, 0.1, 1 / 3.2));
  ENV_MESH.plainWest = uploadMesh(planeData(-260, -260, u.returnX0 - 0.1, 300, 0.02, 1 / 9));
  ENV_MESH.plainFar = uploadMesh(planeData(-260, -320, 260, u.roadZ0 - 8, 0.015, 1 / 9));
  ENV_MESH.plaza = uploadMesh(planeData(u.returnX0, u.roadZ0 - 8, u.roadX1 + 0.1, -84, 0.004, 1 / 6));
  ENV_MESH.plainNorth = uploadMesh(planeData(u.returnX0, 80, u.roadX0 - 0.2, 300, 0.05, 1 / 3.2));
  ENV_MESH.far = uploadMesh(planeData(-400, -400, 400, 400, -0.05, 1 / 9));

  ENV_MESH.curbs = uploadMesh(buildCurbs());
  ENV_MESH.wall = uploadMesh(buildConcreteWall());
  ENV_MESH.grass = uploadMesh(buildGrass());
  ENV_MESH.roadLeaves = uploadMesh(buildRoadLeaves());

  ENV_MESH.box = CAR_MESH.box;
  ENV_MESH.roundBox = CAR_MESH.roundBox;
  ENV_MESH.sky = uploadMesh(sphereData(1, 24, 48));
  ENV_MESH.cylinder = uploadMesh(cylinderData(1, 1, 1, 14));
  ENV_MESH.lampGlobe = uploadMesh(sphereData(0.15, 12, 18));

  // Halte: panel dengan sudut besar di kanan-atas dan kiri-bawah seperti foto
  const panelW = 0.95;
  const panelH = 2.1;
  const outline = roundedRectOutline(panelW, panelH, [0.16, 0.035, 0.16, 0.035], 12);
  const panel = extrudedPanelData(outline, panelW, panelH, 0.13, 0.012);
  const panelFaces = splitPanelFaces(panel.face);
  ENV_MESH.panelFront = uploadMesh(panelFaces.front);
  ENV_MESH.panelBack = uploadMesh(panelFaces.back);
  ENV_MESH.panelEdge = uploadMesh(panel.edge);
  ENV_MESH.post = uploadMesh(roundedBoxData(1, 1, 1, 0.012, 2));

  // Lingkaran rambu 30
  ENV_MESH.disc = uploadMesh(latheData([[0, 0.012], [0.33, 0.012], [0.33, 0.012], [0.33, -0.012], [0.33, -0.012], [0, -0.012]], 32, { planarUV: true }));

  ENV_MESH.bannerQuad = uploadMesh(billboardQuadData(0.75, 3.1));
  ENV_MESH.kawasanQuad = uploadMesh(billboardQuadData(2.2, 4.4));
  ENV_MESH.labQuad = uploadMesh(billboardQuadData(1.7, 3.5));

  // Gedung atap pelana: muka pentagon, sisi, dan dua bidang atap
  const gableW = 30;
  const gableWall = 8.2;
  const gableRoof = 5.2;
  const gableD = 22;
  const gableFront = createMeshData();
  const gableTotal = gableWall + gableRoof;
  const gableUV = (x, y) => [x / gableW + 0.5, y / gableTotal];
  const gableN = [0, 0, 1];
  const wallPoints = [[-gableW / 2, 0], [gableW / 2, 0], [gableW / 2, gableWall], [0, gableTotal], [-gableW / 2, gableWall]];
  for (let i = 1; i < wallPoints.length - 1; i += 1) {
    for (const p of [wallPoints[0], wallPoints[i], wallPoints[i + 1]]) {
      pushVertex(gableFront, [p[0], p[1], 0], gableN, gableUV(p[0], p[1]));
    }
  }
  ENV_MESH.gableFront = uploadMesh(gableFront);

  const gableRoofMesh = createMeshData();
  const slope = Math.hypot(gableW / 2, gableRoof);
  const roofN = (side) => Vec3.normalize([side * gableRoof, gableW / 2, 0]);
  for (const side of [-1, 1]) {
    const n = roofN(side);
    pushQuad(
      gableRoofMesh,
      [side * (gableW / 2 + 0.8), gableWall - 0.4, 0.7], [0, gableTotal, 0.7], [0, gableTotal, -gableD], [side * (gableW / 2 + 0.8), gableWall - 0.4, -gableD],
      n, n, n, n,
      [0, 0], [slope / 3, 0], [slope / 3, gableD / 3], [0, gableD / 3]
    );
  }
  ENV_MESH.gableRoof = uploadMesh(gableRoofMesh);
  ENV_MESH.gableInfo = { w: gableW, wall: gableWall, depth: gableD };

  // Gedung kaca panjang di sisi barat
  ENV_MESH.glassQuad = uploadMesh(billboardQuadData(60, 9));

  // Kartu barisan pepohonan di kejauhan
  // v sedikit di bawah 1 supaya sampling REPEAT tidak mengambil baris bawah texture yang opak
  ENV_MESH.treeline = uploadMesh(billboardQuadData(420, 15, 3, 0.985));

  // Kabel listrik memakai primitive gl.LINES (praktikum 02)
  const wires = createMeshData();
  const poleZ = [-70, -38, -6, 26];
  const poleX = 8.6;
  for (const offset of [-0.5, 0, 0.5]) {
    for (let i = 0; i < poleZ.length - 1; i += 1) {
      const STEPS = 12;
      for (let s = 0; s < STEPS; s += 1) {
        const sag = (t) => 8.35 - 1.1 * (1 - Math.pow(2 * t - 1, 2));
        const t0 = s / STEPS;
        const t1 = (s + 1) / STEPS;
        pushVertex(wires, [poleX + offset, sag(t0), lerp(poleZ[i], poleZ[i + 1], t0)], [0, 1, 0], [0, 0]);
        pushVertex(wires, [poleX + offset, sag(t1), lerp(poleZ[i], poleZ[i + 1], t1)], [0, 1, 0], [0, 0]);
      }
    }
  }
  ENV_MESH.wires = uploadMesh(wires, gl.LINES);
  ENV_MESH.wirePoles = poleZ.map((z) => [poleX, z]);

  // Daun yang jatuh
  ENV_MESH.fallingLeaf = uploadMesh(billboardQuadData(0.11, 0.11, 0.5, 0.5));

  const mat = ENV_MAT;
  mat.sky = createMaterial({ texture: TEX.sky, unlit: true, noFog: true, noShadow: true });
  mat.paver = createMaterial({ texture: TEX.paver, color: [0.86, 0.86, 0.84], specular: 0.06, shininess: 14, tileWithState: true, macro: 0.13 });
  mat.gutter = createMaterial({ texture: TEX.gutter, uvScale: [1 / 0.55, 1 / 1.6], specular: 0.04, shininess: 12, tileWithState: true, macro: 0.12 });
  mat.seam = createMaterial({ color: [0.42, 0.41, 0.38], specular: 0.02, shininess: 8 });
  mat.curb = createMaterial({ texture: TEX.curb, specular: 0.14, shininess: 18 });
  mat.litter = createMaterial({ texture: TEX.litter, specular: 0.02, shininess: 8, tileWithState: true, macro: 0.2 });
  mat.lawn = createMaterial({ texture: TEX.lawn, color: [0.8, 0.8, 0.62], specular: 0.02, shininess: 8, tileWithState: true, macro: 0.16 });
  mat.dusty = createMaterial({ texture: TEX.dustyRoad, specular: 0.02, shininess: 8, tileWithState: true, macro: 0.05 });
  mat.farGround = createMaterial({ texture: TEX.lawn, color: [0.72, 0.74, 0.56], specular: 0.0, macro: 0.2 });
  mat.concrete = createMaterial({ texture: TEX.concrete, specular: 0.04, shininess: 10, tileWithState: true });
  mat.bark = createMaterial({ texture: TEX.bark, specular: 0.05, shininess: 10 });
  mat.leaf = createMaterial({ texture: TEX.leaves, color: [0.74, 0.78, 0.62], alphaCut: 0.42, translucency: 0.6, specular: 0.05, shininess: 14, wind: 0.018 });
  mat.farLeaf = createMaterial({ texture: TEX.leaves, color: [0.72, 0.76, 0.6], alphaCut: 0.3, translucency: 0.6, specular: 0.03, shininess: 14 });
  mat.frond = createMaterial({ texture: TEX.palm, alphaCut: 0.38, translucency: 0.5, specular: 0.08, shininess: 18, wind: 0.012 });
  mat.grass = createMaterial({ texture: TEX.grass, color: [0.82, 0.84, 0.66], alphaCut: 0.45, translucency: 0.2, diffuse: 0.75, specular: 0.0, noShadow: true });
  mat.roadLeaf = createMaterial({ texture: TEX.fallenLeaf, alphaCut: 0.5, specular: 0.02, noShadow: true });
  mat.fallingLeaf = createMaterial({ texture: TEX.fallenLeaf, alphaCut: 0.5, specular: 0.02, translucency: 0.5, noShadow: true });
  mat.treeline = createMaterial({ texture: TEX.treeline, alphaCut: 0.4, specular: 0, noShadow: true, translucency: 0.3 });
  mat.signFace = createMaterial({ texture: TEX.sign, specular: 0.18, shininess: 30 });
  mat.signEdge = createMaterial({ color: [0.84, 0.85, 0.86], specular: 0.16, shininess: 30 });
  mat.post = createMaterial({ color: [0.09, 0.38, 0.82], specular: 0.32, shininess: 40 });
  mat.pole = createMaterial({ color: [0.62, 0.64, 0.66], specular: 0.4, shininess: 40 });
  mat.polePainted = createMaterial({ color: [0.17, 0.18, 0.2], specular: 0.25, shininess: 30 });
  mat.lampGlobe = createMaterial({ color: [0.94, 0.94, 0.92], specular: 0.5, shininess: 60 });
  mat.speed = createMaterial({ texture: TEX.speed, specular: 0.2, shininess: 30, alphaCut: 0.1 });
  mat.banner = createMaterial({ texture: TEX.banner, specular: 0.05, shininess: 10, translucency: 0.3 });
  mat.kawasan = createMaterial({ texture: TEX.kawasan, specular: 0.14, shininess: 25 });
  mat.lab = createMaterial({ texture: TEX.lab, specular: 0.14, shininess: 25 });
  mat.boardBack = createMaterial({ color: [0.55, 0.57, 0.6], specular: 0.1, shininess: 20 });
  mat.boardBase = createMaterial({ texture: TEX.concrete, specular: 0.03, uvScale: [1, 1] });
  mat.glass = createMaterial({ texture: TEX.glass, specular: 0.35, shininess: 60 });
  mat.gable = createMaterial({ texture: TEX.gable, specular: 0.1, shininess: 24 });
  mat.gableSide = createMaterial({ color: [0.87, 0.85, 0.78], specular: 0.05, shininess: 16 });
  mat.roof = createMaterial({ texture: TEX.roof, specular: 0.2, shininess: 30 });
  mat.buildingSide = createMaterial({ color: [0.82, 0.82, 0.8], specular: 0.05, shininess: 16 });
  mat.wire = createMaterial({ color: [0.07, 0.07, 0.08], unlit: true, noShadow: true });
}

// ─── Scene Graph Lingkungan ───────────────────────────────────────────────────

function createEnvironment(rootId) {
  const mesh = ENV_MESH;
  const mat = ENV_MAT;

  // ── Permukaan ──
  const groundId = addNode("Lingkungan", rootId, Mat4.identity(), null, { note: "Tanah, jalan, dan lanskap" });

  addNode("Jalan Paving", groundId, Mat4.identity(), () => {
    drawPart(mesh.road, mat.paver);
    drawPart(mesh.crossA, mat.paver);
    drawPart(mesh.crossB, mat.paver);
    drawPart(mesh.gutters, mat.gutter);
    drawPart(mesh.seams, mat.seam);
    drawPart(mesh.roadLeaves, mat.roadLeaf);
  }, { note: "Herringbone, texture berulang (REPEAT)" });

  addNode("Jalan Berdebu", groundId, Mat4.identity(), () => {
    drawPart(mesh.returnRoad, mat.dusty);
    drawPart(mesh.plaza, mat.dusty);
  }, { note: "Jalan balik iCAR di belakang median" });

  addNode("Curb Kuning-Hitam", groundId, Mat4.identity(), () => {
    drawPart(mesh.curbs, mat.curb);
  }, { note: "±1.300 blok digabung satu mesh" });

  addNode("Median", groundId, Mat4.identity(), () => {
    drawPart(mesh.island, mat.litter);
    drawPart(mesh.terrace, mat.litter);
    drawPart(mesh.grass, mat.grass);
  }, { note: "Rumput kering dan daun gugur" });

  addNode("Dinding Beton", groundId, Mat4.identity(), () => {
    drawPart(mesh.wall, mat.concrete);
  }, { note: "Segmen 3 m di tepi teras pohon" });

  addNode("Tanah Sekitar", groundId, Mat4.identity(), () => {
    drawPart(mesh.far, mat.farGround);
    drawPart(mesh.lawnEast, mat.lawn);
    drawPart(mesh.plainNorth, mat.lawn);
    drawPart(mesh.plainWest, mat.dusty);
    drawPart(mesh.plainFar, mat.lawn);
    // Barisan pepohonan di keempat sisi
    drawPart(mesh.treeline, mat.treeline, Mat4.translation(0, 0, -190));
    drawPart(mesh.treeline, mat.treeline, Mat4.chain(Mat4.translation(0, 0, 250), Mat4.rotationY(Math.PI)));
    drawPart(mesh.treeline, mat.treeline, Mat4.chain(Mat4.translation(150, 0, 30), Mat4.rotationY(-Math.PI / 2)));
    drawPart(mesh.treeline, mat.treeline, Mat4.chain(Mat4.translation(-160, 0, 30), Mat4.rotationY(Math.PI / 2)));
  }, { note: "Lawn, tanah lapang, barisan pohon jauh" });

  createHalte(rootId);
  createTrees(rootId);
  createStreetFurniture(rootId);
  createBuildings(rootId);
  createFallingLeaves(rootId);
}

// ── Halte: tiang biru sebagai parent dari dua panel ──
function createHalte(rootId) {
  const mesh = ENV_MESH;
  const mat = ENV_MAT;
  const POST_W = 0.4;
  const POST_D = 0.16;
  const PANEL_BOTTOM = 1.2;
  const PANEL_H = 2.1;
  const POST_H = PANEL_BOTTOM + PANEL_H * 0.81;
  const OFFSET = POST_D / 2 + 0.065;

  const halteId = addNode("Halte iCAR 1", rootId, Mat4.translation(-1.35, WORLD.islandY, 0), null, { note: "Pindahkan node ini, tiang dan panel ikut" });

  const postId = addNode("Tiang Biru", halteId, Mat4.identity(), () => {
    drawPart(mesh.post, mat.post, Mat4.multiply(Mat4.translation(0, POST_H / 2, 0), Mat4.scaling(POST_W, POST_H, POST_D)));
    drawPart(mesh.box, mat.concrete, Mat4.multiply(Mat4.translation(0, 0.01, 0), Mat4.scaling(POST_W + 0.14, 0.05, POST_D + 0.14)));
  }, { note: "Parent kedua panel" });

  // Hanya muka luar yang bergambar, muka yang menghadap tiang polos (foto ketiga)
  const panel = (name, z, printed, plain) => addNode(name, postId, Mat4.translation(0, PANEL_BOTTOM, z), () => {
    drawPart(printed, mat.signFace);
    drawPart(plain, mat.signEdge);
    drawPart(mesh.panelEdge, mat.signEdge);
  }, { note: "Rounded panel, texture dari Canvas 2D" });

  panel("Panel Depan", OFFSET, mesh.panelFront, mesh.panelBack);
  panel("Panel Belakang", -OFFSET, mesh.panelBack, mesh.panelFront);
}

// ── Pepohonan ──
function createTrees(rootId) {
  const mesh = ENV_MESH;
  const mat = ENV_MAT;
  const groupId = addNode("Pepohonan", rootId, Mat4.identity(), null, { note: "Setiap pohon: batang → cabang → ranting" });
  const y0 = WORLD.islandY;
  const y1 = WORLD.terraceY;

  const slim = { trunkHeight: 6.4, radius: 0.115, branches: 4, twigs: 2, branchLength: 5.2, crown: 1.15, cards: 8, cardSize: 1.25, squash: 0.55 };
  const stout = { trunkHeight: 6.5, radius: 0.17, branches: 5, twigs: 2, branchLength: 5.6, crown: 1.2, cards: 8, cardSize: 1.3, squash: 0.55 };
  const tall = { trunkHeight: 7.6, radius: 0.13, branches: 4, twigs: 3, branchLength: 5.0, crown: 1.15, cards: 7, cardSize: 1.25, squash: 0.52 };
  const round = { trunkHeight: 3.8, radius: 0.2, branches: 5, twigs: 3, branchLength: 3.3, crown: 1.45, cards: 15, cardSize: 1.5, squash: 0.8 };
  const umbrella = { trunkHeight: 4.2, radius: 0.18, branches: 5, twigs: 2, branchLength: 5.0, crown: 1.5, cards: 9, cardSize: 1.7, squash: 0.35 };

  const templates = [
    makeTreeTemplate(301, slim),
    makeTreeTemplate(302, stout),
    makeTreeTemplate(303, tall),
    makeTreeTemplate(304, slim),
    makeTreeTemplate(305, stout),
    makeTreeTemplate(306, tall),
  ];

  // Pohon dekat halte: posisinya diperkirakan dari ketiga foto
  const nearTrees = [
    [-3.3, 1.1, y0, 1, 2.1, 1.4],
    [-3.0, 2.6, y0, 0, 0.3, 1.2],
    [-2.55, -3.25, y0, 3, 1.1, 1.25],
    [-3.2, -3.0, y0, 2, 4.0, 0.95],
    [-2.2, -5.1, y0, 5, 0.5, 1.05],
    [-3.7, -6.6, y0, 4, 5.2, 0.9],
    [-2.2, -8.8, y0, 3, 3.0, 1.05],
    [-1.7, -12.6, y0, 1, 1.7, 0.95],
    [-3.6, -11.5, y0, 0, 2.5, 1.0],
    [-2.2, -16.7, y0, 2, 0.9, 1.0],
    [-2.3, 8.2, y0, 2, 1.4, 1.0],
    [-3.8, 6.4, y0, 0, 5.5, 1.1],
    [-1.8, 13.5, y0, 5, 3.6, 1.0],
    [-3.2, 12.8, y0, 4, 0.2, 1.0],
    [-7.6, 1.5, y1, 1, 1.0, 1.1],
    [-6.5, -5.5, y1, 3, 2.0, 1.05],
    [-8.8, -11, y1, 2, 3.0, 1.0],
    [-7.2, 9.5, y1, 4, 4.4, 1.0],
  ];
  nearTrees.forEach((tree, index) => {
    plantTree(groupId, templates[tree[3]], `Pohon ${index + 1}`, tree[0], tree[1], tree[2], tree[4], tree[5]);
  });

  // Pohon jauh digabung supaya hemat draw call
  const farSlim = mergeTreeTemplate(templates[0]);
  const farStout = mergeTreeTemplate(templates[1]);
  const farTall = mergeTreeTemplate(templates[2]);
  const farRound = mergeTreeTemplate(makeTreeTemplate(307, round));
  const farUmbrella = mergeTreeTemplate(makeTreeTemplate(308, umbrella));
  const farTemplates = [farSlim, farStout, farTall];

  const random = createRandom(401);
  const farList = [];
  // Sisa baris median sepanjang jalan
  for (let z = -21; z > WORLD.islandZ0 + 6; z -= random.range(4.5, 7)) {
    farList.push([random.range(-3.8, -1.3), z, y0, random.pick(farTemplates), random.range(0.95, 1.15)]);
    if (random() < 0.7) farList.push([random.range(-9.5, -6), z + random.range(-2, 2), y1, random.pick(farTemplates), random.range(0.85, 1.05)]);
  }
  for (let z = 19; z < WORLD.islandZ1 - 6; z += random.range(4.5, 7)) {
    farList.push([random.range(-3.8, -1.3), z, y0, random.pick(farTemplates), random.range(0.85, 1.05)]);
    if (random() < 0.7) farList.push([random.range(-9.5, -6), z + random.range(-2, 2), y1, random.pick(farTemplates), random.range(0.85, 1.05)]);
  }
  // Sisi timur jalan: pohon rimbun di lawn
  for (let z = -92; z < 120; z += random.range(6, 11)) {
    farList.push([random.range(9, 13), z, 0.1, random() < 0.6 ? farRound : farSlim, random.range(0.95, 1.25)]);
    if (random() < 0.5) farList.push([random.range(16, 30), z + random.range(-3, 3), 0.1, farRound, random.range(1, 1.5)]);
  }
  // Sisi utara jalan
  for (let z = 84; z < 170; z += random.range(6, 10)) {
    farList.push([random.range(-5, -1.5), z, 0.05, random() < 0.5 ? farRound : farStout, random.range(0.95, 1.2)]);
  }
  // Tanah lapang barat: pohon payung seperti latar foto ketiga
  for (const [x, z] of [[-30, -22], [-36, -30], [-27, -38], [-41, -19], [-33, -48], [-46, -36], [-26, 16], [-30, 34], [-52, -55], [-30, 70]]) {
    farList.push([x, z, 0.02, farUmbrella, random.range(0.95, 1.2)]);
  }
  // Ujung jalan
  for (const [x, z] of [[-6, -88], [-13, -92], [9, -96], [13, -102], [-3, -96], [-18, -96]]) {
    farList.push([x, z, 0.02, farRound, random.range(0.85, 1.1)]);
  }

  addNode("Pohon Jauh", groupId, Mat4.identity(), () => {
    for (const tree of farList) {
      if (renderPass === "shadow" && Math.hypot(tree[0] - shadowFocus[0], tree[1] - shadowFocus[2]) > SHADOW_RADIUS + 12) continue;
      const matrix = Mat4.chain(
        Mat4.translation(tree[0], tree[2], tree[1]),
        Mat4.rotationY(tree[0] * 3.1 + tree[1]),
        Mat4.scaling(tree[4], tree[4], tree[4])
      );
      drawPart(tree[3].wood, mat.bark, matrix);
      drawPart(tree[3].leaves, mat.farLeaf, matrix);
    }
  }, { note: `${farList.length} pohon tanpa sendi, hemat draw call` });

  // Palem
  const palmA = makePalmTemplate(501, 6.2);
  const palmB = makePalmTemplate(502, 7.4);
  plantPalm(groupId, palmA, "Palem 1", -9.6, -2.2, y1, 0.3);
  plantPalm(groupId, palmB, "Palem 2", -10.0, -7.0, y1, 1.2);
  plantPalm(groupId, palmA, "Palem 3", -24.5, -25, 0.02, 2.0);
  plantPalm(groupId, palmB, "Palem 4", -10, 22, y1, 0.7);
  plantPalm(groupId, palmB, "Palem 5", -3.0, 33, y0, 2.6);

  // Semak di dekat halte
  const shrubData = createMeshData();
  const shrubRandom = createRandom(601);
  addLeafCards(shrubData, [0, 0.42, 0], 0.48, 20, shrubRandom, { size: 0.55, squash: 0.95 });
  const shrub = uploadMesh(shrubData);
  // Posisi semak dihitung dari foto: dekat tiang (foto 1), di teras belakang dinding (foto 2 dan 3)
  const shrubs = [[-2.5, -4.8, y0], [-1.25, -10, y0], [-6.8, 5, y1], [-10, -2, y1], [-2.5, 5, y0], [-4.0, 9.5, y0]];
  addNode("Semak", groupId, Mat4.identity(), () => {
    for (const s of shrubs) drawPart(shrub, mat.leaf, Mat4.translation(s[0], s[2], s[1]));
  }, { note: "Semak kecil di median" });

  // Pagar tanaman di lawn timur
  const hedgeData = createMeshData();
  const hedgeRandom = createRandom(611);
  for (let z = -62; z < -22; z += 1) {
    addLeafCards(hedgeData, [8.1 + hedgeRandom() * 0.4, 0.55, z], 0.65, 5, hedgeRandom, { size: 0.75, squash: 0.8 });
  }
  const hedge = uploadMesh(hedgeData);
  addNode("Pagar Tanaman", groupId, Mat4.identity(), () => drawPart(hedge, mat.leaf), { note: "Semak memanjang sisi timur" });
}

// ── Tiang lampu, rambu, papan informasi, kabel ──
function createStreetFurniture(rootId) {
  const mesh = ENV_MESH;
  const mat = ENV_MAT;
  const groupId = addNode("Perabot Jalan", rootId, Mat4.identity(), null, { note: "Lampu, rambu, papan, kabel" });

  const POLE_H = 3.3;
  const lampSpots = [[-2.4, -11], [-2.4, -27], [-2.4, -43], [-2.4, -59], [-2.4, 12], [-2.4, 30], [-2.4, 48]];
  lampSpots.forEach((spot, index) => {
    const poleId = addNode(`Tiang Lampu ${index + 1}`, groupId, Mat4.translation(spot[0], WORLD.islandY, spot[1]), () => {
      drawPart(mesh.cylinder, mat.pole, Mat4.scaling(0.045, POLE_H, 0.045));
      drawPart(mesh.cylinder, mat.pole, Mat4.scaling(0.07, 0.5, 0.07));
    }, { note: "Parent bola lampu", collapsed: true });
    addNode("Bola Lampu", poleId, Mat4.translation(0, POLE_H + 0.12, 0), () => {
      drawPart(mesh.lampGlobe, mat.lampGlobe);
    }, { note: "Menyala saat malam (point light)" });
    lampPositions.push([spot[0], WORLD.islandY + POLE_H + 0.12, spot[1]]);
  });

  const speedId = addNode("Tiang Rambu 30", groupId, Mat4.translation(-1.1, WORLD.islandY, -33), () => {
    drawPart(mesh.cylinder, mat.pole, Mat4.scaling(0.035, 3.05, 0.035));
    drawPart(mesh.cylinder, mat.pole, Mat4.scaling(0.11, 0.12, 0.11));
  }, { note: "Parent rambu" });
  addNode("Rambu Batas 30", speedId, Mat4.chain(Mat4.translation(0, 3.0, 0.04), Mat4.rotationX(Math.PI / 2)), () => {
    drawPart(mesh.disc, mat.speed);
  }, { note: "Lingkaran dengan texture" });

  addNode("Spanduk", groupId, Mat4.translation(-1.65, WORLD.islandY, -33.8), () => {
    drawPart(mesh.cylinder, mat.pole, Mat4.chain(Mat4.translation(0.4, 0, -0.02), Mat4.scaling(0.03, 3.6, 0.03)));
    drawPart(mesh.bannerQuad, mat.banner, Mat4.translation(0, 0.45, 0));
  }, { note: "Spanduk vertikal" });

  // Papan kawasan dan laboratorium menghadap −Z, seperti terlihat di foto kedua
  const boardsId = addNode("Papan Kawasan", groupId, Mat4.chain(Mat4.translation(-3.4, WORLD.islandY, 23), Mat4.rotationY(Math.PI)), () => {
    drawPart(mesh.box, mat.boardBase, Mat4.multiply(Mat4.translation(0, 0.18, -0.05), Mat4.scaling(2.5, 0.36, 0.5)));
    drawPart(mesh.kawasanQuad, mat.kawasan, Mat4.translation(0, 0.32, 0.03));
    drawPart(mesh.box, mat.boardBack, Mat4.multiply(Mat4.translation(0, 0.32 + 2.2, -0.02), Mat4.scaling(2.2, 4.4, 0.1)));
  }, { note: "Papan biru STP TIK-Robotika" });
  addNode("Papan Laboratorium", boardsId, Mat4.translation(1.05, 0, 1.35), () => {
    drawPart(mesh.labQuad, mat.lab, Mat4.translation(0, 0.1, 0.05));
    drawPart(mesh.box, mat.boardBack, Mat4.multiply(Mat4.translation(0, 0.1 + 1.75, 0), Mat4.scaling(1.7, 3.5, 0.08)));
  }, { note: "Child papan kawasan" });

  addNode("Kabel Listrik", groupId, Mat4.identity(), () => {
    drawPart(mesh.wires, mat.wire);
    for (const pole of mesh.wirePoles) {
      drawPart(mesh.cylinder, mat.polePainted, Mat4.chain(Mat4.translation(pole[0], 0.1, pole[1]), Mat4.scaling(0.07, 8.4, 0.07)));
      drawPart(mesh.box, mat.polePainted, Mat4.chain(Mat4.translation(pole[0], 8.35, pole[1]), Mat4.scaling(1.3, 0.07, 0.07)));
    }
  }, { note: "Primitive gl.LINES" });
}

// ── Gedung ──
function createBuildings(rootId) {
  const mesh = ENV_MESH;
  const mat = ENV_MAT;
  const groupId = addNode("Gedung", rootId, Mat4.identity(), null, { note: "Latar belakang kawasan" });
  const info = mesh.gableInfo;

  addNode("Gedung Ujung Jalan", groupId, Mat4.translation(3.4, 0, -118), () => {
    drawPart(mesh.gableFront, mat.gable);
    drawPart(mesh.gableRoof, mat.roof);
    drawPart(mesh.box, mat.gableSide, Mat4.chain(Mat4.translation(0, info.wall / 2, -info.depth / 2), Mat4.scaling(info.w, info.wall, info.depth)));
    drawPart(mesh.box, mat.gableSide, Mat4.chain(Mat4.translation(-info.w / 2 - 9, 3.2, -6), Mat4.scaling(18, 6.4, 14)));
    drawPart(mesh.box, mat.gableSide, Mat4.chain(Mat4.translation(info.w / 2 + 9, 3.2, -6), Mat4.scaling(18, 6.4, 14)));
  }, { note: "Atap pelana abu dan kaca segitiga" });

  addNode("Gedung Kaca Barat", groupId, Mat4.chain(Mat4.translation(-52, 0.02, 38), Mat4.rotationY(Math.PI / 2)), () => {
    drawPart(mesh.glassQuad, mat.glass);
    drawPart(mesh.box, mat.buildingSide, Mat4.chain(Mat4.translation(0, 4.45, -7), Mat4.scaling(60, 8.9, 14)));
  }, { note: "Fasad kaca dengan panel kuning" });
}

// ── Daun jatuh dari pohon di dekat halte ──
const fallingLeaves = [];

function createFallingLeaves(rootId) {
  const groupId = addNode("Daun Gugur", rootId, Mat4.identity(), null, { note: "Animasi: turun sambil berputar" });
  const random = createRandom(701);
  for (let i = 0; i < 18; i += 1) {
    const leaf = {
      x: random.range(-6, 2),
      z: random.range(-16, 12),
      y: random.range(0, 8),
      speed: random.range(0.35, 0.7),
      spin: random.range(1.2, 3.2),
      sway: random.range(0.4, 1.2),
      phase: random() * 6.28,
      id: 0,
      age: 0,
    };
    leaf.id = addNode(`Daun ${i + 1}`, groupId, () => Mat4.chain(
      Mat4.translation(
        leaf.x + Math.sin(leaf.age * 0.9 + leaf.phase) * leaf.sway,
        leaf.y,
        leaf.z + Math.cos(leaf.age * 0.7 + leaf.phase) * leaf.sway * 0.7
      ),
      Mat4.rotationY(leaf.age * leaf.spin),
      Mat4.rotationX(leaf.age * leaf.spin * 0.6 + leaf.phase)
    ), () => {
      drawPart(ENV_MESH.fallingLeaf, ENV_MAT.fallingLeaf);
    }, { note: "Node daun", hidden: true });
    fallingLeaves.push(leaf);
  }
}

function drawSky() {
  const position = camera.current.position;
  modelMatrix = Mat4.chain(Mat4.translation(position[0], position[1], position[2]), Mat4.scaling(600, 600, 600));
  gl.depthMask(false);
  drawPart(ENV_MESH.sky, ENV_MAT.sky);
  gl.depthMask(true);
  modelMatrix = Mat4.identity();
}
