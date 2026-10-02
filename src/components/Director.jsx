import { useLocale } from '../i18n/LocaleProvider.jsx';
import { Leaf, Package, CloudRain, MessageCircle, Gem, Biohazard } from 'lucide-react';
export const EVENTS = [
  ['food_crisis', 'director.food_crisis.name', 'director.food_crisis.description', Leaf],
  ['supply_drop', 'director.supply_drop.name', 'director.supply_drop.description', Package],
  ['storm', 'director.storm.name', 'director.storm.description', CloudRain],
  ['rumor', 'director.rumor.name', 'director.rumor.description', MessageCircle],
  ['treasure', 'director.treasure.name', 'director.treasure.description', Gem],
  ['plague', 'director.plague.name', 'director.plague.description', Biohazard],
];
export default function Director({ state, onEvent, expanded = false }) {
  const { t } = useLocale();
  return (
    <section
      className={`director-panel ${expanded ? 'expanded' : ''}`}
      aria-label={t('director.label')}
    >
      <div className="panel-title">
        <span>{t('director.title')}</span>
        <span className="muted">{t('director.tagline')}</span>
      </div>
      <div className="director-actions">
        {EVENTS.map(([id, name, description, Icon]) => (
          <button
            key={id}
            data-testid={`director-${id}`}
            className={state.effects[id] > state.elapsed ? 'event-active' : ''}
            disabled={state.status === 'finished'}
            onClick={() => onEvent(id)}
          >
            <Icon size={24} strokeWidth={1.6} />
            <strong>{t(name)}</strong>
            <small>{t(description)}</small>
            {state.effects[id] > state.elapsed ? (
              <span>{Math.ceil(state.effects[id] - state.elapsed)}s</span>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}
