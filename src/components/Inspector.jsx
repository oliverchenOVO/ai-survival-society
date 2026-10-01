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
  return (
    <svg
      className="robot-portrait"
      width={size}
      height={size}
      viewBox="0 0 80 80"
      aria-label={`${agent.name} robot portrait`}
      style={{ color: agent.color }}
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
        <i style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
      </div>
      <b>
        {Math.round(value)}
        <small>%</small>
      </b>
    </div>
  );
}
export default function Inspector({ state, selected, onSelect }) {
  const a = state.agents.find((a) => a.id === selected) ?? state.agents[0];
  const relationships = Object.entries(a.relationships)
    .map(([id, r]) => ({ ...r, agent: state.agents.find((a) => a.id === id) }))
    .filter((r) => r.agent)
    .sort((x, y) => (y.alliance ? 2 : 0) + y.trust - (x.alliance ? 2 : 0) - x.trust);
  const memories = [...a.memory]
    .sort((x, y) => y.importance - x.importance || y.when - x.when)
    .slice(0, 5);
  return (
    <aside className="inspector" aria-label="Agent inspector">
      <div className="panel-title">
        <span>AGENT INSPECTOR</span>
        <span className="muted">#{String(a.index + 1).padStart(2, '0')}</span>
      </div>
      <div className="agent-identity">
        <RobotPortrait agent={a} />
        <div>
          <select
            aria-label="Selected agent"
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
              ? 'Empathic'
              : a.personality.aggression > 0.65
                ? 'Volatile'
                : 'Adaptive'}{' '}
            · {a.personality.curiosity > 0.5 ? 'Curious' : 'Pragmatic'}
          </p>
          <span className={a.alive ? 'alive-state' : 'dead-state'}>
            <i />
            {a.alive ? (a.infected ? 'Infected' : 'Active') : 'Eliminated'}
          </span>
        </div>
      </div>
      <div className="vitals">
        <Meter label="Health" value={a.hp} color="#89dfba" icon={Heart} />
        <Meter label="Energy" value={a.energy} color="#e4b77e" icon={Zap} />
        <Meter label="Hunger" value={a.hunger} color="#e7857e" icon={Utensils} />
      </div>
      <div className="inventory">
        <span>
          <Utensils size={12} /> {a.inventory.food} food
        </span>
        <span>
          <Heart size={12} /> {a.inventory.medicine} med
        </span>
        <span>◇ {a.inventory.relic} relic</span>
      </div>
      <div className="weapon">
        <Shield size={13} />
        <span>{a.weapon}</span>
        <span className="muted">{a.alliance.length} allies</span>
      </div>
      <section className="inspector-section decision">
        <div className="panel-title">
          <span>CURRENT DECISION</span>
          <span className="source">{a.decisionSource.toUpperCase()}</span>
        </div>
        <strong>
          <span className="decision-dot">↗</span>
          {a.goal}
        </strong>
        <p>{a.public_reason}</p>
        <dl>
          <dt>Observed</dt>
          <dd>{a.observed}</dd>
          <dt>Action</dt>
          <dd>
            {a.action}
            {a.target
              ? ` → ${state.agents.find((b) => b.id === a.target)?.name ?? a.target.replace('Resource_', 'Supply #')}`
              : ''}
          </dd>
        </dl>
        <details>
          <summary>Utility scores</summary>
          {a.utility.map((u, i) => (
            <div className="utility-line" key={i}>
              <span>{u.action}</span>
              <span>{u.score.toFixed(2)}</span>
            </div>
          ))}
        </details>
      </section>
      <section className="inspector-section">
        <div className="panel-title">PERSONALITY</div>
        <div className="trait-grid">
          {TRAITS.map((key) => (
            <div className="trait" key={key}>
              <span>
                {key === 'riskTolerance' ? 'Risk tolerance' : key[0].toUpperCase() + key.slice(1)}
              </span>
              <div>
                <i style={{ width: `${a.personality[key] * 100}%`, background: a.color }} />
              </div>
              <b>{Math.round(a.personality[key] * 100)}</b>
            </div>
          ))}
        </div>
      </section>
      <section className="inspector-section">
        <div className="panel-title">
          <span>RELATIONSHIPS</span>
          <span className="muted">TRUST</span>
        </div>
        <div className="relationship-list">
          {relationships.length ? (
            relationships.slice(0, 4).map((r) => (
              <button key={r.agent.id} onClick={() => onSelect(r.agent.id)}>
                <i style={{ background: r.agent.color }} />
                <span>{r.agent.name}</span>
                <small className={r.alliance ? 'blue' : r.hostility > 0.4 ? 'coral' : 'mint'}>
                  {r.alliance
                    ? 'ALLY'
                    : r.hostility > 0.4
                      ? 'HOSTILE'
                      : r.trust > 0.3
                        ? 'FRIEND'
                        : 'NEUTRAL'}
                </small>
                <b>{Math.round(r.trust * 100)}%</b>
              </button>
            ))
          ) : (
            <p className="muted">Every connection starts with an encounter.</p>
          )}
        </div>
      </section>
      <section className="inspector-section memories">
        <div className="panel-title">IMPORTANT MEMORIES</div>
        {memories.length ? (
          memories.map((m, i) => (
            <div className="memory" key={`${m.when}-${i}`}>
              <i className={m.emotionalImpact < 0 ? 'negative' : ''} />
              <p>{m.what}</p>
              <time>{formatTime(m.when)}</time>
            </div>
          ))
        ) : (
          <p className="muted">The island has not left its mark yet.</p>
        )}
      </section>
    </aside>
  );
}
