// renderer.js — WebGL2 context, shader, buffer, texture, shadow map
// Shader Phong per-fragment berasal dari praktikum 06, dengan tambahan:
// beberapa lampu titik/sorot, hemisphere ambient, kabut, dan shadow mapping.

"use strict";

// ─── WebGL Context ───────────────────────────────────────────────────────────

const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl2", { antialias: true });

if (!gl) {
  throw new Error("WebGL2 tidak tersedia.");
}

gl.enable(gl.DEPTH_TEST);
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

const anisotropyExtension = gl.getExtension("EXT_texture_filter_anisotropic");

// ─── Shader Sources ───────────────────────────────────────────────────────────

const MAX_POINT_LIGHTS = 8;

const vertexShaderSource = `#version 300 es

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_texCoord;

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform mat4 u_lightSpace;

uniform mat3 u_normalMatrix;

uniform vec2 u_uvScale;
uniform float u_time;
uniform float u_wind;

out vec3 v_worldPosition;
out vec3 v_normal;
out vec2 v_texCoord;
out vec4 v_lightSpacePosition;

void main() {
  vec4 worldPosition = u_model * vec4(a_position, 1.0);

  // Daun bergetar halus; goyangan besar dikerjakan oleh sendi cabang di hierarki
  if (u_wind > 0.0) {
    worldPosition.xyz += u_wind * vec3(
      sin(u_time * 2.1 + worldPosition.y * 1.7 + worldPosition.z),
      sin(u_time * 2.7 + worldPosition.x * 1.3) * 0.6,
      sin(u_time * 1.9 + worldPosition.x * 1.9)
    );
  }

  v_worldPosition = worldPosition.xyz;
  v_normal = u_normalMatrix * a_normal;
  v_texCoord = a_texCoord * u_uvScale;

  // Normal offset supaya permukaan tidak membayangi dirinya sendiri (shadow acne)
  v_lightSpacePosition = u_lightSpace * vec4(worldPosition.xyz + normalize(v_normal) * 0.035, 1.0);

  gl_Position = u_projection * u_view * worldPosition;
}
`;

