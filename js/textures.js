// textures.js — Texture prosedural dengan Canvas 2D
// Seperti createCheckerTexture() praktikum 06: digambar dengan kode sehingga tidak
// butuh file gambar dan tidak terkena CORS saat index.html dibuka langsung.
// Warna dan tata letak diambil dari foto di folder gallery.

"use strict";

function makeCanvas(width, height) {
  const source = document.createElement("canvas");
  source.width = width;
  source.height = height;
  return { source, ctx: source.getContext("2d"), width, height };
}

// Texture ber-alpha: piksel transparan diberi warna tetangganya. Kalau tidak,
// warna hitam di area transparan ikut tercampur saat mipmap dan tepi daun menggelap.
function bleedTransparentPixels(ctx, width, height, color) {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) {
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
    }
  }
  return image;
}

// Menggambar ulang di sisi seberang supaya texture menyambung saat di-REPEAT
function drawWrapped(x, y, margin, width, height, draw) {
  const xs = [x];
  if (x < margin) xs.push(x + width);
  if (x > width - margin) xs.push(x - width);
  const ys = [y];
  if (y < margin) ys.push(y + height);
  if (y > height - margin) ys.push(y - height);
  for (const px of xs) {
    for (const py of ys) draw(px, py);
  }
}

function rgb(hex, shade = 1) {
  const value = parseInt(hex.slice(1), 16);
  const r = clamp(((value >> 16) & 255) * shade, 0, 255);
  const g = clamp(((value >> 8) & 255) * shade, 0, 255);
  const b = clamp((value & 255) * shade, 0, 255);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function speckle(ctx, width, height, count, random, colors, maxSize = 2) {
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = random.pick(colors);
    const size = random.range(0.5, maxSize);
    ctx.fillRect(random() * width, random() * height, size, size);
  }
}

// ─── Permukaan Jalan ──────────────────────────────────────────────────────────

// Paving herringbone. Satuan u = setengah panjang bata; pola menyambung tiap 4u.
function paverTexture() {
  const size = 1024;
  const { source, ctx } = makeCanvas(size, size);
  const random = createRandom(11);
  const cells = 16;
  const u = size / cells;

  ctx.fillStyle = "#3b3c3e";
  ctx.fillRect(0, 0, size, size);

  const drawBrick = (x, y, w, h) => {
    const shade = random.range(0.86, 1.1);
    const warm = random() < 0.1 ? "#7c7470" : "#73757a";
    ctx.fillStyle = rgb(warm, shade);
    for (const ox of [0, -size, size]) {
      for (const oy of [0, -size, size]) {
        ctx.fillRect(x + ox + 1.5, y + oy + 1.5, w - 3, h - 3);
      }
    }
  };

  for (let x = 0; x < cells; x += 1) {
    for (let y = 0; y < cells; y += 1) {
      const c = ((x - y) % 4 + 4) % 4;
      if (c === 0) drawBrick(x * u, y * u, u * 2, u);
      if (c === 3) drawBrick(x * u, y * u, u, u * 2);
    }
  }

  speckle(ctx, size, size, 9000, random, ["rgba(30,30,32,0.28)", "rgba(190,190,190,0.1)", "rgba(90,85,80,0.22)"], 2.4);
  return source;
}

// Strip paving lurus di tepi jalan, sejajar curb
function gutterTexture() {
  const size = 512;
  const { source, ctx } = makeCanvas(size, size);
  const random = createRandom(21);
  ctx.fillStyle = "#413f3d";
  ctx.fillRect(0, 0, size, size);

  const rows = 4;
  const columns = 8;
  const brickW = size / rows;
  const brickH = size / columns;
  for (let row = 0; row < rows; row += 1) {
    for (let column = -1; column <= columns; column += 1) {
      const offset = row % 2 === 0 ? 0 : brickH / 2;
      ctx.fillStyle = rgb("#6d6862", random.range(0.82, 1.08));
      ctx.fillRect(row * brickW + 1.5, column * brickH + offset + 1.5, brickW - 3, brickH - 3);
    }
  }
  speckle(ctx, size, size, 3500, random, ["rgba(30,28,25,0.3)", "rgba(150,135,110,0.14)"], 2.6);
  return source;
}

