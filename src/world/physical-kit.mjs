import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainHeight } from '../../core/world.mjs';
import collisionData from '../../public/assets/world-collision.json' with { type: 'json' };
const colors = {
  concrete: '#91a9ab',
  wood: '#927457',
  metal: '#526975',
  medical: '#e2efea',
  industrial: '#293e49',
  glass: '#85bdce',
  water: '#57acae',
  vegetation: '#537964',
  emission: '#93eadb',
  damage: '#343d40',
};
export function createPhysicalKit(scene) {
  const root = new THREE.Group();
  root.name = 'physical-pois';
  scene.add(root);
  const materials = Object.fromEntries(
    Object.entries(colors).map(([k, color]) => [
      k,
      new THREE.MeshStandardMaterial({
        color,
        roughness: k === 'metal' ? 0.5 : 0.8,
        metalness: k === 'metal' ? 0.35 : 0,
        emissive: k === 'emission' ? color : 0,
        emissiveIntensity: k === 'emission' ? 0.6 : 0,
      }),
    ]),
  );
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cone: new THREE.ConeGeometry(1, 1, 4),
    rock: new THREE.DodecahedronGeometry(1, 0),
  };
  for (const [name, m] of Object.entries(materials)) m.name = name;
  const waterTime = { value: 0 };
  materials.water.onBeforeCompile = (shader) => {
    shader.uniforms.visualWaterTime = waterTime;
    shader.fragmentShader = 'uniform float visualWaterTime;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\n diffuseColor.rgb *= .94 + .06*sin(vViewPosition.x*5. + visualWaterTime*2.);',
    );
  };
  const parts = new Map(),
    pois = new Map();
  let batch = [];
  // GLB geometries are normalized so kit assembly dimensions remain explicit.
  const ready = new GLTFLoader()
    .loadAsync('/assets/world-kit.glb')
    .then((gltf) => {
      gltf.scene.traverse((o) => {
        if (o.isMesh) {
          o.geometry.computeBoundingBox();
          const size = new THREE.Vector3();
          o.geometry.boundingBox.getSize(size);
          const g = o.geometry.clone();
          g.scale(1 / size.x, 1 / size.y, 1 / size.z);
          parts.set(o.name, g);
        }
      });
      return true;
    })
    .catch(() => false); // Procedural kit fallback keeps offline/old archives usable.
  function piece(kind, x, y, z, w, h, d, material = 'concrete', angle = 0) {
    const geometry = parts.get(kind) ?? geometries.box;
    const m = new THREE.Mesh(geometry, materials[material]);
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    m.rotation.y = angle;
    m.castShadow = true;
    m.receiveShadow = true;
    batch.push(m);
    return m;
  }
  function flush(parent) {
    // At most one draw per palette material for each landmark.
    for (const material of Object.values(materials)) {
      const meshes = batch.filter((m) => m.material === material);
      if (!meshes.length) continue;
      const copies = meshes.map((m) => {
        m.updateMatrix();
        return m.geometry.clone().applyMatrix4(m.matrix);
      });
      const merged = mergeGeometries(copies);
      copies.forEach((g) => g.dispose());
      const m = new THREE.Mesh(merged, material.name === 'emission' ? material.clone() : material);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
    }
    batch = [];
  }
  function courtyard(p, material, roofColor) {
    const { x, z } = p.position,
      y = terrainHeight(x, z);
    // Open sides: authoritative v1.5 agents may approach from any direction.
    // No decorative solid wall spans a traversable route; elevated canopy/posts.
    piece('platform', x, y + 0.06, z, 7, 0.12, 6, material);
    for (const dx of [-3.4, 3.4])
      for (const dz of [-2.8, 2.8])
        piece('pipe', x + dx, y + 1.65, z + dz, 0.15, 3.3, 0.15, 'metal');
    piece('roof', x, y + 3.5, z, 7.5, 0.22, 6.5, roofColor);
    // Roof is cut back on camera-facing side so occupants are observable.
    batch.at(-1).scale.z = 3;
    batch.at(-1).position.z = z + 1.6;
    piece('sign', x, y + 2.8, z - 2.9, 2.3, 0.55, 0.12, 'industrial');
    return y;
  }
  function build(world) {
    for (const c of root.children) {
      c.traverse((o) => {
        o.geometry?.dispose();
        if (o.material && !Object.values(materials).includes(o.material)) o.material.dispose();
      });
    }
    root.clear();
    pois.clear();
    for (const p of world.pois) {
      const g = new THREE.Group();
      g.userData.poiId = p.id;
      root.add(g);
      const { x, z } = p.position,
        y = terrainHeight(x, z);
      if (['clinic', 'shelter', 'depot'].includes(p.type)) {
        courtyard(
          p,
          p.type === 'clinic' ? 'medical' : 'concrete',
          p.type === 'shelter' ? 'wood' : 'metal',
        );
        if (p.type === 'clinic') {
          piece('sign', x, y + 3.15, z - 2.95, 0.28, 1, 0.18, 'emission');
          piece('sign', x, y + 3.15, z - 2.95, 1, 0.28, 0.18, 'emission');
          for (const dx of [-2.9, 2.9])
            piece('cabinet', x + dx, y + 0.8, z + 2.2, 0.65, 1.5, 0.6, 'medical');
          piece('pipe', x + 2.8, y + 2, z + 2.3, 0.09, 0.8, 0.09, 'metal');
        } else if (p.type === 'depot') {
          for (const dx of [-2.8, 2.8]) {
            for (const h of [0.6, 1.5, 2.4])
              piece(
                'shelf',
                x + dx,
                y + h,
                z + (world.spatial && dx > 0 ? 2.4 : 1.7),
                0.75,
                0.1,
                world.spatial && dx > 0 ? 0.5 : 2,
                'metal',
              );
            for (const dz of [1, 2])
              piece('crate', x + dx, y + 0.9, z + dz, 0.55, 0.6, 0.6, 'wood');
          }
          piece('platform', x, y + 0.08, z - 4, 4, 0.15, 1.5, 'industrial');
          for (const dx of [-3.8, 3.8])
            piece(
              'fence',
              x + dx,
              y + 0.6,
              z - (world.spatial && dx > 0 ? 0.9 : 0),
              0.1,
              1.2,
              world.spatial && dx > 0 ? 3.2 : 5,
              'metal',
            );
        } else {
          for (const dx of [-2.8, 2.8]) piece('bed', x + dx, y + 0.4, z + 1.5, 0.5, 0.6, 2, 'wood');
        }
      }
      if (p.type === 'village') {
        piece('platform', x, y + 0.02, z, 9, 0.06, 8, 'concrete');
        for (const [dx, dz] of [
          [-3, 2],
          [3, 2],
          [-3, 5],
          [3, 5],
        ]) {
          // Raised short shell with open arcade, keeping all ground routes free.
          for (const side of [-1, 1])
            piece('pipe', x + dx + side, y + 1.1, z + dz, 0.14, 2.2, 0.14, 'wood');
          const roof = piece('roof', x + dx, y + 2.45, z + dz, 2.7, 0.25, 2.8, 'wood');
          roof.geometry = geometries.cone;
          roof.scale.set(2, 1.2, 2);
          roof.rotation.y = Math.PI / 4;
          // Upper wall panels leave a continuous walkable arcade at ground level.
          piece('wall', x + dx, y + 1.85, z + dz + 1.2, 2, 0.8, 0.1, 'concrete');
          piece('window', x + dx, y + 1.8, z + dz + 1.2, 0.8, 0.5, 0.08, 'emission');
        }
        for (const dx of [-4.5, 4.5]) {
          piece('fence', x + dx, y + 0.55, z + 2, 0.1, 1.1, 4, 'wood');
          piece('lamp', x + dx, y + 2.5, z, 0.3, 0.35, 0.3, 'emission');
          piece('pipe', x + dx, y + 1.2, z, 0.08, 2.4, 0.08, 'metal');
        }
        piece('pipe', x, y + 2.2, z + 3, 5, 0.08, 0.08, 'industrial');
      }
      if (p.type === 'ruins') {
        for (let i = 0; i < 5; i++) {
          const dx = Math.cos(i * 1.3) * 3,
            dz = Math.sin(i * 1.3) * 3;
          piece('wall', x + dx, y + 0.65, z + dz, 1.2, 1.3, 0.4, 'concrete', i);
          piece('pipe', x + dx, y + 1.6, z + dz, 0.45, 1.9, 0.45, 'concrete');
        }
        for (let i = 0; i < 10; i++)
          piece(
            'debris',
            x + Math.sin(i * 3.4) * 3.5,
            y + 0.17,
            z + Math.cos(i * 2.1) * 2.5,
            0.5,
            0.35,
            0.65,
            'damage',
            i,
          );
      }
      if (p.type === 'bridge') {
        piece('bridge', x, y + 0.3, z, 6, 0.28, 2.3, 'wood');
        for (const dz of [-1.2, 1.2]) {
          piece('fence', x, y + 1, z + dz, 6, 0.12, 0.1, 'metal');
          for (const dx of [-2.8, 0, 2.8])
            piece('pipe', x + dx, y + 0.4, z + dz, 0.12, 1.5, 0.12, 'metal');
        }
      }
      if (p.type === 'lake') {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.3, 0.18, 24), materials.water);
        m.position.set(x, y + 0.08, z);
        g.add(m);
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2;
          piece(
            'debris',
            x + Math.cos(a) * 3.3,
            y + 0.1,
            z + Math.sin(a) * 3.3,
            0.6,
            0.35,
            0.7,
            'concrete',
            a,
          );
          if (i % 2 === 0)
            piece(
              'pipe',
              x + Math.cos(a) * 3.7,
              y + 0.6,
              z + Math.sin(a) * 3.7,
              0.08,
              1.1,
              0.08,
              'vegetation',
            );
        }
        piece('platform', x, y + 0.2, z - 3.8, 1.3, 0.12, 2, 'wood');
      }
      if (world.spatial) {
        if (p.type === 'village')
          for (const c of collisionData.colliders.filter((c) => c.kind === 'rock')) {
            const rock = piece(
              'debris',
              c.x,
              terrainHeight(c.x, c.z) + c.height / 2,
              c.z,
              c.radius,
              c.height / 2,
              c.radius,
              'concrete',
            );
            rock.geometry = geometries.rock;
          }
        for (const c of collisionData.colliders.filter(
          (c) => c.region === p.type && c.kind === 'wall',
        ))
          piece(
            'wall',
            c.x,
            terrainHeight(c.x, c.z) + c.height / 2,
            c.z,
            c.width,
            c.height,
            c.depth,
            'concrete',
          );
        for (const route of collisionData.verticalRoutes.filter((r) => r.id.startsWith(p.type))) {
          for (let i = 1; i < route.nodes.length; i++) {
            const a = route.nodes[i - 1],
              b = route.nodes[i],
              length = Math.hypot(b.x - a.x, b.z - a.z),
              angle = Math.atan2(b.x - a.x, b.z - a.z),
              count = Math.ceil(length / 0.25);
            for (let j = 0; j < count; j++) {
              const f = (j + 0.5) / count,
                rx = a.x + (b.x - a.x) * f,
                rz = a.z + (b.z - a.z) * f,
                ry = terrainHeight(rx, rz) + a.y + (b.y - a.y) * f;
              piece('platform', rx, ry, rz, route.width, 0.12, length / count, 'concrete', angle);
            }
          }
          if (p.type === 'ruins')
            piece('platform', 11, terrainHeight(11, -10) + 1.5, -10, 2.8, 0.2, 2.6, 'concrete');
        }
      }
      flush(g);
      const control = new THREE.Group(),
        ring = new THREE.Mesh(
          new THREE.TorusGeometry(p.type === 'bridge' ? 2.6 : 3.8, 0.045, 4, 32),
          new THREE.MeshBasicMaterial({ color: '#93eadb' }),
        );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, y + 0.18, z);
      control.add(ring);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.65, 0.06), ring.material);
      flag.position.set(x + 3, y + 3.2, z + 1);
      control.add(flag);
      const pole = new THREE.Mesh(geometries.box, materials.metal);
      pole.scale.set(0.08, 3, 0.08);
      pole.position.set(x + 3, y + 1.5, z + 1);
      g.add(pole);
      g.add(control);
      const damage = new THREE.Mesh(
        new THREE.CircleGeometry(3, 14),
        new THREE.MeshBasicMaterial({
          color: '#222b2e',
          transparent: true,
          opacity: 0.38,
          depthWrite: false,
        }),
      );
      damage.rotation.x = -Math.PI / 2;
      damage.position.set(x, y + 0.12, z);
      g.add(damage);
      const debris = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const chunk = new THREE.Mesh(geometries.box, materials.damage);
        chunk.scale.set(0.4, 0.18, 0.65);
        chunk.rotation.y = i;
        chunk.position.set(x + Math.sin(i * 2.1) * 2.5, y + 0.23, z + Math.cos(i * 1.7) * 2);
        debris.add(chunk);
      }
      g.add(debris);
      const light = new THREE.PointLight(
        p.type === 'clinic' ? '#b8e9ed' : p.type === 'depot' ? '#8fbdcc' : '#f6bd83',
        0,
        8,
      );
      light.position.set(x, y + 2, z);
      if (['clinic', 'shelter', 'depot'].includes(p.type)) g.add(light);
      pois.set(p.id, { g, control, ring, flag, damage, debris, light });
    }
    // Paths follow original world coordinates, visual only.
    const pathGroup = new THREE.Group();
    root.add(pathGroup);
    const center = world.pois.find((p) => p.type === 'depot').position;
    for (const p of world.pois) {
      const dx = p.position.x - center.x,
        dz = p.position.z - center.z,
        length = Math.hypot(dx, dz);
      if (length < 1) continue;
      for (let i = 0; i < Math.ceil(length); i++) {
        const f = (i + 0.5) / Math.ceil(length),
          x = center.x + dx * f,
          z = center.z + dz * f;
        piece(
          'platform',
          x,
          terrainHeight(x, z) + 0.025,
          z,
          p.type === 'depot' ? 2 : 1.1,
          0.04,
          1.05,
          'wood',
          Math.atan2(dx, dz),
        );
      }
    }
    flush(pathGroup);
  }
  function update(s, time, traces) {
    waterTime.value = time;
    for (const p of s.world.pois) {
      const v = pois.get(p.id);
      if (!v) continue;
      const controlled = p.controllers?.length > 0;
      v.control.visible = controlled || p.access === 'contested';
      const color = s.agents.find((a) => a.id === p.controller)?.color ?? '#e3bc83';
      v.ring.material.color.set(color);
      v.flag.rotation.y = Math.sin(time * 2) * 0.12;
      v.ring.scale.setScalar(p.access === 'contested' ? 1 + Math.sin(time * 6) * 0.07 : 1);
      v.flag.scale.y = p.access === 'contested' ? 0.5 + 0.5 * Math.abs(Math.sin(time * 6)) : 1;
      v.damage.visible = traces.some(
        (e) =>
          e.data?.poi === p.id &&
          ['ATTACK', 'BETRAYAL', 'FIRE_STARTED', 'BRIDGE_BLOCKED'].includes(e.event),
      );
      v.debris.visible = v.damage.visible;
      v.g.userData.condition = v.damage.visible
        ? 'damaged'
        : traces.some((e) => e.data?.poi === p.id)
          ? 'used'
          : 'clean';
      const power =
        !['clinic', 'village'].includes(p.type) ||
        s.world.objects.some(
          (o) =>
            o.type === 'generator' && o.state === 'online' && o.metadata.powerZone === 'village',
        );
      v.light.intensity = power ? (s.world.timeOfDay === 'night' ? 3 : 0.4) : 0;
      v.g.traverse((o) => {
        if (o.isMesh && o.material.name === 'emission') {
          o.material.emissiveIntensity = power ? (s.world.timeOfDay === 'night' ? 1.2 : 0.4) : 0;
          o.material.color.set(power ? '#93eadb' : '#465d61');
        }
      });
    }
  }
  return { root, ready, build, update, pois, materials };
}