const fragmentShaderSource = `#version 300 es

precision highp float;
precision highp sampler2DShadow;

in vec3 v_worldPosition;
in vec3 v_normal;
in vec2 v_texCoord;
in vec4 v_lightSpacePosition;

// Matahari/bulan: point light yang sangat jauh, rumusnya sama seperti praktikum 06
uniform vec3 u_lightPosition;
uniform vec3 u_lightColor;
uniform vec3 u_cameraPosition;

uniform vec3 u_skyAmbient;
uniform vec3 u_groundAmbient;

uniform float u_ambientStrength;
uniform float u_diffuseStrength;
uniform float u_specularStrength;
uniform float u_shininess;
uniform float u_translucency;

// Lampu jalan dan lampu iCAR
uniform int u_pointLightCount;
uniform vec3 u_pointPosition[${MAX_POINT_LIGHTS}];
uniform vec3 u_pointColor[${MAX_POINT_LIGHTS}];
uniform vec3 u_pointDirection[${MAX_POINT_LIGHTS}];
uniform float u_pointCutoff[${MAX_POINT_LIGHTS}];
uniform float u_pointRange[${MAX_POINT_LIGHTS}];

uniform sampler2D u_texture;
uniform bool u_useTexture;
uniform vec3 u_color;
uniform vec3 u_emissive;
uniform float u_alphaCut;
uniform bool u_unlit;
uniform float u_macro;

uniform sampler2DShadow u_shadowMap;
uniform bool u_shadowEnabled;
uniform float u_shadowTexel;

uniform vec3 u_fogColor;
uniform float u_fogDensity;
uniform float u_highlight;

out vec4 outColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

// Percentage Closer Filtering: rata-rata beberapa sampel agar tepi bayangan halus
float sunVisibility() {
  if (!u_shadowEnabled) return 1.0;
  vec3 coord = v_lightSpacePosition.xyz / v_lightSpacePosition.w * 0.5 + 0.5;
  if (coord.x < 0.0 || coord.x > 1.0 || coord.y < 0.0 || coord.y > 1.0 || coord.z > 1.0) return 1.0;

  coord.z -= 0.0006;
  float sum = 0.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      sum += texture(u_shadowMap, coord + vec3(vec2(x, y) * u_shadowTexel, 0.0));
    }
  }
  return sum / 9.0;
}

vec3 phong(vec3 N, vec3 L, vec3 V, vec3 lightColor, vec3 base) {
  float diff = max(dot(N, L), 0.0);
  diff += u_translucency * max(dot(-N, L), 0.0);

  vec3 R = reflect(-L, N);
  float spec = 0.0;
  if (diff > 0.0) {
    spec = pow(max(dot(R, V), 0.0), u_shininess);
  }

  return u_diffuseStrength * diff * lightColor * base
       + u_specularStrength * spec * lightColor;
}

void main() {
  vec4 texColor = u_useTexture ? texture(u_texture, v_texCoord) : vec4(1.0);
  if (texColor.a < u_alphaCut) discard;

  vec3 base = texColor.rgb * u_color;

  // Variasi warna skala besar agar pola texture berulang tidak terlihat
  if (u_macro > 0.0) {
    float n = valueNoise(v_worldPosition.xz * 0.21) * 0.65 + valueNoise(v_worldPosition.xz * 0.77) * 0.35;
    base *= 1.0 + u_macro * (n - 0.5) * 2.0;
  }

  vec3 finalColor;
  if (u_unlit) {
    finalColor = base;
  } else {
    vec3 N = normalize(v_normal);
    vec3 V = normalize(u_cameraPosition - v_worldPosition);

    vec3 ambientLight = mix(u_groundAmbient, u_skyAmbient, 0.5 + 0.5 * N.y);
    finalColor = u_ambientStrength * ambientLight * base;

    vec3 L = normalize(u_lightPosition - v_worldPosition);
    // Daun tembus cahaya: bayangan pada tajuk tidak segelap bayangan pada tanah
    float sun = sunVisibility();
    if (u_translucency > 0.0) sun = mix(0.55, 1.0, sun);
    finalColor += phong(N, L, V, u_lightColor, base) * sun;

    for (int i = 0; i < u_pointLightCount; i++) {
      vec3 toLight = u_pointPosition[i] - v_worldPosition;
      float dist = length(toLight);
      float range = u_pointRange[i];
      if (dist > range) continue;
      vec3 pointL = toLight / dist;

      float falloff = 1.0 - dist / range;
      float attenuation = falloff * falloff;

      // Cutoff < 0 berarti lampu titik biasa; selain itu lampu sorot (headlight)
      if (u_pointCutoff[i] > -0.5) {
        float angle = dot(-pointL, u_pointDirection[i]);
        attenuation *= smoothstep(u_pointCutoff[i], u_pointCutoff[i] + 0.12, angle);
      }
      finalColor += phong(N, pointL, V, u_pointColor[i], base) * attenuation;
    }
  }

  finalColor += u_emissive;

  if (u_fogDensity > 0.0) {
    float d = length(u_cameraPosition - v_worldPosition) * u_fogDensity;
    finalColor = mix(u_fogColor, finalColor, exp(-d * d));
  }

  if (u_highlight > 0.0) {
    finalColor = mix(finalColor, vec3(1.0, 0.55, 0.08), 0.5 * u_highlight);
  }

  outColor = vec4(finalColor, 1.0);
}
`;

const shadowVertexSource = `#version 300 es

layout(location = 0) in vec3 a_position;
layout(location = 2) in vec2 a_texCoord;

uniform mat4 u_model;
uniform mat4 u_lightSpace;
uniform vec2 u_uvScale;

out vec2 v_texCoord;

void main() {
  v_texCoord = a_texCoord * u_uvScale;
  gl_Position = u_lightSpace * u_model * vec4(a_position, 1.0);
}
`;

const shadowFragmentSource = `#version 300 es

precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform float u_alphaCut;

out vec4 outColor;

void main() {
  if (u_alphaCut > 0.0 && texture(u_texture, v_texCoord).a < u_alphaCut) discard;
  outColor = vec4(1.0);
}
`;

// ─── Shader Helper ────────────────────────────────────────────────────────────

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error("Shader compile error:\n" + info);
  }
  return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const program = gl.createProgram();
  gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error("Program link error:\n" + info);
  }
  return program;
}

function uniformLocations(program, names) {
  const locations = {};
  for (const name of names) locations[name] = gl.getUniformLocation(program, "u_" + name);
  return locations;
}

const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
const shadowProgram = createProgram(gl, shadowVertexSource, shadowFragmentSource);

const u = uniformLocations(program, [
  "model", "view", "projection", "lightSpace", "normalMatrix", "uvScale", "time", "wind",
  "lightPosition", "lightColor", "cameraPosition", "skyAmbient", "groundAmbient",
  "ambientStrength", "diffuseStrength", "specularStrength", "shininess", "translucency",
  "pointLightCount", "texture", "useTexture", "color", "emissive", "alphaCut", "unlit", "macro",
  "shadowMap", "shadowEnabled", "shadowTexel", "fogColor", "fogDensity", "highlight",
]);

