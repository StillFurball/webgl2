// math3d.js — Helper vektor dan matrix untuk WebGL
// Sumber: math3d.js praktikum 04 (lookAt, perspective, orthographic)
// dan praktikum 06 (normalMatrixFromMat4). Konvensi tetap column-major.

"use strict";

function degToRad(degree) {
  return (degree * Math.PI) / 180;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

const Vec3 = {
  add(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  },

  subtract(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  },

  scale(a, s) {
    return [a[0] * s, a[1] * s, a[2] * s];
  },

  cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  },

  dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  },

  length(a) {
    return Math.hypot(a[0], a[1], a[2]);
  },

  normalize(vector) {
    const length = Math.hypot(vector[0], vector[1], vector[2]);
    if (length < 1e-6) return [0, 0, 0];
    return [vector[0] / length, vector[1] / length, vector[2] / length];
  },

  lerp(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  },
};

const Mat4 = {
  identity() {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  },

  translation(tx, ty, tz) {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      tx, ty, tz, 1,
    ]);
  },

  rotationX(radians) {
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    return new Float32Array([
      1, 0, 0, 0,
      0, cosine, sine, 0,
      0, -sine, cosine, 0,
      0, 0, 0, 1,
    ]);
  },

  rotationY(radians) {
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    return new Float32Array([
      cosine, 0, -sine, 0,
      0, 1, 0, 0,
      sine, 0, cosine, 0,
      0, 0, 0, 1,
    ]);
  },

  rotationZ(radians) {
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    return new Float32Array([
      cosine, sine, 0, 0,
      -sine, cosine, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  },

  scaling(sx, sy, sz) {
    return new Float32Array([
      sx, 0, 0, 0,
      0, sy, 0, 0,
      0, 0, sz, 0,
      0, 0, 0, 1,
    ]);
  },

  multiply(a, b) {
    const result = new Float32Array(16);
    for (let column = 0; column < 4; column += 1) {
      for (let row = 0; row < 4; row += 1) {
        let sum = 0;
        for (let index = 0; index < 4; index += 1) {
          sum += a[index * 4 + row] * b[column * 4 + index];
        }
        result[column * 4 + row] = sum;
      }
    }
    return result;
  },

  // Komposisi berurutan: chain(T, R, S) = T × R × S
  chain(...matrices) {
    return matrices.reduce((result, matrix) => Mat4.multiply(result, matrix));
  },

  transformPoint(m, p) {
    return [
      m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
    ];
  },

  transformDirection(m, d) {
    return [
      m[0] * d[0] + m[4] * d[1] + m[8] * d[2],
      m[1] * d[0] + m[5] * d[1] + m[9] * d[2],
      m[2] * d[0] + m[6] * d[1] + m[10] * d[2],
    ];
  },

  lookAt(position, target, up) {
    const forward = Vec3.normalize(Vec3.subtract(target, position));
    const safeForward = Math.hypot(...forward) < 1e-6 ? [0, 0, -1] : forward;
    let right = Vec3.normalize(Vec3.cross(safeForward, up));
    if (Math.hypot(...right) < 1e-6) {
      const fallbackUp = Math.abs(safeForward[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
      right = Vec3.normalize(Vec3.cross(safeForward, fallbackUp));
    }
    const correctedUp = Vec3.cross(right, safeForward);

    return new Float32Array([
      right[0], correctedUp[0], -safeForward[0], 0,
      right[1], correctedUp[1], -safeForward[1], 0,
      right[2], correctedUp[2], -safeForward[2], 0,
      -Vec3.dot(right, position),
      -Vec3.dot(correctedUp, position),
      Vec3.dot(safeForward, position),
      1,
    ]);
  },

  perspective(fovRadians, aspect, near, far) {
    const focalLength = 1 / Math.tan(fovRadians / 2);
    const rangeInverse = 1 / (near - far);
    return new Float32Array([
      focalLength / aspect, 0, 0, 0,
      0, focalLength, 0, 0,
      0, 0, (near + far) * rangeInverse, -1,
      0, 0, 2 * near * far * rangeInverse, 0,
    ]);
  },

  orthographic(left, right, bottom, top, near, far) {
    return new Float32Array([
      2 / (right - left), 0, 0, 0,
      0, 2 / (top - bottom), 0, 0,
      0, 0, -2 / (far - near), 0,
      -(right + left) / (right - left),
      -(top + bottom) / (top - bottom),
      -(far + near) / (far - near),
      1,
    ]);
  },
};

// Normal Matrix — inverse-transpose dari bagian 3×3 Model Matrix (praktikum 06)
function normalMatrixFromMat4(m) {
  const a00 = m[0], a01 = m[1], a02 = m[2];
  const a10 = m[4], a11 = m[5], a12 = m[6];
  const a20 = m[8], a21 = m[9], a22 = m[10];

  const b01 = a22 * a11 - a12 * a21;
  const b11 = -a22 * a10 + a12 * a20;
  const b21 = a21 * a10 - a11 * a20;

  let det = a00 * b01 + a01 * b11 + a02 * b21;

  if (Math.abs(det) < 0.000001) {
    return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }

  det = 1.0 / det;

  // transpose(inverse)
  return new Float32Array([
    b01 * det, b11 * det, b21 * det,
    (-a22 * a01 + a02 * a21) * det, (a22 * a00 - a02 * a20) * det, (-a21 * a00 + a01 * a20) * det,
    (a12 * a01 - a02 * a11) * det, (-a12 * a00 + a02 * a10) * det, (a11 * a00 - a01 * a10) * det,
  ]);
}

// Random dengan seed, supaya bentuk pohon dan texture selalu sama setiap reload
function createRandom(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (min, max) => min + (max - min) * next();
  next.pick = (list) => list[Math.floor(next() * list.length)];
  return next;
}
