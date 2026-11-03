// animation.js — Rute iCAR, berhenti di halte, roda, setir, pengemudi, angin
// iCAR melaju, melambat, berhenti di Halte Robotika, berangkat lagi, lalu memutar
// lewat jalan di belakang median. Urutan status: Melaju → Mendekati halte →
// Berhenti di halte → Berangkat → Melaju.

"use strict";

// Rute = dua ruas lurus dan dua setengah lingkaran mengelilingi median.
// Ubah empat angka ini untuk menggeser lajur atau titik memutar.
const ROUTE = {
  xMain: 1.5,
  xReturn: -16.8,
  zSouth: -66,
  zNorth: 60,
};

const route = (() => {
  const { xMain, xReturn, zSouth, zNorth } = ROUTE;
  const radius = (xMain - xReturn) / 2;
  const centerX = (xMain + xReturn) / 2;
  const straight = zNorth - zSouth;
  const arc = Math.PI * radius;
  const total = 2 * (straight + arc);

  const pointAt = (distance) => {
    let d = ((distance % total) + total) % total;
    if (d < straight) return [xMain, zNorth - d];
    d -= straight;
    if (d < arc) {
      const angle = d / radius;
      return [centerX + radius * Math.cos(angle), zSouth - radius * Math.sin(angle)];
    }
    d -= arc;
    if (d < straight) return [xReturn, zSouth + d];
    d -= straight;
    const angle = d / radius;
    return [centerX - radius * Math.cos(angle), zNorth + radius * Math.sin(angle)];
  };

  const headingAt = (distance) => {
    const a = pointAt(distance - 0.25);
    const b = pointAt(distance + 0.25);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  };

  // Kelengkungan bertanda: positif = belok ke kiri (+X lokal)
  const curvatureAt = (distance) => {
    const h0 = headingAt(distance - 1);
    const h1 = headingAt(distance + 1);
    let diff = Math.atan2(h1[0], h1[1]) - Math.atan2(h0[0], h0[1]);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return diff / 2;
  };

  return { total, radius, pointAt, headingAt, curvatureAt };
})();

// Jarak sepanjang rute saat iCAR tepat di samping papan halte (z = 0,9)
const HALTE_STOP = ROUTE.zNorth - 0.9;

const CRUISE_SPEED = 5.6;
const STOP_DURATION = 6;

const animation = {
  playing: true,
  time: 0,
  windStrength: 1,
  speedScale: 1,
  distance: HALTE_STOP - 50,
  speed: CRUISE_SPEED,
  acceleration: 0,
  state: "Melaju",
  stopTimer: 0,
  // Sendi yang sedang dikendalikan slider tidak ditimpa animasi otomatis
  manual: {},
};

function setJoint(key, value) {
  if (!animation.manual[key]) theta[key] = value;
}

function distanceToStop() {
  return ((HALTE_STOP - animation.distance) % route.total + route.total) % route.total;
}