const pointLightUniforms = {
  position: gl.getUniformLocation(program, "u_pointPosition"),
  color: gl.getUniformLocation(program, "u_pointColor"),
  direction: gl.getUniformLocation(program, "u_pointDirection"),
  cutoff: gl.getUniformLocation(program, "u_pointCutoff"),
  range: gl.getUniformLocation(program, "u_pointRange"),
};

const uShadow = uniformLocations(shadowProgram, ["model", "lightSpace", "uvScale", "texture", "alphaCut"]);

// ─── State Rendering ──────────────────────────────────────────────────────────

const renderState = {
  flatShading: false,
  textureEnabled: true,
  shadowEnabled: true,
  depthTest: true,
  wireframe: false,
  ambientOn: true,
  diffuseOn: true,
  specularOn: true,
  ambientScale: 1,
  diffuseScale: 1,
  specularScale: 1,
  shininessScale: 1,
  uvScale: 1,
  filterMode: "LINEAR_MIPMAP_LINEAR",
  wrapIndex: 0,
  drawCalls: 0,
};

const wrapModes = ["REPEAT", "CLAMP_TO_EDGE", "MIRRORED_REPEAT"];

// ─── Mesh → Buffer ────────────────────────────────────────────────────────────

function createArrayBuffer(data) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}

function setupAttribute(buffer, location, size) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
}

// Face normal untuk flat shading: satu normal per segitiga (praktikum 06).
// Arahnya disamakan dengan vertex normal agar tidak bergantung urutan vertex.
function computeFlatNormals(positions, normals) {
  const flat = new Float32Array(normals.length);
  for (let i = 0; i < positions.length; i += 9) {
    const a = [positions[i], positions[i + 1], positions[i + 2]];
    const b = [positions[i + 3], positions[i + 4], positions[i + 5]];
    const c = [positions[i + 6], positions[i + 7], positions[i + 8]];
    let n = Vec3.normalize(Vec3.cross(Vec3.subtract(b, a), Vec3.subtract(c, a)));
    const reference = [
      normals[i] + normals[i + 3] + normals[i + 6],
      normals[i + 1] + normals[i + 4] + normals[i + 7],
      normals[i + 2] + normals[i + 5] + normals[i + 8],
    ];
    if (Vec3.dot(n, reference) < 0) n = Vec3.scale(n, -1);
    for (let k = 0; k < 3; k += 1) {
      flat[i + k * 3] = n[0];
      flat[i + k * 3 + 1] = n[1];
      flat[i + k * 3 + 2] = n[2];
    }
  }
  return flat;
}

// Setiap mesh punya dua VAO (praktikum 04): normal smooth dan normal flat
function uploadMesh(data, mode) {
  const positions = new Float32Array(data.positions);
  const normals = new Float32Array(data.normals);
  const uvs = new Float32Array(data.uvs);

  const positionBuffer = createArrayBuffer(positions);
  const smoothBuffer = createArrayBuffer(normals);
  const flatBuffer = mode ? smoothBuffer : createArrayBuffer(computeFlatNormals(positions, normals));
  const uvBuffer = createArrayBuffer(uvs);

  const makeVao = (normalBuffer) => {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    setupAttribute(positionBuffer, 0, 3);
    setupAttribute(normalBuffer, 1, 3);
    setupAttribute(uvBuffer, 2, 2);
    gl.bindVertexArray(null);
    return vao;
  };

  return {
    vaoSmooth: makeVao(smoothBuffer),
    vaoFlat: makeVao(flatBuffer),
    count: positions.length / 3,
    mode: mode || gl.TRIANGLES,
  };
}

// ─── Texture ──────────────────────────────────────────────────────────────────

const allTextures = [];

function createTexture(source, options = {}) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.generateMipmap(gl.TEXTURE_2D);

  const entry = { texture, tile: Boolean(options.tile) };
  allTextures.push(entry);
  applyTextureState(entry);
  return texture;
}

function applyTextureState(entry) {
  gl.bindTexture(gl.TEXTURE_2D, entry.texture);

  const minFilter = gl[renderState.filterMode];
  const magFilter = renderState.filterMode === "NEAREST" ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);

  // Hanya texture berulang (jalan, tanah) yang ikut berganti mode wrapping
  const wrap = entry.tile ? gl[wrapModes[renderState.wrapIndex]] : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);

  if (anisotropyExtension) {
    const maxAnisotropy = gl.getParameter(anisotropyExtension.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
    const value = renderState.filterMode === "LINEAR_MIPMAP_LINEAR" ? Math.min(8, maxAnisotropy) : 1;
    gl.texParameterf(gl.TEXTURE_2D, anisotropyExtension.TEXTURE_MAX_ANISOTROPY_EXT, value);
  }
}

