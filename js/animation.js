// animation.js — Gerakan iCAR, pengemudi, dan angin

"use strict";

const ROUTE = {
  xMain: 1.5,
  zSouth: -66,
  zNorth: 60,
};

const CAR_START_Z = 9;
const CRUISE_SPEED = 10; // m/s 1ms = 3.6kmh

const animation = {
  playing: true,
  time: 0,
  windStrength: 1,
  speedScale: 1,
  speed: 0,
  state: "Berhenti",
  // Sendi yang sedang dikendalikan slider tidak ditimpa animasi otomatis
  manual: {},
};

resetIcarDrive();

function resetIcarDrive() {
  icar.x = ROUTE.xMain;
  icar.z = CAR_START_Z;
  icar.yaw = Math.PI;
  animation.speed = 0;
  animation.state = "Berhenti";
  theta.wheelSpin = 0;
}

function setJoint(key, value) {
  if (!animation.manual[key]) theta[key] = value;
}

function updateIcarDrive(dt) {
  const direction = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
  animation.speed = direction * CRUISE_SPEED * animation.speedScale;
  animation.state = direction > 0 ? "Maju" : direction < 0 ? "Mundur" : "Berhenti";

  const oldZ = icar.z;
  icar.z = clamp(icar.z - animation.speed * dt, ROUTE.zSouth, ROUTE.zNorth);
  const distanceMoved = oldZ - icar.z;

  // Mobil tetap menghadap arah yang sama; hanya roda yang berputar.
  setJoint("steer", 0);
  setJoint("steeringWheel", 0);
  setJoint("wheelSpin", (theta.wheelSpin + (distanceMoved / CAR.wheelRadius) * (180 / Math.PI)) % 360);

  const speedRatio = Math.abs(animation.speed) / CRUISE_SPEED;
  setJoint("chassisPitch", 0);
  setJoint("chassisRoll", 0);
  setJoint("chassisBounce", 0.008 + speedRatio * (0.0042 * Math.sin(animation.time * 29) + 0.0028 * Math.sin(animation.time * 47)));

  setJoint("sensorYaw", 24 * Math.sin(animation.time * 0.9));
  setJoint("cameraPitch", -6 + 3 * Math.sin(animation.time * 0.6));

  setJoint("headYaw", 4 * Math.sin(animation.time * 0.37));
  setJoint("headPitch", 4 + 2 * Math.sin(animation.time * 0.53));
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

function updateAnimation(dt) {
  if (animation.playing) {
    animation.time += dt;
    updateIcarDrive(dt);
    updateWind();
  }
  updateIcarNodes();
}
