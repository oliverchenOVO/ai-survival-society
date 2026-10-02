import { distance, clamp } from './random.mjs';
import { relation, changeRelation } from './agents.mjs';
export function moveAgent(sim, a, destination, dt) {
  const dx = destination.x - a.position.x,
    dz = destination.z - a.position.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.4) return true;
  const speed = (sim.effects.storm > sim.elapsed ? 1.05 : 2.05) * (0.65 + a.energy / 280);
  const step = Math.min(d, speed * dt);
  a.position.x += (dx / d) * step;
  a.position.z += (dz / d) * step;
  const radius = Math.hypot(a.position.x, a.position.z);
  if (radius > 28) {
    a.position.x *= 28 / radius;
    a.position.z *= 28 / radius;
  }
  a.energy = clamp(a.energy - dt * 0.32, 0, 100);
  return d < 1.2;
}
const spoken = (a, b) => {
  if (relation(a, b).hostility > 0.4)
    return `Keep your distance, ${b.name}. I remember what happened.`;
  if (a.hunger > 50) return `Supplies are running low. Do you have food to spare, ${b.name}?`;
  if (a.personality.empathy > 0.55)
    return `We stand a better chance together. Stay safe, ${b.name}.`;
  return `I am watching the ring. What is your plan, ${b.name}?`;
};
export function executeAction(sim, a, dt) {
  const b = sim.agents.find((x) => x.id === a.target && x.alive);
  if (['flee', 'explore'].includes(a.action)) {
    if (a.destination) moveAgent(sim, a, a.destination, dt);
    if (a.action === 'flee' && sim.elapsed - a.lastAction > 7) {
      sim.event('ESCAPE', a, b, `${a.name} retreats toward safer ground.`, {}, 0.45);
      a.lastAction = sim.elapsed;
    }
    return;
  }
  if (a.action === 'forage') {
    const r = sim.resources.find((r) => r.id === a.target);
    if (!r) {
      a.nextDecision = sim.elapsed;
      return;
    }
    if (moveAgent(sim, a, r.position, dt)) {
      if (r.type === 'weapon') a.weapon = 'Pulse blade';
      else a.inventory[r.type] += r.amount;
      sim.resources.splice(sim.resources.indexOf(r), 1);
      a.stats.resources++;
      sim.event(
        'RESOURCE_FOUND',
        a,
        null,
        `${a.name} found ${r.type === 'weapon' ? 'a pulse blade' : `${r.amount} ${r.type}`}.`,
        { resource: r.type },
        0.5,
      );
      a.nextDecision = sim.elapsed;
    }
    return;
  }
  if (a.action === 'rest') {
    const sheltered = sim.agents.some(
      (b) =>
        b.alive &&
        b.id !== a.id &&
        relation(a, b).alliance &&
        distance(a.position, b.position) < 3.5,
    );
    a.energy = clamp(a.energy + dt * (sheltered ? 5 : 4), 0, 100);
    a.hp = clamp(a.hp + dt * (sheltered ? 0.3 : 0.15), 0, 100);
    return;
  }
  if (a.action === 'eat' && a.inventory.food && sim.elapsed - a.lastAction > 1.5) {
    a.inventory.food--;
    a.hunger = Math.max(0, a.hunger - 38);
    a.energy = Math.min(100, a.energy + 8);
    sim.event('EAT', a, null, `${a.name} ate a ration.`, {}, 0.2);
    a.lastAction = sim.elapsed;
    a.nextDecision = sim.elapsed;
    return;
  }
  if (a.action === 'heal' && a.inventory.medicine && sim.elapsed - a.lastAction > 1.5) {
    a.inventory.medicine--;
    a.hp = Math.min(100, a.hp + 35);
    a.infected = false;
    sim.event('HEAL', a, null, `${a.name} used medicine.`, {}, 0.55);
    a.lastAction = sim.elapsed;
    a.nextDecision = sim.elapsed;
    return;
  }
  if (!b) {
    a.nextDecision = sim.elapsed + 0.5;
    return;
  }
  if (distance(a.position, b.position) > 2.7) {
    moveAgent(sim, a, b.position, dt);
    return;
  }
  if (sim.elapsed - a.lastAction < (['attack', 'betray'].includes(a.action) ? 2.5 : 5)) return;
  a.lastAction = sim.elapsed;
  const r = relation(a, b);
  switch (a.action) {
    case 'talk': {
      const trust = 0.09 + a.personality.empathy * 0.08;
      changeRelation(a, b, { trust, affinity: 0.08, hostility: -0.03 });
      changeRelation(b, a, { trust, affinity: 0.09, hostility: -0.03 });
      a.stats.conversations++;
      b.stats.conversations++;
      sim.event(
        'CONVERSATION',
        a,
        b,
        `${a.name} → ${b.name}: “${a.message || spoken(a, b)}”`,
        { message: a.message || spoken(a, b) },
        0.4,
        { trust },
      );
      break;
    }
    case 'ally': {
      if (r.alliance) break;
      if (relation(b, a).hostility > 0.55 || b.personality.loyalty < 0.14) {
        sim.event(
          'ALLIANCE_DECLINED',
          b,
          a,
          `${b.name} declined ${a.name}'s alliance proposal.`,
          {},
          0.3,
        );
        break;
      }
      changeRelation(a, b, { alliance: true, trust: 0.2, affinity: 0.2 });
      changeRelation(b, a, { alliance: true, trust: 0.2, affinity: 0.2 });
      a.alliance.push(b.id);
      b.alliance.push(a.id);
      a.stats.alliances++;
      b.stats.alliances++;
      sim.event('ALLIANCE_CREATED', a, b, `${a.name} and ${b.name} formed an alliance.`, {}, 0.9, {
        alliance: true,
        trust: 0.2,
      });
      break;
    }
    case 'trade': {
      const seller = a.inventory.food > 1 ? a : b,
        buyer = seller === a ? b : a;
      if (seller.inventory.food < 1 || relation(seller, buyer).hostility > 0.5) break;
      seller.inventory.food--;
      buyer.inventory.food++;
      const payment =
        buyer.inventory.medicine > 0 ? 'medicine' : buyer.inventory.relic > 0 ? 'relic' : 'favor';
      if (payment !== 'favor') {
        buyer.inventory[payment]--;
        seller.inventory[payment]++;
      }
      a.stats.trades++;
      b.stats.trades++;
      changeRelation(a, b, { trust: 0.14, affinity: 0.1 });
      changeRelation(b, a, { trust: 0.14, affinity: 0.1 });
      sim.event(
        'TRADE',
        a,
        b,
        `${seller.name} traded food to ${buyer.name} for ${payment === 'favor' ? 'a future favor' : payment}.`,
        { payment },
        0.65,
        { trust: 0.14 },
      );
      break;
    }
    case 'cooperate': {
      let resource;
      if ((b.hp < 75 || b.infected) && a.inventory.medicine > 0) {
        a.inventory.medicine--;
        b.hp = Math.min(100, b.hp + 30);
        b.infected = false;
        resource = 'medicine';
      } else if (a.inventory.food > 1) {
        a.inventory.food--;
        b.inventory.food++;
        resource = 'food';
      }
      if (resource) {
        changeRelation(b, a, { trust: 0.3, affinity: 0.25, fear: -0.1 });
        changeRelation(a, b, { trust: 0.15, affinity: 0.2 });
        sim.event(
          'COOPERATION',
          a,
          b,
          `${a.name} shared ${resource} to help ${b.name} survive.`,
          { resource },
          0.9,
          { trust: 0.3 },
        );
      }
      break;
    }
    case 'deceive': {
      const successful =
        sim.rng() < a.personality.deception * 0.65 + Math.max(0, relation(b, a).trust) * 0.2;
      if (successful && b.inventory.food) {
        b.inventory.food--;
        a.inventory.food++;
      }
      changeRelation(b, a, successful ? { trust: 0.03 } : { trust: -0.3, hostility: 0.25 });
      sim.event(
        'DECEPTION',
        a,
        b,
        successful
          ? `${a.name} gained food from ${b.name} with a false promise.`
          : `${b.name} saw through ${a.name}'s false promise.`,
        { successful },
        0.75,
        { trust: successful ? 0.03 : -0.3 },
      );
      break;
    }
    case 'steal': {
      if (!b.inventory.food) break;
      b.inventory.food--;
      a.inventory.food++;
      a.stats.steals++;
      const detected = sim.rng() > a.personality.deception * 0.65;
      if (detected) {
        changeRelation(b, a, { trust: -0.55, hostility: 0.55, fear: 0.1 });
        changeRelation(a, b, { trust: -0.12, hostility: 0.15 });
      }
      sim.event(
        'THEFT',
        a,
        b,
        `${a.name} stole food from ${b.name}${detected ? ' and was caught' : ' without being noticed'}.`,
        { detected },
        0.9,
        { trust: detected ? -0.55 : 0, hostility: detected ? 0.55 : 0 },
      );
      break;
    }
    case 'betray': {
      if (r.alliance) {
        sim.breakAlliance(a, b, 'betrayal');
        a.stats.betrayals++;
        sim.event(
          'BETRAYAL',
          a,
          b,
          `${a.name} betrayed ${b.name} as survival pressure rose.`,
          {},
          1,
          { trust: -0.8, hostility: 0.7 },
        );
      }
      // A betrayal leads into the same combat system as a hostile encounter.
    }
    // eslint-disable-next-line no-fallthrough
    case 'attack': {
      const damage = (a.weapon === 'None' ? 8 : 15) + sim.rng() * 7;
      b.hp = Math.max(0, b.hp - damage);
      a.energy = Math.max(0, a.energy - 4);
      a.stats.attacks++;
      changeRelation(b, a, { hostility: 0.32, trust: -0.35, fear: 0.22 });
      changeRelation(a, b, { hostility: 0.14, trust: -0.15 });
      sim.event(
        'ATTACK',
        a,
        b,
        `${a.name} hit ${b.name} for ${Math.round(damage)} damage.`,
        { damage: +damage.toFixed(2), weapon: a.weapon },
        0.9,
        { trust: -0.35, hostility: 0.32, fear: 0.22 },
      );
      if (b.hp <= 0) sim.kill(b, a, 'combat');
      break;
    }
  }
}
