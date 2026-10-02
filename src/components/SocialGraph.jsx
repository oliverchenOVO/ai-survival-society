import { useLocale } from '../i18n/LocaleProvider.jsx';
import { memo } from 'react';
export default memo(function SocialGraph({ state, selected, onSelect, expanded = false }) {
  const { t } = useLocale();
  const points = state.agents.map((a, i) => ({
    ...a,
    cx: 155 + Math.cos((i / state.agents.length) * Math.PI * 2 - Math.PI / 2) * 112,
    cy: 95 + Math.sin((i / state.agents.length) * Math.PI * 2 - Math.PI / 2) * 66,
  }));
  const edges = [];
  for (const a of points)
    for (const b of points) {
      if (a.id >= b.id) continue;
      const r = a.relationships[b.id],
        rev = b.relationships[a.id];
      if (!r && !rev) continue;
      const alliance = r?.alliance || rev?.alliance,
        hostility = Math.max(r?.hostility ?? 0, rev?.hostility ?? 0),
        trust = ((r?.trust ?? 0.15) + (rev?.trust ?? 0.15)) / 2;
      const color = alliance
        ? '#80bfea'
        : hostility > 0.4
          ? '#ee827e'
          : trust > 0.3
            ? '#88e5be'
            : '#263e4b';
      edges.push(
        <line
          key={`${a.id}-${b.id}`}
          x1={a.cx}
          y1={a.cy}
          x2={b.cx}
          y2={b.cy}
          stroke={color}
          strokeOpacity={alliance ? 0.85 : hostility > 0.4 ? 0.7 : trust > 0.3 ? 0.55 : 0.28}
          strokeWidth={alliance ? 1.5 : 0.8}
        />,
      );
    }
  return (
    <section className={`social-panel ${expanded ? 'expanded' : ''}`} aria-label={t('graph.label')}>
      <div className="panel-title">
        <span>{t('inspector.relationships')}</span>
        <div className="graph-legend">
          <span>
            <i className="mint-bg" />
            {t('relation.legendFriend')}
          </span>
          <span>
            <i className="blue-bg" />
            {t('relation.legendAlly')}
          </span>
          <span>
            <i className="coral-bg" />
            {t('relation.legendHostile')}
          </span>
        </div>
      </div>
      <svg viewBox="0 0 310 190" role="img" aria-label={t('graph.live')}>
        {edges}
        {points.map((a) => (
          <g
            key={a.id}
            className="graph-node"
            onClick={() => onSelect(a.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSelect(a.id);
            }}
            tabIndex="0"
            role="button"
            aria-label={t('inspector.inspect', {
              name: a.name,
            })}
            opacity={a.alive ? 1 : 0.3}
          >
            <circle
              cx={a.cx}
              cy={a.cy}
              r={a.id === selected ? 7 : 4.5}
              fill={a.color}
              stroke={a.id === selected ? '#e1fff1' : '#12222b'}
              strokeWidth="2"
            />
            <text
              x={a.cx}
              y={a.cy + (a.cy > 130 ? 16 : -11)}
              fill="#b6c8d0"
              fontSize="8"
              textAnchor="middle"
            >
              {a.name.toUpperCase()}
            </text>
          </g>
        ))}
      </svg>
    </section>
  );
});
