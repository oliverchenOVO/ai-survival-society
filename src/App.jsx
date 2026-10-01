import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  Globe2,
  Users,
  ScrollText,
  Network,
  Settings2,
  SlidersHorizontal,
  Pause,
  Play,
  RotateCcw,
  Heart,
  Handshake,
  Skull,
  Download,
  Archive,
  Save,
  Volume2,
  VolumeX,
  AlertCircle,
  WifiOff,
} from 'lucide-react';
import Inspector from './components/Inspector.jsx';
import SocialGraph from './components/SocialGraph.jsx';
import Director from './components/Director.jsx';
import EventFeed from './components/EventFeed.jsx';
import { Modal, Settings, Roster, Winner, ReplayLibrary } from './components/Dialogs.jsx';
import { request, formatTime } from './api.mjs';
const WorldView = lazy(() => import('./world/WorldView.jsx'));
const NAV = [
  ['world', 'World', Globe2],
  ['agents', 'Agents', Users],
  ['feed', 'Log', ScrollText],
  ['network', 'Network', Network],
  ['director', 'Director', SlidersHorizontal],
];
export default function App() {
  const [live, setLive] = useState(null),
    [connected, setConnected] = useState(false),
    [selected, setSelected] = useState('Agent_01'),
    [dialog, setDialog] = useState(null),
    [follow, setFollow] = useState(false),
    [cinematic, setCinematic] = useState(false),
    [graph, setGraph] = useState(false),
    [audio, setAudio] = useState(false),
    [toast, setToast] = useState(''),
    [replay, setReplay] = useState(null),
    [replayTime, setReplayTime] = useState(0),
    [replayPlaying, setReplayPlaying] = useState(false);
  const finished = useRef(null),
    audioContext = useRef(null),
    seenEvent = useRef(0);
  const onError = useCallback((e) => setToast(e.message ?? String(e)), []);
  const notify = useCallback((message) => setToast(message), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    let stopped = false,
      socket,
      retry,
      timer,
      last = 0;
    const connect = () => {
      socket = new WebSocket(
        `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`,
      );
      socket.onopen = () => setConnected(true);
      socket.onmessage = (e) => {
        try {
          const s = JSON.parse(e.data);
          if (Date.now() - last < 180 && s.status !== 'finished') return;
          last = Date.now();
          setLive(s);
        } catch {}
      };
      socket.onclose = () => {
        setConnected(false);
        if (!stopped) retry = setTimeout(connect, 1500);
      };
      socket.onerror = () => socket.close();
    };
    request('/api/state').then(setLive).catch(onError);
    connect();
    timer = setInterval(() => {
      if (socket?.readyState !== WebSocket.OPEN)
        request('/api/state')
          .then(setLive)
          .catch(() => {});
    }, 5000);
    return () => {
      stopped = true;
      clearTimeout(retry);
      clearInterval(timer);
      socket?.close();
    };
  }, []);
  useEffect(() => {
    if (live?.status === 'finished' && finished.current !== live.matchId && !replay) {
      finished.current = live.matchId;
      setDialog('winner');
    }
  }, [live?.status, live?.matchId, replay]);
  useEffect(() => {
    if (!replayPlaying || !replay) return;
    const timer = setInterval(
      () =>
        setReplayTime((t) => {
          if (t + 0.5 >= replay.elapsed) {
            setReplayPlaying(false);
            return replay.elapsed;
          }
          return t + 0.5;
        }),
      100,
    );
    return () => clearInterval(timer);
  }, [replayPlaying, replay]);
  useEffect(() => {
    if (!audio || !live || !audioContext.current) return;
    const event = live.events
      .filter((e) => e.id > seenEvent.current)
      .find((e) => ['ATTACK', 'ALLIANCE_CREATED', 'SUPPLY_DROP', 'DEATH'].includes(e.event));
    seenEvent.current = live.eventCount;
    if (event) {
      const ctx = audioContext.current,
        osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = event.event === 'ATTACK' ? 140 : event.event === 'DEATH' ? 90 : 440;
      gain.gain.setValueAtTime(0.035, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }
  }, [live?.eventCount, audio]);
  const toggleAudio = () => {
    if (!audioContext.current) {
      const ctx = new AudioContext();
      audioContext.current = ctx;
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 62;
      gain.gain.value = 0.008;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
    }
    audioContext.current.resume();
    audioContext.current.suspend().then(() => {
      if (!audio) audioContext.current.resume();
    });
    seenEvent.current = live?.eventCount ?? 0;
    setAudio(!audio);
  };
  const control = useCallback(
    async (action, value) => {
      try {
        const s = await request('/api/control', { action, value });
        setLive(s);
        if (action === 'restart') {
          setReplay(null);
          setDialog(null);
          setFollow(false);
        }
      } catch (e) {
        onError(e);
      }
    },
    [onError],
  );
  const onEvent = async (event) => {
    try {
      setLive(await request('/api/director', { event }));
      notify('World event introduced. Watch the society adapt.');
    } catch (e) {
      onError(e);
    }
  };
  const onSelect = useCallback((id) => setSelected(id), []);
  const save = async () => {
    try {
      await request('/api/save', {});
      notify('Simulation saved to the archive.');
    } catch (e) {
      onError(e);
    }
  };
  if (!live)
    return (
      <div className="startup">
        <div className="brand-symbol">◎</div>
        <h1>AI Survival Society</h1>
        <p>Connecting to the island…</p>
        {toast ? <p className="coral">{toast}</p> : null}
        <small>Start the server with npm start if it is not running.</small>
      </div>
    );
  let state = live;
  if (replay) {
    const frame =
      [...replay.timeline].reverse().find((f) => f.timestamp <= replayTime) ?? replay.timeline[0];
    state = {
      ...replay,
      elapsed: replayTime,
      status: 'paused',
      speed: live.speed,
      llm: live.llm,
      autoRestart: false,
      safeRadius: Math.max(1.6, 29 - (replayTime / replay.duration) * 27.4),
      effects: { food_crisis: 0, storm: 0, plague: 0, rumor: '' },
      stats: frame?.stats ?? replay.stats,
      agents: replay.agents.map((a) => ({ ...a, ...frame?.agents.find((b) => b.id === a.id) })),
      events: replay.events.filter((e) => e.timestamp <= replayTime).slice(-100),
      eventCount: replay.events.filter((e) => e.timestamp <= replayTime).length,
      resources: [],
    };
  }
  const trust = Math.round(state.stats.averageTrust * 100);
  return (
    <div className="app-shell">
      <nav className="nav-rail" aria-label="Main navigation">
        <button className="brand-symbol" aria-label="World home" onClick={() => setDialog(null)}>
          ◎
        </button>
        <div className="nav-items">
          {NAV.map(([id, label, Icon]) => (
            <button
              key={id}
              aria-label={label}
              className={dialog === id || (id === 'world' && !dialog) ? 'active' : ''}
              onClick={() => (id === 'world' ? setDialog(null) : setDialog(id))}
            >
              <Icon size={21} strokeWidth={1.6} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="nav-bottom">
          <button
            title="Simulation archive"
            aria-label="Simulation archive"
            onClick={() => setDialog('archive')}
          >
            <Archive size={21} />
            <span>Replay</span>
          </button>
          <button title="Settings" aria-label="Settings" onClick={() => setDialog('settings')}>
            <Settings2 size={21} />
            <span>Settings</span>
          </button>
        </div>
      </nav>
      <header className="topbar">
        <div className="brand">
          <h1>AI SURVIVAL SOCIETY</h1>
          <span>TWELVE MINDS. A SMALLER TOMORROW.</span>
        </div>
        <div className="top-stats">
          <span>
            <Users size={15} />
            <small>Alive</small>
            <b data-testid="alive">{state.stats.alive}</b>
          </span>
          <span>
            <Handshake size={15} />
            <small>Trades</small>
            <b>{state.stats.trades}</b>
          </span>
          <span>
            <Network size={15} />
            <small>Alliances</small>
            <b>{state.stats.activeAlliances}</b>
          </span>
          <span>
            <Heart size={15} />
            <small>Trust</small>
            <b>{trust}%</b>
          </span>
        </div>
        <div className="playback">
          <button
            data-testid="pause"
            disabled={!!replay || live.status === 'finished'}
            onClick={() => control(live.status === 'paused' ? 'resume' : 'pause')}
          >
            {live.status === 'paused' ? <Play size={15} /> : <Pause size={15} />}
            <span>{live.status === 'paused' ? 'Resume' : 'Pause'}</span>
          </button>
          <button
            aria-label="Restart simulation"
            data-testid="restart"
            onClick={() => control('restart', live.seed)}
          >
            <RotateCcw size={15} />
            <span>Restart</span>
          </button>
          <select
            aria-label="Simulation speed"
            value={live.speed}
            onChange={(e) => control('speed', Number(e.target.value))}
          >
            {[0.5, 1, 2, 4, 8, 16, 32].map((v) => (
              <option key={v} value={v}>
                {v}× speed
              </option>
            ))}
          </select>
        </div>
      </header>
      <div className="simulation-strip">
        <div>
          <span className={connected ? 'connection-dot' : 'connection-dot offline'} />
          <span>{replay ? 'ARCHIVE REPLAY' : connected ? 'CONNECTED' : 'RECONNECTING'}</span>
          <span className="strip-divider" />
          <span>SEED {state.seed}</span>
          <span className="strip-divider" />
          <time data-testid="sim-time">{formatTime(state.elapsed)}</time>
          <span className="muted"> / {formatTime(state.duration)}</span>
        </div>
        <div className="strip-right">
          <span>
            <Skull size={12} /> {state.stats.deaths} deaths
          </span>
          <span>{state.stats.kills} kills</span>
          <span>{state.stats.betrayals} betrayals</span>
          <span>Safe zone {state.safeRadius.toFixed(1)}m</span>
          <span className="model-badge">
            {state.llm.enabled ? 'MODEL + UTILITY' : 'UTILITY AI'}
          </span>
          <button
            title="Show relationships in world"
            aria-label="Show world relationships"
            aria-pressed={graph}
            className={graph ? 'active' : ''}
            onClick={() => setGraph(!graph)}
          >
            <Network size={14} />
          </button>
          <button title="Toggle audio" aria-label="Toggle audio" onClick={toggleAudio}>
            {audio ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
          <button title="Save run" aria-label="Save run" onClick={save}>
            <Save size={14} />
          </button>
          <a href="/api/export" download title="Export event log" aria-label="Export event log">
            <Download size={14} />
          </a>
        </div>
      </div>
      <main className="main-stage">
        <Suspense fallback={<div className="world-loading">Building Haven Island…</div>}>
          <WorldView
            state={state}
            selected={selected}
            onSelect={onSelect}
            follow={follow}
            setFollow={setFollow}
            cinematic={cinematic}
            setCinematic={setCinematic}
            graphVisible={graph}
            audio={audio}
          />
        </Suspense>
        <Inspector state={state} selected={selected} onSelect={onSelect} />
      </main>
      <div className="lower-deck">
        <EventFeed events={state.events} eventCount={state.eventCount} />
        <Director
          state={state}
          onEvent={replay ? () => notify('Exit replay to introduce a live world event.') : onEvent}
        />
        <SocialGraph state={state} selected={selected} onSelect={onSelect} />
      </div>
      <footer className="statusbar">
        <span>Every decision leaves a mark.</span>
        <span>
          {live.autoRestart ? 'CONTINUOUS MODE' : 'SINGLE SIMULATION'} · {state.eventCount} recorded
          events
        </span>
        <button onClick={() => setDialog('help')}>Controls & about</button>
      </footer>
      {replay ? (
        <div className="replay-bar">
          <button aria-label="Play replay" onClick={() => setReplayPlaying(!replayPlaying)}>
            {replayPlaying ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <strong>ARCHIVE · SEED {replay.seed}</strong>
          <input
            aria-label="Replay timeline"
            type="range"
            min="0"
            max={replay.elapsed}
            step=".25"
            value={replayTime}
            onChange={(e) => setReplayTime(Number(e.target.value))}
          />
          <time>{formatTime(replayTime)}</time>
          <button
            onClick={() => {
              setReplay(null);
              setReplayPlaying(false);
            }}
          >
            Return live
          </button>
        </div>
      ) : null}
      {live.status === 'finished' && !replay ? (
        <div className="result-banner">
          <TrophyMark />
          <span>
            {live.agents.find((a) => a.id === live.winner)?.name ?? 'No one'} survived the island.
          </span>
          <button onClick={() => setDialog('winner')}>View history</button>
          {live.restartIn !== null ? (
            <small>Next world in {Math.ceil(live.restartIn)}s</small>
          ) : null}
        </div>
      ) : null}
      {toast ? (
        <div className="toast" role="status">
          <AlertCircle size={16} />
          {toast}
          <button aria-label="Dismiss notification" onClick={() => setToast('')}>
            ×
          </button>
        </div>
      ) : null}
      {dialog === 'settings' ? (
        <Settings
          state={live}
          onClose={() => setDialog(null)}
          onError={onError}
          onControl={control}
        />
      ) : null}
      {dialog === 'agents' ? (
        <Roster state={state} onSelect={onSelect} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === 'winner' ? (
        <Winner
          state={replay ?? live}
          onClose={() => setDialog(null)}
          onRestart={() => control('restart', (live.seed + 1) >>> 0)}
        />
      ) : null}
      {dialog === 'archive' ? (
        <ReplayLibrary
          onClose={() => setDialog(null)}
          onLoad={(r) => {
            setReplay(r);
            setReplayTime(0);
            setReplayPlaying(false);
          }}
          onError={onError}
        />
      ) : null}
      {dialog === 'feed' ? (
        <Modal title="World event log" onClose={() => setDialog(null)} wide>
          <EventFeed events={state.events} eventCount={state.eventCount} expanded />
          <a className="button" href="/api/export" download>
            <Download size={14} /> Download complete event log
          </a>
        </Modal>
      ) : null}
      {dialog === 'network' ? (
        <Modal title="The social fabric" onClose={() => setDialog(null)} wide>
          <SocialGraph state={state} selected={selected} onSelect={onSelect} expanded />
          <p className="muted">
            Green: friendship · Blue: alliance · Red: hostility. Lines reflect current relationship
            data; eliminated agents fade.
          </p>
          <div className="leaderboard">
            <span>
              Most trusted<strong>{state.stats.mostTrusted}</strong>
            </span>
            <span>
              Most feared<strong>{state.stats.mostFeared}</strong>
            </span>
            <span>
              Most aggressive<strong>{state.stats.mostAggressive}</strong>
            </span>
            <span>
              Most social<strong>{state.stats.mostSocial}</strong>
            </span>
          </div>
        </Modal>
      ) : null}
      {dialog === 'director' ? (
        <Modal title="Director mode" onClose={() => setDialog(null)} wide>
          <p className="muted">You change the environment. The agents choose how to respond.</p>
          <Director state={state} onEvent={onEvent} expanded />
        </Modal>
      ) : null}
      {dialog === 'help' ? (
        <Modal title="Welcome to the observatory" onClose={() => setDialog(null)}>
          <p>
            Twelve autonomous robots share a small island. Resources, personality, relationships and
            memories shape their choices. The safe zone contracts until a survivor remains.
          </p>
          <dl className="help-list">
            <dt>Camera</dt>
            <dd>
              Drag to orbit, right-drag to pan, wheel to zoom. Click a robot or its name to focus.
            </dd>
            <dt>Follow & cinema</dt>
            <dd>
              Eye follows the selected robot. Video focuses notable combat and alliance events.
            </dd>
            <dt>Director</dt>
            <dd>Introduce crises, gifts or rumors. Every decision still belongs to the agents.</dd>
            <dt>Seeds</dt>
            <dd>
              Same seed + same events + Utility AI reproduces the same simulation. LLM decisions are
              intentionally nondeterministic.
            </dd>
            <dt>Continuous mode</dt>
            <dd>
              New world after each result. Toggle in Settings. Completed runs are saved, with the
              most recent 30 retained.
            </dd>
            <dt>Models</dt>
            <dd>
              Enable Ollama or a compatible API in Settings. Timeouts and invalid replies fall back
              to Utility AI.
            </dd>
            <dt>Replay</dt>
            <dd>
              Review saved timeline samples and full event history. This is an observational replay,
              not a deterministic re-simulation.
            </dd>
          </dl>
        </Modal>
      ) : null}
    </div>
  );
}
function TrophyMark() {
  return <span className="amber">♜</span>;
}
