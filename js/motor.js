// motor.js — Motor dan pengendara (dua motor di jalan pada foto pertama)
// Pengendara memakai struktur figure.js: torso → kepala, lengan atas → bawah,
// kaki atas → bawah. Motor berjalan menjauh menunjukkan lampu merah dan plat putih.

"use strict";

const BIKE_MESH = {};
const BIKE_MAT = {};
const motors = [];

// Ukuran bagian tubuh, dipakai bersama oleh mesh dan sendi
const RIDER = {
  torsoLean: 14,
  shoulderY: 0.5,
  shoulderX: 0.2,
  armUpper: 0.31,
  armLower: 0.31,
  legUpper: 0.4,
  legLower: 0.4,
};

// Bentuk organik dari beberapa penampang elips di sepanjang path.
// sections = [[x, y, z, r1, r2], ...]. Dua arah jari-jari mengikuti frame tubeData.
function ellipseLoftData(sections) {
  const count = sections.length;
  return tubeData(
    sections.map((s) => [s[0], s[1], s[2]]),
    (t, angle) => {
      const s = sections[Math.round(t * (count - 1))];
      return 1 / Math.hypot(Math.cos(angle) / s[3], Math.sin(angle) / s[4]);
    },
    16
  );
}

// Lengan atau kaki: tumbuh ke +Y lokal dengan ujung membulat, seperti bagian figure.js
function limbData(length, r0, r1) {
  return latheData(
    [[0, -r0], [r0 * 0.72, -r0 * 0.72], [r0, 0], [r1, length], [r1 * 0.72, length + r1 * 0.72], [0, length + r1]],
    12
  );
}

