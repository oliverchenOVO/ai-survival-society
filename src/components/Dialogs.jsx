import { useLocale } from '../i18n/LocaleProvider.jsx';
import { useEffect, useState } from 'react';
import { X, Download, Trophy, Skull, Play, ArrowRight, Save } from 'lucide-react';
import { request, formatTime } from '../api.mjs';
import { RobotPortrait } from './Inspector.jsx';
import { DEBUG_KEY, DEBUG_LAYERS, readSpatialDebug } from '../world/spatial-debug-settings.mjs';
export function Modal({ title, onClose, children, wide = false }) {
  const { t } = useLocale();
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
          <button aria-label={t('a11y.close')} onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function Settings({ onClose, onError, state, onControl }) {
  const [spatialDebug, setSpatialDebug] = useState(readSpatialDebug);
  const { t, error: localizeError, locale, setLanguage, preferenceError } = useLocale();
  const [config, setConfig] = useState(null),
    [saving, setSaving] = useState(false),
    [note, setNote] = useState(''),
    [seed, setSeed] = useState(state.seed);
  useEffect(() => {
    request('/api/config/llm').then(setConfig).catch(onError);
  }, []);
  const update = (key, value) =>
    setConfig((c) => ({
      ...c,
      [key]: value,
    }));
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await request('/api/config/llm', config);
      setNote('settings.applied');
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal title={t('settings.title')} onClose={onClose}>
      <div className="settings-block">
        <label>
          {t('settings.language')}
          <select
            aria-label={t('settings.language')}
            data-testid="language-select"
            value={locale}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="zh-TW">{t('language.zhTW')}</option>
            <option value="en">{t('language.en')}</option>
          </select>
        </label>
        <p className="muted">{t('settings.languageHelp')}</p>
        {preferenceError ? <p role="status">{t('language.failed')}</p> : null}
      </div>
      <div className="settings-block">
        <h3>{t('settings.worlds')}</h3>
        <label>
          {t('settings.seed')}
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
          {t('settings.startSeed')}
          <ArrowRight size={15} />
        </button>
        <label className="check-label">
          <input
            type="checkbox"
            checked={state.autoRestart}
            onChange={(e) => onControl('auto_restart', e.target.checked)}
          />
          {t('settings.continuous')}
        </label>
        <p className="muted">{t('settings.continuousHelp')}</p>
      </div>
      <div className="settings-block">
        <h3>{t('spatial.debug')}</h3>
        <p className="muted">{t('spatial.debugHelp')}</p>
        {DEBUG_LAYERS.map((layer) => (
          <label className="check-label" key={layer}>
            <input
              type="checkbox"
              data-testid={'spatial-' + layer}
              checked={!!spatialDebug[layer]}
              onChange={(e) => {
                const next = { ...spatialDebug, [layer]: e.target.checked };
                setSpatialDebug(next);
                try {
                  localStorage.setItem(DEBUG_KEY, JSON.stringify(next));
                } catch {}
                window.dispatchEvent(new CustomEvent('society-spatial-debug', { detail: next }));
              }}
            />
            {t('spatial.' + layer)}
          </label>
        ))}
      </div>
      <form onSubmit={save} className="settings-block">
        <h3>{t('settings.models')}</h3>
        {config ? (
          <>
            <label className="check-label">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => update('enabled', e.target.checked)}
              />
              {t('settings.enabled')}
            </label>
            <label>
              {t('settings.provider')}
              <select value={config.provider} onChange={(e) => update('provider', e.target.value)}>
                <option value="ollama">{t('settings.ollama')}</option>
                <option value="compatible">{t('settings.compatible')}</option>
                <option value="fallback">{t('settings.fallback')}</option>
              </select>
            </label>
            <label>
              {t('settings.endpoint')}
              <input value={config.endpoint} onChange={(e) => update('endpoint', e.target.value)} />
            </label>
            <label>
              {t('settings.model')}
              <input value={config.model} onChange={(e) => update('model', e.target.value)} />
            </label>
            <div className="form-row">
              <label>
                {t('settings.temperature')}
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
                {t('settings.timeout')}
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
            <p className="muted">{t('settings.security')}</p>
            <button type="submit" className="primary" disabled={saving}>
              {saving ? t('settings.applying') : t('settings.apply')}
            </button>
            <p className="settings-note">{note ? t(note) : ''}</p>
            <div className="model-status">
              <span>{t('model.' + state.llm.state)}</span>
              <span>
                {t('model.count', {
                  valid: state.llm.completed,
                  failed: state.llm.failed,
                })}
              </span>
            </div>
            {state.llm.lastError ? (
              <p className="coral">{localizeError(state.llm.lastError)}</p>
            ) : null}
          </>
        ) : (
          <p>{t('settings.loading')}</p>
        )}
      </form>
    </Modal>
  );
}
export function Roster({ state, onSelect, onClose }) {
  const { t, text } = useLocale();
  return (
    <Modal title={t('roster.title')} onClose={onClose} wide>
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
              <span>{text(a.goal)}</span>
            </div>
            <b>{Math.round(a.hp)} HP</b>
          </button>
        ))}
      </div>
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
  );
}
export function Winner({ state, onClose, onRestart }) {
  const { t, error: localizeError, history: localizeHistory } = useLocale();
  const localizedHistory = localizeHistory(state);
  const a = state.agents.find((a) => a.id === state.winner);
  const [exportUrl, setExportUrl] = useState(null),
    [exportError, setExportError] = useState('');
  useEffect(() => {
    let disposed = false,
      url;
    const load = state.timeline
      ? Promise.resolve(state)
      : request(`/api/matches/${state.matchId}/export`);
    load
      .then((data) => {
        if (disposed) return;
        url = URL.createObjectURL(
          new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json',
          }),
        );
        setExportUrl(url);
      })
      .catch((e) => {
        if (!disposed) setExportError(e.message);
      });
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [state.matchId]);
  return (
    <Modal title={t('result.title')} onClose={onClose} wide>
      <div className="winner-intro">
        {a ? <Trophy size={25} /> : <Skull size={25} />}
        <span>{a ? t('result.winner') : t('result.extinction')}</span>
        {a ? <RobotPortrait agent={a} size={86} /> : null}
        <h1>{a ? a.name : t('result.claimed')}</h1>
        <p>{localizedHistory?.summary}</p>
        <small>
          {t('result.seed', {
            seed: state.seed,
          })}
        </small>
      </div>
      <div className="winner-stats">
        {[
          [t('stats.duration'), formatTime(state.elapsed)],
          [t('stats.kills'), state.stats.kills],
          [t('stats.trades'), state.stats.trades],
          [t('stats.alliances'), state.stats.alliances],
          [t('stats.betrayals'), state.stats.betrayals],
        ].map(([k, v]) => (
          <div key={k}>
            <strong>{v}</strong>
            <span>{k}</span>
          </div>
        ))}
      </div>
      <div className="leaderboard">
        <span>
          {t('ranking.social')}
          <strong>
            {state.stats.conversations || state.stats.trades ? state.stats.mostSocial : '—'}
          </strong>
        </span>
        <span>
          {t('ranking.trusted')}
          <strong>
            {state.stats.conversations || state.stats.trades || state.stats.alliances
              ? state.stats.mostTrusted
              : '—'}
          </strong>
        </span>
        <span>
          {t('ranking.aid')}
          <strong>
            {t('stats.acts', {
              count: state.stats.cooperation,
            })}
          </strong>
        </span>
      </div>
      <div className="history">
        {state.history?.narration ? (
          <p className="narration">{state.history.narration}</p>
        ) : (
          localizedHistory?.chapters.map((c) => (
            <section key={c.title}>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
            </section>
          ))
        )}
      </div>
      <div className="modal-footer">
        {state.simulation_id ? (
          <a className="button primary" href={'/story/' + state.simulation_id}>
            {t('story.view')}
          </a>
        ) : null}
        {exportUrl ? (
          <a
            className="button"
            href={exportUrl}
            download={`society-${state.simulation_id ?? state.matchId}.json`}
          >
            <Download size={14} />
            {t('result.export')}
          </a>
        ) : (
          <span>{exportError ? localizeError(exportError) : t('result.preparing')}</span>
        )}
        <button className="primary" onClick={onRestart}>
          <Play size={14} />
          {t('result.new')}
        </button>
      </div>
    </Modal>
  );
}
export function ReplayLibrary({ onClose, onLoad, onError }) {
  const { t, locale } = useLocale();
  const [items, setItems] = useState(null);
  const [search, setSearch] = useState(''),
    [sort, setSort] = useState('newest');
  const visible = (items ?? [])
    .filter((r) => [r.id, r.seed, r.winner].join(' ').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sort === 'oldest'
        ? (a.date ?? '').localeCompare(b.date ?? '')
        : sort === 'longest'
          ? b.elapsed - a.elapsed
          : sort === 'combat'
            ? (b.stats?.kills ?? 0) - (a.stats?.kills ?? 0)
            : sort === 'sociable'
              ? (b.stats?.trades ?? 0) +
                (b.stats?.alliances ?? 0) -
                ((a.stats?.trades ?? 0) + (a.stats?.alliances ?? 0))
              : (b.date ?? '').localeCompare(a.date ?? ''),
    );
  useEffect(() => {
    request('/api/replays').then(setItems).catch(onError);
  }, []);
  return (
    <Modal title={t('replay.title')} onClose={onClose} wide>
      <p className="muted">{t('replay.intro')}</p>
      <h3>{t('story.library')}</h3>
      <div className="library-tools">
        <input
          aria-label={t('story.search')}
          placeholder={t('story.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select aria-label={t('story.sort')} value={sort} onChange={(e) => setSort(e.target.value)}>
          {['newest', 'oldest', 'longest', 'combat', 'sociable'].map((k) => (
            <option key={k} value={k}>
              {t('story.' + k)}
            </option>
          ))}
        </select>
      </div>
      <div className="archive-list">
        {visible.length ? (
          visible.map((r) => (
            <article className="library-entry" key={r.id}>
              <button
                key={r.id}
                data-testid="library-replay"
                disabled={r.error}
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
                  <strong>{r.error ? t('story.unavailable') : `Seed ${r.seed}`}</strong>
                  <small className="library-id">{r.id}</small>
                  <span>
                    {r.error
                      ? t('story.error')
                      : r.winner
                        ? t('replay.survived', {
                            name: r.winner,
                          })
                        : r.outcome?.kind === 'extinction'
                          ? t('replay.extinction')
                          : t('replay.status', {
                              status: t('status.' + r.status),
                            })}{' '}
                    ·{' '}
                    {t('replay.events', {
                      count: r.events,
                    })}
                  </span>
                </div>
                <time>{r.error ? '—' : formatTime(r.elapsed)}</time>
                <ArrowRight size={17} />
              </button>
              <div className="library-meta">
                {r.resumable ? (
                  <button
                    onClick={async () => {
                      try {
                        await request('/api/load', { id: r.id });
                        location.href = '/';
                      } catch (e) {
                        onError(e);
                      }
                    }}
                  >
                    {t('world.resume')}
                  </button>
                ) : null}
                <time>
                  {r.date ? new Date(r.date).toLocaleString(locale) : t('story.unknownDate')}
                </time>
                {['kills', 'trades', 'alliances', 'betrayals'].map((k) => (
                  <span key={k}>
                    {t('stats.' + k)} {r.stats?.[k] ?? 0}
                  </span>
                ))}
              </div>
              <div className="library-actions">
                {r.status === 'finished' ? (
                  <>
                    <a className="button" href={'/story/' + r.id}>
                      {t('story.view')}
                    </a>
                    <a
                      className="button"
                      href={`/api/stories/${r.id}/export?format=markdown&lang=${locale}`}
                      download
                    >
                      {t('story.markdown')}
                    </a>
                    <a className="button" href={`/api/stories/${r.id}/export`} download>
                      {t('story.json')}
                    </a>
                  </>
                ) : null}
                <button
                  onClick={async () => {
                    if (!confirm(t('story.confirmDelete'))) return;
                    try {
                      const res = await fetch('/api/stories/' + r.id, { method: 'DELETE' });
                      if (!res.ok) throw new Error(t('story.error'));
                      setItems(items.filter((i) => i.id !== r.id));
                    } catch (e) {
                      onError(e);
                    }
                  }}
                >
                  {t('story.delete')}
                </button>
              </div>
            </article>
          ))
        ) : (
          <p>{items ? t('replay.empty') : t('replay.loading')}</p>
        )}
      </div>
      <label className="import-replay">
        {t('replay.import')}
        <input
          type="file"
          accept="application/json,.json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              if (file.size > 20 * 1024 * 1024) throw new Error(t('error.replaySize'));
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
                throw new Error(t('error.replaySchema'));
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