// Blok curb: separuh kiri kuning, separuh kanan abu kebiruan, dengan noda kotor
function curbTexture() {
  const width = 512;
  const height = 256;
  const { source, ctx } = makeCanvas(width, height);
  const random = createRandom(31);

  ctx.fillStyle = "#e0b52c";
  ctx.fillRect(0, 0, width / 2, height);
  ctx.fillStyle = "#4b525b";
  ctx.fillRect(width / 2, 0, width / 2, height);

  for (let i = 0; i < 120; i += 1) {
    const dark = random() < 0.7;
    ctx.fillStyle = dark ? "rgba(70,60,40,0.12)" : "rgba(255,255,255,0.05)";
    ctx.beginPath();
    ctx.ellipse(random() * width, random() * height, random.range(4, 30), random.range(3, 14), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const dirt = ctx.createLinearGradient(0, 0, 0, height);
  dirt.addColorStop(0, "rgba(60,48,30,0)");
  dirt.addColorStop(1, "rgba(60,48,30,0.55)");
  ctx.fillStyle = dirt;
  ctx.fillRect(0, height * 0.5, width, height * 0.5);

  speckle(ctx, width, height, 2500, random, ["rgba(40,35,25,0.22)", "rgba(255,245,210,0.08)"], 2.2);
  return source;
}

function drawLeaf(ctx, x, y, length, angle, color) {
  const width = length * 0.36;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = "rgba(25,18,10,0.35)";
  ctx.beginPath();
  ctx.ellipse(1.2, 1.6, length * 0.5, width * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-length * 0.5, 0);
  ctx.quadraticCurveTo(0, -width, length * 0.5, 0);
  ctx.quadraticCurveTo(0, width, -length * 0.5, 0);
  ctx.fill();
  ctx.strokeStyle = "rgba(40,22,10,0.5)";
  ctx.lineWidth = Math.max(0.6, length * 0.03);
  ctx.beginPath();
  ctx.moveTo(-length * 0.5, 0);
  ctx.lineTo(length * 0.5, 0);
  ctx.stroke();
  ctx.restore();
}

// Tanah median: rumput kering kekuningan dan daun coklat berserakan seperti foto
function litterTexture() {
  const size = 2048;
  const { source, ctx } = makeCanvas(size, size);
  const random = createRandom(41);

  ctx.fillStyle = "#a8945e";
  ctx.fillRect(0, 0, size, size);

  // Bercak tanah dan rumput skala besar
  const patches = ["#b8a66e", "#93824f", "#a7a05e", "#8a7c48", "#c4b27a", "#7e7c45"];
  for (let i = 0; i < 900; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const r = random.range(30, 150);
    const color = random.pick(patches);
    drawWrapped(x, y, r, size, size, (px, py) => {
      const gradient = ctx.createRadialGradient(px, py, 0, px, py, r);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = gradient;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
    });
  }

  // Helai rumput kering
  const grass = ["#c4b274", "#ad9f60", "#9b9750", "#858a44", "#d1be80", "#94834a", "#79803f"];
  ctx.lineCap = "round";
  for (let i = 0; i < 26000; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const angle = random() * Math.PI * 2;
    const length = random.range(5, 20);
    ctx.strokeStyle = random.pick(grass);
    ctx.lineWidth = random.range(0.7, 1.7);
    ctx.globalAlpha = random.range(0.45, 0.95);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Daun gugur: lebih rapat di beberapa kelompok
  const leaves = ["#85603a", "#9c6f3e", "#6c4c2e", "#b0824c", "#a1743f", "#775735", "#bd9659", "#8e6638", "#5d4530"];
  const clusters = [];
  for (let i = 0; i < 26; i += 1) clusters.push([random() * size, random() * size, random.range(120, 330)]);
  for (let i = 0; i < 9000; i += 1) {
    let x = random() * size;
    let y = random() * size;
    if (random() < 0.68) {
      const cluster = random.pick(clusters);
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * cluster[2];
      x = (cluster[0] + Math.cos(angle) * distance + size) % size;
      y = (cluster[1] + Math.sin(angle) * distance + size) % size;
    }
    const length = random.range(9, 25);
    const leafAngle = random() * Math.PI * 2;
    const color = random.pick(leaves);
    drawWrapped(x, y, 18, size, size, (px, py) => drawLeaf(ctx, px, py, length, leafAngle, color));
  }
  return source;
}

function lawnTexture() {
  const size = 1024;
  const { source, ctx } = makeCanvas(size, size);
  const random = createRandom(51);
  ctx.fillStyle = "#6f8a3c";
  ctx.fillRect(0, 0, size, size);
  const colors = ["#7f9a44", "#5d7a33", "#8ea650", "#4f6c2c", "#94a44f", "#a4a55c"];
  ctx.lineCap = "round";
  for (let i = 0; i < 30000; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const angle = -Math.PI / 2 + random.range(-0.7, 0.7);
    const length = random.range(4, 13);
    ctx.strokeStyle = random.pick(colors);
    ctx.lineWidth = random.range(0.6, 1.5);
    ctx.globalAlpha = random.range(0.5, 1);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return source;
}

// Aspal berdebu di belakang saluran (latar foto ketiga)
function dustyRoadTexture() {
  const size = 1024;
  const { source, ctx } = makeCanvas(size, size);
  const random = createRandom(61);
  ctx.fillStyle = "#a59b89";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const r = random.range(40, 170);
    const color = random.pick(["#b2a896", "#968d7e", "#baaf9c", "#a09685"]);
    drawWrapped(x, y, r, size, size, (px, py) => {
      const gradient = ctx.createRadialGradient(px, py, 0, px, py, r);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = gradient;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
    });
  }
  speckle(ctx, size, size, 12000, random, ["rgba(90,84,74,0.14)", "rgba(190,180,162,0.16)", "rgba(70,66,58,0.08)"], 2.0);
  return source;
}

function concreteTexture() {
  const size = 512;
  const { source, ctx } = makeCanvas(size, size);
  const random = createRandom(71);
  ctx.fillStyle = "#94928a";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 130; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const r = random.range(18, 90);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, random() < 0.7 ? "rgba(62,62,52,0.26)" : "rgba(190,188,176,0.2)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  speckle(ctx, size, size, 7000, random, ["rgba(50,50,45,0.25)", "rgba(235,232,220,0.15)"], 1.8);
  return source;
}

// ─── Pohon ────────────────────────────────────────────────────────────────────

// Kulit kayu pecah-pecah memanjang seperti batang pohon pada foto
function barkTexture() {
  const size = 1024;
  const { source, ctx } = makeCanvas(size, size);
  const random = createRandom(81);

  ctx.fillStyle = "#a18f77";
  ctx.fillRect(0, 0, size, size);

  // Lempeng kulit kayu: bercak memanjang terang dan gelap
  for (let i = 0; i < 620; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const w = random.range(16, 62);
    const h = random.range(40, 170);
    const tilt = random.range(-0.12, 0.12);
    ctx.fillStyle = random.pick(["rgba(190,175,150,0.3)", "rgba(120,104,84,0.26)", "rgba(150,146,128,0.24)", "rgba(205,192,168,0.2)", "rgba(136,116,92,0.3)"]);
    drawWrapped(x, y, 100, size, size, (px, py) => {
      ctx.beginPath();
      ctx.ellipse(px, py, w * 0.5, h * 0.5, tilt, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Retakan vertikal halus bergelombang
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < 240; i += 1) {
    let x = random() * size;
    let y = random() * size;
    const length = random.range(50, 240);
    ctx.strokeStyle = random() < 0.6 ? "rgba(56,44,34,0.62)" : "rgba(80,66,52,0.44)";
    ctx.lineWidth = random.range(1.4, 5.2);
    const points = [[x, y]];
    const steps = Math.ceil(length / 11);
    for (let s = 0; s < steps; s += 1) {
      x += random.range(-5, 5);
      y += 11;
      points.push([x, y]);
    }
    for (const ox of [0, -size, size]) {
      for (const oy of [0, -size]) {
        ctx.beginPath();
        points.forEach((p, index) => (index === 0 ? ctx.moveTo(p[0] + ox, p[1] + oy) : ctx.lineTo(p[0] + ox, p[1] + oy)));
        ctx.stroke();
      }
    }
  }

  // Retakan mendatar pendek
  for (let i = 0; i < 420; i += 1) {
    const x = random() * size;
    const y = random() * size;
    ctx.strokeStyle = "rgba(70,56,44,0.28)";
    ctx.lineWidth = random.range(0.7, 1.8);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + random.range(8, 30), y + random.range(-5, 5));
    ctx.stroke();
  }

  speckle(ctx, size, size, 9000, random, ["rgba(50,40,30,0.16)", "rgba(220,208,186,0.14)"], 2.4);
  return source;
}

// Atlas 2×2 berisi rumpun daun majemuk. Warna tiap sel berbeda sedikit.
function leafAtlasTexture() {
  const size = 1024;
  const { ctx } = makeCanvas(size, size);
  const random = createRandom(91);
  const cell = size / 2;
  const palettes = [
    ["#7aa346", "#89b04e", "#6c963f", "#9aba58"],
    ["#90b751", "#a0c25c", "#80aa49", "#b2cc68"],
    ["#68943d", "#77a244", "#5c8837", "#88ae4c"],
    ["#82ac4a", "#97b955", "#739f43", "#aac662"],
  ];

  const drawCompoundLeaf = (x, y, angle, length, palette) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = "#6f7f3e";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(length, 0);
    ctx.stroke();

    const pairs = 4 + Math.floor(random() * 3);
    for (let i = 0; i < pairs; i += 1) {
      const t = (i + 0.7) / (pairs + 0.3);
      const px = t * length;
      const leafletLength = length * 0.44 * (1 - 0.3 * t);
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(px, 0);
        ctx.rotate(side * random.range(0.6, 1.0));
        ctx.fillStyle = random.pick(palette);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(leafletLength * 0.5, -leafletLength * 0.22, leafletLength, 0);
        ctx.quadraticCurveTo(leafletLength * 0.5, leafletLength * 0.22, 0, 0);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.fillStyle = random.pick(palette);
    ctx.beginPath();
    ctx.ellipse(length + length * 0.14, 0, length * 0.17, length * 0.065, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 2; column += 1) {
      const palette = palettes[row * 2 + column];
      const cx = column * cell + cell / 2;
      const cy = row * cell + cell / 2;
      const count = 7;
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + random.range(-0.35, 0.35);
        const start = random.range(10, 60);
        drawCompoundLeaf(
          cx + Math.cos(angle) * start,
          cy + Math.sin(angle) * start,
          angle,
          random.range(cell * 0.22, cell * 0.31),
          palette
        );
      }
    }
  }
  return bleedTransparentPixels(ctx, size, size, [125, 165, 70]);
}

// Empat daun kering dengan alpha, untuk daun di jalan dan daun yang jatuh
function fallenLeafTexture() {
  const size = 512;
  const { ctx } = makeCanvas(size, size);
  const colors = ["#8c5526", "#b57a3a", "#6e4a2a", "#a5692f"];
  colors.forEach((color, index) => {
    const x = (index % 2) * 256 + 128;
    const y = Math.floor(index / 2) * 256 + 128;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.6 + index);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-104, 0);
    ctx.quadraticCurveTo(0, -56, 104, 0);
    ctx.quadraticCurveTo(0, 56, -104, 0);
    ctx.fill();
    ctx.strokeStyle = "rgba(40,22,10,0.6)";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-104, 0);
    ctx.lineTo(104, 0);
    for (let k = -3; k <= 3; k += 1) {
      ctx.moveTo(k * 24, 0);
      ctx.lineTo(k * 24 + 18, -26 + Math.abs(k) * 5);
      ctx.moveTo(k * 24, 0);
      ctx.lineTo(k * 24 + 18, 26 - Math.abs(k) * 5);
    }
    ctx.stroke();
    ctx.restore();
  });
  return bleedTransparentPixels(ctx, size, size, [120, 80, 40]);
}

function grassTuftTexture() {
  const size = 512;
  const { ctx } = makeCanvas(size, size);
  const random = createRandom(101);
  const colors = ["#7f8a42", "#8f9447", "#6d7c3a", "#a29c58", "#b4a766", "#747f3b", "#94884a"];
  ctx.lineCap = "round";
  for (let i = 0; i < 46; i += 1) {
    const x = size * 0.5 + random.range(-size * 0.3, size * 0.3);
    const height = random.range(size * 0.38, size * 0.95);
    const bend = random.range(-110, 110);
    ctx.strokeStyle = random.pick(colors);
    ctx.lineWidth = random.range(2.5, 5.5);
    ctx.beginPath();
    ctx.moveTo(x, size);
    ctx.quadraticCurveTo(x + bend * 0.15, size - height * 0.6, x + bend, size - height);
    ctx.stroke();
  }
  return bleedTransparentPixels(ctx, size, size, [125, 135, 70]);
}

function palmFrondTexture() {
  const width = 256;
  const height = 1024;
  const { ctx } = makeCanvas(width, height);
  const random = createRandom(111);
  const colors = ["#4c7a3c", "#588843", "#44703a", "#65944b"];
  ctx.lineCap = "round";
  for (let y = 12; y < height - 10; y += 15) {
    const t = y / height;
    const spread = Math.sin(Math.min(1, t * 1.12) * Math.PI) * width * 0.47 + 9;
    for (const side of [-1, 1]) {
      ctx.strokeStyle = random.pick(colors);
      ctx.lineWidth = random.range(8, 12.5);
      ctx.beginPath();
      ctx.moveTo(width / 2, y);
      ctx.quadraticCurveTo(width / 2 + side * spread * 0.55, y + 8, width / 2 + side * spread, y + 40 + random.range(-4, 10));
      ctx.stroke();
    }
  }
  ctx.strokeStyle = "#7c8a44";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();
  return bleedTransparentPixels(ctx, width, height, [76, 118, 60]);
}

// Barisan pepohonan jauh untuk latar belakang
function treelineTexture() {
  const width = 2048;
  const height = 512;
  const { ctx } = makeCanvas(width, height);
  const random = createRandom(121);
  const greens = ["#4f7a3e", "#5c8646", "#6a9450", "#44703a", "#789e58", "#86a862"];

  // Gumpalan kecil berlapis supaya terlihat seperti tajuk pohon, bukan bukit
  for (let i = 0; i < 9000; i += 1) {
    const x = random() * width;
    const profile = 0.42 + 0.2 * Math.sin(x * 0.0123 + 1.3) + 0.14 * Math.sin(x * 0.041) + 0.08 * Math.sin(x * 0.097);
    const y = random.range(height * (1 - profile), height);
    const r = random.range(3, 12);
    ctx.fillStyle = rgb(random.pick(greens), 0.82 + 0.34 * (1 - y / height));
    for (const ox of [0, -width, width]) {
      ctx.beginPath();
      ctx.arc(x + ox, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return bleedTransparentPixels(ctx, width, height, [85, 125, 70]);
}

// ─── Langit ───────────────────────────────────────────────────────────────────

function skyTexture() {
  const width = 2048;
  const height = 1024;
  const { source, ctx } = makeCanvas(width, height);
  const random = createRandom(131);

  const gradient = ctx.createLinearGradient(0, 0, 0, height / 2);
  gradient.addColorStop(0, "#2d77c8");
  gradient.addColorStop(0.5, "#4490d8");
  gradient.addColorStop(0.8, "#7fb8e6");
  gradient.addColorStop(1, "#d3e6f4");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#cdd8dd";
  ctx.fillRect(0, height / 2, width, height / 2);

  const puff = (x, y, rx, ry, alpha) => {
    for (const ox of [0, -width, width]) {
      const gradientCloud = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      gradientCloud.addColorStop(0, `rgba(255,255,255,${alpha})`);
      gradientCloud.addColorStop(1, "rgba(255,255,255,0)");
      ctx.save();
      ctx.translate(x + ox, y);
      ctx.scale(rx, ry);
      ctx.fillStyle = gradientCloud;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
  };

  // Awan tipis memanjang (langit foto pertama)
  for (let i = 0; i < 52; i += 1) {
    const cx = random() * width;
    const cy = random.range(height * 0.1, height * 0.46);
    const count = 12 + Math.floor(random() * 20);
    const tilt = random.range(-0.2, 0.2);
    const reach = random.range(90, 260);
    for (let k = 0; k < count; k += 1) {
      const dx = random.range(-reach, reach);
      puff(cx + dx, cy + dx * tilt + random.range(-7, 7), random.range(40, 130), random.range(3, 10), random.range(0.05, 0.2));
    }
  }

  // Awan gumpal tipis dekat cakrawala
  for (let i = 0; i < 18; i += 1) {
    const cx = random() * width;
    const cy = random.range(height * 0.42, height * 0.49);
    for (let k = 0; k < 12; k += 1) {
      puff(cx + random.range(-100, 100), cy + random.range(-10, 10), random.range(24, 70), random.range(6, 16), random.range(0.12, 0.34));
    }
  }
  return source;
}

// ─── Papan Halte iCAR ─────────────────────────────────────────────────────────

function drawIcarLogo(ctx, cx, cy, rx, ry) {
  ctx.fillStyle = "#f4f4ee";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 1.05, ry * 1.09, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2f5f9e";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = ry * 0.05;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.88, ry * 0.82, 0, Math.PI * 0.62, Math.PI * 1.25);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = `italic 800 ${ry * 0.92}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("iCAR", cx, cy - ry * 0.12);

  ctx.font = `600 ${ry * 0.24}px Arial, sans-serif`;
  ctx.fillText("Intelligent Car", cx, cy + ry * 0.55);
}

// Ilustrasi iCAR hitam-putih seperti foto pada papan asli
function drawIcarIllustration(ctx, x, y, width, height) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width / 345, height / 380);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Koordinat mengikuti foto mobil pada crop papan (px − 190, py − 575)
  const shape = (points, fill) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    points.forEach((p, index) => {
      if (index === 0) ctx.moveTo(p[0], p[1]);
      else if (p.length === 4) ctx.quadraticCurveTo(p[0], p[1], p[2], p[3]);
      else ctx.lineTo(p[0], p[1]);
    });
    ctx.closePath();
    ctx.fill();
  };

  // Lantai kabin dan kursi hitam terlihat lewat jendela
  shape([[32, 134], [142, 148], [340, 150], [340, 164], [32, 156]], "#26282a");
  shape([[34, 118], [84, 121], [86, 150], [34, 148]], "#34373a");

  // Pilar belakang, pilar tengah, dan pilar hitam depan
  shape([[20, 88], [33, 82], [36, 152], [24, 150]], "#c9cccd");
  shape([[132, 74], [149, 70], [153, 156], [136, 154]], "#d4d6d7");
  shape([[149, 72], [161, 70], [164, 156], [153, 156]], "#191b1d");
  shape([[286, 62], [311, 60], [310, 160], [284, 158]], "#141618");
  shape([[311, 60], [322, 58], [326, 160], [310, 160]], "#c4c7c8");

  // Atap melengkung dengan sisi bawah abu
  shape([[14, 92], [36, 62, 104, 44], [218, 24], [300, 26], [340, 34, 326, 56], [270, 54], [140, 66], [58, 74, 28, 98]], "#e1e3e3");
  shape([[28, 98], [58, 74, 140, 66], [270, 54], [326, 56], [322, 66], [150, 80], [68, 86, 34, 104]], "#8f9295");

  // Sensor: dudukan hitam, kamera, kubah
  shape([[218, 26], [270, 22], [292, 28], [240, 34]], "#2a2c2f");
  ctx.fillStyle = "#4c4f52";
  ctx.fillRect(252, 6, 6, 24);
  ctx.fillStyle = "#6e7276";
  ctx.beginPath();
  ctx.ellipse(255, 7, 26, 4, -0.05, 0, Math.PI * 2);
  ctx.fill();
  shape([[258, 22], [296, 18], [300, 34], [262, 38]], "#55585b");

  // Setir
  ctx.strokeStyle = "#191b1d";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(196, 150, 26, 8, -0.12, 0, Math.PI * 2);
  ctx.stroke();

  // Badan: sisi samping lebih gelap dari muka depan
  const side = ctx.createLinearGradient(0, 160, 0, 345);
  side.addColorStop(0, "#dfe1e1");
  side.addColorStop(0.55, "#c6c9ca");
  side.addColorStop(1, "#9ea2a4");
  shape([[8, 152], [146, 160], [150, 356], [106, 358], [46, 326], [14, 262]], side);

  const front = ctx.createLinearGradient(0, 160, 0, 325);
  front.addColorStop(0, "#f2f3f3");
  front.addColorStop(1, "#d3d6d7");
  shape([[146, 160], [326, 158], [344, 172, 342, 206], [336, 300], [326, 322, 296, 324], [150, 356]], front);

  // Lengkung roda dan roda
  ctx.fillStyle = "#6f7274";
  ctx.beginPath();
  ctx.ellipse(120, 300, 42, 58, 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#17181a";
  ctx.beginPath();
  ctx.ellipse(120, 318, 32, 56, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#a6aaad";
  ctx.beginPath();
  ctx.ellipse(122, 318, 19, 36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6c7073";
  ctx.beginPath();
  ctx.ellipse(122, 318, 7, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#17181a";
  ctx.beginPath();
  ctx.ellipse(21, 240, 13, 31, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#94989b";
  ctx.beginPath();
  ctx.ellipse(21, 240, 7, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Garis hitam di sisi samping
  ctx.strokeStyle = "#232527";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(10, 180);
  ctx.quadraticCurveTo(90, 192, 146, 214);
  ctx.stroke();

  // Tulisan iCAR pada sisi dan depan
  ctx.fillStyle = "#3a3e42";
  ctx.font = "italic 800 25px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.translate(82, 202);
  ctx.rotate(0.11);
  ctx.fillText("iCAR", 0, 0);
  ctx.restore();
  ctx.font = "700 15px Arial, sans-serif";
  ctx.fillText("iCAR", 256, 306);
  ctx.font = "600 9px Arial, sans-serif";
  ctx.fillText("Intelligent Autonomous", 196, 180);
  ctx.fillText("Electric Car", 232, 192);

  // Grille hitam, lampu, dan dua bar putih
  ctx.fillStyle = "#121315";
  ctx.beginPath();
  ctx.roundRect(204, 222, 138, 72, 20);
  ctx.fill();
  ctx.fillStyle = "#c7cacb";
  ctx.beginPath();
  ctx.arc(232, 258, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a2d30";
  ctx.beginPath();
  ctx.arc(232, 258, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#edeeef";
  ctx.beginPath();
  ctx.roundRect(268, 234, 64, 13, 6);
  ctx.roundRect(265, 263, 66, 13, 6);
  ctx.fill();
  ctx.fillStyle = "#b3b6b8";
  ctx.beginPath();
  ctx.arc(188, 262, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawQrCode(ctx, x, y, size, seed) {
  const random = createRandom(seed);
  const modules = 25;
  const cell = size / modules;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#111111";
  const inFinder = (i, j) =>
    (i < 8 && j < 8) || (i >= modules - 8 && j < 8) || (i < 8 && j >= modules - 8);
  for (let i = 0; i < modules; i += 1) {
    for (let j = 0; j < modules; j += 1) {
      if (!inFinder(i, j) && random() < 0.5) ctx.fillRect(x + i * cell, y + j * cell, cell + 0.4, cell + 0.4);
    }
  }
  for (const [i, j] of [[0, 0], [modules - 7, 0], [0, modules - 7]]) {
    ctx.fillRect(x + i * cell, y + j * cell, cell * 7, cell * 7);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + (i + 1) * cell, y + (j + 1) * cell, cell * 5, cell * 5);
    ctx.fillStyle = "#111111";
    ctx.fillRect(x + (i + 2) * cell, y + (j + 2) * cell, cell * 3, cell * 3);
  }
}

// Koordinat diambil dari crop foto papan (px, py), lalu dipetakan ke ukuran canvas
function signFaceTexture() {
  const width = 1024;
  const height = 2264;
  const { source, ctx } = makeCanvas(width, height);
  const random = createRandom(141);
  const fx = (px) => ((px - 25) / 655) * width;
  const fy = (py) => ((py - 20) / 1610) * height;
  const fs = (px) => (px / 655) * width;

  ctx.fillStyle = "#ecead9";
  ctx.fillRect(0, 0, width, height);

  // Nomor halte
  ctx.fillStyle = "#285a97";
  ctx.font = `800 ${fs(130)}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("1", fx(370), fy(115));

  drawIcarLogo(ctx, fx(370), fy(298), fs(112), fs(66));

  // Nama halte
  ctx.fillStyle = "#b39a3f";
  ctx.font = `700 ${fs(58)}px "Trebuchet MS", Verdana, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Robotika", fx(370), fy(485));

  drawIcarIllustration(ctx, fx(190), fy(575), fs(345), fs(380));

  // Peta rute: loop biru dan loop hijau
  const drawRoute = (points, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = fs(8);
    ctx.lineJoin = "round";
    ctx.beginPath();
    points.forEach((p, index) => (index === 0 ? ctx.moveTo(fx(p[0]), fy(p[1])) : ctx.lineTo(fx(p[0]), fy(p[1]))));
    ctx.closePath();
    ctx.stroke();
  };

  drawRoute([[120, 1050], [143, 1045], [218, 1178], [197, 1210], [205, 1340], [165, 1495], [158, 1490], [185, 1340], [172, 1215], [155, 1205], [155, 1120]], "#1f5c9c");
  drawRoute([[350, 1090], [372, 1090], [372, 1188], [400, 1188], [400, 1345], [180, 1345], [178, 1220], [210, 1215], [212, 1322], [375, 1322], [375, 1210], [348, 1205]], "#2f9a63");

  const stop = (px, py) => {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#555a5e";
    ctx.lineWidth = fs(1.6);
    ctx.beginPath();
    ctx.arc(fx(px), fy(py), fs(6), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };

  const label = (text, px, py, align = "left", color = "#2c3034") => {
    ctx.fillStyle = color;
    ctx.font = `600 ${fs(15)}px Arial, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(text, fx(px), fy(py));
  };

  [[128, 1077], [155, 1072], [192, 1135], [175, 1238], [205, 1265], [165, 1445], [372, 1122], [345, 1168], [375, 1235], [398, 1258], [308, 1322], [283, 1345]]
    .forEach((p) => stop(p[0], p[1]));

  label("7- Teknik Lingkungan", 165, 1060);
  label("6- Gerbang", 115, 1078, "right");
  label("ITS", 115, 1098, "right");
  label("8- Rektorat", 202, 1128);
  label("5- Masjid", 160, 1232, "right");
  label("Manarul Ilmi", 160, 1252, "right");
  label("9- Kantin Pusat", 218, 1262);
  label("10- Tower 2", 275, 1298);
  label("3- Dassa B", 260, 1368);
  label("4- Asrama", 150, 1442, "right");
  label("1- Robotika", 385, 1122, "left", "#7d7341");
  label("12- Gedung", 335, 1166, "right");
  label("Riset", 335, 1186, "right");
  label("11- Block-U Barat", 368, 1232, "right");
  label("2- Block-U Timur", 410, 1258);

  // Kotak QR
  ctx.fillStyle = "#f1f1ea";
  ctx.strokeStyle = "#8c8f8e";
  ctx.lineWidth = fs(1.6);
  ctx.fillRect(fx(432), fy(1346), fs(216), fs(178));
  ctx.strokeRect(fx(432), fy(1346), fs(216), fs(178));
  drawQrCode(ctx, fx(438), fy(1352), fs(76), 7);
  drawQrCode(ctx, fx(438), fy(1438), fs(76), 19);
  ctx.fillStyle = "#2c3034";
  ctx.font = `600 ${fs(16)}px Arial, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("Website", fx(524), fy(1392));
  ctx.fillText("Mobile App", fx(524), fy(1476));

  // Baut di tepi papan
  ctx.fillStyle = "rgba(60,60,60,0.6)";
  for (const [px, py] of [[85, 70], [670, 178], [97, 410], [660, 875], [650, 1240], [40, 1058], [500, 1636]]) {
    ctx.beginPath();
    ctx.arc(fx(px), fy(py), fs(2.2), 0, Math.PI * 2);
    ctx.fill();
  }

  // Noda dan pudar akibat cuaca
  for (let i = 0; i < 70; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const r = random.range(40, 190);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, random() < 0.5 ? "rgba(255,255,255,0.03)" : "rgba(110,105,85,0.02)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return source;
}

// ─── Rambu dan Papan Informasi ────────────────────────────────────────────────

function speedSignTexture() {
  const size = 512;
  const { ctx } = makeCanvas(size, size);
  ctx.fillStyle = "#c62f2a";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.495, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f6f4ee";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.385, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.font = "700 170px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("30", size * 0.47, size * 0.53);
  ctx.font = "700 44px Arial, sans-serif";
  ctx.fillText("km", size * 0.76, size * 0.36);
  return bleedTransparentPixels(ctx, size, size, [200, 60, 50]);
}

// Spanduk vertikal tinggi di samping rambu 30 pada foto pertama
function bannerTexture() {
  const width = 256;
  const height = 1024;
  const { source, ctx } = makeCanvas(width, height);
  const random = createRandom(151);
  ctx.fillStyle = "#eef2f4";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#2c6cb2";
  ctx.fillRect(0, 0, width, 110);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 58px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ITS", width / 2, 56);

  for (let i = 0; i < 70; i += 1) {
    ctx.fillStyle = random.pick(["#e8c83d", "#d9b42e", "#4aa0d8", "#6cae5a", "#f0d65a"]);
    ctx.globalAlpha = random.range(0.5, 0.95);
    ctx.beginPath();
    ctx.arc(random() * width, random.range(190, 760), random.range(5, 24), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#2c6cb2";
  ctx.font = "700 30px Arial, sans-serif";
  ctx.fillText("Green", width / 2, 840);
  ctx.fillText("Campus", width / 2, 880);
  return source;
}

// Papan biru "Kawasan STP" pada foto kedua
function kawasanBoardTexture() {
  const width = 512;
  const height = 1024;
  const { source, ctx } = makeCanvas(width, height);

  ctx.fillStyle = "#eef1f2";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#1c6ea8";
  ctx.font = "800 50px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("KAWASAN STP", 22, 62);
  ctx.fillText("TIK - ROBOTIKA", 22, 128);

  const rows = [
    ["PUI", "Artificial Intelligence"],
    ["PUI", "Mechatronics"],
    ["5G Expo", ""],
    ["SMART", "City"],
  ];
  rows.forEach((row, index) => {
    const y = 190 + index * 205;
    ctx.fillStyle = "#1565b6";
    ctx.fillRect(14, y, width - 28, 190);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 64px Arial, sans-serif";
    ctx.fillText(row[0], index < 2 ? 190 : 110, y + 72);
    ctx.font = "600 28px Arial, sans-serif";
    ctx.fillText(row[1], index < 2 ? 190 : 110, y + 138);
    if (index < 2) {
      ctx.fillStyle = "#dfe9f2";
      ctx.beginPath();
      ctx.ellipse(96, y + 95, 66, 54, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  return source;
}

// Papan biru tua "Laboratorium Energi dan Lingkungan" pada foto kedua
function labBoardTexture() {
  const width = 512;
  const height = 1024;
  const { source, ctx } = makeCanvas(width, height);

  ctx.fillStyle = "#b9bdbf";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#1e2b5e";
  ctx.fillRect(14, 70, width - 28, 60);
  ctx.fillStyle = "#e8ecf2";
  ctx.fillRect(30, 90, width - 110, 20);
  ctx.beginPath();
  ctx.moveTo(width - 80, 76);
  ctx.lineTo(width - 40, 100);
  ctx.lineTo(width - 80, 124);
  ctx.fill();

  ctx.fillStyle = "#1e2b5e";
  ctx.fillRect(14, 142, width - 28, 240);
  ctx.fillRect(14, 394, width - 28, 280);
  ctx.fillRect(14, 720, width - 28, 290);

  ctx.fillStyle = "#e8ecf2";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "700 34px Arial, sans-serif";
  ["LABORATORIUM ENERGI", "DAN LINGKUNGAN", "DRPM ITS"].forEach((text, i) => ctx.fillText(text, 34, 196 + i * 58));

  ctx.font = "700 32px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("LAYANAN", width / 2, 430);
  ctx.textAlign = "left";
  ctx.font = "600 25px Arial, sans-serif";
  [["Pengujian", "Sampling"], ["Pelatihan", "Konsultansi"], ["Penelitian", "Pemantauan"]].forEach((row, i) => {
    ctx.fillText("• " + row[0], 34, 490 + i * 62);
    ctx.fillText("• " + row[1], 262, 490 + i * 62);
  });

  ctx.font = "500 21px Arial, sans-serif";
  for (let i = 0; i < 7; i += 1) {
    ctx.fillRect(38, 756 + i * 34, 14, 14);
    ctx.fillRect(66, 756 + i * 34, 240 + ((i * 53) % 150), 10);
  }
  return source;
}

// ─── Gedung ───────────────────────────────────────────────────────────────────

// Fasad kaca dengan panel kuning (foto ketiga)
function glassBuildingTexture() {
  const width = 2048;
  const height = 512;
  const { source, ctx } = makeCanvas(width, height);
  const random = createRandom(161);

  ctx.fillStyle = "#d6d8d4";
  ctx.fillRect(0, 0, width, height);

  // Atap datar bagian atas
  ctx.fillStyle = "#4c5a66";
  ctx.fillRect(0, 0, width, 50);
  ctx.fillStyle = "#eeeeea";
  ctx.fillRect(0, 50, width, 20);

  for (let x = 0; x < width; x += 58) {
    const shade = random.range(0.82, 1.14);
    ctx.fillStyle = rgb("#8ea3af", shade);
    ctx.fillRect(x + 4, 78, 50, 140);
    ctx.fillStyle = rgb("#7a919e", shade);
    ctx.fillRect(x + 4, 228, 50, 168);
    const sky = ctx.createLinearGradient(0, 78, 0, 396);
    sky.addColorStop(0, "rgba(255,255,255,0.32)");
    sky.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sky;
    ctx.fillRect(x + 4, 78, 50, 318);
  }

  ctx.fillStyle = "#9b9a90";
  ctx.fillRect(0, 396, width, 60);
  ctx.fillStyle = "#74767a";
  ctx.fillRect(0, 456, width, 56);

  // Blok kuning: posisinya dihitung dari foto ketiga (u = jarak dari ujung gedung)
  ctx.fillStyle = "#e6bb2c";
  for (const [x, w] of [[560, 150], [1352, 157], [1716, 88], [1980, 68]]) {
    ctx.fillRect(x, 130, w, 382);
  }
  return source;
}

// Gedung dengan atap pelana dan kaca segitiga di ujung jalan (foto pertama)
function gableBuildingTexture() {
  const width = 1024;
  const height = 1024;
  const { source, ctx } = makeCanvas(width, height);

  ctx.fillStyle = "#e6e2d3";
  ctx.fillRect(0, 0, width, height);

  // Kaca segitiga di bawah atap pelana
  ctx.fillStyle = "#8ea2ad";
  ctx.beginPath();
  ctx.moveTo(180, 400);
  ctx.lineTo(512, 90);
  ctx.lineTo(844, 400);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#e6e2d3";
  ctx.lineWidth = 14;
  for (const x of [290, 400, 512, 624, 734]) {
    ctx.beginPath();
    ctx.moveTo(x, 90);
    ctx.lineTo(x, 400);
    ctx.stroke();
  }
  ctx.fillStyle = "#e6e2d3";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(512, 0);
  ctx.lineTo(512, 90);
  ctx.lineTo(180, 400);
  ctx.lineTo(0, 400);
  ctx.closePath();
  ctx.moveTo(width, 0);
  ctx.lineTo(512, 0);
  ctx.lineTo(512, 90);
  ctx.lineTo(844, 400);
  ctx.lineTo(width, 400);
  ctx.closePath();
  ctx.fill();

  // Lantai bawah
  ctx.fillStyle = "#d3cfbf";
  ctx.fillRect(0, 400, width, 46);
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = "#65747d";
    ctx.fillRect(130 + i * 280, 490, 200, 170);
    ctx.fillStyle = "#4c5960";
    ctx.fillRect(160 + i * 280, 720, 140, 300);
  }
  ctx.fillStyle = "#d3cfbf";
  ctx.fillRect(0, 668, width, 34);
  return source;
}

function roofTexture() {
  const size = 512;
  const { source, ctx } = makeCanvas(size, size);
  const random = createRandom(171);
  ctx.fillStyle = "#7a7f83";
  ctx.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += 32) {
    ctx.fillStyle = rgb("#7a7f83", random.range(0.9, 1.1));
    ctx.fillRect(x, 0, 28, size);
  }
  return source;
}

// ─── Bagian iCAR ──────────────────────────────────────────────────────────────

// Velg turbin perak dengan celah gelap, sesuai foto samping iCAR
function wheelRimTexture() {
  const size = 512;
  const { source, ctx } = makeCanvas(size, size);
  const c = size / 2;

  ctx.fillStyle = "#17181a";
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "#b9bdc1";
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.arc(c, c, c * 0.93, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "#787c80";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(c, c, c * 0.84, 0, Math.PI * 2);
  ctx.stroke();

  const spokes = 11;
  for (let i = 0; i < spokes; i += 1) {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate((i / spokes) * Math.PI * 2);
    const gradient = ctx.createLinearGradient(0, 0, c * 0.86, 0);
    gradient.addColorStop(0, "#8c9094");
    gradient.addColorStop(0.5, "#d0d3d6");
    gradient.addColorStop(1, "#a6aaae");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(c * 0.18, -c * 0.03);
    ctx.quadraticCurveTo(c * 0.5, -c * 0.14, c * 0.86, -c * 0.17);
    ctx.lineTo(c * 0.86, c * 0.09);
    ctx.quadraticCurveTo(c * 0.5, c * 0.09, c * 0.18, c * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = "#a7abaf";
  ctx.beginPath();
  ctx.arc(c, c, c * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2b2d30";
  ctx.beginPath();
  ctx.arc(c, c, c * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#54575b";
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.arc(c + Math.cos(angle) * c * 0.17, c + Math.sin(angle) * c * 0.17, c * 0.022, 0, Math.PI * 2);
    ctx.fill();
  }
  return source;
}

// Lampu depan LED: cincin dengan tiga lengan seperti foto depan iCAR
function headlampTexture() {
  const size = 256;
  const { source, ctx } = makeCanvas(size, size);
  const c = size / 2;
  ctx.fillStyle = "#191b1d";
  ctx.fillRect(0, 0, size, size);

  const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
  glow.addColorStop(0, "#f4f6f7");
  glow.addColorStop(0.75, "#c7cdd2");
  glow.addColorStop(1, "#6d7378");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(c, c, c * 0.96, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#2a2d30";
  ctx.lineWidth = 16;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i += 1) {
    const angle = -Math.PI / 2 + (i / 3) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(angle) * c * 0.16, c + Math.sin(angle) * c * 0.16);
    ctx.lineTo(c + Math.cos(angle) * c * 0.68, c + Math.sin(angle) * c * 0.68);
    ctx.stroke();
  }
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(c, c, c * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#2a2d30";
  ctx.beginPath();
  ctx.arc(c, c, c * 0.18, 0, Math.PI * 2);
  ctx.fill();
  return source;
}

// Texture badan iCAR: u = keliling badan, v = tinggi. Garis hitam mengikuti foto
// samping: mendatar lalu melengkung turun di depan roda depan. Lihat CAR di icar.js.
function icarBodyTexture(car) {
  const width = 4096;
  const height = 1024;
  const { source, ctx } = makeCanvas(width, height);
  const random = createRandom(181);
  const toX = (sf) => (sf / car.perimeter) * width;
  const toY = (y) => height - ((y - car.texY0) / (car.texY1 - car.texY0)) * height;

  ctx.fillStyle = "#eff1f1";
  ctx.fillRect(0, 0, width, height);

  // Permukaan fiberglass sedikit berbintik dan kotor di bagian bawah
  speckle(ctx, width, height, 26000, random, ["rgba(120,125,130,0.1)", "rgba(255,255,255,0.35)"], 2.4);
  const grime = ctx.createLinearGradient(0, toY(0.55), 0, toY(0.1));
  grime.addColorStop(0, "rgba(120,120,110,0)");
  grime.addColorStop(1, "rgba(90,90,80,0.28)");
  ctx.fillStyle = grime;
  ctx.fillRect(0, toY(0.55), width, toY(0.1) - toY(0.55));

  const stripeY = (sf) => {
    const t = clamp((car.stripeCurveStart - sf) / (car.stripeCurveStart - car.stripeFront), 0, 1);
    return car.stripeHeight - (car.stripeHeight - car.stripeEndHeight) * t * t * (1.6 - 0.6 * t);
  };

  // Digambar di kedua sisi: sisi kanan adalah cermin (perimeter − sf)
  ctx.fillStyle = "#1b1d1f";
  for (const mirror of [false, true]) {
    const map = (sf) => toX(mirror ? car.perimeter - sf : sf);
    ctx.beginPath();
    const steps = 90;
    for (let i = 0; i <= steps; i += 1) {
      const sf = lerp(car.stripeFront, car.stripeRear, i / steps);
      const half = 0.016 * smoothstep(car.stripeFront, car.stripeFront + 0.35, sf) + 0.002;
      const x = map(sf);
      const y = toY(stripeY(sf) + half);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = steps; i >= 0; i -= 1) {
      const sf = lerp(car.stripeFront, car.stripeRear, i / steps);
      const half = 0.016 * smoothstep(car.stripeFront, car.stripeFront + 0.35, sf) + 0.002;
      ctx.lineTo(map(sf), toY(stripeY(sf) - half));
    }
    ctx.closePath();
    ctx.fill();
  }
  return source;
}

// ─── Daftar Texture ───────────────────────────────────────────────────────────

const TEX = {};

function loadTextures() {
  const tile = { tile: true };
  TEX.paver = createTexture(paverTexture(), tile);
  TEX.gutter = createTexture(gutterTexture(), tile);
  TEX.curb = createTexture(curbTexture());
  TEX.litter = createTexture(litterTexture(), tile);
  TEX.lawn = createTexture(lawnTexture(), tile);
  TEX.dustyRoad = createTexture(dustyRoadTexture(), tile);
  TEX.concrete = createTexture(concreteTexture(), tile);
  TEX.bark = createTexture(barkTexture(), tile);
  TEX.leaves = createTexture(leafAtlasTexture());
  TEX.fallenLeaf = createTexture(fallenLeafTexture());
  TEX.grass = createTexture(grassTuftTexture());
  TEX.palm = createTexture(palmFrondTexture());
  TEX.treeline = createTexture(treelineTexture(), tile);
  TEX.sky = createTexture(skyTexture(), tile);
  TEX.sign = createTexture(signFaceTexture());
  TEX.speed = createTexture(speedSignTexture());
  TEX.banner = createTexture(bannerTexture());
  TEX.kawasan = createTexture(kawasanBoardTexture());
  TEX.lab = createTexture(labBoardTexture());
  TEX.glass = createTexture(glassBuildingTexture(), tile);
  TEX.gable = createTexture(gableBuildingTexture());
  TEX.roof = createTexture(roofTexture(), tile);
  TEX.rim = createTexture(wheelRimTexture());
  TEX.headlamp = createTexture(headlampTexture());
}
