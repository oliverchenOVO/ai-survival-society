import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Share2, Download, Play, Trophy, Skull } from 'lucide-react';
import { useLocale } from '../i18n/LocaleProvider.jsx';
import { request } from '../api.mjs';
import { RobotPortrait } from '../components/Inspector.jsx';
import { Modal } from '../components/Dialogs.jsx';
import { biography, summary, time, category, shareCardSVG } from './facts.mjs';
import './story.css';
const counters = ['kills', 'trades', 'alliances', 'betrayals'];
const replayLink = (d, e) => `/replay/${d.simulation_id}?t=${e?.timestamp ?? 0}`;
function Stats({ stats, hero = false }) {
  const { t } = useLocale();
  return (
    <div className={hero ? 'story-stats' : 'cast-stats'}>
      {(hero ? ['deaths', ...counters] : counters).map((k) => (
        <div key={k}>
          <b>{stats[k] ?? 0}</b>
          <span>{t('stats.' + k)}</span>
        </div>
      ))}
    </div>
  );
}
function Fate({ data, agent }) {
  const { t, text } = useLocale();
  const f = data.story.agents.find((f) => f.id === agent.id);
  return (
    <span>
      {agent.id === data.winner
        ? t('result.winner')
        : f.killer
          ? t('story.killed', { name: data.agents.find((a) => a.id === f.killer)?.name })
          : f.cause
            ? t('story.environment', { cause: text(f.cause) })
            : t('story.dead')}
    </span>
  );
}
function EventRow({ data, event, major = false, first = false }) {
  const { t, event: localizeEvent } = useLocale();
  return (
    <article className={`story-event category-${category(event.event)}`} data-event-id={event.id}>
      <time>{time(event.timestamp)}</time>
      <div>
        <span className="story-eyebrow">
          {t('type.' + event.event)}
          {first ? ' · ' + t('story.first') : ''}
        </span>
        <p>{localizeEvent(event)}</p>
      </div>
      {major ? (
        <a className="moment-watch" href={replayLink(data, event)} title={t('story.watch')}>
          <Play size={15} />
          <span>{t('story.watch')}</span>
        </a>
      ) : null}
    </article>
  );
}
function Timeline({ data, events = data.events }) {
  const { t } = useLocale();
  const [filter, setFilter] = useState('All'),
    [type, setType] = useState(''),
    [agent, setAgent] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [page, setPage] = useState(1);
  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (filter === 'All' || category(e.event) === filter) &&
          (!type || e.event === type) &&
          (!agent || [e.actor, e.target, e.data?.victim].includes(agent)) &&
          (from === '' || e.timestamp >= Number(from)) &&
          (to === '' || e.timestamp <= Number(to)),
      ),
    [events, filter, type, agent, from, to],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 25)),
    current = Math.min(page, pages);
  const change = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };
  return (
    <div className="story-full-timeline">
      <div className="story-filters">
        <label>
          {t('story.category')}
          <select aria-label={t('story.category')} value={filter} onChange={change(setFilter)}>
            {['All', 'Social', 'Combat', 'Alliance', 'Trade', 'Director', 'Death'].map((k) => (
              <option key={k} value={k}>
                {t(k === 'All' ? 'story.all' : 'story.filter' + k)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('story.type')}
          <select aria-label={t('story.type')} value={type} onChange={change(setType)}>
            <option value="">{t('story.all')}</option>
            {[...new Set(events.map((e) => e.event))].map((k) => (
              <option key={k} value={k}>
                {t('type.' + k)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('story.agent')}
          <select aria-label={t('story.agent')} value={agent} onChange={change(setAgent)}>
            <option value="">{t('story.all')}</option>
            {data.agents.map((a) => (
              <option value={a.id} key={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('story.from')}
          <input
            aria-label={t('story.from')}
            type="number"
            min="0"
            value={from}
            onChange={change(setFrom)}
          />
        </label>
        <label>
          {t('story.to')}
          <input
            aria-label={t('story.to')}
            type="number"
            min="0"
            value={to}
            onChange={change(setTo)}
          />
        </label>
      </div>
      {filtered.slice((current - 1) * 25, current * 25).map((e) => (
        <EventRow data={data} event={e} key={e.id} />
      ))}
      {!filtered.length ? <p className="muted">{t('story.none')}</p> : null}
      <div className="story-pagination">
        <button disabled={current === 1} onClick={() => setPage(current - 1)}>
          {t('story.previous')}
        </button>
        <span>{t('story.page', { page: current, pages, count: filtered.length })}</span>
        <button disabled={current === pages} onClick={() => setPage(current + 1)}>
          {t('story.next')}
        </button>
      </div>
    </div>
  );
}
function LifeStory({ data, id, onClose }) {
  const { t, text, event: localizeEvent } = useLocale(),
    { locale } = useLocale();
  const a = data.agents.find((a) => a.id === id),
    f = data.story.agents.find((f) => f.id === id);
  const names = (ids) =>
    ids.length
      ? ids.map((id) => data.agents.find((a) => a.id === id)?.name).join(' / ')
      : t('story.none');
  return (
    <Modal title={t('story.life') + ' · ' + a.name} onClose={onClose} wide>
      <div className="life-story">
        <div className="life-identity">
          <RobotPortrait agent={a} size={96} />
          <div>
            <h2>{a.name.toUpperCase()}</h2>
            <Fate data={data} agent={a} />
            <p>{t('story.survival', { time: time(f.survival) })}</p>
          </div>
        </div>
        <p className="life-biography">{biography(data, id, locale)}</p>
        <Stats stats={a.stats} />
        {(f.places ?? []).length > 0 ? (
          <>
            <h3>{t('world.places')}</h3>
            {f.places.slice(0, 5).map((p) => (
              <p key={p.id}>
                {t('world.' + p.id.replace('poi_', ''))} ·{' '}
                {t('world.placeDetail', {
                  visits: p.visits,
                  seconds: Math.round(p.controlSeconds),
                })}
              </p>
            ))}
            {f.finalPlace ? (
              <p>
                {t('world.deathPlace')} · {t('world.' + f.finalPlace.replace('poi_', ''))}
              </p>
            ) : null}
          </>
        ) : null}
        <h3>{t('inspector.personality')}</h3>
        <div className="life-traits">
          {Object.entries(a.personality).map(([key, value]) => (
            <div key={key}>
              <span>{t('trait.' + key)}</span>
              <b>{Math.round(value * 100)}%</b>
              <meter min="0" max="1" value={value} />
            </div>
          ))}
        </div>
        <div className="life-relations">
          {[
            ['closest', 'story.closest'],
            ['rival', 'story.rival'],
            ['trusted', 'story.trusted'],
            ['feared', 'story.feared'],
          ].map(([key, label]) => (
            <div key={key}>
              <small>{t(label)}</small>
              <strong>{names(f[key])}</strong>
            </div>
          ))}
        </div>
        <h3>{t('story.memories')}</h3>
        {f.memoryIds.map((id) => {
          const e = data.events.find((e) => e.id === id);
          return <EventRow data={data} event={e} key={id} />;
        })}
        {a.memory
          .filter((m) => !data.events.some((e) => e.result === m.what))
          .sort((a, b) => b.importance - a.importance)
          .slice(0, 3)
          .map((m, i) => (
            <p key={i}>
              {time(m.when)} · {text(m.what)}
            </p>
          ))}
      </div>
    </Modal>
  );
}
function SocialHistory({ data, onAgent, onPair }) {
  const { t } = useLocale();
  const points = data.agents.map((a, i) => ({
    ...a,
    x: 350 + Math.cos((i / data.agents.length) * Math.PI * 2 - Math.PI / 2) * 270,
    y: 215 + Math.sin((i / data.agents.length) * Math.PI * 2 - Math.PI / 2) * 160,
  }));
  const edges = [];
  for (const a of points)
    for (const b of points) {
      if (a.id >= b.id) continue;
      const r = a.relationships[b.id],
        rev = b.relationships[a.id];
      if (!r && !rev) continue;
      const ally = r?.alliance || rev?.alliance,
        hostile = Math.max(r?.hostility ?? 0, rev?.hostility ?? 0) > 0.4,
        friend = ((r?.trust ?? 0) + (rev?.trust ?? 0)) / 2 > 0.3;
      edges.push(
        <g
          key={a.id + b.id}
          role="button"
          tabIndex="0"
          aria-label={a.name + ' ↔ ' + b.name}
          className="story-edge"
          onClick={() => onPair([a.id, b.id])}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onPair([a.id, b.id]);
          }}
        >
          <title>{a.name + ' ↔ ' + b.name}</title>
          <line
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={ally ? '#86c6ef' : hostile ? '#ec827e' : friend ? '#8ee6c0' : '#34505d'}
            strokeOpacity={ally || hostile || friend ? 0.65 : 0.25}
            strokeWidth={ally ? 2.5 : 1}
          />
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth="12" />
        </g>,
      );
    }
  return (
    <>
      <p className="muted">{t('story.finalNetworkNote')}</p>
      <div className="story-graph-legend">
        {['Friend', 'Ally', 'Hostile'].map((k) => (
          <span key={k}>{t('relation.legend' + k)}</span>
        ))}
      </div>
      <svg
        className="story-network"
        viewBox="0 0 700 430"
        role="group"
        aria-label={t('story.network')}
      >
        {edges}
        {points.map((a) => (
          <g
            key={a.id}
            role="button"
            tabIndex="0"
            aria-label={a.name}
            onClick={() => onAgent(a.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onAgent(a.id);
            }}
          >
            <circle cx={a.x} cy={a.y} r="9" fill={a.color} />
            <text
              x={a.x}
              y={a.y + (a.y > 215 ? 25 : -20)}
              textAnchor="middle"
              fill="#c6d8df"
              fontSize="13"
            >
              {a.name.toUpperCase()}
            </text>
          </g>
        ))}
      </svg>
      <p className="muted">{t('story.influence')}</p>
      <div className="story-changes">
        {data.story.relationshipChanges.map((id) => {
          const e = data.events.find((e) => e.id === id),
            r = e.relationship_change;
          return (
            <button key={id} onClick={() => onPair([e.actor, e.target])}>
              <span>
                {time(e.timestamp)} · {e.actorName} ↔ {e.targetName}
              </span>
              <strong>{t('type.' + e.event)}</strong>
              {typeof r.trust === 'number' || typeof r.hostility === 'number' ? (
                <small>
                  {t('story.delta', {
                    trust: r.trust?.toFixed(2) ?? '—',
                    hostility: r.hostility?.toFixed(2) ?? '—',
                  })}
                </small>
              ) : null}
            </button>
          );
        })}
      </div>
    </>
  );
}
export default function StoryPage({ id }) {
  const { t, locale, setLanguage, history: localizeHistory } = useLocale();
  const [data, setData] = useState(null),
    [failed, setFailed] = useState(false),
    [agent, setAgent] = useState(null),
    [pair, setPair] = useState(null),
    [full, setFull] = useState(false),
    [card, setCard] = useState(false),
    [shareNote, setShareNote] = useState('');
  useEffect(() => {
    let disposed = false;
    request('/api/stories/' + encodeURIComponent(id))
      .then((d) => {
        if (!disposed) setData(d);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
    };
  }, [id]);
  useEffect(() => {
    document.title = data ? `AI Survival Society — ${data.simulation_id}` : 'AI Survival Society';
  }, [data]);
  const svg = useMemo(() => (data ? shareCardSVG(data, locale) : ''), [data, locale]);
  const cardUrl = useMemo(
    () => (svg ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) : ''),
    [svg],
  );
  async function downloadCard() {
    try {
      const image = new Image();
      image.src = cardUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 630;
      canvas.getContext('2d').drawImage(image, 0, 0);
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      const url = URL.createObjectURL(blob),
        link = document.createElement('a');
      link.href = url;
      link.download = `simulation-${data.simulation_id}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setShareNote('story.shareError');
    }
  }
  async function share(native = false) {
    try {
      if (native && navigator.share) {
        await navigator.share({ title: 'AI Survival Society', url: data.share.url });
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(data.share.url);
      } else {
        const el = document.createElement('textarea');
        el.value = data.share.url;
        document.body.append(el);
        el.select();
        if (!document.execCommand('copy')) throw new Error();
        el.remove();
      }
      setShareNote('story.copied');
    } catch (e) {
      if (e.name !== 'AbortError') setShareNote('story.shareError');
    }
  }
  const header = (
    <header className="story-header">
      <a href="/">
        <ArrowLeft size={16} />
        {t('story.back')}
      </a>
      <span>AI SURVIVAL SOCIETY</span>
      <select
        aria-label={t('settings.language')}
        data-testid="story-language"
        value={locale}
        onChange={(e) => setLanguage(e.target.value)}
      >
        <option value="zh-TW">繁體中文</option>
        <option value="en">English</option>
      </select>
    </header>
  );
  if (!data)
    return (
      <div className="story-page">
        {header}
        <main className="story-empty">
          <h1>{t(failed ? 'story.unavailable' : 'story.loading')}</h1>
          {failed ? <p>{t('story.error')}</p> : null}
        </main>
      </div>
    );
  const winner = data.agents.find((a) => a.id === data.winner),
    history = localizeHistory(data);
  return (
    <div className="story-page">
      {header}
      <main className="story-content">
        <section className={`story-hero ${winner ? '' : 'extinction'}`}>
          <div className="story-hero-copy">
            <p className="story-eyebrow">
              {t('story.title')} · {data.simulation_id}
            </p>
            <div className="story-outcome">
              {winner ? <Trophy size={18} /> : <Skull size={18} />}{' '}
              {t(winner ? 'result.winner' : 'result.extinction')}
            </div>
            <h1>{winner ? winner.name.toUpperCase() : t('result.claimed')}</h1>
            <p className="story-deck">
              {t('story.entered', { count: data.agents.length, alive: winner ? 1 : 0 })}
            </p>
            <div className="story-meta">
              <span>Seed {data.seed}</span>
              <span>{t('story.survival', { time: time(data.elapsed) })}</span>
              <time>
                {data.story.finishedAt
                  ? new Date(data.story.finishedAt).toLocaleString(locale)
                  : t('story.unknownDate')}
              </time>
            </div>
            <a className="button primary" href={replayLink(data)}>
              <Play size={15} />
              {t('story.replay')}
            </a>
          </div>
          <div className="story-hero-art">
            {winner ? (
              <RobotPortrait agent={winner} size={230} />
            ) : (
              <div className="extinction-symbol">◎</div>
            )}
            <span>{data.simulation_id}</span>
          </div>
          <Stats stats={data.stats} hero />
        </section>
        <section className="story-section" id="summary">
          <div className="story-section-heading">
            <span>01</span>
            <h2>{t('story.summary')}</h2>
          </div>
          <div className="story-phases">
            {summary(data, locale).map((p, i) => (
              <article key={p.key}>
                <small>
                  0{i + 1} / {t('story.' + p.key)}
                </small>
                <p>{p.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="story-section" id="moments">
          <div className="story-section-heading">
            <span>02</span>
            <h2>{t('story.moments')}</h2>
          </div>
          <div className="story-moments">
            {data.story.majorMoments.map((m) => (
              <EventRow
                key={m.eventId}
                data={data}
                event={data.events.find((e) => e.id === m.eventId)}
                first={m.first}
                major
              />
            ))}
          </div>
        </section>
        {data.world ? (
          <section className="story-section" id="world-moments">
            <div className="story-section-heading">
              <span>◎</span>
              <h2>{t('world.moments')}</h2>
            </div>
              <div className="story-world-moments">
              {data.events
                .filter((e) =>
                  [
                    'POI_CONTROLLED',
                    'POI_CONTESTED',
                    'GENERATOR_REPAIRED',
                    'FIRE_STARTED',
                    'BRIDGE_BLOCKED',
                    'WEATHER_CHANGED',
                  ].includes(e.event),
                )
                .slice(0, 12)
                .map((e) => (
                  <EventRow key={e.id} data={data} event={e} major />
                ))}
            </div>
          </section>
        ) : null}
        <section className="story-section" id="final-three">
          <div className="story-section-heading">
            <span>03</span>
            <h2>{t(winner ? 'story.finalThree' : 'story.lastToFall')}</h2>
          </div>
          <div className="story-finalists">
            {data.story.finalThree.map((id, i) => {
              const a = data.agents.find((a) => a.id === id),
                f = data.story.agents.find((a) => a.id === id),
                ties = data.story.agents
                  .filter(
                    (b) =>
                      b.id !== id &&
                      b.id !== data.winner &&
                      id !== data.winner &&
                      b.survival === f.survival,
                  )
                  .map((b) => data.agents.find((a) => a.id === b.id).name);
              return (
                <article key={id}>
                  <span className="final-rank">0{i + 1}</span>
                  <button onClick={() => setAgent(id)}>
                    <RobotPortrait agent={a} size={90} />
                    <h3>{a.name.toUpperCase()}</h3>
                  </button>
                  <Fate data={data} agent={a} />
                  <p>{biography(data, id, locale)}</p>
                  {ties.length ? (
                    <small>{t('story.tie', { names: ties.join(' / ') })}</small>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
        <section className="story-section" id="cast">
          <div className="story-section-heading">
            <span>04</span>
            <h2>{t('story.cast')}</h2>
          </div>
          <div className="story-cast">
            {data.agents.map((a) => {
              const f = data.story.agents.find((f) => f.id === a.id);
              return (
                <button
                  key={a.id}
                  className="cast-card"
                  data-agent-id={a.id}
                  onClick={() => setAgent(a.id)}
                >
                  <div>
                    <RobotPortrait agent={a} size={62} />
                    <span>
                      <h3>{a.name.toUpperCase()}</h3>
                      <small>{f.traits.map((k) => t('trait.' + k)).join(' / ')}</small>
                    </span>
                    <ArrowUpRight size={16} />
                  </div>
                  <Fate data={data} agent={a} />
                  <p>{t('story.survival', { time: time(f.survival) })}</p>
                  <Stats stats={a.stats} />
                </button>
              );
            })}
          </div>
          <div className="story-awards">
            {data.story.awards.map((a) => (
              <article key={a.key} title={t('formula.' + a.key)}>
                <small>{t('award.' + a.key)}</small>
                <strong>
                  {a.ids.map((id) => data.agents.find((a) => a.id === id)?.name).join(' / ') || '—'}
                </strong>
                <p>{t('formula.' + a.key)}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="story-section" id="social">
          <div className="story-section-heading">
            <span>05</span>
            <h2>{t('story.social')}</h2>
          </div>
          <h3>{t('story.network')}</h3>
          <SocialHistory data={data} onAgent={setAgent} onPair={setPair} />
        </section>
        <section className="story-section" id="timeline">
          <div className="story-section-heading">
            <span>06</span>
            <h2>{t('story.timeline')}</h2>
          </div>
          <button onClick={() => setFull(!full)} aria-expanded={full}>
            {t(full ? 'story.collapse' : 'story.expand')}
          </button>
          {full ? <Timeline data={data} /> : null}
        </section>
        <section className="story-section" id="historian">
          <div className="story-section-heading">
            <span>07</span>
            <h2>{t('story.historian')}</h2>
          </div>
          <div className="story-historian">
            {data.history?.narration ? (
              <p>{data.history.narration}</p>
            ) : (
              history?.chapters.map((c) => (
                <article key={c.title}>
                  <h3>{c.title}</h3>
                  <p>{c.text}</p>
                </article>
              ))
            )}
          </div>
        </section>
        <section className="story-section story-share" id="share">
          <div className="story-section-heading">
            <span>08</span>
            <h2>{t('story.share')}</h2>
          </div>
          <p className="muted">{t(data.share.local ? 'story.local' : 'story.public')}</p>
          <input
            aria-label={t('story.copy')}
            value={data.share.url}
            readOnly
            onFocus={(e) => e.target.select()}
          />
          <div className="story-share-actions">
            <button onClick={() => share()}>
              <Share2 size={15} />
              {t('story.copy')}
            </button>
            <button onClick={() => share(true)}>{t('story.native')}</button>
            <button onClick={() => setCard(true)}>{t('story.card')}</button>
            <a
              className="button"
              href={`/api/stories/${data.simulation_id}/export?format=markdown&lang=${locale}`}
              download
            >
              <Download size={15} />
              {t('story.markdown')}
            </a>
            <a className="button" href={`/api/stories/${data.simulation_id}/export`} download>
              {t('story.json')}
            </a>
          </div>
          {shareNote ? <p role="status">{t(shareNote)}</p> : null}
        </section>
      </main>
      <footer className="story-footer">AI SURVIVAL SOCIETY · {data.simulation_id}</footer>
      {agent ? <LifeStory data={data} id={agent} onClose={() => setAgent(null)} /> : null}
      {pair ? (
        <Modal
          title={pair.map((id) => data.agents.find((a) => a.id === id)?.name).join(' ↔ ')}
          onClose={() => setPair(null)}
          wide
        >
          <h3>{t('story.finalValues')}</h3>
          <div className="life-relations">
            {pair.map((id, i) => {
              const a = data.agents.find((a) => a.id === id),
                b = data.agents.find((a) => a.id === pair[1 - i]),
                r = a.relationships[b.id];
              return (
                <article key={id}>
                  <strong>
                    {a.name} → {b.name}
                  </strong>
                  {r ? (
                    <p>
                      {t('stats.trust')} {Math.round(r.trust * 100)} · {t('story.fearValue')}{' '}
                      {Math.round(r.fear * 100)} · {t('story.hostilityValue')}{' '}
                      {Math.round(r.hostility * 100)}
                      {r.alliance ? ' · ' + t('relation.ally') : ''}
                    </p>
                  ) : (
                    <p>{t('story.none')}</p>
                  )}
                </article>
              );
            })}
          </div>
          <h3>{t('story.pair')}</h3>
          <Timeline
            data={data}
            events={data.events.filter((e) => pair.includes(e.actor) && pair.includes(e.target))}
          />
        </Modal>
      ) : null}
      {card ? (
        <Modal title={t('story.card')} onClose={() => setCard(false)} wide>
          <img className="story-card-preview" src={cardUrl} alt={t('story.card')} />
          <button className="primary" onClick={downloadCard}>
            {t('story.png')}
          </button>
        </Modal>
      ) : null}
    </div>
  );
}
