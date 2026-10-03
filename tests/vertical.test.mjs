import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../core/simulation.mjs';
import {moveAgent} from '../core/actions.mjs';
import {COLLISION_DATA,nearestLegal,reserveInteraction,atInteractionSlot,revalidateSpatial,releaseSlot} from '../core/spatial.mjs';
test('watchtower and ruins ascend and descend along explicit routes without teleport',()=>{
  for(const route of COLLISION_DATA.verticalRoutes.filter(r=>r.id!=='bridge_watchtower_0')){
    const s=new Simulation({seed:7});for(const b of s.agents)b.alive=false;const a=s.agents[0];a.alive=true;a.energy=100;a.position=nearestLegal(s,{x:route.nodes[0].x+1,z:route.nodes[0].z+1});a.target=route.objectId;a.action=route.id==='ruins_upper'?'search':'occupy';const o=s.world.objects.find(o=>o.id===route.objectId),slot=reserveInteraction(s,a,o);assert.ok(slot);
    let steps=0;while(!atInteractionSlot(s,a,o)&&steps++<800){const before={...a.position};s.elapsed+=.25;revalidateSpatial(s);moveAgent(s,a,slot,.25);assert.ok(Math.hypot(a.position.x-before.x,a.position.z-before.z)<=.52,'horizontal teleport');assert.ok(Math.abs((a.position.y??0)-(before.y??0))<.6,'vertical teleport');}
    assert.ok(atInteractionSlot(s,a,o),route.id+' failed ascent');assert.ok(a.position.y>1.3);
    releaseSlot(s,a);a.target=null;const ground=route.nodes[0];steps=0;while((a.position.y??0)>.1&&steps++<800){s.elapsed+=.25;revalidateSpatial(s);moveAgent(s,a,ground,.25);}assert.ok((a.position.y??0)<.1,route.id+' failed descent');
  }
});
