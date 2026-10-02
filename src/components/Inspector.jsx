import { useLocale } from '../i18n/LocaleProvider.jsx';
import { Heart, Zap, Utensils, Shield, Brain, ChevronDown, Crosshair } from 'lucide-react';
import { formatTime } from '../api.mjs';
const TRAITS = [
  'aggression',
  'greed',
  'loyalty',
  'empathy',
  'riskTolerance',
  'sociability',
  'deception',
  'curiosity',
];
export function RobotPortrait({ agent, size = 72 }) {
  const { t } = useLocale();
  return (
    <svg
      className="robot-portrait"
      width={size}
      height={size}
      viewBox="0 0 80 80"
      aria-label={t('inspector.portrait', {
        name: agent.name,
      })}
      style={{
        color: agent.color,
      }}
    >
      <circle cx="40" cy="40" r="38" fill="#14232b" stroke="currentColor" strokeWidth=".7" />
      <path d="M18 77Q20 56 40 55Q60 56 62 77" fill="#c5d6d7" />
      <path d="M30 76V60H50V76" fill="currentColor" />
      <circle cx="40" cy="68" r="4" fill="#95efe6" />
      <rect
        x="16"
        y="17"
        width="48"
        height="36"
        rx={agent.index % 3 === 0 ? 8 : 14}
        fill="#d9e4e4"
      />
      <rect x="20" y="23" width="40" height="23" rx="9" fill="#08141d" />
      <ellipse cx="31" cy="34" rx="4" ry="6" fill="#88eaf0" />
      <ellipse cx="49" cy="34" rx="4" ry="6" fill="#88eaf0" />
      <path
        d={
          agent.index % 4 === 0
            ? 'M40 17V8'
            : agent.index % 4 === 1
              ? 'M15 25V15M65 25V15'
              : 'M30 17V13H50V17'
        }
        stroke="currentColor"
        strokeWidth="4"
      />
      <circle cx="40" cy="8" r={agent.index % 4 === 0 ? 3 : 0} fill="currentColor" />
    </svg>
  );
}
function Meter({ label, value, color, icon: Icon }) {
  return (
    <div className="meter-row">
      <span>
        <Icon size={12} />
        {label}
      </span>
      <div className="meter-track">
        <i
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            background: color,
          }}
        />
      </div>
      <b>
        {Math.round(value)}
        <small>%</small>
      </b>
    </div>
  );
}
export default function Inspector({ state, selected, onSelect }) {
  const { t, text } = useLocale();
  const a = state.agents.find((a) => a.id === selected) ?? state.agents[0];
  const relationships = Object.entries(a.relationships)
    .map(([id, r]) => ({
      ...r,
      agent: state.agents.find((a) => a.id === id),
    }))
    .filter((r) => r.agent)
    .sort((x, y) => (y.alliance ? 2 : 0) + y.trust - (x.alliance ? 2 : 0) - x.trust);
  const memories = [...a.memory]
    .sort((x, y) => y.importance - x.importance || y.when - x.when)
    .slice(0, 5);
  return (
    <aside className="inspector" aria-label={t('inspector.label')}>
      <div className="panel-title">
        <span>{t('inspector.title')}</span>
        <span className="muted">#{String(a.index + 1).padStart(2, '0')}</span>
      </div>
      <div className="agent-identity">
        <RobotPortrait agent={a} />
        <div>
          <select
            aria-label={t('inspector.selected')}
            value={a.id}
            onChange={(e) => onSelect(e.target.value)}
          >
            {state.agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name.toUpperCase()}
              </option>
            ))}
          </select>
          <p>
            {a.personality.empathy > 0.6
              ? t('inspector.empathic')
              : a.personality.aggression > 0.65
                ? t('inspector.volatile')
                : t('inspector.adaptive')}{' '}
            · {a.personality.curiosity > 0.5 ? t('inspector.curious') : t('inspector.pragmatic')}
          </p>
          <span className={a.alive ? 'alive-state' : 'dead-state'}>
            <i />
            {a.alive
              ? a.infected
                ? t('inspector.infected')
                : t('inspector.active')
              : t('inspector.eliminated')}
          </span>
        </div>
      </div>
      <div className="vitals">
        <Meter label={t('inspector.health')} value={a.hp} color="#89dfba" icon={Heart} />
        <Meter label={t('inspector.energy')} value={a.energy} color="#e4b77e" icon={Zap} />
        <Meter label={t('inspector.hunger')} value={a.hunger} color="#e7857e" icon={Utensils} />
      </div>
      <div className="inventory">
        <span>
          <Utensils size={12} /> {a.inventory.food}
          {t('resource.food')}
        </span>
        <span>
          <Heart size={12} /> {a.inventory.medicine}
          {t('resource.med')}
        </span>
        <span>
          ◇ {a.inventory.relic}
          {t('resource.relic')}
        </span>
      </div>
      <div className="weapon">
        <Shield size={13} />
        <span>{text(a.weapon)}</span>
        <span className="muted">
          {t('stats.allies', {
            count: a.alliance.length,
          })}
        </span>
      </div>
      <section className="inspector-section decision">
        <div className="panel-title">
          <span>{t('inspector.decision')}</span>
          <span className="source">{a.decisionSource === 'llm' ? 'LLM' : 'Utility AI'}</span>
        </div>
        <strong>
          <span className="decision-dot">↗</span>
          {text(a.goal)}
        </strong>
        <p>{a.decisionSource === 'llm' ? a.public_reason : text(a.public_reason)}</p>
        <dl>
          <dt>{t('inspector.observed')}</dt>
          <dd>{text(a.observed)}</dd>
          <dt>{t('inspector.action')}</dt>
          <dd>
            {t('action.' + a.action)}
            {a.target
              ? ` → ${
                  state.agents.find((b) => b.id === a.target)?.name ??
                  t('inspector.supply', {
                    id: a.target.replace('Resource_', ''),
                  })
                }`
              : ''}
          </dd>
        </dl>
        <details>
          <summary>{t('inspector.utility')}</summary>
          {a.utility.map((u, i) => (
            <div className="utility-line" key={i}>
              <span>{t('action.' + u.action)}</span>
              <span>{u.score.toFixed(2)}</span>
            </div>
          ))}
        </details>
      </section>
      <section className="inspector-section">
        <div className="panel-title">{t('inspector.personality')}</div>
        <div className="trait-grid">
          {TRAITS.map((key) => (
            <div className="trait" key={key}>
              <span>{t('trait.' + key)}</span>
              <div>
                <i
                  style={{
                    width: `${a.personality[key] * 100}%`,
                    background: a.color,
                  }}
                />
              </div>
              <b>{Math.round(a.personality[key] * 100)}</b>
            </div>
          ))}
        </div>
      </section>
      <section className="inspector-section">
        <div className="panel-title">
          <span>{t('inspector.relationships')}</span>
          <span className="muted">{t('inspector.trust')}</span>
        </div>
        <div className="relationship-list">
          {relationships.length ? (
            relationships.slice(0, 4).map((r) => (
              <button key={r.agent.id} onClick={() => onSelect(r.agent.id)}>
                <i
                  style={{
                    background: r.agent.color,
                  }}
                />
                <span>{r.agent.name}</span>
                <small className={r.alliance ? 'blue' : r.hostility > 0.4 ? 'coral' : 'mint'}>
                  {r.alliance
                    ? t('relation.ally')
                    : r.hostility > 0.4
                      ? t('relation.hostile')
                      : r.trust > 0.3
                        ? t('relation.friend')
                        : t('relation.neutral')}
                </small>
                <b>{Math.round(r.trust * 100)}%</b>
              </button>
            ))
          ) : (
            <p className="muted">{t('relation.empty')}</p>
          )}
        </div>
      </section>
      <section className="inspector-section memories">
        <div className="panel-title">{t('inspector.memories')}</div>
        {memories.length ? (
          memories.map((m, i) => (
            <div className="memory" key={`${m.when}-${i}`}>
              <i className={m.emotionalImpact < 0 ? 'negative' : ''} />
              <p>{text(m.what)}</p>
              <time>{formatTime(m.when)}</time>
            </div>
          ))
        ) : (
          <p className="muted">{t('memory.empty')}</p>
        )}
      </section>
    </aside>
  );
}
