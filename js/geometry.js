// geometry.js — Generator mesh (posisi, normal, UV)
// Semua mesh berupa triangle list tanpa index, sama seperti 36 vertex cube
// pada praktikum 06. Normal di sini adalah vertex normal (smooth shading);
// face normal untuk flat shading dihitung saat upload di renderer.js.

"use strict";

function createMeshData() {
  return { positions: [], normals: [], uvs: [] };
}

function pushVertex(mesh, p, n, uv) {
  mesh.positions.push(p[0], p[1], p[2]);
  mesh.normals.push(n[0], n[1], n[2]);
  mesh.uvs.push(uv[0], uv[1]);
}

// Quad a-b-c-d dipecah menjadi dua segitiga
function pushQuad(mesh, a, b, c, d, na, nb, nc, nd, ua, ub, uc, ud) {
  pushVertex(mesh, a, na, ua);
  pushVertex(mesh, b, nb, ub);
  pushVertex(mesh, c, nc, uc);
  pushVertex(mesh, a, na, ua);
  pushVertex(mesh, c, nc, uc);
  pushVertex(mesh, d, nd, ud);
}

// Menggabungkan mesh ke target, opsional dengan transformasi (pakai Normal Matrix)
function mergeMeshData(target, source, matrix) {
  const normalMatrix = matrix ? normalMatrixFromMat4(matrix) : null;
  for (let i = 0; i < source.positions.length; i += 3) {
    let p = [source.positions[i], source.positions[i + 1], source.positions[i + 2]];
    let n = [source.normals[i], source.normals[i + 1], source.normals[i + 2]];
    if (matrix) {
      p = Mat4.transformPoint(matrix, p);
      n = Vec3.normalize([
        normalMatrix[0] * n[0] + normalMatrix[3] * n[1] + normalMatrix[6] * n[2],
        normalMatrix[1] * n[0] + normalMatrix[4] * n[1] + normalMatrix[7] * n[2],
        normalMatrix[2] * n[0] + normalMatrix[5] * n[1] + normalMatrix[8] * n[2],
      ]);
    }
    target.positions.push(p[0], p[1], p[2]);
    target.normals.push(n[0], n[1], n[2]);
  }
  for (let i = 0; i < source.uvs.length; i += 1) target.uvs.push(source.uvs[i]);
  return target;
}

function transformMeshData(source, matrix) {
  return mergeMeshData(createMeshData(), source, matrix);
}

// ─── Primitive Dasar ──────────────────────────────────────────────────────────