function applyAllTextureState() {
  allTextures.forEach(applyTextureState);
}

const whiteTexture = (() => {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  return texture;
})();

// ─── Material ─────────────────────────────────────────────────────────────────

function createMaterial(props) {
  return Object.assign(
    {
      texture: null,
      color: [1, 1, 1],
      emissive: [0, 0, 0],
      diffuse: 1,
      specular: 0.1,
      shininess: 32,
      alphaCut: 0,
      uvScale: [1, 1],
      tileWithState: false,
      unlit: false,
      noFog: false,
      noShadow: false,
      translucency: 0,
      wind: 0,
      macro: 0,
    },
    props
  );
}

let activeMaterial = null;

function useMaterial(material) {
  if (material === activeMaterial) return;
  activeMaterial = material;

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, material.texture || whiteTexture);
  gl.uniform1i(u.useTexture, material.texture && renderState.textureEnabled ? 1 : 0);

  gl.uniform3fv(u.color, material.color);
  gl.uniform3fv(u.emissive, material.emissive);
  gl.uniform1f(u.diffuseStrength, material.diffuse * (renderState.diffuseOn ? renderState.diffuseScale : 0));
  gl.uniform1f(u.specularStrength, material.specular * (renderState.specularOn ? renderState.specularScale : 0));
  gl.uniform1f(u.shininess, material.shininess * renderState.shininessScale);
  gl.uniform1f(u.alphaCut, renderState.textureEnabled || material.alphaCut === 0 ? material.alphaCut : 0);
  gl.uniform1i(u.unlit, material.unlit ? 1 : 0);
  gl.uniform1f(u.translucency, material.translucency);
  gl.uniform1f(u.wind, material.wind);
  gl.uniform1f(u.macro, material.macro);
  gl.uniform1f(u.fogDensity, material.noFog ? 0 : frameLighting.fogDensity);

  const uvScale = material.tileWithState ? renderState.uvScale : 1;
  gl.uniform2f(u.uvScale, material.uvScale[0] * uvScale, material.uvScale[1] * uvScale);
}

// ─── Shadow Map (di luar materi praktikum) ────────────────────────────────────
// Scene digambar sekali dari arah matahari ke depth texture, lalu fragment
// shader membandingkan kedalaman untuk menentukan terkena cahaya atau tidak.

const SHADOW_SIZE = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE));

const shadowDepthTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, shadowDepthTexture);
gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SHADOW_SIZE, SHADOW_SIZE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);

const shadowFramebuffer = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowDepthTexture, 0);
gl.drawBuffers([gl.NONE]);
gl.readBuffer(gl.NONE);
gl.bindFramebuffer(gl.FRAMEBUFFER, null);

// ─── Draw Call ────────────────────────────────────────────────────────────────

// Nilai pass: "update" hanya menghitung world matrix, "shadow" ke shadow map,
// "main" ke layar. Ketiganya memakai traverse() yang sama.
let renderPass = "update";
let currentHighlight = 0;
let lastHighlightSent = -1;

// Sama seperti torso() pada figure.js: instanceMatrix hanya berlaku untuk bagian
// ini dan tidak diwariskan ke child.
function drawPart(mesh, material, instanceMatrix) {
  if (renderPass === "update") return;

  const world = instanceMatrix ? Mat4.multiply(modelMatrix, instanceMatrix) : modelMatrix;

  if (renderPass === "shadow") {
    if (material.noShadow || mesh.mode !== gl.TRIANGLES) return;
    gl.uniformMatrix4fv(uShadow.model, false, world);
    if (material.alphaCut > 0) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, material.texture);
      gl.uniform1f(uShadow.alphaCut, material.alphaCut);
      gl.uniform2fv(uShadow.uvScale, material.uvScale);
    } else {
      gl.uniform1f(uShadow.alphaCut, 0);
    }
    gl.bindVertexArray(mesh.vaoSmooth);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    renderState.drawCalls += 1;
    return;
  }

  useMaterial(material);
  gl.uniformMatrix4fv(u.model, false, world);
  gl.uniformMatrix3fv(u.normalMatrix, false, normalMatrixFromMat4(world));

  const highlight = currentHighlight > 0 ? 1 : 0;
  if (highlight !== lastHighlightSent) {
    gl.uniform1f(u.highlight, highlight);
    lastHighlightSent = highlight;
  }

  gl.bindVertexArray(renderState.flatShading ? mesh.vaoFlat : mesh.vaoSmooth);
  const mode = renderState.wireframe && mesh.mode === gl.TRIANGLES ? gl.LINE_STRIP : mesh.mode;
  gl.drawArrays(mode, 0, mesh.count);
  renderState.drawCalls += 1;
}
