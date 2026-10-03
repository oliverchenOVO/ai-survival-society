import * as THREE from 'three';
import { terrainHeight } from '../../core/world.mjs';
// Bounded scene registry. State comes only from authoritative/replay snapshots.
export function createLivingScene(scene, host) {
  const group = new THREE.Group();
  scene.add(group);
  const objects = new Map(),
    pois = new Map(),
    hazards = new Map(),
    walls = [];
  const labelHost = document.createElement('div');
  labelHost.className = 'world-labels living-labels';
  host.append(labelHost);
  const hud = document.createElement('div');
  hud.className = 'living-hud';
  host.append(hud);
  let lastWorld = null;
  const box = (w, h, d, color) =>
    new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
    );
  function build(o) {
    const g = new THREE.Group(),
      body = box(1, 0.7, 0.75, '#718891');
    body.position.y = 0.4;
    g.add(body);
    const indicator = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16),
      new THREE.MeshBasicMaterial({ color: '#8ee6c0' }),
    );
    indicator.position.y = 1.2;
    g.add(indicator);
    const arm = box(0.14, 1.8, 0.14, '#b5d6d0');
    arm.position.y = 0.8;
    g.add(arm);
    if (o.type === 'door') {
      body.scale.set(1.8, 2.5, 0.2);
      body.position.y = 0.9;
      arm.visible = false;
    }
    if (o.type === 'bed') {
      body.scale.set(1.6, 0.4, 1.8);
      body.material.color.set('#9caeee');
      arm.visible = false;
    }
    if (o.type === 'campfire') {
      body.geometry.dispose();
      body.geometry = new THREE.ConeGeometry(0.38, 0.8, 7);
      body.material.color.set('#ec9458');
      arm.visible = false;
    }
    if (o.type === 'watchtower') {
      body.scale.set(1.5, 0.4, 1.5);
      body.position.y = 3;
      arm.scale.set(4, 2, 4);
      arm.position.y = 1.5;
      indicator.position.y = 3.6;
    }
    if (o.type === 'medical_station') {
      body.material.color.set('#83d2d8');
      body.scale.y = 1.5;
    }
    if (o.type === 'generator') {
      body.material.color.set('#eabc7e');
      body.scale.set(1.4, 1.5, 1.1);
    }
    if (o.type === 'radio') {
      arm.scale.y = 1.8;
      indicator.position.y = 2.8;
    }
    const light = new THREE.PointLight('#ffba65', 0, 6);
    light.position.y = 1;
    g.add(light);
    group.add(g);
    return { g, body, indicator, light };
  }
  const rainGeometry = new THREE.BufferGeometry();
  const rainPositions = new Float32Array(240 * 3);
  for (let i = 0; i < 240; i++) {
    rainPositions[i * 3] = Math.sin(i * 17) * 28;
    rainPositions[i * 3 + 1] = (i % 20) + 3;
    rainPositions[i * 3 + 2] = Math.cos(i * 13) * 28;
  }
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.Points(
    rainGeometry,
    new THREE.PointsMaterial({ color: '#a7d9ed', size: 0.1, transparent: true, opacity: 0.55 }),
  );
  group.add(rain);
  const projection = new THREE.Vector3();
  function update(s, camera, time, t) {
    const w = s.world;
    group.visible = Boolean(w);
    labelHost.hidden = !w;
    hud.hidden = !w;
    if (!w) return;
    hud.textContent = `v1.5.0 · ${t('world.title')} · ${t('weather.' + w.timeOfDay)} · ${t('weather.' + w.weather)}`;
    if (lastWorld !== s.matchId) {
      for (const mesh of walls) {
        group.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      walls.length = 0;
      for (const r of w.walls) {
        const m = box(r.hx * 2, 1.6, r.hz * 2, '#536c73');
        m.position.set(r.x, terrainHeight(r.x, r.z) + 0.8, r.z);
        group.add(m);
        walls.push(m);
      }
      lastWorld = s.matchId;
    }
    for (const [id, item] of objects)
      if (!w.objects.some((o) => o.id === id)) {
        group.remove(item.g);
        item.g.traverse((o) => {
          o.geometry?.dispose();
          o.material?.dispose();
        });
        objects.delete(id);
      }
    for (const o of w.objects) {
      let item = objects.get(o.id);
      if (!item) {
        item = build(o);
        objects.set(o.id, item);
      }
      const { g, body, indicator, light } = item;
      g.position.set(o.position.x, terrainHeight(o.position.x, o.position.z) + 0.1, o.position.z);
      if (o.type === 'door')
        body.rotation.y = ['open', 'broken'].includes(o.state) ? Math.PI / 2 : 0;
      if (o.type === 'container') {
        body.material.color.set(['empty', 'searched'].includes(o.state) ? '#35434b' : '#8ca69e');
        body.rotation.x = o.state === 'partial' ? -0.15 : 0;
      }
      const active =
        o.state === 'lit' ||
        o.state === 'online' ||
        o.metadata.occupants.length > 0 ||
        (o.type === 'medical_station' &&
          w.objects.some(
            (g) =>
              g.type === 'generator' &&
              g.state === 'online' &&
              g.metadata.powerZone === o.metadata.powerZone,
          ));
      indicator.material.color.set(active ? '#8ee6c0' : '#dc827c');
      indicator.scale.setScalar(1 + Math.sin(time * 3) * 0.1);
      if (o.type === 'campfire') {
        body.visible = o.state === 'lit';
        body.scale.y = 0.9 + Math.sin(time * 9) * 0.15;
        light.intensity = o.state === 'lit' ? 2 : 0;
      }
      if (o.type === 'generator') light.intensity = o.state === 'online' ? 0.8 : 0;
      if (o.type === 'watchtower') indicator.scale.setScalar(o.metadata.occupants.length ? 2 : 1);
      if (o.type === 'radio')
        indicator.scale.setScalar(
          s.agents.some((a) => a.target === o.id && a.action === 'broadcast')
            ? 1.5 + Math.sin(time * 7) * 0.5
            : 1,
        );
    }
    for (const p of w.pois) {
      let label = pois.get(p.id);
      if (!label) {
        label = document.createElement('div');
        label.className = 'poi-label';
        labelHost.append(label);
        pois.set(p.id, label);
      }
      const names = (p.controllers ?? [])
        .map((id) => s.agents.find((a) => a.id === id)?.name)
        .filter(Boolean)
        .join(' + ');
      label.textContent = t('world.' + p.type) + (names ? ' · ' + names : '');
      label.title = names ? t('world.controlled', { name: names }) : t('world.public');
      label.dataset.controlled = Boolean(names);
      label.style.borderColor = s.agents.find((a) => a.id === p.controller)?.color ?? '#607880';
      projection
        .set(p.position.x, terrainHeight(p.position.x, p.position.z) + 3.7, p.position.z)
        .project(camera);
      label.style.transform = `translate(-50%,-50%) translate(${(projection.x * 0.5 + 0.5) * host.clientWidth}px,${(-projection.y * 0.5 + 0.5) * host.clientHeight}px)`;
      label.style.display = projection.z < 1 ? 'block' : 'none';
    }
    for (const [id, m] of hazards)
      if (!w.hazards.some((h) => h.id === id)) {
        group.remove(m);
        m.geometry.dispose();
        m.material.dispose();
        hazards.delete(id);
      }
    for (const h of w.hazards) {
      let m = hazards.get(h.id);
      if (!m) {
        m = new THREE.Mesh(
          new THREE.CylinderGeometry(h.radius, h.radius, h.type === 'fire' ? 1.8 : 0.25, 16),
          new THREE.MeshBasicMaterial({
            color: h.type === 'fire' ? '#ee7744' : '#619ece',
            transparent: true,
            opacity: 0.45,
          }),
        );
        group.add(m);
        hazards.set(h.id, m);
      }
      m.position.set(h.position.x, terrainHeight(h.position.x, h.position.z) + 0.6, h.position.z);
      m.scale.y = h.type === 'fire' ? 1 + Math.sin(time * 8) * 0.15 : 1;
    }
    rain.visible = w.weather !== 'clear';
    rain.position.y = -((time * (w.weather === 'storm' ? 8 : 4)) % 10);
  }
  return { update };
}
