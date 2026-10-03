import { reserveInteraction, atInteractionSlot } from '../core/spatial.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLivingWorld } from '../core/living-world.mjs';
import { Simulation } from '../core/simulation.mjs';
import * as THREE from 'three';
import { buildStatefulObject } from '../src/world/stateful-objects.mjs';
import { animateRobot } from '../src/world/robot-motion.mjs';
import { assembleRobot } from '../src/world/robot-kit.mjs';
import {
  objectVisual,
  visualHistory,
  agentPose,
  phase,
  zoomTier,
  eventPriority,
} from '../src/world/visual-state.mjs';
test('instant completed slot interactions remain briefly visible without showing approach as use', () => {
  const s = new Simulation({ seed: 7 }),
    a = s.agents[0],
    o = s.world.objects.find((o) => o.type === 'medical_station');
  a.action = 'heal_at';
  a.target = o.id;
  const slot = reserveInteraction(s, a, o);
  a.position = { x: slot.x, z: slot.z, y: slot.y ?? 0 };
  const view = s.snapshot();
  assert.equal(agentPose(a, view).interaction, false);
  view.events = [
    { actor: a.id, event: 'STATION_HEAL', timestamp: s.elapsed, data: { object: o.id } },
  ];
  assert.equal(agentPose(a, view).interaction, true);
  view.elapsed += 1;
  assert.equal(agentPose(a, view).interaction, false);
});
test('visual projections preserve snapshots and gameplay RNG', () => {
  const sim = new Simulation({ seed: 7 }),
    world = sim.world,
    before = JSON.stringify(sim.export()),
    rng = sim.rng.getState();
  for (let i = 0; i < 100; i++) {
    world.objects.forEach((o) => objectVisual(o, world, sim.agents));
    sim.agents.forEach((a) => agentPose(a, sim));
    visualHistory(sim.bus.log, i);
    phase(i);
  }
  assert.equal(JSON.stringify(sim.export()), before);
  assert.equal(sim.rng.getState(), rng);
});
test('door cache generator medical and fuel states have distinct visual projections', () => {
  const world = createLivingWorld(7),
    door = world.objects.find((o) => o.type === 'door');
  door.state = 'closed';
  assert.equal(objectVisual(door, world).doorAngle, 0);
  door.state = 'open';
  assert.ok(objectVisual(door, world).doorAngle > 1);
  door.state = 'broken';
  assert.ok(objectVisual(door, world).broken);
  door.state = 'locked';
  assert.ok(objectVisual(door, world).locked);
  const cache = world.objects.find((o) => o.type === 'container');
  cache.state = 'full';
  assert.equal(objectVisual(cache, world).lidAngle, 0);
  cache.state = 'empty';
  assert.ok(!objectVisual(cache, world).contents);
  assert.ok(objectVisual(cache, world).lidAngle < 0);
  const gen = world.objects.find((o) => o.type === 'generator'),
    med = world.objects.find((o) => o.type === 'medical_station');
  gen.state = 'damaged';
  assert.ok(objectVisual(gen, world).damaged);
  assert.ok(!objectVisual(med, world).powered);
  gen.state = 'online';
  assert.ok(objectVisual(med, world).powered);
  med.metadata.charges = 0;
  assert.ok(!objectVisual(med, world).available);
  const fire = world.objects.find((o) => o.type === 'campfire');
  fire.state = 'lit';
  fire.metadata.fuel = 4;
  assert.ok(objectVisual(fire, world).lowFuel);
  fire.state = 'extinguished';
  assert.ok(objectVisual(fire, world).extinguished);
});
test('visual history excludes future events, expires temporary marks, retains bounded major traces', () => {
  const events = [
    { id: 1, event: 'ATTACK', timestamp: 5 },
    { id: 2, event: 'FIRE_STARTED', timestamp: 10 },
    { id: 3, event: 'CONTAINER_SEARCHED', timestamp: 90 },
  ];
  assert.deepEqual(
    visualHistory(events, 8).map((e) => e.id),
    [1],
  );
  assert.deepEqual(
    visualHistory(events, 80).map((e) => e.id),
    [2],
  );
  assert.deepEqual(
    visualHistory(events, 100).map((e) => e.id),
    [2, 3],
  );
  assert.deepEqual(
    visualHistory(events, 8).map((e) => e.id),
    [1],
  );
  assert.equal(
    visualHistory(
      Array.from({ length: 150 }, (_, id) => ({ id, event: 'FIRE_STARTED', timestamp: id })),
      200,
    ).length,
    96,
  );
});
test('contextual facing, shutdown, LOD and camera priority remain visual only', () => {
  const sim = new Simulation({ seed: 7 }),
    a = sim.agents[0],
    g = sim.world.objects.find((o) => o.type === 'generator');
  a.target = g.id;
  a.action = 'repair';
  const slot = reserveInteraction(sim, a, g);
  a.position = { x: slot.x, z: slot.z, y: slot.y };
  atInteractionSlot(sim, a, g);
  assert.deepEqual(agentPose(a, sim).target, g.position);
  a.target = sim.agents[1].id;
  a.action = 'attack';
  assert.deepEqual(agentPose(a, sim).target, sim.agents[1].position);
  a.alive = false;
  assert.equal(agentPose(a, sim).action, 'shutdown');
  assert.deepEqual([zoomTier(12), zoomTier(50), zoomTier(90)], ['close', 'medium', 'far']);
  assert.ok(eventPriority.DEATH > eventPriority.ATTACK);
  assert.equal(phase('Nova'), phase('Nova'));
});
test('actual scene objects change hinge, lid, contents, motor, lights and flame visibility', () => {
  const world = createLivingWorld(7),
    group = new THREE.Group();
  const door = world.objects.find((o) => o.type === 'door'),
    d = buildStatefulObject(door, group);
  door.state = 'closed';
  d.update(world, [], 3);
  assert.equal(d.hinge.rotation.y, 0);
  door.state = 'open';
  d.update(world, [], 4);
  assert.ok(d.hinge.rotation.y > 1);
  door.state = 'broken';
  d.update(world, [], 5);
  assert.ok(d.hinge.rotation.z > 0);
  const cache = world.objects.find((o) => o.type === 'container'),
    c = buildStatefulObject(cache, group);
  cache.state = 'full';
  c.update(world, [], 3);
  assert.ok(c.contents.visible);
  assert.equal(c.lid.rotation.x, 0);
  cache.state = 'empty';
  c.update(world, [], 4);
  assert.ok(!c.contents.visible);
  assert.ok(c.lid.rotation.x < 0);
  const gen = world.objects.find((o) => o.type === 'generator'),
    g = buildStatefulObject(gen, group);
  gen.state = 'offline';
  g.update(world, [], 3);
  assert.equal(g.motor.rotation.z, 0);
  assert.equal(g.light.intensity, 0);
  gen.state = 'online';
  g.update(world, [], 4);
  assert.ok(g.motor.rotation.z > 0);
  assert.ok(g.light.intensity > 0);
  const fire = world.objects.find((o) => o.type === 'campfire'),
    f = buildStatefulObject(fire, group);
  fire.state = 'unlit';
  f.update(world, [], 3);
  assert.ok(!f.flames.visible);
  fire.state = 'lit';
  f.update(world, [], 4);
  assert.ok(f.flames.visible);
});
test('robot scene limbs move, face interaction targets, flash on impact and retain full-size wrecks', () => {
  const sim = new Simulation({ seed: 7 }),
    a = sim.agents[0],
    wrapper = new THREE.Group(),
    model = new THREE.Group();
  wrapper.add(model);
  for (const name of ['Arm', 'Leg']) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.4, 0.2),
      new THREE.MeshStandardMaterial({ color: '#cccccc' }),
    );
    m.name = name;
    m.position.set(0.2, 0.5, 0);
    model.add(m);
  }
  a.action = 'repair';
  const gen = sim.world.objects.find((o) => o.type === 'generator');
  a.target = gen.id;
  const slot = reserveInteraction(sim, a, gen);
  a.position = { x: slot.x, z: slot.z, y: slot.y };
  atInteractionSlot(sim, a, gen);
  const before = JSON.stringify(sim.export());
  animateRobot(wrapper, a, sim.snapshot(), 2, 0.1, true);
  const angle = model.children[0].rotation.x;
  animateRobot(wrapper, a, sim.snapshot(), 2.2, 0.1, true);
  assert.notEqual(model.children[0].rotation.x, angle);
  assert.ok(wrapper.userData.pose.target);
  assert.equal(JSON.stringify(sim.export()), before);
  sim.event('ATTACK', sim.agents[1], a, 'ATTACK');
  animateRobot(wrapper, a, sim.snapshot(), sim.elapsed, 0.1, false);
  assert.ok(wrapper.userData.pose.hit);
  assert.ok(model.children[0].material.emissiveIntensity > 0);
  a.alive = false;
  for (let i = 0; i < 30; i++) animateRobot(wrapper, a, sim.snapshot(), i * 0.1, 0.1, false);
  assert.ok(wrapper.rotation.z > 1);
  assert.equal(wrapper.scale.x, 1);
  assert.equal(model.children[0].material.emissiveIntensity, 0);
});
test('robot assembly reduces static draws and retains independent limb pivots and identity colors', () => {
  const model = new THREE.Group();
  for (const [name, x, y, color] of [
    ['Torso', 0, 1, '#ffffff'],
    ['Pack', 0, 1, '#222222'],
    ['Chest plate', 0, 1, '#83ddbc'],
    ['Head', 0, 1.6, '#dddddd'],
    ['Visor', 0, 1.6, '#111111'],
    ['Arm', -0.43, 1, '#ffffff'],
    ['Hand', -0.43, 0.75, '#222222'],
    ['Arm.001', 0.43, 1, '#ffffff'],
    ['Hand.001', 0.43, 0.75, '#222222'],
    ['Leg', -0.18, 0.4, '#ffffff'],
    ['Boot', -0.18, 0.15, '#83ddbc'],
    ['Leg.001', 0.18, 0.4, '#ffffff'],
    ['Boot.001', 0.18, 0.15, '#83ddbc'],
  ]) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.2, 0.2),
      new THREE.MeshStandardMaterial({ color }),
    );
    mesh.name = name;
    mesh.position.set(x, y, 0);
    model.add(mesh);
  }
  assert.ok(assembleRobot(model));
  assert.ok(model.userData.assembly.renderMeshes < model.userData.assembly.sourceMeshes);
  assert.equal(model.getObjectByName('Arm.L').position.x, -0.43);
  assert.equal(model.getObjectByName('Arm.R').position.x, 0.43);
  const body = model.getObjectByName('body').children[0];
  assert.ok(body.geometry.attributes.color);
  assert.ok(body.material.vertexColors);
  assert.ok(body.castShadow);
});
