import { useEffect, useState } from 'react';
import { X, Download, Trophy, Play, ArrowRight, Save } from 'lucide-react';
import { request, formatTime } from '../api.mjs';
import { RobotPortrait } from './Inspector.jsx';
export function Modal({ title, onClose, children, wide = false }) {
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button aria-label="Close dialog" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function Settings({ onClose, onError, state, onControl }) {
  const [config, setConfig] = useState(null),
    [saving, setSaving] = useState(false),
    [note, setNote] = useState(''),
    [seed, setSeed] = useState(state.seed);
  useEffect(() => {
    request('/api/config/llm').then(setConfig).catch(onError);
  }, []);
  const update = (key, value) => setConfig((c) => ({ ...c, [key]: value }));
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await request('/api/config/llm', config);
      setNote('Model settings applied. Utility AI remains available at all times.');
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal title="Simulation settings" onClose={onClose}>
      <div className="settings-block">
        <h3>Reproducible worlds</h3>
        <label>
          Random seed
          <input
            type="number"
            min="0"
            max="4294967295"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
          />
        </label>
        <button
          className="primary"
          onClick={() => {
            onControl('restart', seed);
            onClose();
          }}
        >
          Start this seed <ArrowRight size={15} />
        </button>
        <label className="check-label">
          <input
            type="checkbox"
            checked={state.autoRestart}
            onChange={(e) => onControl('auto_restart', e.target.checked)}
          />
          Continuous mode: start a new seed after each result
        </label>
        <p className="muted">
          Results remain visible for 35 seconds and are saved automatically. Pause to hold the
          world.
        </p>
      </div>
      <form onSubmit={save} className="settings-block">
        <h3>Optional language model</h3>
        {config ? (
          <>
            <label className="check-label">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => update('enabled', e.target.checked)}
              />
              Enable high-level model decisions
            </label>
            <label>
              Provider
              <select value={config.provider} onChange={(e) => update('provider', e.target.value)}>
                <option value="ollama">Local Ollama</option>
                <option value="compatible">OpenAI-compatible API</option>
                <option value="fallback">Utility AI only</option>
              </select>
            </label>
            <label>
              Endpoint
              <input value={config.endpoint} onChange={(e) => update('endpoint', e.target.value)} />
            </label>
            <label>
              Model
              <input value={config.model} onChange={(e) => update('model', e.target.value)} />
            </label>
            <div className="form-row">
              <label>
                Temperature
                <input
                  type="number"
                  min="0"
                  max="2"
                  step=".1"
                  value={config.temperature}
                  onChange={(e) => update('temperature', Number(e.target.value))}
                />
              </label>
              <label>
                Timeout (ms)
                <input
                  type="number"
                  min="500"
                  max="60000"
                  step="500"
                  value={config.timeoutMs}
                  onChange={(e) => update('timeoutMs', Number(e.target.value))}
                />
              </label>
            </div>
            <p className="muted">
              Model calls run in a bounded background queue. Remote API keys are read only by the
              server from LLM_API_KEY. They never enter this client.
            </p>
            <button type="submit" className="primary" disabled={saving}>
              {saving ? 'Applying…' : 'Apply model settings'}
            </button>
            <p className="settings-note">{note}</p>
            <div className="model-status">
              <span>{state.llm.state}</span>
              <span>
                {state.llm.completed} valid · {state.llm.failed} fallbacks
              </span>
            </div>
            {state.llm.lastError ? <p className="coral">{state.llm.lastError}</p> : null}
          </>
        ) : (
          <p>Loading settings…</p>
        )}
      </form>
    </Modal>
  );
}
export function Roster({ state, onSelect, onClose }) {
  return (
    <Modal title="Twelve minds" onClose={onClose} wide>
      <div className="roster">
        {state.agents.map((a) => (
          <button
            key={a.id}
            className={a.alive ? '' : 'eliminated'}
            onClick={() => {
              onSelect(a.id);
              onClose();
            }}
          >
            <RobotPortrait agent={a} size={50} />
            <div>
              <strong>{a.name}</strong>
              <span>{a.goal}</span>
            </div>
            <b>{Math.round(a.hp)} HP</b>
          </button>
        ))}
      </div>
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
  );
}
export function Winner({ state, onClose, onRestart }) {
  const a = state.agents.find((a) => a.id === state.winner);
  return (
    <Modal title="The island remembers" onClose={onClose} wide>
      <div className="winner-intro">
        <Trophy size={25} />
        <span>LAST SURVIVOR</span>
        {a ? <RobotPortrait agent={a} size={86} /> : null}
        <h1>{a ? a.name : 'No survivors'}</h1>
        <p>{state.history?.summary}</p>
      </div>
      <div className="winner-stats">
        {[
          ['Survival', formatTime(state.elapsed)],
          ['Kills', a?.stats.kills ?? 0],
          ['Trades', a?.stats.trades ?? 0],
          ['Alliances', a?.stats.alliances ?? 0],
          ['Betrayals', a?.stats.betrayals ?? 0],
        ].map(([k, v]) => (
          <div key={k}>
            <strong>{v}</strong>
            <span>{k}</span>
          </div>
        ))}
      </div>
      <div className="history">
        {state.history?.narration ? (
          <p className="narration">{state.history.narration}</p>
        ) : (
          state.history?.chapters.map((c) => (
            <section key={c.title}>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
            </section>
          ))
        )}
      </div>
      <div className="modal-footer">
        <a className="button" href="/api/export" download>
          <Download size={14} /> Export this history
        </a>
        <button className="primary" onClick={onRestart}>
          <Play size={14} /> New simulation
        </button>
      </div>
    </Modal>
  );
}
export function ReplayLibrary({ onClose, onLoad, onError }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    request('/api/replays').then(setItems).catch(onError);
  }, []);
  return (
    <Modal title="Simulation archive" onClose={onClose} wide>
      <p className="muted">
        Review a saved timeline, statistics and major events. Live simulation continues
        independently.
      </p>
      <div className="archive-list">
        {items?.length ? (
          items.map((r) => (
            <button
              key={r.id}
              onClick={async () => {
                try {
                  onLoad(await request(`/api/replays/${r.id}`));
                  onClose();
                } catch (e) {
                  onError(e);
                }
              }}
            >
              <div>
                <strong>Seed {r.seed}</strong>
                <span>
                  {r.winner ? `${r.winner} survived` : `${r.status} simulation`} · {r.events} events
                </span>
              </div>
              <time>{formatTime(r.elapsed)}</time>
              <ArrowRight size={17} />
            </button>
          ))
        ) : (
          <p>
            {items
              ? 'No saved runs yet. Use Save run or complete a simulation.'
              : 'Loading archive…'}
          </p>
        )}
      </div>
      <label className="import-replay">
        Or import an exported log
        <input
          type="file"
          accept="application/json,.json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              if (file.size > 20 * 1024 * 1024) throw new Error('Replay exceeds 20MB');
              const r = JSON.parse(await file.text());
              if (
                r.schemaVersion !== 1 ||
                !Array.isArray(r.timeline) ||
                !Array.isArray(r.agents) ||
                !Array.isArray(r.events) ||
                !r.stats ||
                r.timeline.length > 5000 ||
                r.agents.length !== 12
              )
                throw new Error('Unsupported replay schema');
              onLoad(r);
              onClose();
            } catch (err) {
              onError(err);
            }
          }}
        />
      </label>
    </Modal>
  );
}
