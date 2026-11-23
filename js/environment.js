// environment.js — Jalan, penghalang, halte, dan pepohonan tepi jalan

"use strict";

const WORLD = {
  roadX0: 0,
  roadX1: 6.6,
  gutter: 0.55,
  roadZ0: -66,
  roadZ1: 60,
  vergeX0: -4.5,
  vergeX1: -0.13,
  vergeY: 0.02,
};

const ENV_MESH = {};
const ENV_MAT = {};
const windJoints = [];

// ─── Helper Geometri Lingkungan ───────────────────────────────────────────────

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
  const count = Math.round((WORLD.roadZ1 - WORLD.roadZ0) / 0.5);
  const edges = [WORLD.roadX0 - 0.13, WORLD.roadX1 + 0.13];

  for (let i = 0; i < count; i += 1) {
    const z = WORLD.roadZ0 + ((i + 0.5) / count) * (WORLD.roadZ1 - WORLD.roadZ0);
    for (const x of edges) {
      const block = i % 2 === 0 ? yellow : dark;
      mergeMeshData(mesh, block, Mat4.translation(x, 0, z));
    }
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

// ─── Aset Lingkungan ──────────────────────────────────────────────────────────

function loadEnvironmentAssets() {
  const u = WORLD;

  // Setiap tile paving 1,6 m; UV diputar 45° sehingga herringbone serong seperti foto
  ENV_MESH.road = uploadMesh(planeData(u.roadX0 + u.gutter, u.roadZ0, u.roadX1 - u.gutter, u.roadZ1, 0, 1 / 1.6, Math.PI / 4));
  // Strip paving lurus di kedua tepi, satu tile = 4 baris × 8 bata
  const gutters = createMeshData();
  mergeMeshData(gutters, planeData(u.roadX0, u.roadZ0, u.roadX0 + u.gutter, u.roadZ1, 0.001));
  mergeMeshData(gutters, planeData(u.roadX1 - u.gutter, u.roadZ0, u.roadX1, u.roadZ1, 0.001));
  ENV_MESH.gutters = uploadMesh(gutters);

  const seams = createMeshData();
  const seamWidth = 0.035;
  mergeMeshData(seams, planeData(u.roadX0 + u.gutter - seamWidth, u.roadZ0, u.roadX0 + u.gutter + seamWidth, u.roadZ1, 0.003));
  mergeMeshData(seams, planeData(u.roadX1 - u.gutter - seamWidth, u.roadZ0, u.roadX1 - u.gutter + seamWidth, u.roadZ1, 0.003));
  ENV_MESH.seams = uploadMesh(seams);

  ENV_MESH.sidewalk = uploadMesh(planeData(u.vergeX0, u.roadZ0, u.vergeX1, u.roadZ1, u.vergeY, 1 / 1.6));
  ENV_MESH.curbs = uploadMesh(buildCurbs());

  ENV_MESH.box = CAR_MESH.box;
  ENV_MESH.sky = uploadMesh(sphereData(1, 24, 48));

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

  const mat = ENV_MAT;
  mat.sky = createMaterial({ texture: TEX.sky, unlit: true, noFog: true, noShadow: true });
  mat.paver = createMaterial({ texture: TEX.paver, color: [0.86, 0.86, 0.84], specular: 0.06, shininess: 14, tileWithState: true, macro: 0.13 });
  mat.lawn = createMaterial({ texture: TEX.lawn, specular: 0.02, shininess: 8, tileWithState: true, macro: 0.16 });
  mat.gutter = createMaterial({ texture: TEX.gutter, uvScale: [1 / 0.55, 1 / 1.6], specular: 0.04, shininess: 12, tileWithState: true, macro: 0.12 });
  mat.seam = createMaterial({ color: [0.42, 0.41, 0.38], specular: 0.02, shininess: 8 });
  mat.curb = createMaterial({ texture: TEX.curb, specular: 0.14, shininess: 18 });
  mat.concrete = createMaterial({ texture: TEX.concrete, specular: 0.04, shininess: 10, tileWithState: true });
  mat.bark = createMaterial({ texture: TEX.bark, specular: 0.05, shininess: 10 });
  mat.leaf = createMaterial({ texture: TEX.leaves, color: [0.74, 0.78, 0.62], alphaCut: 0.42, translucency: 0.6, specular: 0.05, shininess: 14, wind: 0.018 });
  mat.signFace = createMaterial({ texture: TEX.sign, specular: 0.18, shininess: 30 });
  mat.signEdge = createMaterial({ color: [0.84, 0.85, 0.86], specular: 0.16, shininess: 30 });
  mat.post = createMaterial({ color: [0.09, 0.38, 0.82], specular: 0.32, shininess: 40 });
}

// ─── Scene Graph Lingkungan ───────────────────────────────────────────────────

function createEnvironment(rootId) {
  const mesh = ENV_MESH;
  const mat = ENV_MAT;
  const groundId = addNode("Jalan", rootId, Mat4.identity(), null, { note: "Jalan paving dan penghalang" });

  addNode("Jalan Paving", groundId, Mat4.identity(), () => {
    drawPart(mesh.road, mat.paver);
    drawPart(mesh.gutters, mat.gutter);
    drawPart(mesh.seams, mat.seam);
  }, { note: "Jalan lurus dari paving" });

  addNode("Penghalang Kuning-Hitam", groundId, Mat4.identity(), () => {
    drawPart(mesh.curbs, mat.curb);
  }, { note: "Penghalang di kedua sisi jalan" });

  addNode("Rumput di Bawah Pohon", groundId, Mat4.identity(), () => {
    drawPart(mesh.sidewalk, mat.lawn);
  }, { note: "Rumput pada tepi jalan tempat pohon dan halte" });

  createHalte(rootId);
  createTrees(rootId);
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

  const halteId = addNode("Halte iCAR 1", rootId, Mat4.translation(-1.35, WORLD.vergeY, 0), null, { note: "Pindahkan node ini, tiang dan panel ikut" });

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
  const groupId = addNode("Pepohonan", rootId, Mat4.identity(), null, { note: "Setiap pohon: batang → cabang → ranting" });
  const y0 = WORLD.vergeY;

  const slim = { trunkHeight: 6.4, radius: 0.115, branches: 4, twigs: 2, branchLength: 5.2, crown: 1.15, cards: 8, cardSize: 1.25, squash: 0.55 };
  const stout = { trunkHeight: 6.5, radius: 0.17, branches: 5, twigs: 2, branchLength: 5.6, crown: 1.2, cards: 8, cardSize: 1.3, squash: 0.55 };
  const tall = { trunkHeight: 7.6, radius: 0.13, branches: 4, twigs: 3, branchLength: 5.0, crown: 1.15, cards: 7, cardSize: 1.25, squash: 0.52 };
  const templates = [
    makeTreeTemplate(301, slim),
    makeTreeTemplate(302, stout),
    makeTreeTemplate(303, tall),
    makeTreeTemplate(304, slim),
    makeTreeTemplate(305, stout),
    makeTreeTemplate(306, tall),
  ];

  const trees = [
    [-3.3, 1.1, 1, 2.1, 1.4],
    [-3.2, -3.0, 2, 4.0, 0.95],
    [-3.7, -6.6, 4, 5.2, 0.9],
    [-2.2, -12.6, 1, 1.7, 0.95],
    [-2.3, 8.2, 2, 1.4, 1.0],
    [-3.8, 6.4, 0, 5.5, 1.1],
    [-3.4, -30, 3, 2.0, 1.0],
    [-3.4, -48, 5, 2.2, 1.0],
    [-3.4, -60, 1, 2.0, 1.0],
    [-3.2, 27, 4, 2.2, 1.0],
    [-3.2, 43, 0, 2.5, 1.0],
    [-3.2, 56, 2, 2.8, 1.0],
  ];

  trees.forEach((tree, index) => {
    plantTree(groupId, templates[tree[2]], `Pohon ${index + 1}`, tree[0], tree[1], y0, tree[3], tree[4]);
  });
}

function drawSky() {
  const position = camera.current.position;
  modelMatrix = Mat4.chain(Mat4.translation(position[0], position[1], position[2]), Mat4.scaling(600, 600, 600));
  gl.depthMask(false);
  drawPart(ENV_MESH.sky, ENV_MAT.sky);
  gl.depthMask(true);
  modelMatrix = Mat4.identity();
}
