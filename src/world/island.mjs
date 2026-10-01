import * as THREE from 'three';
import { randomGenerator } from '../../core/random.mjs';
import { terrainHeight } from '../../core/world.mjs';
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });
export function createIsland(scene, seed) {
  const rng = randomGenerator(seed), group = new THREE.Group(); scene.add(group);
  const grass = [new THREE.Color('#789878'), new THREE.Color('#87a78a'), new THREE.Color('#a0b393'), new THREE.Color('#64866e')];
  const positions = [], colors = [], indices = [], rings = 18, segments = 96;
  positions.push(0, terrainHeight(0, 0), 0); colors.push(...grass[0].toArray());
  const riverDepth = (x, z) => Math.abs(x - Math.sin(z * 0.16) * 3.7 - 1.5) < 1.1 && z > -20 ? 0.8 : 0;
  for (let r = 1; r <= rings; r++) for (let j = 0; j < segments; j++) {
    const angle = j / segments * Math.PI * 2;
    const rough = 1 + Math.sin(angle * 5) * 0.035 + Math.cos(angle * 7) * 0.03;
    const radius = r / rings * 30 * rough;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    const h = terrainHeight(x, z) + (rng() - 0.5) * 0.32 - riverDepth(x,z);
    positions.push(x, h, z);
    const c = r > rings - 2 ? new THREE.Color('#c4b99b') : grass[Math.floor(rng() * grass.length)]; colors.push(...c.toArray());
    const current = 1 + (r - 1) * segments + j, next = 1 + (r - 1) * segments + (j + 1) % segments;
    if (r === 1) indices.push(0, next, current);
    else { const prev = 1 + (r - 2) * segments + j, prevNext = 1 + (r - 2) * segments + (j + 1) % segments; indices.push(prev, prevNext, current, current, prevNext, next); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  const top = new THREE.Mesh(geometry, mat('#ffffff', { vertexColors: true })); top.receiveShadow = true; group.add(top);
  // Sculpted rock skirt, individual facets catch the amber sun.
  const skirtPos=[], skirtColors=[];
  for (let j=0;j<segments;j++) {
    const a=j/segments*Math.PI*2,b=(j+1)/segments*Math.PI*2;
    const rad=t=>30*(1+Math.sin(t*5)*.035+Math.cos(t*7)*.03);
    const x=Math.cos(a)*rad(a),z=Math.sin(a)*rad(a),x2=Math.cos(b)*rad(b),z2=Math.sin(b)*rad(b);
    const h=terrainHeight(x,z),h2=terrainHeight(x2,z2), bottom=-4-rng()*3;
    const vertices=[x,h,z,x*.88,bottom,z*.88,x2,h2,z2,x2,h2,z2,x*.88,bottom,z*.88,x2*.88,bottom,z2*.88];
    skirtPos.push(...vertices); const c=new THREE.Color(rng()>.5?'#6a7772':'#8a9286');for(let k=0;k<6;k++)skirtColors.push(...c.toArray());
  }
  const skirtGeo=new THREE.BufferGeometry();skirtGeo.setAttribute('position',new THREE.Float32BufferAttribute(skirtPos,3));skirtGeo.setAttribute('color',new THREE.Float32BufferAttribute(skirtColors,3));skirtGeo.computeVertexNormals();
  const skirt=new THREE.Mesh(skirtGeo,mat('#ffffff',{vertexColors:true,side:THREE.DoubleSide}));skirt.castShadow=true;skirt.receiveShadow=true;group.add(skirt);
  const trunkMat=mat('#5c5944'), leafMats=[mat('#2c6655'),mat('#397b60'),mat('#507e5d')], rockMat=mat('#8a9487');
  function addMesh(geo,material,x,y,z,scale=1){const o=new THREE.Mesh(geo,material);o.position.set(x,y,z);o.scale.setScalar(scale);o.castShadow=true;o.receiveShadow=true;group.add(o);return o;}
  const trunkGeo=new THREE.CylinderGeometry(.16,.26,1.8,5), leaves=new THREE.ConeGeometry(1.25,2.7,6), rockGeo=new THREE.DodecahedronGeometry(1,0);
  for(let i=0;i<165;i++){
    const x=(rng()-.5)*54,z=(rng()-.5)*52;
    if(Math.hypot(x,z)>27 || Math.abs(x-Math.sin(z*.16)*3.7-1.5)<2 || Math.hypot(x+10,z-12)<6 || Math.hypot(x-10,z+10)<5 || Math.hypot(x,z)<4)continue;
    const y=terrainHeight(x,z),s=.65+rng()*.6;
    addMesh(trunkGeo,trunkMat,x,y+.9*s,z,s);
    for(let k=0;k<3;k++)addMesh(leaves,leafMats[i%3],x,y+(1.6+k*.75)*s,z,s*(1-k*.18));
  }
  for(let i=0;i<72;i++){
    const a=rng()*Math.PI*2,r=8+rng()*20,x=Math.cos(a)*r,z=Math.sin(a)*r;
    if(Math.abs(x-Math.sin(z*.16)*3.7-1.5)<2)continue;
    const o=addMesh(rockGeo,rockMat,x,terrainHeight(x,z)+.2,z,.25+rng()*1.2);o.scale.y*=.65;o.rotation.set(rng(),rng(),rng());
  }
  // Meandering river is actual geometry with opaque cyan water, crossed by two timber bridges.
  const riverPos=[];
  for(let z=-19;z<29;z+=1){const x=Math.sin(z*.16)*3.7+1.5,x2=Math.sin((z+1)*.16)*3.7+1.5;
    const y=terrainHeight(x,z)+.1,y2=terrainHeight(x2,z+1)+.1;
    riverPos.push(x-1.05,y,z,x+1.05,y,z,x2-1.05,y2,z+1,x+1.05,y,z,x2+1.05,y2,z+1,x2-1.05,y2,z+1);
  }
  const riverGeo=new THREE.BufferGeometry();riverGeo.setAttribute('position',new THREE.Float32BufferAttribute(riverPos,3));riverGeo.computeVertexNormals();
  group.add(new THREE.Mesh(riverGeo,mat('#57c5bd',{metalness:.35,roughness:.22,side:THREE.DoubleSide,emissive:'#163c38',emissiveIntensity:.15})));
  for(const z of [-5,13]) {const x=Math.sin(z*.16)*3.7+1.5,y=terrainHeight(x,z)+.4;
    for(let k=-5;k<=5;k++)addMesh(new THREE.BoxGeometry(.24,.16,2),mat('#886f50'),x+k*.28,y,z);
    for(const dz of [-.95,.95]) {addMesh(new THREE.BoxGeometry(3.2,.1,.1),trunkMat,x,y+.65,z+dz);for(const dx of [-1.5,1.5])addMesh(new THREE.BoxGeometry(.1,.8,.1),trunkMat,x+dx,y+.35,z+dz);}
  }
  const stone=mat('#c6c2a7'), roofMat=mat('#6d6452'), walls=mat('#d2c3a0'), window=mat('#ffce86',{emissive:'#e4a552',emissiveIntensity:1.4});
  for(let i=0;i<6;i++){
    const x=-13+(i%3)*3.3,z=10+Math.floor(i/3)*4,y=terrainHeight(x,z);
    addMesh(new THREE.BoxGeometry(2.4,1.9,2.8),walls,x,y+.95,z);
    const roof=addMesh(new THREE.ConeGeometry(2.1,1.15,4),roofMat,x,y+2.45,z);roof.rotation.y=Math.PI/4;roof.scale.z=1.15;
    addMesh(new THREE.BoxGeometry(.55,.55,.03),window,x,y+1.1,z+1.415);
    addMesh(new THREE.BoxGeometry(.45,.8,.06),trunkMat,x+.65,y+.4,z+1.43);
  }
  // Broken sanctuary columns and lintels, with a small glowing artifact.
  for(let i=0;i<7;i++) {const a=i/7*Math.PI*2,x=10+Math.cos(a)*3,z=-10+Math.sin(a)*3,y=terrainHeight(x,z),h=2+rng()*2;
    addMesh(new THREE.CylinderGeometry(.35,.45,h,7),stone,x,y+h/2,z);addMesh(new THREE.BoxGeometry(.9,.23,.9),stone,x,y+h,z);
  }
  addMesh(new THREE.CylinderGeometry(3.6,3.8,.4,12),stone,10,terrainHeight(10,-10)+.15,-10);
  const artifact=addMesh(new THREE.OctahedronGeometry(.55),mat('#f4c48a',{emissive:'#c8833d',emissiveIntensity:1}),10,terrainHeight(10,-10)+1.3,-10);
  const beacon=new THREE.Group();beacon.position.set(0,terrainHeight(0,0),0);group.add(beacon);
  const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.6,.5,12),mat('#c1b798'));pedestal.position.y=.25;pedestal.receiveShadow=true;beacon.add(pedestal);
  const tower=new THREE.Mesh(new THREE.CylinderGeometry(.07,.12,13,8),new THREE.MeshBasicMaterial({color:'#f5c979',transparent:true,opacity:.5}));tower.position.y=6.5;beacon.add(tower);
  const halo=new THREE.Mesh(new THREE.TorusGeometry(.9,.035,6,48),new THREE.MeshBasicMaterial({color:'#efc38c'}));halo.rotation.x=-Math.PI/2;halo.position.y=.55;beacon.add(halo);
  const light=new THREE.PointLight('#efba70',20,9,2);light.position.set(0,3,0);beacon.add(light);
  return {group,artifact,beacon};
}
export function createOcean(scene) {
  const material=new THREE.ShaderMaterial({ uniforms:{time:{value:0}},vertexShader:`varying vec3 vPos; uniform float time; void main(){ vec3 p=position; p.z+=sin(p.x*.16+time*.35)*.06+cos(p.y*.13-time*.2)*.06; vPos=p; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`,fragmentShader:`varying vec3 vPos; uniform float time; void main(){float wave=sin(vPos.x*1.9+vPos.y*1.3+sin(vPos.y*.15)*2.+time*.4)*.5+.5;float light=pow(max(0.,1.-abs(vPos.x+vPos.y*.22-30.)/20.),4.);vec3 color=mix(vec3(.017,.074,.10),vec3(.035,.125,.15),wave*.22)+vec3(.12,.079,.027)*light;gl_FragColor=vec4(color,1.);}` });
  const ocean=new THREE.Mesh(new THREE.PlaneGeometry(700,700,110,110),material);ocean.rotation.x=-Math.PI/2;ocean.position.y=-2.6;scene.add(ocean);return material;
}
export function createSky(scene) {
  const material=new THREE.ShaderMaterial({side:THREE.BackSide,uniforms:{},vertexShader:`varying vec3 vWorld; void main(){vWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vWorld; void main(){float h=normalize(vWorld).y; vec3 c=mix(vec3(.50,.37,.29),vec3(.075,.16,.22),smoothstep(-.03,.6,h));float sun=pow(max(0.,dot(normalize(vWorld),normalize(vec3(-.5,.16,-.7)))),160.);c+=vec3(1.,.65,.30)*sun;gl_FragColor=vec4(c,1.);}`});
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(380,32,20),material));
  const silhouettes=new THREE.Group();const materialRock=mat('#4b6368');
  for(let i=0;i<18;i++){const angle=i/18*Math.PI*2;const rock=new THREE.Mesh(new THREE.ConeGeometry(10+i%4*3,14+i%5*5,5),materialRock);rock.position.set(Math.cos(angle)*140,0,Math.sin(angle)*140);rock.rotation.y=i*.4;silhouettes.add(rock);}scene.add(silhouettes);
}
