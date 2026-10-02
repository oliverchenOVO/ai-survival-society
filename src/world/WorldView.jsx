import { useLocale } from '../i18n/LocaleProvider.jsx';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Crosshair, Plus, Minus, Eye, Video, Move, RotateCcw } from 'lucide-react';
import { createIsland, createOcean, createSky } from './island.mjs';
import { terrainHeight } from '../../core/world.mjs';
const tmp = new THREE.Vector3();
export default function WorldView({
  state,
  selected,
  onSelect,
  follow,
  setFollow,
  cinematic,
  setCinematic,
  graphVisible,
  audio,
}) {
  const { t, text, error: localizeError, locale } = useLocale();
  const host = useRef(null),
    runtime = useRef(null),
    latest = useRef({
      state,
      selected,
      follow,
      cinematic,
      graphVisible,
      audio,
    }),
    [error, setError] = useState('');
  latest.current = {
    state,
    selected,
    follow,
    cinematic,
    graphVisible,
    audio,
    text,
    t,
  };
  useEffect(() => {
    const container = host.current;
    let disposed = false,
      frame = 0,
      scene,
      renderer,
      composer,
      observer;
    try {
      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2('#38535a', 0.0045);
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.domElement.setAttribute('aria-label', t('world.canvas'));
      container.appendChild(renderer.domElement);
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1800);
      camera.position.set(37, 23, 43);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 3, 0);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.minDistance = 9;
      controls.maxDistance = 125;
      controls.maxPolarAngle = Math.PI * 0.47;
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
      scene.add(new THREE.HemisphereLight('#bcdfe4', '#405048', 1.5));
      const sunlight = new THREE.DirectionalLight('#ffd5a0', 3.7);
      sunlight.position.set(-35, 55, -25);
      sunlight.castShadow = true;
      sunlight.shadow.mapSize.set(2048, 2048);
      Object.assign(sunlight.shadow.camera, {
        left: -40,
        right: 40,
        top: 40,
        bottom: -40,
        near: 1,
        far: 150,
      });
      sunlight.shadow.normalBias = 0.08;
      scene.add(sunlight);
      createSky(scene);
      const ocean = createOcean(scene);
      let island = createIsland(scene, latest.current.state.seed),
        worldSeed = latest.current.state.seed;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.016, 6, 160),
        new THREE.MeshBasicMaterial({
          color: '#e6c27e',
          transparent: true,
          opacity: 0.58,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 1.5;
      scene.add(ring);
      const selectionRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.95, 0.035, 6, 64),
        new THREE.MeshBasicMaterial({
          color: '#a0efd0',
        }),
      );
      selectionRing.rotation.x = -Math.PI / 2;
      scene.add(selectionRing);
      const agentGroup = new THREE.Group(),
        resourceGroup = new THREE.Group(),
        socialGroup = new THREE.Group(),
        effectGroup = new THREE.Group();
      scene.add(agentGroup, resourceGroup, socialGroup, effectGroup);
      const particlePositions = new Float32Array(180 * 3);
      for (let i = 0; i < 180; i++) {
        particlePositions[i * 3] = Math.sin(i * 19.3) * 25;
        particlePositions[i * 3 + 1] = 2 + (i % 9) * 0.5;
        particlePositions[i * 3 + 2] = Math.cos(i * 11.7) * 25;
      }
      const dustGeometry = new THREE.BufferGeometry();
      dustGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      const dust = new THREE.Points(
        dustGeometry,
        new THREE.PointsMaterial({
          color: '#dce9b1',
          size: 0.045,
          transparent: true,
          opacity: 0.48,
          depthWrite: false,
        }),
      );
      scene.add(dust);
      const agents = new Map(),
        resources = new Map(),
        labels = new Map(),
        traces = [],
        loader = new GLTFLoader();
      const labelsHost = document.createElement('div');
      labelsHost.className = 'world-labels';
      container.appendChild(labelsHost);
      for (const a of latest.current.state.agents) {
        const wrapper = new THREE.Group();
        wrapper.userData.agentId = a.id;
        agentGroup.add(wrapper);
        agents.set(a.id, wrapper);
        const label = document.createElement('button');
        label.type = 'button';
        label.className = 'agent-label';
        label.style.setProperty('--agent-color', a.color);
        label.textContent = a.name.toUpperCase();
        label.onclick = () => onSelect(a.id);
        labelsHost.appendChild(label);
        labels.set(a.id, label);
        loader.load(
          `/assets/${a.name.toLowerCase()}.glb`,
          (gltf) => {
            if (disposed) return;
            const model = gltf.scene;
            model.scale.setScalar(0.75);
            model.rotation.y = Math.PI;
            model.traverse((o) => {
              if (o.isMesh) {
                o.castShadow = true;
                o.receiveShadow = true;
                o.userData.agentId = a.id;
              }
            });
            wrapper.add(model);
          },
          undefined,
          () => {
            // Procedural fallback still supplies a visible, selectable robot if an asset request fails.
            const torso = new THREE.Mesh(
              new THREE.BoxGeometry(0.7, 0.9, 0.5),
              new THREE.MeshStandardMaterial({
                color: a.color,
              }),
            );
            torso.position.y = 0.8;
            wrapper.add(torso);
            const head = new THREE.Mesh(
              new THREE.BoxGeometry(0.8, 0.55, 0.6),
              new THREE.MeshStandardMaterial({
                color: '#e0e7e5',
              }),
            );
            head.position.y = 1.5;
            wrapper.add(head);
          },
        );
      }
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(800, 600), 0.14, 0.55, 1.1));
      composer.addPass(new OutputPass());
      const resize = () => {
        const w = container.clientWidth,
          h = container.clientHeight;
        renderer.setSize(w, h);
        composer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      observer = new ResizeObserver(resize);
      observer.observe(container);
      resize();
      const raycaster = new THREE.Raycaster(),
        pointer = new THREE.Vector2();
      let down = null;
      const pointerDown = (e) => {
        down = {
          x: e.clientX,
          y: e.clientY,
        };
      };
      const pointerUp = (e) => {
        if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(agentGroup.children, true)[0];
        if (hit) {
          let o = hit.object;
          while (o && !o.userData.agentId) o = o.parent;
          if (o) onSelect(o.userData.agentId);
        }
      };
      renderer.domElement.addEventListener('pointerdown', pointerDown);
      renderer.domElement.addEventListener('pointerup', pointerUp);
      const focus = (id) => {
        const a = latest.current.state.agents.find((a) => a.id === id);
        if (a) {
          const target = new THREE.Vector3(
            a.position.x,
            terrainHeight(a.position.x, a.position.z) + 0.6,
            a.position.z,
          );
          const offset = camera.position.clone().sub(controls.target);
          if (offset.length() > 28) offset.setLength(25);
          controls.target.copy(target);
          camera.position.copy(target.clone().add(offset));
        }
      };
      runtime.current = {
        focus,
        zoom: (factor) => {
          camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);
        },
        reset: () => {
          camera.position.set(37, 23, 43);
          controls.target.set(0, 3, 0);
        },
        renderer,
        camera,
      };
      let prevSelected = latest.current.selected,
        lastMatch = '',
        lastEvent = 0,
        lastGraph = 0,
        lastCinematic = 0;
      const clock = new THREE.Clock();
      const render = () => {
        if (disposed) return;
        frame = requestAnimationFrame(render);
        const delta = Math.min(clock.getDelta(), 0.1),
          time = clock.elapsedTime,
          {
            state: s,
            selected: id,
            follow: following,
            cinematic: cinema,
            graphVisible: showGraph,
          } = latest.current;
        if (s.seed !== worldSeed) {
          disposeObject(island.group);
          scene.remove(island.group);
          island = createIsland(scene, s.seed);
          worldSeed = s.seed;
        }
        ocean.uniforms.time.value = time;
        island.artifact.rotation.y = time * 0.3;
        dust.rotation.y = time * 0.015;
        dust.position.y = Math.sin(time * 0.2) * 0.15;
        ring.scale.setScalar(s.safeRadius);
        ring.material.opacity = s.effects.storm > s.elapsed ? 0.8 : 0.36;
        if (lastMatch !== s.matchId) {
          lastMatch = s.matchId;
          lastEvent = 0;
        }
        if (prevSelected !== id) {
          focus(id);
          prevSelected = id;
        }
        for (const a of s.agents) {
          const wrapper = agents.get(a.id);
          if (!wrapper) continue;
          const pos = new THREE.Vector3(
            a.position.x,
            terrainHeight(a.position.x, a.position.z) + (a.alive ? 0.08 : 0),
            a.position.z,
          );
          if (!wrapper.userData.placed) {
            wrapper.position.copy(pos);
            wrapper.userData.placed = true;
          }
          const moving = wrapper.position.distanceTo(pos) > 0.03;
          const dx = pos.x - wrapper.position.x,
            dz = pos.z - wrapper.position.z;
          wrapper.position.lerp(pos, Math.min(1, delta * 10));
          if (moving)
            wrapper.rotation.y = THREE.MathUtils.lerp(
              wrapper.rotation.y,
              Math.atan2(dx, dz),
              Math.min(1, delta * 5),
            );
          wrapper.scale.setScalar(a.alive ? 1 : 0.45);
          wrapper.rotation.z = a.alive ? 0 : Math.PI / 2;
          if (wrapper.children[0]) {
            wrapper.children[0].position.y =
              a.alive && moving ? Math.sin(time * 11 + a.index) * 0.08 : 0;
            wrapper.children[0].rotation.z =
              a.alive && moving ? Math.sin(time * 11 + a.index) * 0.06 : 0;
          }
          const label = labels.get(a.id);
          tmp
            .copy(wrapper.position)
            .add(new THREE.Vector3(0, 2.4, 0))
            .project(camera);
          label.style.transform = `translate(-50%,-50%) translate(${(tmp.x * 0.5 + 0.5) * container.clientWidth}px,${(-tmp.y * 0.5 + 0.5) * container.clientHeight}px)`;
          label.style.display = tmp.z < 1 && a.alive ? 'block' : 'none';
          label.classList.toggle('selected', a.id === id);
          label.classList.toggle('fighting', ['attack', 'betray'].includes(a.action));
          label.title = `${a.name}: ${latest.current.text(a.goal)}`;
          if (a.id === id) {
            selectionRing.position.set(
              wrapper.position.x,
              wrapper.position.y + 0.08,
              wrapper.position.z,
            );
            selectionRing.visible = a.alive;
          }
          if (following && a.id === id && a.alive) {
            const drift = pos
              .clone()
              .sub(controls.target)
              .multiplyScalar(delta * 3);
            controls.target.add(drift);
            camera.position.add(drift);
          }
        }
        const ids = new Set(s.resources.map((r) => r.id));
        for (const [id, mesh] of resources)
          if (!ids.has(id)) {
            resourceGroup.remove(mesh);
            disposeObject(mesh);
            resources.delete(id);
          }
        for (const r of s.resources) {
          let mesh = resources.get(r.id);
          if (!mesh) {
            const color = {
              food: '#91d99a',
              medicine: '#9dcfe6',
              weapon: '#f4be8b',
              relic: '#d3ace9',
            }[r.type];
            mesh = new THREE.Mesh(
              r.type === 'relic'
                ? new THREE.OctahedronGeometry(0.35)
                : new THREE.BoxGeometry(0.45, 0.45, 0.45),
              new THREE.MeshStandardMaterial({
                color,
                emissive: color,
                emissiveIntensity: 0.25,
                roughness: 0.4,
              }),
            );
            resourceGroup.add(mesh);
            resources.set(r.id, mesh);
          }
          mesh.position.set(
            r.position.x,
            terrainHeight(r.position.x, r.position.z) +
              0.42 +
              Math.sin(time * 2 + Number(r.id.split('_')[1])) * 0.08,
            r.position.z,
          );
          mesh.rotation.y = time * 0.4;
        }
        for (const e of s.events) {
          if (e.id <= lastEvent) continue;
          lastEvent = e.id;
          if (
            [
              'ATTACK',
              'BETRAYAL',
              'ALLIANCE_CREATED',
              'SUPPLY_DROP',
              'DEATH',
              'MATCH_ENDED',
            ].includes(e.event)
          ) {
            const a = s.agents.find((a) => a.id === e.actor),
              b = s.agents.find((a) => a.id === e.target);
            if (a && b) {
              const line = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([
                  new THREE.Vector3(
                    a.position.x,
                    terrainHeight(a.position.x, a.position.z) + 1,
                    a.position.z,
                  ),
                  new THREE.Vector3(
                    b.position.x,
                    terrainHeight(b.position.x, b.position.z) + 1,
                    b.position.z,
                  ),
                ]),
                new THREE.LineBasicMaterial({
                  color: e.event === 'ALLIANCE_CREATED' ? '#7cc3ee' : '#f2887f',
                  transparent: true,
                  opacity: 0.9,
                }),
              );
              effectGroup.add(line);
              traces.push({
                object: line,
                expires: time + 0.75,
              });
            }
            if (cinema && a && time - lastCinematic > 9) {
              focus(a.id);
              lastCinematic = time;
            }
          }
        }
        for (let i = traces.length - 1; i >= 0; i--)
          if (traces[i].expires < time) {
            effectGroup.remove(traces[i].object);
            disposeObject(traces[i].object);
            traces.splice(i, 1);
          }
        socialGroup.visible = showGraph;
        if (showGraph && time - lastGraph > 0.5) {
          lastGraph = time;
          while (socialGroup.children.length) {
            const o = socialGroup.children[0];
            socialGroup.remove(o);
            disposeObject(o);
          }
          for (const a of s.agents)
            for (const b of s.agents) {
              if (a.id >= b.id || !a.alive || !b.alive) continue;
              const rel = a.relationships[b.id];
              if (!rel || (!rel.alliance && rel.trust < 0.3 && rel.hostility < 0.4)) continue;
              const line = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([
                  new THREE.Vector3(
                    a.position.x,
                    terrainHeight(a.position.x, a.position.z) + 0.3,
                    a.position.z,
                  ),
                  new THREE.Vector3(
                    b.position.x,
                    terrainHeight(b.position.x, b.position.z) + 0.3,
                    b.position.z,
                  ),
                ]),
                new THREE.LineBasicMaterial({
                  color: rel.alliance ? '#80bfea' : rel.hostility > 0.4 ? '#ee827e' : '#88e5be',
                  transparent: true,
                  opacity: 0.35,
                }),
              );
              socialGroup.add(line);
            }
        }
        controls.update();
        composer.render();
      };
      render();
      return () => {
        disposed = true;
        cancelAnimationFrame(frame);
        observer.disconnect();
        controls.dispose();
        renderer.domElement.removeEventListener('pointerdown', pointerDown);
        renderer.domElement.removeEventListener('pointerup', pointerUp);
        disposeObject(scene);
        composer.dispose();
        renderer.dispose();
        container.replaceChildren();
        runtime.current = null;
      };
    } catch (e) {
      setError(e.message);
      renderer?.dispose();
    }
  }, []);
  useEffect(() => {
    host.current?.querySelector('canvas')?.setAttribute('aria-label', t('world.canvas'));
  }, [locale]);
  return (
    <section className="world-panel" aria-label={t('world.label')}>
      <div className="world-canvas" ref={host} />
      {error ? (
        <div className="world-error">
          {t('error.renderer', {
            detail: localizeError(error),
          })}
        </div>
      ) : null}
      <div className="world-heading">
        <span className="live-dot" />
        <span>
          {state.status === 'finished'
            ? t('world.finished')
            : state.status === 'paused'
              ? t('world.paused')
              : t('world.live')}
        </span>
        <span className="world-location">{t('world.island')}</span>
      </div>
      <div className="world-bottom">
        <div className="world-caption">
          <span className="compass">
            N<span>↑</span>
          </span>
          <div>
            <strong>{t('world.caption')}</strong>
            <small>{t('world.cameraHint')}</small>
          </div>
        </div>
        <div className="camera-tools">
          <button
            title={t('camera.in')}
            aria-label={t('camera.in')}
            onClick={() => runtime.current?.zoom(0.85)}
          >
            <Plus size={17} />
          </button>
          <button
            title={t('camera.out')}
            aria-label={t('camera.out')}
            onClick={() => runtime.current?.zoom(1.18)}
          >
            <Minus size={17} />
          </button>
          <button
            title={t('camera.focus')}
            aria-label={t('camera.focus')}
            onClick={() => runtime.current?.focus(selected)}
          >
            <Crosshair size={17} />
          </button>
          <button
            title={t('camera.reset')}
            aria-label={t('camera.reset')}
            onClick={() => runtime.current?.reset()}
          >
            <RotateCcw size={17} />
          </button>
          <button
            className={follow ? 'active' : ''}
            title={t('camera.follow')}
            aria-label={t('camera.follow')}
            aria-pressed={follow}
            onClick={() => setFollow(!follow)}
          >
            <Eye size={17} />
          </button>
          <button
            className={cinematic ? 'active' : ''}
            title={t('camera.cinema')}
            aria-label={t('camera.cinema')}
            aria-pressed={cinematic}
            onClick={() => setCinematic(!cinematic)}
          >
            <Video size={17} />
          </button>
        </div>
      </div>
      {state.effects.storm > state.elapsed ? (
        <div className="weather-notice">{t('world.storm')}</div>
      ) : null}
    </section>
  );
}
function disposeObject(object) {
  object.traverse((o) => {
    o.geometry?.dispose();
    if (o.material) {
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
        m.dispose();
      }
    }
  });
}
