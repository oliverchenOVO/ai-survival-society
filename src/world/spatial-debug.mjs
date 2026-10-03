import * as THREE from 'three';
import data from '../../public/assets/world-collision.json' with { type: 'json' };
import { terrainHeight } from '../../core/world.mjs';
import { DEBUG_LAYERS } from './spatial-debug-settings.mjs';
export { readSpatialDebug } from './spatial-debug-settings.mjs';
export function createSpatialDebug(scene) {
  const root = new THREE.Group();
  root.name = 'spatial-debug';
  scene.add(root);
  const groups = Object.fromEntries(
    DEBUG_LAYERS.map((k) => {
      const g = new THREE.Group();
      g.name = k;
      root.add(g);
      return [k, g];
    }),
  );
  let stamp = '';
  const line = (points, color, parent) => {
    const g = new THREE.BufferGeometry().setFromPoints(
      points.map((p) => new THREE.Vector3(p.x, terrainHeight(p.x, p.z) + (p.y ?? 0) + 0.15, p.z)),
    );
    const m = new THREE.Line(
      g,
      new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.8 }),
    );
    m.renderOrder = 99;
    parent.add(m);
  };
  const ring = (p, r, color, parent) =>
    line(
      Array.from({ length: 25 }, (_, i) => ({
        x: p.x + Math.cos((i * Math.PI) / 12) * r,
        z: p.z + Math.sin((i * Math.PI) / 12) * r,
        y: p.y ?? 0,
      })),
      color,
      parent,
    );
  function clear(g) {
    for (const o of g.children) {
      o.geometry?.dispose();
      o.material?.dispose();
    }
    g.clear();
  }
  for (const c of data.colliders) {
    const p = { x: c.x, z: c.z, y: c.y ?? 0 };
    if (c.type === 'circle') ring(p, c.radius, '#ffad78', groups.collision);
    else {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(c.width, c.height || 0.2, c.depth),
        new THREE.MeshBasicMaterial({ color: '#ffad78', wireframe: true, depthTest: false }),
      );
      m.position.set(c.x, terrainHeight(c.x, c.z) + (c.y ?? 0) + (c.height || 0.2) / 2, c.z);
      m.renderOrder = 99;
      groups.collision.add(m);
    }
  }
  for (const r of data.regions)
    line(
      [...r.polygon, r.polygon[0]].map(([x, z]) => ({ x, z })),
      '#84d6ea',
      groups.regions,
    );
  for (const route of data.verticalRoutes) line(route.nodes, '#84d6ea', groups.regions);
  function update(s, flags) {
    root.visible = !!s.world?.spatial;
    for (const k of DEBUG_LAYERS) groups[k].visible = !!flags[k];
    if (!root.visible || !Object.values(flags).some(Boolean)) return;
    const next = s.matchId + ':' + s.elapsed;
    if (next === stamp) return;
    stamp = next;
    for (const k of ['portals', 'paths', 'slots', 'reservations', 'radii']) clear(groups[k]);
    for (const p of s.world.spatial.portals) {
      const door = s.world.objects.find((o) => o.id === p.objectId);
      const color = door && !['open', 'broken'].includes(door.state) ? '#f09284' : '#93eadb';
      line(
        p.axis === 'x'
          ? [
              { x: p.x, z: p.z - p.width / 2 },
              { x: p.x, z: p.z + p.width / 2 },
            ]
          : [
              { x: p.x - p.width / 2, z: p.z },
              { x: p.x + p.width / 2, z: p.z },
            ],
        color,
        groups.portals,
      );
      if (p.reservations.length) ring(p, 0.5, '#eabc7e', groups.reservations);
    }
    for (const slot of s.world.spatial.slots) {
      ring(
        slot,
        0.2,
        slot.state === 'occupied' ? '#f09284' : slot.state === 'reserved' ? '#eabc7e' : '#93eadb',
        groups.slots,
      );
      line([slot, { ...slot.facing, y: slot.y }], '#93eadb', groups.slots);
      if (slot.agentId) ring(slot, 0.4, '#eabc7e', groups.reservations);
    }
    for (const a of s.agents.filter((a) => a.alive)) {
      line([a.position, ...(a.spatial?.path ?? [])], a.color, groups.paths);
      ring(a.position, a.collisionRadius ?? 0.35, a.color, groups.radii);
    }
  }
  return {
    root,
    update,
    dispose() {
      for (const g of Object.values(groups)) clear(g);
      scene.remove(root);
    },
  };
}
