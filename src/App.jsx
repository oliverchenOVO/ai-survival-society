import { useLocale } from './i18n/LocaleProvider.jsx';
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
import { safeRadiusAt } from '../core/rules.mjs';
const WorldView = lazy(() => import('./world/WorldView.jsx'));
const NAV = [
  ['world', 'nav.world', Globe2],
  ['agents', 'nav.agents', Users],
  ['feed', 'nav.log', ScrollText],
  ['network', 'nav.network', Network],
  ['director', 'nav.director', SlidersHorizontal],
];
export default function App() {
  const { t, error: localizeError } = useLocale();
  const [live, setLive] = useState(null),
    [connected, setConnected] = useState(false),
    [selected, setSelected] = useState('Agent_01'),
    [dialog, setDialog] = useState(null),
    [completedResult, setCompletedResult] = useState(null),
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
  const onError = useCallback(
    (e) =>
      setToast({
        kind: 'error',
        text: e.message ?? String(e),
      }),
    [],
  );
  const notify = useCallback(
    (message) =>
      setToast({
        kind: 'message',
        key: message,
      }),
    [],
  );
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
      setCompletedResult(live);
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
        const s = await request('/api/control', {
          action,
          value,
        });
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
      setLive(
        await request('/api/director', {
          event,
        }),
      );
      notify('toast.director');
    } catch (e) {
      onError(e);
    }
  };
  const onSelect = useCallback((id) => setSelected(id), []);
  const save = async () => {
    try {
      await request('/api/save', {});
      notify('toast.saved');
    } catch (e) {
      onError(e);
    }
  };
  if (!live)
    return (
      <div className="startup">
        <div className="brand-symbol">◎</div>
        <h1>AI Survival Society</h1>
        <p>{t('connection.connecting')}</p>
        {toast ? (
          <p className="coral">
            {toast.kind === 'error' ? localizeError(toast.text) : t(toast.key)}
          </p>
        ) : null}
        <small>{t('connection.startHelp')}</small>
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
      safeRadius: safeRadiusAt(
        replayTime,
        replay.duration,
        replay.duration * (replay.config?.safeZoneGraceFraction ?? 0),
      ),
      effects: {
        food_crisis: 0,
        storm: 0,
        plague: 0,
        rumor: '',
      },
      stats: frame?.stats ?? replay.stats,
      agents: replay.agents.map((a) => ({
        ...a,
        ...frame?.agents.find((b) => b.id === a.id),
      })),
      events: replay.events.filter((e) => e.timestamp <= replayTime).slice(-100),
      eventCount: replay.events.filter((e) => e.timestamp <= replayTime).length,
      resources: [],
    };
  }
  const trust = Math.round(state.stats.averageTrust * 100);
  return (
    <div className="app-shell">
      <nav className="nav-rail" aria-label={t('a11y.navigation')}>
        <button
          className="brand-symbol"
          aria-label={t('a11y.home')}
          onClick={() => setDialog(null)}
        >
          ◎
        </button>
        <div className="nav-items">
          {NAV.map(([id, label, Icon]) => (
            <button
              key={id}
              aria-label={t(label)}
              className={dialog === id || (id === 'world' && !dialog) ? 'active' : ''}
              onClick={() => (id === 'world' ? setDialog(null) : setDialog(id))}
            >
              <Icon size={21} strokeWidth={1.6} />
              <span>{t(label)}</span>
            </button>
          ))}
        </div>
        <div className="nav-bottom">
          <button
            title={t('replay.title')}
            aria-label={t('replay.title')}
            onClick={() => setDialog('archive')}
          >
            <Archive size={21} />
            <span>{t('nav.replay')}</span>
          </button>
          <button
            title={t('nav.settings')}
            aria-label={t('nav.settings')}
            onClick={() => setDialog('settings')}
          >
            <Settings2 size={21} />
            <span>{t('nav.settings')}</span>
          </button>
        </div>
      </nav>
      <header className="topbar">
        <div className="brand">
          <h1>AI SURVIVAL SOCIETY</h1>
          <span>{t('brand.tagline')}</span>
        </div>
        <div className="top-stats">
          <span>
            <Users size={15} />
            <small>{t('stats.alive')}</small>
            <b data-testid="alive">{state.stats.alive}</b>
          </span>
          <span>
            <Handshake size={15} />
            <small>{t('stats.trades')}</small>
            <b>{state.stats.trades}</b>
          </span>
          <span>
            <Network size={15} />
            <small>{t('stats.alliances')}</small>
            <b>{state.stats.activeAlliances}</b>
          </span>
          <span>
            <Heart size={15} />
            <small>{t('stats.trust')}</small>
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
            <span>{live.status === 'paused' ? t('control.resume') : t('control.pause')}</span>
          </button>
          <button
            aria-label={t('control.restartLabel')}
            data-testid="restart"
            onClick={() => control('restart', live.seed)}
          >
            <RotateCcw size={15} />
            <span>{t('control.restart')}</span>
          </button>
          <select
            aria-label={t('control.speedLabel')}
            value={live.speed}
            onChange={(e) => control('speed', Number(e.target.value))}
          >
            {[0.5, 1, 2, 4, 8, 16, 32].map((v) => (
              <option key={v} value={v}>
                {t('speed.option', {
                  speed: v,
                })}
              </option>
            ))}
          </select>
        </div>
      </header>
      <div className="simulation-strip">
        <div>
          <span className={connected ? 'connection-dot' : 'connection-dot offline'} />
          <span>
            {replay
              ? t('replay.active')
              : connected
                ? t('connection.connected')
                : t('connection.reconnecting')}
          </span>
          <span className="strip-divider" />
          <span>SEED {state.seed}</span>
          <span className="strip-divider" />
          <time data-testid="sim-time">{formatTime(state.elapsed)}</time>
          <span className="muted"> / {formatTime(state.duration)}</span>
        </div>
        <div className="strip-right">
          <span>
            <Skull size={12} />{' '}
            {t('stats.deathCount', {
              count: state.stats.deaths,
            })}
          </span>
          <span>
            {t('stats.killCount', {
              count: state.stats.kills,
            })}
          </span>
          <span>
            {t('stats.betrayalCount', {
              count: state.stats.betrayals,
            })}
          </span>
          <span>
            {t('stats.safeZone', {
              radius: state.safeRadius.toFixed(1),
            })}
          </span>
          <span className="model-badge">{state.llm.enabled ? t('model.badge') : 'Utility AI'}</span>
          <button
            title={t('tooltip.relationships')}
            aria-label={t('tooltip.worldRelationships')}
            aria-pressed={graph}
            className={graph ? 'active' : ''}
            onClick={() => setGraph(!graph)}
          >
            <Network size={14} />
          </button>
          <button title={t('tooltip.audio')} aria-label={t('tooltip.audio')} onClick={toggleAudio}>
            {audio ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
          <button title={t('tooltip.save')} aria-label={t('tooltip.save')} onClick={save}>
            <Save size={14} />
          </button>
          <a
            href="/api/export"
            download
            title={t('tooltip.export')}
            aria-label={t('tooltip.export')}
          >
            <Download size={14} />
          </a>
        </div>
      </div>
      <main className="main-stage">
        <Suspense fallback={<div className="world-loading">{t('connection.loadingWorld')}</div>}>
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
        <Director state={state} onEvent={replay ? () => notify('toast.replay') : onEvent} />
        <SocialGraph state={state} selected={selected} onSelect={onSelect} />
      </div>
      <footer className="statusbar">
        <span>{t('footer.motto')}</span>
        <span>
          {live.autoRestart ? t('footer.continuous') : t('footer.single')} ·{' '}
          {t('footer.count', {
            count: state.eventCount,
          })}
        </span>
        <button onClick={() => setDialog('help')}>{t('help.controls')}</button>
      </footer>
      {replay ? (
        <div className="replay-bar">
          <button aria-label={t('replay.play')} onClick={() => setReplayPlaying(!replayPlaying)}>
            {replayPlaying ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <strong>
            {t('replay.seed', {
              seed: replay.seed,
            })}
          </strong>
          <input
            aria-label={t('replay.timeline')}
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
            {t('replay.return')}
          </button>
        </div>
      ) : null}
      {live.status === 'finished' && !replay ? (
        <div className="result-banner">
          <TrophyMark />
          <span>
            {live.winner
              ? t('result.survived', {
                  name: live.agents.find((a) => a.id === live.winner)?.name,
                })
              : t('result.extinctionBanner')}
          </span>
          <button
            onClick={() => {
              setCompletedResult(live);
              setDialog('winner');
            }}
          >
            {t('result.view')}
          </button>
          {live.restartIn !== null ? (
            <small>
              {t('result.next', {
                seconds: Math.ceil(live.restartIn),
              })}
            </small>
          ) : null}
        </div>
      ) : null}
      {toast ? (
        <div className="toast" role="status">
          <AlertCircle size={16} />
          {toast.kind === 'error' ? localizeError(toast.text) : t(toast.key)}
          <button aria-label={t('a11y.dismiss')} onClick={() => setToast('')}>
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
      {dialog === 'winner' && (replay ?? completedResult)?.status === 'finished' ? (
        <Winner
          key={(replay ?? completedResult).matchId}
          state={replay ?? completedResult}
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
        <Modal title={t('log.title')} onClose={() => setDialog(null)} wide>
          <EventFeed events={state.events} eventCount={state.eventCount} expanded />
          <a className="button" href="/api/export" download>
            <Download size={14} />
            {t('log.download')}
          </a>
        </Modal>
      ) : null}
      {dialog === 'network' ? (
        <Modal title={t('graph.title')} onClose={() => setDialog(null)} wide>
          <SocialGraph state={state} selected={selected} onSelect={onSelect} expanded />
          <p className="muted">{t('graph.explanation')}</p>
          <div className="leaderboard">
            <span>
              {t('ranking.trusted')}
              <strong>{state.stats.mostTrusted}</strong>
            </span>
            <span>
              {t('ranking.feared')}
              <strong>{state.stats.mostFeared}</strong>
            </span>
            <span>
              {t('ranking.aggressive')}
              <strong>{state.stats.mostAggressive}</strong>
            </span>
            <span>
              {t('ranking.social')}
              <strong>{state.stats.mostSocial}</strong>
            </span>
          </div>
        </Modal>
      ) : null}
      {dialog === 'director' ? (
        <Modal title={t('director.label')} onClose={() => setDialog(null)} wide>
          <p className="muted">{t('director.explanation')}</p>
          <Director state={state} onEvent={onEvent} expanded />
        </Modal>
      ) : null}
      {dialog === 'help' ? (
        <Modal title={t('help.title')} onClose={() => setDialog(null)}>
          <p>{t('help.intro')}</p>
          <dl className="help-list">
            <dt>{t('help.camera')}</dt>
            <dd>{t('help.cameraText')}</dd>
            <dt>{t('help.follow')}</dt>
            <dd>{t('help.followText')}</dd>
            <dt>{t('nav.director')}</dt>
            <dd>{t('help.directorText')}</dd>
            <dt>{t('help.seeds')}</dt>
            <dd>{t('help.seedText')}</dd>
            <dt>{t('help.continuous')}</dt>
            <dd>{t('help.continuousText')}</dd>
            <dt>{t('help.models')}</dt>
            <dd>{t('help.modelsText')}</dd>
            <dt>{t('nav.replay')}</dt>
            <dd>{t('help.replayText')}</dd>
          </dl>
        </Modal>
      ) : null}
    </div>
  );
}
function TrophyMark() {
  return <span className="amber">♜</span>;
}
