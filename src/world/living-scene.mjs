import * as THREE from 'three';
import { createPhysicalKit } from './physical-kit.mjs';
import { buildStatefulObject } from './stateful-objects.mjs';
import { visualHistory, zoomTier } from './visual-state.mjs';
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
  let lastWorld = null,
    lastElapsed = -1,
    eventCache = new Map(),
    disposed = false;
  const kit = createPhysicalKit(scene),
    historyGroup = new THREE.Group();
  group.add(historyGroup);
  let historyKey = '';
  kit.ready.then(() => {
    if (!disposed) {
      lastWorld = null;
    }
  });
  const box = (w, h, d, color) =>
    new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
    );
  function build(o) {
    return buildStatefulObject(o, group);
  }
  const rainGeometry = new THREE.BufferGeometry();
  const rainPositions = new Float32Array(240 * 6);
  for (let i = 0; i < 240; i++) {
    rainPositions[i * 6] = Math.sin(i * 17) * 28;
    rainPositions[i * 6 + 1] = (i % 20) + 3;
    rainPositions[i * 6 + 2] = Math.cos(i * 13) * 28;
    rainPositions[i * 6 + 3] = rainPositions[i * 6] + 0.13;
    rainPositions[i * 6 + 4] = rainPositions[i * 6 + 1] - 0.7;
    rainPositions[i * 6 + 5] = rainPositions[i * 6 + 2];
  }
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.LineSegments(
    rainGeometry,
    new THREE.LineBasicMaterial({ color: '#a7d9ed', transparent: true, opacity: 0.55 }),
  );
  group.add(rain);
  const projection = new THREE.Vector3();
  function update(s, camera, time, t) {
    const w = s.world;
    group.visible = Boolean(w);
    kit.root.visible = Boolean(w);
    labelHost.hidden = !w;
    hud.hidden = !w;
    if (!w) return;
    hud.textContent = `v1.7.0 · ${t('world.title')} · ${t('weather.' + w.timeOfDay)} · ${t('weather.' + w.weather)}`;
    if (lastElapsed > s.elapsed || (lastWorld && lastWorld !== s.matchId)) eventCache.clear();
    lastElapsed = s.elapsed;
    for (const e of s.visualEvents ?? s.events ?? [])
      if (e.timestamp <= s.elapsed) eventCache.set(e.id, e);
    const traces = visualHistory([...eventCache.values()], s.elapsed);
    for (const [id, e] of eventCache)
      if (
        !traces.some((t) => t.id === id) &&
        !['FIRE_STARTED', 'GENERATOR_REPAIRED'].includes(e.event)
      )
        eventCache.delete(id);
    if (lastWorld !== s.matchId) {
      historyKey = null;
      kit.build(w);
      for (const mesh of walls) {
        group.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      walls.length = 0;
      for (const r of w.spatial ? [] : w.walls) {
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
      item.setObject(o);
      item.g.position.set(
        o.position.x,
        terrainHeight(o.position.x, o.position.z) + (o.position.y ?? 0) + 0.1,
        o.position.z,
      );
      item.update(w, s.agents, s.elapsed);
    }
    kit.update(s, s.elapsed, traces);
    for (const [name, m] of Object.entries(kit.materials)) {
      if (name === 'emission') continue;
      m.roughness = w.weather === 'clear' ? 0.8 : 0.36;
    }
    const key = traces.map((e) => e.id).join(',');
    if (key !== historyKey) {
      historyKey = key;
      for (const m of historyGroup.children) {
        m.geometry?.dispose();
        m.material?.dispose();
      }
      historyGroup.clear();
      for (const e of traces) {
        if (!e.position) continue;
        const mark = new THREE.Mesh(
          new THREE.CircleGeometry(e.event === 'FIRE_STARTED' ? 2.6 : 0.45, 12),
          new THREE.MeshBasicMaterial({
            color:
              e.event === 'FIRE_STARTED'
                ? '#252e30'
                : e.event === 'GENERATOR_REPAIRED'
                  ? '#9ee7d0'
                  : '#394950',
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
          }),
        );
        mark.rotation.x = -Math.PI / 2;
        mark.position.set(
          e.position.x,
          terrainHeight(e.position.x, e.position.z) + 0.14,
          e.position.z,
        );
        historyGroup.add(mark);
      }
    }
    const tier = zoomTier(
      camera.position.distanceTo(camera.userData.target ?? new THREE.Vector3()),
    );
    const placed = [],
      viewportWidth = host.clientWidth,
      viewportHeight = host.clientHeight;
    for (const p of w.pois) {
      let label = pois.get(p.id);
      if (!label) {
        label = document.createElement('div');
        label.className = 'poi-label';
        label.tabIndex = 0;
        label.setAttribute('role', 'button');
        label.onclick = () => camera.userData.focusPoi?.(p.position);
        label.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') label.onclick();
        };
        labelHost.append(label);
        pois.set(p.id, label);
      }
      const controllers = (p.controllers ?? [])
        .map((id) => s.agents.find((a) => a.id === id)?.name)
        .filter(Boolean);
      const names = controllers.join(' + ');
      const visibleNames =
        controllers.slice(0, 2).join(' + ') +
        (controllers.length > 2 ? ` +${controllers.length - 2}` : '');
      const caption = t('world.' + p.type) + (names ? ' · ' + visibleNames : '');
      if (label.textContent !== caption) {
        label.textContent = caption;
        label._livingSize = null;
      }
      label.title = names ? t('world.controlled', { name: names }) : t('world.public');
      label.dataset.controlled = Boolean(names);
      label.style.borderColor = s.agents.find((a) => a.id === p.controller)?.color ?? '#607880';
      projection
        .set(p.position.x, terrainHeight(p.position.x, p.position.z) + 3.7, p.position.z)
        .project(camera);
      const visible =
        tier !== 'close' &&
        !camera.userData.hideLabels &&
        projection.z < 1 &&
        Math.abs(projection.x) < 1 &&
        Math.abs(projection.y) < 1;
      label.style.display = visible ? 'block' : 'none';
      if (!visible) continue;
      label._livingSize ??= { width: label.offsetWidth, height: label.offsetHeight };
      const { width, height } = label._livingSize;
      const x = Math.max(
        width / 2 + 6,
        Math.min(viewportWidth - width / 2 - 6, (projection.x * 0.5 + 0.5) * viewportWidth),
      );
      const anchorY = (-projection.y * 0.5 + 0.5) * viewportHeight;
      let y = anchorY,
        rect;
      // Eight labels, bounded screen-space search; no gameplay or camera changes.
      for (let step = 0; step < 17; step++) {
        const offset = Math.ceil(step / 2) * (height + 6) * (step % 2 ? -1 : 1);
        y = Math.max(92 + height / 2, Math.min(viewportHeight - height / 2 - 8, anchorY + offset));
        rect = {
          left: x - width / 2,
          right: x + width / 2,
          top: y - height / 2,
          bottom: y + height / 2,
        };
        if (
          !placed.some(
            (r) =>
              rect.left < r.right + 4 &&
              rect.right > r.left - 4 &&
              rect.top < r.bottom + 4 &&
              rect.bottom > r.top - 4,
          )
        )
          break;
      }
      placed.push(rect);
      label.dataset.shift = y > anchorY ? 'down' : 'up';
      label.style.setProperty(
        '--poi-leader',
        `${Math.max(0, Math.abs(y - anchorY) - height / 2)}px`,
      );
      label.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
    }
    for (const [id, m] of hazards)
      if (!w.hazards.some((h) => h.id === id)) {
        group.remove(m);
        m.traverse((o) => {
          o.geometry?.dispose();
          o.material?.dispose();
        });
        hazards.delete(id);
      }
    for (const h of w.hazards) {
      let m = hazards.get(h.id);
      if (!m) {
        m = new THREE.Mesh(
          h.type === 'fire'
            ? new THREE.ConeGeometry(h.radius * 0.65, 3, 7)
            : new THREE.BoxGeometry(h.radius * 2, 0.45, h.radius * 2),
          new THREE.MeshBasicMaterial({
            color: h.type === 'fire' ? '#ee7744' : '#619ece',
            transparent: true,
            opacity: 0.45,
          }),
        );
        group.add(m);
        const smoke = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.7, 0),
          new THREE.MeshBasicMaterial({
            color: '#44565e',
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
          }),
        );
        smoke.position.y = 2.6;
        smoke.visible = h.type === 'fire';
        m.add(smoke);
        const glow = new THREE.PointLight('#ff954f', h.type === 'fire' ? 3 : 0, h.radius * 3);
        m.add(glow);
        if (h.type === 'flood') {
          const warning = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.28),
            new THREE.MeshBasicMaterial({ color: '#ebc87c' }),
          );
          warning.position.y = 0.85;
          m.add(warning);
        }
        if (h.type === 'fire') {
          for (let i = 0; i < 5; i++) {
            const flame = new THREE.Mesh(
              new THREE.ConeGeometry(0.35, 1.5, 5),
              new THREE.MeshBasicMaterial({
                color: i % 2 ? '#ffbb66' : '#ee8959',
                transparent: true,
                opacity: 0.8,
              }),
            );
            flame.position.set(
              Math.sin(i * 2.4) * h.radius * 0.65,
              0.1,
              Math.cos(i * 2.4) * h.radius * 0.65,
            );
            m.add(flame);
          }
        }
        hazards.set(h.id, m);
      }
      m.position.set(h.position.x, terrainHeight(h.position.x, h.position.z) + 0.6, h.position.z);
      m.scale.y = h.type === 'fire' ? 1 + Math.sin(s.elapsed * 8) * 0.15 : 1;
      m.rotation.y = h.type === 'flood' ? Math.sin(s.elapsed * 2) * 0.025 : 0;
      if (m.children[0]) m.children[0].rotation.y = s.elapsed * 0.3;
    }
    rain.visible = w.weather !== 'clear';
    rain.position.y = -((time * (w.weather === 'storm' ? 8 : 4)) % 10);
    rain.rotation.z = w.weather === 'storm' ? 0.18 : 0.03;
    rain.material.opacity = w.weather === 'storm' ? 0.65 : 0.35;
  }
  return {
    update,
    kit,
    objects,
    hazards,
    historyGroup,
    seedHistory(events) {
      for (const e of events ?? []) eventCache.set(e.id, e);
    },
    dispose() {
      disposed = true;
      labelHost.remove();
      hud.remove();
    },
  };
}