function loadMotorAssets() {
  const axleToX = Mat4.rotationZ(-Math.PI / 2);

  BIKE_MESH.tire = uploadMesh(transformMeshData(
    latheData([[0.13, -0.05], [0.13, -0.05], [0.17, -0.05], [0.205, -0.03], [0.21, 0], [0.205, 0.03], [0.17, 0.05], [0.13, 0.05]], 24),
    axleToX
  ));

  const rimFace = latheData([[0.132, 0.05], [0.118, 0.028], [0.04, 0.03], [0, 0.04]], 24, { planarUV: true });
  const rim = transformMeshData(rimFace, axleToX);
  mergeMeshData(rim, rimFace, Mat4.multiply(Mat4.rotationZ(Math.PI / 2), Mat4.identity()));
  BIKE_MESH.rim = uploadMesh(rim);

  // Bodi belakang: path ke arah +Z, jari-jari pertama lebar (X), kedua tinggi (Y)
  BIKE_MESH.rearBody = uploadMesh(ellipseLoftData([
    [0, 0.7, -0.76, 0.01, 0.01],
    [0, 0.7, -0.74, 0.055, 0.04],
    [0, 0.66, -0.6, 0.115, 0.115],
    [0, 0.59, -0.38, 0.145, 0.18],
    [0, 0.52, -0.12, 0.15, 0.22],
    [0, 0.46, 0.06, 0.125, 0.17],
    [0, 0.42, 0.13, 0.095, 0.11],
  ]));

  BIKE_MESH.seat = uploadMesh(ellipseLoftData([
    [0, 0.76, -0.66, 0.01, 0.01],
    [0, 0.77, -0.63, 0.075, 0.035],
    [0, 0.795, -0.45, 0.125, 0.055],
    [0, 0.79, -0.2, 0.14, 0.062],
    [0, 0.76, 0.0, 0.13, 0.05],
    [0, 0.75, 0.05, 0.01, 0.01],
  ]));

  // Pelindung kaki: path ke arah +Y, jari-jari pertama tebal (Z), kedua lebar (X)
  BIKE_MESH.legShield = uploadMesh(ellipseLoftData([
    [0, 0.33, 0.45, 0.01, 0.01],
    [0, 0.35, 0.45, 0.055, 0.15],
    [0, 0.6, 0.41, 0.06, 0.175],
    [0, 0.8, 0.355, 0.05, 0.15],
    [0, 0.96, 0.305, 0.04, 0.1],
    [0, 0.99, 0.295, 0.01, 0.01],
  ]));

  // Badan pengendara: jari-jari pertama tebal (Z), kedua lebar (X)
  BIKE_MESH.torso = uploadMesh(ellipseLoftData([
    [0, -0.03, 0, 0.01, 0.01],
    [0, 0, 0, 0.1, 0.16],
    [0, 0.12, 0, 0.115, 0.17],
    [0, 0.28, 0, 0.125, 0.185],
    [0, 0.42, 0, 0.125, 0.215],
    [0, 0.5, 0, 0.09, 0.19],
    [0, 0.55, 0, 0.05, 0.085],
    [0, 0.6, 0, 0.045, 0.055],
  ]));

  BIKE_MESH.armUpper = uploadMesh(limbData(RIDER.armUpper, 0.055, 0.045));
  BIKE_MESH.armLower = uploadMesh(limbData(RIDER.armLower, 0.045, 0.036));
  BIKE_MESH.legUpper = uploadMesh(limbData(RIDER.legUpper, 0.088, 0.066));
  BIKE_MESH.legLower = uploadMesh(limbData(RIDER.legLower, 0.064, 0.046));

  BIKE_MAT.body = createMaterial({ color: [0.11, 0.115, 0.125], specular: 0.7, shininess: 70 });
  BIKE_MAT.bodyAlt = createMaterial({ color: [0.16, 0.17, 0.2], specular: 0.7, shininess: 70 });
  BIKE_MAT.frame = createMaterial({ color: [0.07, 0.07, 0.075], specular: 0.2, shininess: 24 });
  BIKE_MAT.seat = createMaterial({ color: [0.055, 0.055, 0.06], specular: 0.22, shininess: 22 });
  BIKE_MAT.rim = createMaterial({ texture: TEX.rim, color: [0.55, 0.56, 0.58], specular: 0.4, shininess: 50 });
  BIKE_MAT.exhaust = createMaterial({ color: [0.3, 0.3, 0.31], specular: 0.8, shininess: 80 });
  BIKE_MAT.plate = createMaterial({ color: [0.92, 0.92, 0.9], specular: 0.2, shininess: 30 });
  BIKE_MAT.lamp = createMaterial({ color: [0.8, 0.08, 0.05], emissive: [0.62, 0.03, 0.02], specular: 0.5, shininess: 40 });
  BIKE_MAT.headlamp = createMaterial({ color: [0.95, 0.95, 0.9], emissive: [0.5, 0.5, 0.44], specular: 0.5, shininess: 40 });
  BIKE_MAT.jacket = createMaterial({ color: [0.095, 0.115, 0.15], specular: 0.22, shininess: 24 });
  BIKE_MAT.jacketPanel = createMaterial({ color: [0.3, 0.37, 0.45], specular: 0.25, shininess: 24 });
  BIKE_MAT.trousers = createMaterial({ color: [0.075, 0.075, 0.085], specular: 0.08, shininess: 12 });
  BIKE_MAT.helmet = createMaterial({ color: [0.055, 0.055, 0.065], specular: 0.9, shininess: 80 });
  BIKE_MAT.visor = createMaterial({ color: [0.02, 0.025, 0.03], specular: 1.0, shininess: 120 });
  BIKE_MAT.glove = createMaterial({ color: [0.06, 0.06, 0.065], specular: 0.12, shininess: 16 });
  BIKE_MAT.shoe = createMaterial({ color: [0.3, 0.28, 0.26], specular: 0.12, shininess: 16 });
}

