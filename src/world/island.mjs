import * as THREE from 'three';
import Delaunator from 'delaunator';
import { randomGenerator } from '../../core/random.mjs';
import { terrainHeight } from '../../core/world.mjs';
const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });
export function createIsland(scene, seed) {
  const rng = randomGenerator(seed),
    group = new THREE.Group();
  scene.add(group);
  const grass = [
    new THREE.Color('#789878'),
    new THREE.Color('#87a78a'),
    new THREE.Color('#a0b393'),
    new THREE.Color('#64866e'),
  ];
  const positions = [],
    colors = [],
    indices = [],
    points = [],
    segments = 96;
  const riverDepth = (x, z) =>
    Math.abs(x - Math.sin(z * 0.16) * 3.7 - 1.5) < 1.1 && z > -20 ? 0.8 : 0;
  const addPoint = (x, z, boundary = false) => {
    points.push([x, z]);
    positions.push(
      x,
      terrainHeight(x, z) + (boundary ? 0 : (rng() - 0.5) * 0.24) - riverDepth(x, z),
      z,
    );
    const c =
      boundary || Math.hypot(x, z) > 27
        ? new THREE.Color('#c4b99b')
        : grass[Math.floor(rng() * grass.length)];
    colors.push(...c.toArray());
  };
  for (let i = 0; i < 1400; i++) {
    const angle = rng() * Math.PI * 2,
      radius = Math.sqrt(rng()) * 28;
    addPoint(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2,
      radius = 30 * (1 + Math.sin(angle * 5) * 0.035 + Math.cos(angle * 7) * 0.03);
    addPoint(Math.cos(angle) * radius, Math.sin(angle) * radius, true);
  }
  const triangles = Delaunator.from(points).triangles;
  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i],
      b = triangles[i + 1],
      c = triangles[i + 2];
    const cross =
      (points[b][0] - points[a][0]) * (points[c][1] - points[a][1]) -
      (points[b][1] - points[a][1]) * (points[c][0] - points[a][0]);
    indices.push(a, cross > 0 ? c : b, cross > 0 ? b : c);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const top = new THREE.Mesh(geometry, mat('#ffffff', { vertexColors: true }));
  top.receiveShadow = true;
  group.add(top);
  // Sculpted rock skirt, individual facets catch the amber sun.
  const skirtPos = [],
    skirtColors = [];
  for (let j = 0; j < segments; j++) {
    const a = (j / segments) * Math.PI * 2,
      b = ((j + 1) / segments) * Math.PI * 2;
    const rad = (t) => 30 * (1 + Math.sin(t * 5) * 0.035 + Math.cos(t * 7) * 0.03);
    const x = Math.cos(a) * rad(a),
      z = Math.sin(a) * rad(a),
      x2 = Math.cos(b) * rad(b),
      z2 = Math.sin(b) * rad(b);
    const h = terrainHeight(x, z),
      h2 = terrainHeight(x2, z2),
      bottom = -4 - rng() * 3;
    const vertices = [
      x,
      h,
      z,
      x * 0.88,
      bottom,
      z * 0.88,
      x2,
      h2,
      z2,
      x2,
      h2,
      z2,
      x * 0.88,
      bottom,
      z * 0.88,
      x2 * 0.88,
      bottom,
      z2 * 0.88,
    ];
    skirtPos.push(...vertices);
    const c = new THREE.Color(rng() > 0.5 ? '#6a7772' : '#8a9286');
    for (let k = 0; k < 6; k++) skirtColors.push(...c.toArray());
  }
  const skirtGeo = new THREE.BufferGeometry();
  skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(skirtPos, 3));
  skirtGeo.setAttribute('color', new THREE.Float32BufferAttribute(skirtColors, 3));
  skirtGeo.computeVertexNormals();
  const skirt = new THREE.Mesh(
    skirtGeo,
    mat('#ffffff', { vertexColors: true, side: THREE.DoubleSide }),
  );
  skirt.castShadow = true;
  skirt.receiveShadow = true;
  group.add(skirt);
  const trunkMat = mat('#5c5944'),
    leafMats = [mat('#2c6655'), mat('#397b60'), mat('#507e5d')],
    rockMat = mat('#8a9487');
  function addMesh(geo, material, x, y, z, scale = 1) {
    const o = new THREE.Mesh(geo, material);
    o.position.set(x, y, z);
    o.scale.setScalar(scale);
    o.castShadow = true;
    o.receiveShadow = true;
    group.add(o);
    return o;
  }
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 1.8, 5),
    leaves = new THREE.ConeGeometry(1.25, 2.7, 6),
    rockGeo = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 130; i++) {
    const x = (rng() - 0.5) * 54,
      z = (rng() - 0.5) * 52;
    if (
      Math.hypot(x, z) > 27 ||
      Math.abs(x - Math.sin(z * 0.16) * 3.7 - 1.5) < 2 ||
      Math.hypot(x + 10, z - 12) < 6 ||
      Math.hypot(x - 10, z + 10) < 5 ||
      Math.hypot(x, z) < 4
    )
      continue;
    const y = terrainHeight(x, z),
      s = 0.65 + rng() * 0.6;
    addMesh(trunkGeo, trunkMat, x, y + 0.9 * s, z, s);
    for (let k = 0; k < 3; k++)
      addMesh(leaves, leafMats[i % 3], x, y + (1.6 + k * 0.75) * s, z, s * (1 - k * 0.18));
  }
  for (let i = 0; i < 72; i++) {
    const a = rng() * Math.PI * 2,
      r = 8 + rng() * 20,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    if (Math.abs(x - Math.sin(z * 0.16) * 3.7 - 1.5) < 2) continue;
    const o = addMesh(rockGeo, rockMat, x, terrainHeight(x, z) + 0.2, z, 0.25 + rng() * 1.2);
    o.scale.y *= 0.65;
    o.rotation.set(rng(), rng(), rng());
  }
  // Meandering river is actual geometry with opaque cyan water, crossed by two timber bridges.
  const riverPos = [];
  for (let z = -19; z < 29; z += 1) {
    const x = Math.sin(z * 0.16) * 3.7 + 1.5,
      x2 = Math.sin((z + 1) * 0.16) * 3.7 + 1.5;
    const y = terrainHeight(x, z) + 0.1,
      y2 = terrainHeight(x2, z + 1) + 0.1;
    riverPos.push(
      x - 1.05,
      y,
      z,
      x + 1.05,
      y,
      z,
      x2 - 1.05,
      y2,
      z + 1,
      x + 1.05,
      y,
      z,
      x2 + 1.05,
      y2,
      z + 1,
      x2 - 1.05,
      y2,
      z + 1,
    );
  }
  const riverGeo = new THREE.BufferGeometry();
  riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(riverPos, 3));
  riverGeo.computeVertexNormals();
  group.add(
    new THREE.Mesh(
      riverGeo,
      mat('#57c5bd', {
        metalness: 0.35,
        roughness: 0.22,
        side: THREE.DoubleSide,
        emissive: '#163c38',
        emissiveIntensity: 0.15,
      }),
    ),
  );
  for (const z of [-5, 13]) {
    const x = Math.sin(z * 0.16) * 3.7 + 1.5,
      y = terrainHeight(x, z) + 0.4;
    for (let k = -5; k <= 5; k++)
      addMesh(new THREE.BoxGeometry(0.24, 0.16, 2), mat('#886f50'), x + k * 0.28, y, z);
    for (const dz of [-0.95, 0.95]) {
      addMesh(new THREE.BoxGeometry(3.2, 0.1, 0.1), trunkMat, x, y + 0.65, z + dz);
      for (const dx of [-1.5, 1.5])
        addMesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), trunkMat, x + dx, y + 0.35, z + dz);
    }
  }
  const stone = mat('#c6c2a7'),
    roofMat = mat('#6d6452'),
    walls = mat('#d2c3a0'),
    window = mat('#ffce86', { emissive: '#e4a552', emissiveIntensity: 1.4 });
  for (let i = 0; i < 6; i++) {
    const x = -13 + (i % 3) * 3.3,
      z = 10 + Math.floor(i / 3) * 4,
      y = terrainHeight(x, z);
    addMesh(new THREE.BoxGeometry(2.4, 1.9, 2.8), walls, x, y + 0.95, z);
    const roof = addMesh(new THREE.ConeGeometry(2.1, 1.15, 4), roofMat, x, y + 2.45, z);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 1.15;
    addMesh(new THREE.BoxGeometry(0.55, 0.55, 0.03), window, x, y + 1.1, z + 1.415);
    addMesh(new THREE.BoxGeometry(0.45, 0.8, 0.06), trunkMat, x + 0.65, y + 0.4, z + 1.43);
  }
  // Broken sanctuary columns and lintels, with a small glowing artifact.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2,
      x = 10 + Math.cos(a) * 3,
      z = -10 + Math.sin(a) * 3,
      y = terrainHeight(x, z),
      h = 2 + rng() * 2;
    addMesh(new THREE.CylinderGeometry(0.35, 0.45, h, 7), stone, x, y + h / 2, z);
    addMesh(new THREE.BoxGeometry(0.9, 0.23, 0.9), stone, x, y + h, z);
  }
  addMesh(
    new THREE.CylinderGeometry(3.6, 3.8, 0.4, 12),
    stone,
    10,
    terrainHeight(10, -10) + 0.15,
    -10,
  );
  const artifact = addMesh(
    new THREE.OctahedronGeometry(0.55),
    mat('#f4c48a', { emissive: '#c8833d', emissiveIntensity: 1 }),
    10,
    terrainHeight(10, -10) + 1.3,
    -10,
  );
  const beacon = new THREE.Group();
  beacon.position.set(0, terrainHeight(0, 0), 0);
  group.add(beacon);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.6, 0.5, 12), mat('#c1b798'));
  pedestal.position.y = 0.25;
  pedestal.receiveShadow = true;
  beacon.add(pedestal);
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.12, 13, 8),
    new THREE.MeshBasicMaterial({ color: '#f5c979', transparent: true, opacity: 0.5 }),
  );
  tower.position.y = 6.5;
  beacon.add(tower);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.035, 6, 48),
    new THREE.MeshBasicMaterial({ color: '#efc38c' }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.55;
  beacon.add(halo);
  const light = new THREE.PointLight('#efba70', 20, 9, 2);
  light.position.set(0, 3, 0);
  beacon.add(light);
  return { group, artifact, beacon };
}
export function createOcean(scene) {
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec3 vPos; varying vec3 vWorld; uniform float time; void main(){ vec3 p=position; p.z+=sin(p.x*.16+time*.35)*.035+cos(p.y*.13-time*.2)*.035; vPos=p;vWorld=(modelMatrix*vec4(p,1.)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
    fragmentShader: `varying vec3 vPos;varying vec3 vWorld; uniform float time; void main(){float wave=sin(vPos.x*2.6+vPos.y*1.7+sin(vPos.y*.15)*2.+time*.4)*.5+.5;float light=pow(max(0.,1.-abs(vPos.x+vPos.y*.22-30.)/20.),4.);vec3 color=mix(vec3(.005,.025,.035),vec3(.007,.032,.043),wave*.12)+vec3(.048,.028,.009)*light;color=mix(color,vec3(.17,.085,.055),smoothstep(130.,750.,distance(cameraPosition,vWorld)));gl_FragColor=vec4(color,1.);}`,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000, 110, 110), material);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -2.6;
  scene.add(ocean);
  return material;
}
export function createSky(scene) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {},
    vertexShader: `varying vec3 vWorld; void main(){vWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 vWorld; void main(){float h=normalize(vWorld).y; vec3 c=mix(vec3(.17,.085,.055),vec3(.035,.08,.13),smoothstep(-.04,.17,h));float alignment=max(0.,dot(normalize(vWorld),normalize(vec3(-.5,.025,-.7))));c+=vec3(1.,.58,.22)*pow(alignment,3600.)+vec3(.12,.045,.005)*pow(alignment,150.);gl_FragColor=vec4(c,1.);}`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 20), material));
  const silhouettes = new THREE.Group();
  const materialRock = mat('#4b6368');
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    for (let j = 0; j < 4; j++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), materialRock);
      rock.scale.set(10 + j * 2, 8 + ((i + j) % 4) * 3, 9 + j);
      rock.position.set(Math.cos(angle) * 160 + j * 6, -4, Math.sin(angle) * 160 + j * 5);
      rock.rotation.set(0.15 * j, i * 0.4, 0);
      silhouettes.add(rock);
    }
  }
  scene.add(silhouettes);
}
