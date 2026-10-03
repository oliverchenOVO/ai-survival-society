import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
// Rigless, pivoted visual assemblies. Bake source material colors into vertices
// so ceramic/metal/identity details retain their colors in a single draw.
export function assembleRobot(model) {
  model.updateMatrixWorld(true);
  const inverse = model.matrixWorld.clone().invert(),
    meshes = [];
  model.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  const skin = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    metalness: 0.3,
    roughness: 0.45,
  });
  const regions = new Map(),
    pivots = {
      body: [0, 0, 0],
      Head: [0, 1.64, 0],
      'Arm.L': [-0.43, 1.23, 0],
      'Arm.R': [0.43, 1.23, 0],
      'Leg.L': [-0.18, 0.67, 0],
      'Leg.R': [0.18, 0.67, 0],
    };
  for (const mesh of meshes) {
    if (Array.isArray(mesh.material)) return false;
    const x = mesh.position.x;
    const region = /^(Arm|Hand)/.test(mesh.name)
      ? x < 0
        ? 'Arm.L'
        : 'Arm.R'
      : /^(Leg|Boot)/.test(mesh.name)
        ? x < 0
          ? 'Leg.L'
          : 'Leg.R'
        : /^(Head|Visor|Optic|Antenna|Ear|Crest|Scout)/.test(mesh.name)
          ? 'Head'
          : 'body';
    const emissive =
      (mesh.material.emissiveIntensity ?? 0) > 0 && mesh.material.emissive?.getHex() > 0;
    const key = region + ':' + (emissive ? mesh.material.uuid : 'skin');
    if (!regions.has(key))
      regions.set(key, {
        region,
        material: emissive ? mesh.material.clone() : skin,
        geometries: [],
      });
    const local = inverse.clone().multiply(mesh.matrixWorld),
      pivot = pivots[region];
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    g.applyMatrix4(local);
    g.translate(-pivot[0], -pivot[1], -pivot[2]);
    for (const name of Object.keys(g.attributes))
      if (!['position', 'normal'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    const colors = new Float32Array(g.attributes.position.count * 3),
      color = emissive ? new THREE.Color('#ffffff') : mesh.material.color;
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = color.r;
      colors[i + 1] = color.g;
      colors[i + 2] = color.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    regions.get(key).geometries.push(g);
  }
  const groups = new Map(),
    assembled = [];
  for (const { region, material, geometries } of regions.values()) {
    const geometry = mergeGeometries(geometries);
    geometries.forEach((g) => g.dispose());
    if (!geometry) return false;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'assembly-surface';
    let group = groups.get(region);
    if (!group) {
      group = new THREE.Group();
      group.name = region;
      group.position.fromArray(pivots[region]);
      groups.set(region, group);
      assembled.push(group);
    }
    group.add(mesh);
  }
  model.clear();
  for (const group of assembled) model.add(group);
  const oldMaterials = new Set(meshes.map((m) => m.material));
  meshes.forEach((m) => m.geometry.dispose());
  oldMaterials.forEach((m) => m.dispose());
  model.userData.assembly = {
    sourceMeshes: meshes.length,
    renderMeshes: regions.size,
    limbPivots: 4,
  };
  return true;
}
