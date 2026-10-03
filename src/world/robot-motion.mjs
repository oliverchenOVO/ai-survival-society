import * as THREE from 'three';
import { agentPose } from './visual-state.mjs';
export function animateRobot(wrapper, a, s, time, delta, moving) {
  const pose = agentPose(a, s),
    model = wrapper.children[0];
  if (!model) return;
  if (!model.userData.motionParts) {
    const parts = [];
    model.traverse((o) => {
      if (/^(Arm|Hand|Leg|Boot|Head)/.test(o.name)) {
        parts.push({ o, position: o.position.clone(), rotation: o.rotation.clone() });
      }
    });
    model.userData.motionParts = parts;
  }
  const speed = wrapper.userData.speed ?? 0;
  wrapper.userData.speed = THREE.MathUtils.lerp(speed, moving ? 1 : 0, Math.min(1, delta * 8));
  const gait = Math.sin(time * 10 + pose.phase) * wrapper.userData.speed;
  model.position.y = a.alive
    ? Math.abs(gait) * 0.05 + Math.sin(time * 1.4 + pose.phase) * 0.014
    : 0;
  model.rotation.z = a.alive ? gait * 0.025 : 0;
  model.rotation.x = a.alive ? (pose.resting ? -0.45 : pose.action === 'search' ? 0.25 : 0) : 0;
  for (const part of model.userData.motionParts) {
    const { o, position, rotation } = part;
    o.position.copy(position);
    o.rotation.copy(rotation);
    const side = position.x < 0 ? -1 : 1;
    if (a.alive && /^(Leg|Boot)/.test(o.name)) {
      o.rotation.x += gait * 0.3 * side;
      o.position.y += Math.max(0, gait * side) * 0.055;
    }
    if (a.alive && /^(Arm|Hand)/.test(o.name)) {
      o.rotation.x += -gait * 0.25 * side;
      if (pose.interaction)
        o.rotation.x += pose.resting
          ? -0.3
          : -0.65 + Math.sin(time * (pose.action === 'repair' ? 14 : 6) + side) * 0.2;
      if (['attack', 'betray'].includes(pose.action))
        o.rotation.x += -0.9 + Math.sin(time * 9) * 0.5;
      if (pose.action === 'broadcast') o.rotation.z += side * 0.3;
    }
    if (a.alive && /^Head/.test(o.name) && pose.interaction) o.rotation.x += 0.12;
  }
  if (pose.target && a.alive) {
    const angle = Math.atan2(pose.target.x - a.position.x, pose.target.z - a.position.z);
    const diff = Math.atan2(
      Math.sin(angle - wrapper.rotation.y),
      Math.cos(angle - wrapper.rotation.y),
    );
    wrapper.rotation.y += diff * Math.min(1, delta * 7);
  }
  // Keep full-size inert body; smooth visible shutdown instead of disappearing.
  const collapse = wrapper.userData.collapse ?? 0;
  wrapper.userData.collapse = THREE.MathUtils.lerp(
    collapse,
    a.alive ? 0 : 1,
    Math.min(1, delta * 4),
  );
  wrapper.scale.setScalar(1);
  wrapper.rotation.z = wrapper.userData.collapse * Math.PI * 0.48;
  const hit = (s.events ?? []).findLast(
    (e) =>
      e.target === a.id &&
      ['ATTACK', 'BETRAYAL'].includes(e.event) &&
      s.elapsed - e.timestamp >= 0 &&
      s.elapsed - e.timestamp < 0.6,
  );
  if (hit && a.alive) {
    model.rotation.z += Math.sin((s.elapsed - hit.timestamp) * 20) * 0.13;
    model.position.y += 0.06;
  }
  if (!model.userData.motionMaterials) {
    const materials = new Set();
    model.traverse((o) => {
      if (o.isMesh)
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          if (m.color) materials.add(m);
    });
    model.userData.motionMaterials = [...materials].map((m) => ({
      m,
      color: m.color.clone(),
      emissive: m.emissive?.clone(),
      intensity: m.emissiveIntensity ?? 0,
    }));
  }
  for (const { m, color, emissive, intensity } of model.userData.motionMaterials) {
    m.color.copy(color);
    if (!a.alive) m.color.lerp(new THREE.Color('#39464c'), 0.55);
    if (m.emissive) {
      m.emissive.copy(emissive);
      m.emissiveIntensity = a.alive ? intensity : 0;
      if (hit && a.alive) {
        m.emissive.set('#ecc699');
        m.emissiveIntensity = 0.7;
      }
    }
  }
  if (a.action === 'flee' && a.alive) model.rotation.x = -0.12;
  wrapper.userData.pose = {
    action: pose.action,
    moving: wrapper.userData.speed,
    target: pose.target,
    hit: Boolean(hit),
    shutdown: wrapper.userData.collapse,
  };
}