// Cube satuan, dipakai dengan instance matrix seperti torso() pada figure.js
function boxData(uvPerMeter) {
  const mesh = createMeshData();
  const faces = [
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
    { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
    { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  ];
  const scaleUV = uvPerMeter || 1;
  for (const face of faces) {
    const corner = (su, sv) => [
      0.5 * (face.n[0] + su * face.u[0] + sv * face.v[0]),
      0.5 * (face.n[1] + su * face.u[1] + sv * face.v[1]),
      0.5 * (face.n[2] + su * face.u[2] + sv * face.v[2]),
    ];
    pushQuad(
      mesh,
      corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1),
      face.n, face.n, face.n, face.n,
      [0, 0], [scaleUV, 0], [scaleUV, scaleUV], [0, scaleUV]
    );
  }
  return mesh;
}

// Kotak dengan sudut membulat: titik permukaan didorong dari kotak dalam
function roundedBoxData(w, h, d, radius, segments = 3) {
  const mesh = createMeshData();
  const half = [w / 2, h / 2, d / 2];
  const inner = half.map((value) => Math.max(value - radius, 0));

  const stopsFor = (axis) => {
    const stops = [];
    for (let k = 0; k <= segments; k += 1) {
      stops.push(-inner[axis] - radius * Math.cos((k / segments) * Math.PI * 0.5));
    }
    for (let k = segments; k >= 0; k -= 1) {
      stops.push(inner[axis] + radius * Math.cos((k / segments) * Math.PI * 0.5));
    }
    return stops;
  };

  const surfacePoint = (raw, fallback) => {
    const q = raw.map((value, axis) => clamp(value, -inner[axis], inner[axis]));
    const direction = Vec3.normalize(Vec3.subtract(raw, q));
    const n = Vec3.length(direction) > 0 ? direction : fallback;
    return { p: Vec3.add(q, Vec3.scale(n, radius)), n };
  };

  for (let axis = 0; axis < 3; axis += 1) {
    for (const sign of [-1, 1]) {
      const axisU = (axis + 1) % 3;
      const axisV = (axis + 2) % 3;
      const stopsU = stopsFor(axisU);
      const stopsV = stopsFor(axisV);
      const fallback = [0, 0, 0];
      fallback[axis] = sign;

      const vertex = (iu, iv) => {
        const raw = [0, 0, 0];
        raw[axis] = sign * half[axis];
        raw[axisU] = stopsU[iu];
        raw[axisV] = stopsV[iv];
        const surface = surfacePoint(raw, fallback);
        surface.uv = [
          (raw[axisU] + half[axisU]) / (2 * half[axisU]),
          (raw[axisV] + half[axisV]) / (2 * half[axisV]),
        ];
        return surface;
      };

      for (let iu = 0; iu < stopsU.length - 1; iu += 1) {
        for (let iv = 0; iv < stopsV.length - 1; iv += 1) {
          const a = vertex(iu, iv);
          const b = vertex(iu + 1, iv);
          const c = vertex(iu + 1, iv + 1);
          const e = vertex(iu, iv + 1);
          pushQuad(mesh, a.p, b.p, c.p, e.p, a.n, b.n, c.n, e.n, a.uv, b.uv, c.uv, e.uv);
        }
      }
    }
  }
  return mesh;
}

// Surface of revolution mengelilingi sumbu Y.
// profile = [[r, y], ...]. Titik yang ditulis dua kali = tepi tajam.
function latheData(profile, segments = 24, options = {}) {
  const mesh = createMeshData();
  const runs = [[]];
  profile.forEach((point, index) => {
    const prev = profile[index - 1];
    if (prev && prev[0] === point[0] && prev[1] === point[1]) {
      runs.push([point]);
    } else {
      runs[runs.length - 1].push(point);
    }
  });

  let maxRadius = 0;
  let totalLength = 0;
  profile.forEach((point, index) => {
    maxRadius = Math.max(maxRadius, point[0]);
    if (index > 0) totalLength += Math.hypot(point[0] - profile[index - 1][0], point[1] - profile[index - 1][1]);
  });

  let travelled = 0;
  for (const run of runs) {
    if (run.length < 2) continue;

    // Normal profil 2D: tangen (dr, dy) diputar searah jarum jam
    const segmentNormals = [];
    for (let i = 0; i < run.length - 1; i += 1) {
      const dr = run[i + 1][0] - run[i][0];
      const dy = run[i + 1][1] - run[i][1];
      const len = Math.hypot(dr, dy) || 1;
      segmentNormals.push([dy / len, -dr / len]);
    }
    const pointNormals = run.map((_, i) => {
      const a = segmentNormals[Math.max(i - 1, 0)];
      const b = segmentNormals[Math.min(i, segmentNormals.length - 1)];
      const len = Math.hypot(a[0] + b[0], a[1] + b[1]) || 1;
      return [(a[0] + b[0]) / len, (a[1] + b[1]) / len];
    });

    for (let i = 0; i < run.length - 1; i += 1) {
      const segLen = Math.hypot(run[i + 1][0] - run[i][0], run[i + 1][1] - run[i][1]);
      const v0 = travelled / (totalLength || 1);
      travelled += segLen;
      const v1 = travelled / (totalLength || 1);

      for (let j = 0; j < segments; j += 1) {
        const vertex = (pi, step, v) => {
          const angle = (step / segments) * Math.PI * 2;
          const cosine = Math.cos(angle);
          const sine = Math.sin(angle);
          const r = run[pi][0];
          const p = [r * cosine, run[pi][1], r * sine];
          const nr = pointNormals[pi];
          const n = [nr[0] * cosine, nr[1], nr[0] * sine];
          const uv = options.planarUV
            ? [0.5 + p[0] / (2 * maxRadius), 0.5 + p[2] / (2 * maxRadius)]
            : [(step / segments) * (options.uRepeat || 1), v * (options.vRepeat || 1)];
          return { p, n, uv };
        };
        const a = vertex(i, j, v0);
        const b = vertex(i, j + 1, v0);
        const c = vertex(i + 1, j + 1, v1);
        const d = vertex(i + 1, j, v1);
        pushQuad(mesh, a.p, b.p, c.p, d.p, a.n, b.n, c.n, d.n, a.uv, b.uv, c.uv, d.uv);
      }
    }
  }
  return mesh;
}

function cylinderData(radiusBottom, radiusTop, height, segments = 16) {
  return latheData(
    [
      [0, 0], [radiusBottom, 0], [radiusBottom, 0],
      [radiusTop, height], [radiusTop, height], [0, height],
    ],
    segments
  );
}

function sphereData(radius, rings = 12, segments = 20) {
  const profile = [];
  for (let i = 0; i <= rings; i += 1) {
    const angle = -Math.PI / 2 + (i / rings) * Math.PI;
    profile.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  profile[0][0] = 0;
  profile[rings][0] = 0;
  return latheData(profile, segments);
}

function torusData(majorRadius, minorRadius, rings = 12, segments = 28) {
  const profile = [];
  for (let i = 0; i <= rings; i += 1) {
    const angle = -Math.PI + (i / rings) * Math.PI * 2;
    profile.push([majorRadius + minorRadius * Math.cos(angle), -minorRadius * Math.sin(angle)]);
  }
  return latheData(profile, segments);
}

// Tube mengikuti path 3D (cabang pohon, tiang). Frame memakai parallel transport.
function tubeData(path, radiusFn, sides = 8, options = {}) {
  const mesh = createMeshData();
  const count = path.length;
  const tangents = path.map((_, i) =>
    Vec3.normalize(Vec3.subtract(path[Math.min(i + 1, count - 1)], path[Math.max(i - 1, 0)]))
  );

  let normal = Vec3.cross(tangents[0], Math.abs(tangents[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
  normal = Vec3.normalize(normal);

  const rings = [];
  let travelled = 0;
  for (let i = 0; i < count; i += 1) {
    const tangent = tangents[i];
    normal = Vec3.normalize(Vec3.subtract(normal, Vec3.scale(tangent, Vec3.dot(normal, tangent))));
    const binormal = Vec3.cross(tangent, normal);
    if (i > 0) travelled += Vec3.length(Vec3.subtract(path[i], path[i - 1]));

    const t = i / (count - 1);
    const ring = [];
    for (let j = 0; j <= sides; j += 1) {
      const angle = (j / sides) * Math.PI * 2;
      const direction = Vec3.add(Vec3.scale(normal, Math.cos(angle)), Vec3.scale(binormal, Math.sin(angle)));
      const radius = typeof radiusFn === "function" ? radiusFn(t, angle) : radiusFn;
      ring.push({
        p: Vec3.add(path[i], Vec3.scale(direction, radius)),
        n: direction,
        uv: [(j / sides) * (options.uRepeat || 1), travelled * (options.vPerMeter || 1)],
      });
    }
    rings.push(ring);
  }

  for (let i = 0; i < count - 1; i += 1) {
    for (let j = 0; j < sides; j += 1) {
      const a = rings[i][j];
      const b = rings[i][j + 1];
      const c = rings[i + 1][j + 1];
      const d = rings[i + 1][j];
      pushQuad(mesh, a.p, b.p, c.p, d.p, a.n, b.n, c.n, d.n, a.uv, b.uv, c.uv, d.uv);
    }
  }

  // Tutup ujung tube
  if (options.capEnd !== false) {
    const lastRing = rings[count - 1];
    const tip = path[count - 1];
    const n = tangents[count - 1];
    for (let j = 0; j < sides; j += 1) {
      pushVertex(mesh, lastRing[j].p, n, lastRing[j].uv);
      pushVertex(mesh, lastRing[j + 1].p, n, lastRing[j + 1].uv);
      pushVertex(mesh, tip, n, lastRing[j].uv);
    }
  }
  return mesh;
}

// Bidang datar y tetap. UV dalam meter supaya texture berulang (GL_REPEAT).
function planeData(x0, z0, x1, z1, y, uvPerMeter = 1, uvRotation = 0) {
  const mesh = createMeshData();
  const cosine = Math.cos(uvRotation);
  const sine = Math.sin(uvRotation);
  const uv = (x, z) => [
    (x * cosine - z * sine) * uvPerMeter,
    (x * sine + z * cosine) * uvPerMeter,
  ];
  const n = [0, 1, 0];
  pushQuad(
    mesh,
    [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0],
    n, n, n, n,
    uv(x0, z1), uv(x1, z1), uv(x1, z0), uv(x0, z0)
  );
  return mesh;
}

// Quad tegak menghadap +Z dengan UV 0..1 (papan, spanduk, kartu pepohonan jauh)
function billboardQuadData(width, height, uRepeat = 1, vRepeat = 1) {
  const mesh = createMeshData();
  const n = [0, 0, 1];
  pushQuad(
    mesh,
    [-width / 2, 0, 0], [width / 2, 0, 0], [width / 2, height, 0], [-width / 2, height, 0],
    n, n, n, n,
    [0, 0], [uRepeat, 0], [uRepeat, vRepeat], [0, vRepeat]
  );
  return mesh;
}

// Prisma: profil 2D (x, y) di-extrude sepanjang sumbu Z, normal per segmen
function prismData(profile, zStart, zEnd, uvPerMeter = 1) {
  const mesh = createMeshData();
  let travelled = 0;
  for (let i = 0; i < profile.length - 1; i += 1) {
    const a = profile[i];
    const b = profile[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const n = [-dy / len, dx / len, 0];
    const u0 = travelled * uvPerMeter;
    const u1 = (travelled + len) * uvPerMeter;
    travelled += len;
    pushQuad(
      mesh,
      [a[0], a[1], zStart], [b[0], b[1], zStart], [b[0], b[1], zEnd], [a[0], a[1], zEnd],
      n, n, n, n,
      [u0, zStart * uvPerMeter], [u1, zStart * uvPerMeter], [u1, zEnd * uvPerMeter], [u0, zEnd * uvPerMeter]
    );
  }
  return mesh;
}

// ─── Panel Sudut Membulat ─────────────────────────────────────────────────────

// Outline CCW di bidang XY. radii = [kiriBawah, kananBawah, kananAtas, kiriAtas]
function roundedRectOutline(width, height, radii, segments = 10) {
  const hw = width / 2;
  const points = [];
  const corners = [
    { cx: -hw + radii[0], cy: radii[0], r: radii[0], start: Math.PI },
    { cx: hw - radii[1], cy: radii[1], r: radii[1], start: Math.PI * 1.5 },
    { cx: hw - radii[2], cy: height - radii[2], r: radii[2], start: 0 },
    { cx: -hw + radii[3], cy: height - radii[3], r: radii[3], start: Math.PI * 0.5 },
  ];
  for (const corner of corners) {
    for (let i = 0; i <= segments; i += 1) {
      const angle = corner.start + (i / segments) * Math.PI * 0.5;
      points.push([corner.cx + corner.r * Math.cos(angle), corner.cy + corner.r * Math.sin(angle)]);
    }
  }
  return points;
}

// Hasil: { face, edge } — muka depan-belakang ber-UV planar, tepi punya bevel kecil
function extrudedPanelData(outline, width, height, thickness, bevel = 0.008) {
  const face = createMeshData();
  const edge = createMeshData();
  const halfT = thickness / 2;
  const uvOf = (p, mirror) => {
    const u = p[0] / width + 0.5;
    return [mirror ? 1 - u : u, p[1] / height];
  };

  // Outline cembung sehingga cukup triangle fan dari titik tengah
  const center = [0, height / 2];
  const inset = outline.map((p) => {
    const dx = center[0] - p[0];
    const dy = center[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    return [p[0] + (dx / len) * bevel, p[1] + (dy / len) * bevel];
  });

  for (let i = 0; i < outline.length; i += 1) {
    const j = (i + 1) % outline.length;
    const a = inset[i];
    const b = inset[j];
    pushVertex(face, [center[0], center[1], halfT], [0, 0, 1], uvOf(center, false));
    pushVertex(face, [a[0], a[1], halfT], [0, 0, 1], uvOf(a, false));
    pushVertex(face, [b[0], b[1], halfT], [0, 0, 1], uvOf(b, false));

    pushVertex(face, [center[0], center[1], -halfT], [0, 0, -1], uvOf(center, true));
    pushVertex(face, [b[0], b[1], -halfT], [0, 0, -1], uvOf(b, true));
    pushVertex(face, [a[0], a[1], -halfT], [0, 0, -1], uvOf(a, true));

    const p = outline[i];
    const q = outline[j];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    const n = [dy / len, -dx / len, 0];
    const zone = bevel * 0.8;
    const nFront = Vec3.normalize([n[0], n[1], 0.9]);
    const nBack = Vec3.normalize([n[0], n[1], -0.9]);
    const white = [0.5, 0.5];

    pushQuad(edge, [p[0], p[1], -halfT + zone], [q[0], q[1], -halfT + zone], [q[0], q[1], halfT - zone], [p[0], p[1], halfT - zone], n, n, n, n, white, white, white, white);
    pushQuad(edge, [p[0], p[1], halfT - zone], [q[0], q[1], halfT - zone], [b[0], b[1], halfT], [a[0], a[1], halfT], nFront, nFront, nFront, nFront, white, white, white, white);
    pushQuad(edge, [a[0], a[1], -halfT], [b[0], b[1], -halfT], [q[0], q[1], -halfT + zone], [p[0], p[1], -halfT + zone], nBack, nBack, nBack, nBack, white, white, white, white);
  }
  return { face, edge };
}

// ─── Kartu Daun ───────────────────────────────────────────────────────────────

// Sekumpulan quad ber-alpha mengelilingi satu titik. Normal dibuat condong keluar
// dari pusat gerombol sehingga pencahayaannya membulat seperti tajuk pohon.
function addLeafCards(mesh, center, radius, count, random, options = {}) {
  const atlas = options.atlas || 2;
  const size = options.size || 1.0;
  const squash = options.squash || 0.7;
  for (let i = 0; i < count; i += 1) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    const distance = radius * Math.cbrt(random());
    const offset = [
      distance * Math.sin(phi) * Math.cos(theta),
      distance * Math.cos(phi) * squash,
      distance * Math.sin(phi) * Math.sin(theta),
    ];
    const position = Vec3.add(center, offset);

    const outward = Vec3.length(offset) > 0.01 ? Vec3.normalize(offset) : [0, 1, 0];
    const axisU = Vec3.normalize(Vec3.cross(
      [random() - 0.5, random() - 0.5, random() - 0.5],
      [0.1 + random(), 1, 0.1]
    ));
    const axisV = Vec3.normalize(Vec3.cross(
      Vec3.normalize([outward[0] + (random() - 0.5), 0.9, outward[2] + (random() - 0.5)]),
      axisU
    ));
    const cardSize = size * (0.75 + random() * 0.6);
    const hu = Vec3.scale(axisU, cardSize * 0.5);
    const hv = Vec3.scale(axisV, cardSize * 0.5);

    const a = Vec3.subtract(Vec3.subtract(position, hu), hv);
    const b = Vec3.subtract(Vec3.add(position, hu), hv);
    const c = Vec3.add(Vec3.add(position, hu), hv);
    const d = Vec3.add(Vec3.subtract(position, hu), hv);
    const n = Vec3.normalize(Vec3.add(Vec3.scale(outward, 0.8), [0, 0.45, 0]));

    const cellU = Math.floor(random() * atlas) / atlas;
    const cellV = Math.floor(random() * atlas) / atlas;
    const cell = 1 / atlas;
    pushQuad(
      mesh, a, b, c, d, n, n, n, n,
      [cellU, cellV], [cellU + cell, cellV], [cellU + cell, cellV + cell], [cellU, cellV + cell]
    );
  }
}