function updateIcarDrive(dt) {
  const toStop = distanceToStop();
  let targetSpeed = CRUISE_SPEED * animation.speedScale;

  if (animation.state === "Berhenti di halte") {
    targetSpeed = 0;
    animation.stopTimer -= dt;
    if (animation.stopTimer <= 0) animation.state = "Berangkat";
  } else if (animation.state === "Berangkat") {
    // Tepat saat berangkat toStop = 0, jadi status baru berganti setelah benar-benar menjauh
    if (toStop > 1 && toStop < route.total - 15) animation.state = "Melaju";
  } else if (toStop < 42) {
    // v² = 2·a·s: perlambatan konstan menuju titik berhenti
    targetSpeed = Math.min(targetSpeed, Math.sqrt(2 * 0.75 * toStop) + 0.02);
    if (toStop < 24) animation.state = "Mendekati halte";
    if (toStop < 0.01 || animation.speed * dt >= toStop) {
      animation.state = "Berhenti di halte";
      animation.stopTimer = STOP_DURATION;
      animation.speed = 0;
      animation.distance = HALTE_STOP;
    }
  }

  // Melambat sebelum tikungan: laju dibatasi percepatan lateral
  const curvature = route.curvatureAt(animation.distance);
  const curveAhead = Math.max(Math.abs(curvature), Math.abs(route.curvatureAt(animation.distance + 10)));
  if (curveAhead > 0.005) {
    targetSpeed = Math.min(targetSpeed, Math.sqrt(1.8 / curveAhead));
  }

  const maxChange = (targetSpeed > animation.speed ? 1.0 : 1.6) * dt;
  const previousSpeed = animation.speed;
  if (animation.state !== "Berhenti di halte") {
    animation.speed += clamp(targetSpeed - animation.speed, -maxChange, maxChange);
  }
  animation.acceleration = lerp(animation.acceleration, (animation.speed - previousSpeed) / Math.max(dt, 1e-3), 1 - Math.exp(-dt * 5));
  animation.distance += animation.speed * dt;

  // Posisi dan arah mobil dari rute
  const position = route.pointAt(animation.distance);
  const heading = route.headingAt(animation.distance);
  icar.x = position[0];
  icar.z = position[1];
  icar.yaw = Math.atan2(heading[0], heading[1]);

  // Roda: sudut belok dari kelengkungan, putaran dari jarak tempuh
  const wheelBase = CAR.axleFront - CAR.axleRear;
  const steerDegrees = clamp(Math.atan(wheelBase * curvature) * (180 / Math.PI), -32, 32);
  setJoint("steer", theta.steer + (steerDegrees - theta.steer) * (1 - Math.exp(-dt * 6)));
  setJoint("wheelSpin", (theta.wheelSpin + ((animation.speed * dt) / CAR.wheelRadius) * (180 / Math.PI)) % 360);
  setJoint("steeringWheel", theta.steer * 6);

  // Sasis: menunduk saat rem, miring keluar saat menikung, bergetar di atas paving
  const lateral = animation.speed * animation.speed * curvature;
  const speedRatio = animation.speed / CRUISE_SPEED;
  setJoint("chassisPitch", clamp(-animation.acceleration * 1.1, -2, 2.4));
  setJoint("chassisRoll", clamp(lateral * 0.7, -2.2, 2.2));
  setJoint("chassisBounce", 0.008 + speedRatio * (0.0042 * Math.sin(animation.time * 29) + 0.0028 * Math.sin(animation.time * 47)));

  // Sensor memindai ke kiri-kanan dan menoleh ke arah belokan
  setJoint("sensorYaw", 24 * Math.sin(animation.time * 0.9) + theta.steer * 0.8);
  setJoint("cameraPitch", -6 + 3 * Math.sin(animation.time * 0.6));

  // Pengemudi: lengan mengikuti setir, kepala menoleh
  const steerRatio = theta.steer / 32;
  setJoint("armUpperLeft", 115 - steerRatio * 13);
  setJoint("armLowerLeft", -12 + steerRatio * 11);
  setJoint("armUpperRight", 115 + steerRatio * 13);
  setJoint("armLowerRight", -12 - steerRatio * 11);
  const lookingAtStop = animation.state === "Berhenti di halte" ? 26 : 0;
  setJoint("headYaw", theta.steer * 1.2 + lookingAtStop + 4 * Math.sin(animation.time * 0.37));
  setJoint("headPitch", 4 + 2 * Math.sin(animation.time * 0.53));

  // Lampu sein berkedip: kiri saat mendekati halte, keduanya saat berhenti
  const blink = Math.sin(animation.time * 9) > 0;
  const stopped = animation.state === "Berhenti di halte";
  const approaching = animation.state === "Mendekati halte";
  const leaving = animation.state === "Berangkat";
  const turningLeft = theta.steer > 6;
  const turningRight = theta.steer < -6;
  const leftOn = blink && (stopped || approaching || turningLeft);
  const rightOn = blink && (stopped || leaving || turningRight);
  CAR_MAT.indicatorLeft.emissive = leftOn ? [1, 0.55, 0.05] : [0, 0, 0];
  CAR_MAT.indicatorRight.emissive = rightOn ? [1, 0.55, 0.05] : [0, 0, 0];

  const braking = stopped || animation.acceleration < -0.25;
  CAR_MAT.brake.emissive = braking ? [0.95, 0.05, 0.03] : [0, 0, 0];
}

function updateMotors(dt) {
  for (const motor of motors) {
    motor.distance += motor.speed * animation.speedScale * dt;
    const center = route.pointAt(motor.distance);
    const heading = route.headingAt(motor.distance);
    // Sisi kanan arah gerak; jalur motor di sebelah kanan lintasan iCAR
    motor.x = center[0] - heading[1] * motor.offset;
    motor.z = center[1] + heading[0] * motor.offset;
    motor.yaw = Math.atan2(heading[0], heading[1]);

    const curvature = route.curvatureAt(motor.distance);
    // rotationZ negatif memiringkan puncak motor ke +X (kiri), yaitu ke dalam tikungan kiri
    motor.lean = -clamp(motor.speed * motor.speed * curvature * 0.09, -0.4, 0.4);
    motor.spin = (motor.spin + (motor.speed * animation.speedScale * dt) / 0.21) % (Math.PI * 2);
    motor.steer = clamp(curvature * 2.4, -0.4, 0.4);
    motor.headYaw = 5 * Math.sin(animation.time * 0.45 + motor.offset);

    [motor.root, motor.rear, motor.fork, motor.front, motor.head].forEach(initNodes);
  }
}

// Angin: setiap sendi cabang punya fase sendiri; ranting bergerak lebih cepat dan
// menumpang gerakan cabang induknya karena hierarki.
function updateWind() {
  const time = animation.time;
  const strength = animation.windStrength;
  const gust = 0.65 + 0.35 * Math.sin(time * 0.31);
  for (const joint of windJoints) {
    const fast = joint.level === 2;
    const amplitude = (fast ? 0.028 : 0.012) * strength * gust;
    const speed = fast ? 1.5 : 0.8;
    joint.angleX = amplitude * Math.sin(time * speed + joint.phase);
    joint.angleZ = amplitude * 0.8 * Math.cos(time * speed * 0.83 + joint.phase * 1.7);
    initNodes(joint.id);
  }
}

function updateFallingLeaves(dt) {
  for (const leaf of fallingLeaves) {
    leaf.age += dt;
    leaf.y -= leaf.speed * dt;
    if (leaf.y < WORLD.islandY + 0.02) {
      leaf.y = 8.5;
      leaf.age = 0;
    }
    initNodes(leaf.id);
  }
}

function updateAnimation(dt) {
  if (animation.playing) {
    animation.time += dt;
    updateIcarDrive(dt);
    updateMotors(dt);
    updateWind();
    updateFallingLeaves(dt);
  }
  updateIcarNodes();
}