function createMotor(parentId, index, options) {
  const box = CAR_MESH.box;
  const rounded = CAR_MESH.roundBox;
  const sphere = CAR_MESH.sphere;
  const cylinder = CAR_MESH.cylinder;
  const motor = { distance: options.start, offset: options.offset, speed: options.speed, x: 0, z: 0, yaw: 0, lean: 0, spin: 0, steer: 0, headYaw: 0 };
  const bodyMaterial = index === 2 ? BIKE_MAT.bodyAlt : BIKE_MAT.body;
  const ts = (x, y, z, sx, sy, sz) => Mat4.multiply(Mat4.translation(x, y, z), Mat4.scaling(sx, sy, sz));

  motor.root = addNode(`Motor ${index}`, parentId, () => Mat4.chain(
    Mat4.translation(motor.x, 0, motor.z),
    Mat4.rotationY(motor.yaw),
    Mat4.rotationZ(motor.lean)
  ), () => {
    drawPart(BIKE_MESH.rearBody, bodyMaterial);
    drawPart(BIKE_MESH.legShield, bodyMaterial);
    drawPart(BIKE_MESH.seat, BIKE_MAT.seat);
    // Pijakan kaki dan mesin
    drawPart(rounded, BIKE_MAT.frame, ts(0, 0.335, 0.2, 0.28, 0.05, 0.5));
    drawPart(rounded, BIKE_MAT.frame, ts(0, 0.27, 0.15, 0.2, 0.09, 0.6));
    drawPart(rounded, BIKE_MAT.frame, ts(0.03, 0.3, -0.3, 0.14, 0.17, 0.42));
    // Knalpot di sisi kanan
    drawPart(cylinder, BIKE_MAT.exhaust, Mat4.chain(Mat4.translation(-0.115, 0.29, -0.68), Mat4.rotationX(Math.PI / 2), Mat4.scaling(0.032, 0.36, 0.032)));
    // Lampu merah di ekor, plat putih di bawahnya, seperti terlihat pada foto
    drawPart(rounded, BIKE_MAT.lamp, ts(0, 0.685, -0.745, 0.12, 0.05, 0.03));
    drawPart(box, BIKE_MAT.frame, ts(0, 0.47, -0.645, 0.2, 0.14, 0.02));
    drawPart(box, BIKE_MAT.plate, ts(0, 0.47, -0.657, 0.17, 0.095, 0.006));
    // Spakbor belakang
    drawPart(sphere, BIKE_MAT.frame, ts(0, 0.37, -0.53, 0.075, 0.075, 0.2));
  }, { note: "Rangka motor; posisi mengikuti rute" });

  const wheelNode = (name, parent, local) => addNode(name, parent, local, () => {
    drawPart(BIKE_MESH.tire, CAR_MAT.rubber);
    drawPart(BIKE_MESH.rim, BIKE_MAT.rim);
  }, { note: "Berputar sesuai laju" });

  motor.rear = wheelNode("Roda Belakang", motor.root, () => Mat4.chain(
    Mat4.translation(0, 0.21, -0.52),
    Mat4.rotationX(motor.spin)
  ));

  // Stang dan roda depan satu cabang: saat stang berbelok, roda depan ikut
  motor.fork = addNode("Stang", motor.root, () => Mat4.chain(
    Mat4.translation(0, 0.74, 0.38),
    Mat4.rotationX(degToRad(-16)),
    Mat4.rotationY(motor.steer)
  ), () => {
    drawPart(rounded, bodyMaterial, ts(0, 0.19, 0.01, 0.2, 0.08, 0.13));
    drawPart(rounded, BIKE_MAT.headlamp, ts(0, 0.18, 0.08, 0.12, 0.05, 0.02));
    drawPart(cylinder, BIKE_MAT.frame, Mat4.chain(Mat4.translation(-0.35, 0.2, 0), Mat4.rotationZ(-Math.PI / 2), Mat4.scaling(0.016, 0.7, 0.016)));
    for (const side of [-1, 1]) {
      drawPart(cylinder, BIKE_MAT.exhaust, Mat4.chain(
        Mat4.translation(side * 0.058, -0.592, 0.142),
        Mat4.rotationX(degToRad(-11.6)),
        Mat4.scaling(0.016, 0.706, 0.016)
      ));
    }
    drawPart(sphere, bodyMaterial, ts(0, -0.355, 0.1, 0.078, 0.05, 0.21));
  }, { note: "Sendi stang" });

  // Posisi lokal dipilih agar roda tepat menyentuh tanah setelah kemiringan garpu 16°
  motor.front = wheelNode("Roda Depan", motor.fork, () => Mat4.chain(
    Mat4.translation(0, -0.592, 0.142),
    Mat4.rotationX(degToRad(16) + motor.spin)
  ));

  // Pengendara. Sudut sendi dihitung agar tangan sampai ke stang dan kaki ke pijakan.
  motor.torso = addNode("Torso Pengendara", motor.root, Mat4.chain(
    Mat4.translation(0, 0.82, -0.2),
    Mat4.rotationX(degToRad(RIDER.torsoLean))
  ), () => {
    drawPart(BIKE_MESH.torso, BIKE_MAT.jacket);
    for (const side of [-1, 1]) {
      drawPart(rounded, BIKE_MAT.jacketPanel, ts(side * 0.085, 0.31, -0.122, 0.085, 0.26, 0.012));
    }
  }, { note: "Sama seperti torso pada figure.js" });

  motor.head = addNode("Helm", motor.torso, () => Mat4.chain(
    Mat4.translation(0, 0.58, 0.01),
    Mat4.rotationY(degToRad(motor.headYaw))
  ), () => {
    drawPart(sphere, BIKE_MAT.helmet, ts(0, 0.12, 0, 0.122, 0.13, 0.14));
    drawPart(sphere, BIKE_MAT.visor, ts(0, 0.125, 0.04, 0.105, 0.06, 0.112));
  }, { note: "Kepala pengendara" });

  for (const side of [-1, 1]) {
    const name = side > 0 ? "Kiri" : "Kanan";

    const upperArm = addNode(`Lengan Atas ${name}`, motor.torso, Mat4.chain(
      Mat4.translation(side * RIDER.shoulderX, RIDER.shoulderY, 0),
      Mat4.rotationX(degToRad(142.5)),
      Mat4.rotationZ(side * degToRad(-12))
    ), () => {
      drawPart(BIKE_MESH.armUpper, BIKE_MAT.jacket);
    }, { note: "Sendi bahu" });

    addNode(`Lengan Bawah ${name}`, upperArm, Mat4.chain(
      Mat4.translation(0, RIDER.armUpper, 0),
      Mat4.rotationX(degToRad(-43.5))
    ), () => {
      drawPart(BIKE_MESH.armLower, BIKE_MAT.jacket);
      drawPart(sphere, BIKE_MAT.glove, ts(0, RIDER.armLower + 0.015, 0, 0.042, 0.05, 0.042));
    }, { note: "Sendi siku" });

    const upperLeg = addNode(`Kaki Atas ${name}`, motor.torso, Mat4.chain(
      Mat4.translation(side * 0.1, 0.02, 0),
      Mat4.rotationX(degToRad(71.8)),
      Mat4.rotationZ(side * degToRad(-4))
    ), () => {
      drawPart(BIKE_MESH.legUpper, BIKE_MAT.trousers);
    }, { note: "Sendi pinggul" });

    addNode(`Kaki Bawah ${name}`, upperLeg, Mat4.chain(
      Mat4.translation(0, RIDER.legUpper, 0),
      Mat4.rotationX(degToRad(94))
    ), () => {
      drawPart(BIKE_MESH.legLower, BIKE_MAT.trousers);
      drawPart(rounded, BIKE_MAT.shoe, ts(0, RIDER.legLower + 0.015, -0.065, 0.09, 0.07, 0.24));
    }, { note: "Sendi lutut" });
  }

  motors.push(motor);
  return motor;
}
