import * as THREE from 'three';
import { objectVisual, phase } from './visual-state.mjs';
export function buildStatefulObject(o, group) {
  const g = new THREE.Group();
  g.name = o.id;
  group.add(g);
  const mats = {
    shell: new THREE.MeshStandardMaterial({ color: '#617986', roughness: 0.6, metalness: 0.3 }),
    wood: new THREE.MeshStandardMaterial({ color: '#aa8c66', roughness: 0.8 }),
    white: new THREE.MeshStandardMaterial({ color: '#d1e4df', roughness: 0.5 }),
    dark: new THREE.MeshStandardMaterial({ color: '#283b43', roughness: 0.7 }),
    signal: new THREE.MeshBasicMaterial({ color: '#93eadb' }),
    amber: new THREE.MeshBasicMaterial({ color: '#f6ba70' }),
  };
  const box = (w, h, d, mat, x = 0, y = 0, z = 0, parent = g) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats[mat]);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const indicator = box(0.2, 0.2, 0.15, 'signal', 0, 1.3, -0.42),
    body = box(1, 0.7, 0.75, 'shell', 0, 0.4);
  const light = new THREE.PointLight('#efad68', 0, 5);
  light.position.y = 1.2;
  // Only fires and online generator use dynamic local light; other fixtures emissive.
  if (['campfire', 'generator'].includes(o.type)) g.add(light);
  let hinge, lid, contents, motor, flames, smoke, progress, ring, damage;
  if (o.type === 'door') {
    body.visible = false;
    box(0.12, 2.1, 0.18, 'shell', -0.92, 1);
    box(0.12, 2.1, 0.18, 'shell', 0.92, 1);
    box(2, 0.12, 0.18, 'shell', 0, 2.1);
    hinge = new THREE.Group();
    hinge.position.set(-0.85, 0, 0);
    g.add(hinge);
    box(1.7, 2, 0.13, 'wood', 0.85, 1, 0, hinge);
    box(0.1, 0.15, 0.14, 'amber', 1.5, 1, -0.1, hinge);
    indicator.position.set(0.9, 1.7, -0.13);
    damage = box(0.9, 0.18, 0.17, 'dark', 0, 0.7, -0.08, hinge);
    damage.rotation.z = 0.5;
  } else if (o.type === 'container') {
    body.scale.set(1.4, 1, 1.3);
    box(1.2, 0.55, 0.85, 'dark', 0, 0.45);
    lid = new THREE.Group();
    lid.position.set(0, 0.8, 0.49);
    g.add(lid);
    box(1.45, 0.12, 1, 'wood', 0, 0, -0.49, lid);
    for (const x of [-0.6, 0.6]) box(0.08, 0.7, 1, 'shell', x, 0.4);
    contents = new THREE.Group();
    g.add(contents);
    for (let i = 0; i < 3; i++)
      box(0.25, 0.25, 0.25, i === 0 ? 'white' : 'amber', (i - 1) * 0.32, 0.6, 0, contents);
    indicator.position.set(0.45, 0.9, -0.52);
  } else if (o.type === 'bed') {
    body.scale.set(1.6, 0.3, 2.1);
    body.material = mats.white;
    body.position.y = 0.55;
    box(0.6, 0.2, 0.45, 'white', 0, 0.8, 0.65);
    for (const x of [-0.7, 0.7])
      for (const z of [-0.7, 0.7]) box(0.09, 0.5, 0.09, 'shell', x, 0.25, z);
    indicator.visible = false;
  } else if (o.type === 'generator') {
    body.scale.set(1.4, 1.5, 1.1);
    body.position.y = 0.65;
    motor = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 8), mats.dark);
    motor.rotation.x = Math.PI / 2;
    motor.position.set(0, 0.75, -0.52);
    g.add(motor);
    box(0.06, 0.6, 0.08, 'amber', 0, 0, 0, motor);
    box(0.12, 1.5, 0.12, 'shell', 0.6, 1.5, 0.35);
    progress = box(1, 0.07, 0.04, 'signal', 0, 1.45, -0.5);
    damage = box(0.7, 0.08, 0.08, 'dark', -0.1, 0.9, -0.5);
    damage.rotation.z = 0.5;
  } else if (o.type === 'medical_station') {
    body.scale.set(1.5, 1.6, 0.9);
    body.material = mats.white;
    box(0.15, 0.5, 0.08, 'signal', 0, 0.85, -0.48);
    box(0.5, 0.15, 0.08, 'signal', 0, 0.85, -0.48);
    box(0.6, 0.4, 0.06, 'dark', 0.9, 1.1, 0);
    indicator.position.set(0.9, 1.15, -0.06);
  } else if (o.type === 'radio') {
    body.scale.set(0.9, 1.4, 0.8);
    box(0.06, 2.6, 0.06, 'shell', 0.35, 1.7, 0.15);
    box(0.7, 0.25, 0.07, 'dark', 0, 0.85, -0.42);
    ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 4, 32), mats.signal);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 2.6;
    g.add(ring);
  } else if (o.type === 'watchtower') {
    body.scale.set(2.6, 0.35, 2.6);
    body.position.y = 3;
    for (const x of [-1, 1]) for (const z of [-1, 1]) box(0.15, 3, 0.15, 'shell', x, 1.5, z);
    for (let i = 0; i < 8; i++) box(0.8, 0.08, 0.12, 'wood', 1.2, 0.3 + i * 0.36, 0);
    for (const z of [-1.2, 1.2]) box(2.6, 0.1, 0.1, 'shell', 0, 3.7, z);
    indicator.position.y = 4;
    box(2.9, 0.15, 2.9, 'shell', 0, 4.3);
  } else if (o.type === 'campfire') {
    body.visible = false;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      box(0.22, 0.18, 0.25, 'dark', Math.cos(a) * 0.55, 0.12, Math.sin(a) * 0.55);
    }
    for (const a of [-0.6, 0.6]) {
      const log = box(0.8, 0.16, 0.15, 'wood', 0, 0.15);
      log.rotation.y = a;
    }
    flames = new THREE.Group();
    g.add(flames);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.8, 5), mats.amber);
      m.position.set(Math.sin(i * 2) * 0.2, 0.6, Math.cos(i * 2) * 0.2);
      flames.add(m);
    }
    smoke = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.25, 0),
      new THREE.MeshBasicMaterial({
        color: '#64777c',
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    );
    smoke.position.y = 1.6;
    g.add(smoke);
    indicator.position.set(0.65, 0.2, 0);
  }
  const sparkGeo = new THREE.BufferGeometry(),
    sparkPositions = new Float32Array(12 * 3);
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  const sparks = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({ color: '#ffd69c', size: 0.06 }),
  );
  sparks.position.y = 1;
  g.add(sparks);
  function update(world, agents, time) {
    const v = objectVisual(o, world, agents);
    g.userData.visual = { ...v };
    if (hinge) {
      hinge.rotation.y = v.doorAngle;
      hinge.rotation.z = v.broken ? 0.16 : 0;
      damage.visible = v.broken;
      indicator.visible = v.locked || v.broken;
      indicator.material.color.set(v.locked ? '#e9be6d' : '#ed8b7e');
    }
    if (lid) {
      lid.rotation.x = v.lidAngle;
      contents.visible = v.contents;
      contents.scale.setScalar(o.state === 'partial' ? 0.6 : 1);
      indicator.material.color.set(v.contents ? '#93eadb' : '#727f86');
    }
    if (motor) {
      motor.rotation.z = v.online ? time * 5 : 0;
      light.intensity = v.online ? 1 : 0;
      damage.visible = v.damaged;
      progress.scale.x = Math.max(0.02, v.online ? 1 : v.progress);
      indicator.material.color.set(v.online ? '#93eadb' : v.damaged ? '#e7a576' : '#56646b');
    }
    if (o.type === 'medical_station') {
      indicator.material.color.set(!v.powered ? '#31414a' : !v.available ? '#cf7770' : '#93eadb');
      indicator.scale.setScalar(v.occupied ? 1 + Math.sin(time * 5) * 0.2 : 1);
    }
    if (flames) {
      flames.visible = v.lit;
      flames.scale.set(0.9, v.lowFuel ? 0.45 : 0.9 + Math.sin(time * 7) * 0.15, 0.9);
      smoke.visible = v.lit || v.extinguished;
      smoke.position.y = 1.3 + (time % 2) * 0.4;
      light.intensity = v.lit ? (v.lowFuel ? 0.5 : 2) : 0;
      indicator.material.color.set(v.extinguished ? '#61727a' : v.lit ? '#f6ba70' : '#87674d');
    }
    if (ring) {
      ring.visible = v.broadcasting;
      ring.scale.setScalar(1 + (time % 1.5));
      ring.material.color.set(v.powered ? '#93eadb' : '#61727a');
    }
    sparks.visible = v.repairing || (v.damaged && Math.sin(time * 2 + phase(o.id)) > 0.92);
    if (sparks.visible) {
      for (let i = 0; i < 12; i++) {
        const f = (time * 2 + i / 12) % 1;
        sparkPositions[i * 3] = Math.sin(i * 8) * f * 0.5;
        sparkPositions[i * 3 + 1] = f * 0.7 - f * f;
        sparkPositions[i * 3 + 2] = -0.6 + Math.cos(i * 7) * f * 0.4;
      }
      sparkGeo.attributes.position.needsUpdate = true;
    }
  }
  return {
    g,
    body,
    indicator,
    light,
    hinge,
    lid,
    contents,
    motor,
    flames,
    progress,
    update,
    setObject: (value) => {
      o = value;
    },
  };
}
