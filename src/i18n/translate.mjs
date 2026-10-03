import { catalogs as base, englishKeys as initialKeys } from './catalog.mjs';
import { generatedStatic, generatedTemplates, generatedRules } from './generated.mjs';
export const DEFAULT_LOCALE = 'zh-TW';
export const LOCALES = ['zh-TW', 'en'];
export const STORAGE_KEY = 'society.locale.v1';
export const catalogs = Object.fromEntries(
  ['en', 'zh-TW'].map((locale, i) => [
    locale,
    {
      ...base[locale],
      ...Object.fromEntries(generatedStatic.map(([key, en, zh]) => [key, i ? zh : en])),
      ...Object.fromEntries(
        Object.entries(generatedTemplates).map(([key, pair]) => [key, pair[i]]),
      ),
    },
  ]),
);
const englishKeys = {
  ...initialKeys,
  ...Object.fromEntries(generatedStatic.map(([key, en]) => [en, key])),
  'a future favor': 'payment.favor',
  ' and was caught': 'theft.caught',
  ' without being noticed': 'theft.hidden',
};
export function translate(key, locale = DEFAULT_LOCALE, params = {}) {
  const value = catalogs[locale]?.[key] ?? catalogs.en[key];
  if (value === undefined) throw new Error(`Missing localization key: ${key}`);
  return value.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
}
export function localizeText(text, locale = DEFAULT_LOCALE) {
  if (catalogs.en['world.event.' + text]) return translate('world.event.' + text, locale);
  if (text?.startsWith('world.') && catalogs.en[text]) return translate(text, locale);
  if (!text || locale === 'en') return text ?? '';
  if (englishKeys[text]) return translate(englishKeys[text], locale);
  for (const [pattern, key, names] of generatedRules) {
    const match = text.match(pattern);
    if (!match) continue;
    const params = Object.fromEntries(names.map((name, i) => [name, match[i + 1]]));
    for (const name of ['resource', 'payment', 'cause', 'detection', 'message'])
      if (params[name]) params[name] = localizeText(params[name], locale);
    return translate(key, locale, params).trim();
  }
  return text; // Unknown/free model prose is deliberately preserved.
}
export function localizeEvent(event, locale) {
  if (catalogs.en['world.event.' + event.event]) {
    const location = event.data?.poi?.replace(/^poi_/, '');
    const place =
      location && catalogs.en['world.' + location] ? translate('world.' + location, locale) : '';
    const actor = event.actor !== 'WORLD' ? event.actorName + ' · ' : '';
    const suffix = event.data?.weather
      ? ' · ' + translate('weather.' + event.data.weather, locale)
      : '';
    return (
      actor +
      translate('world.event.' + event.event, locale) +
      (place ? ' · ' + place : '') +
      suffix +
      (event.data?.message ? ' · ' + event.data.message : '')
    );
  }
  return localizeText(event.result, locale);
}
export function localizeHistory(state, locale) {
  const history = state.history;
  if (!history || locale === 'en') return history;
  const winner = state.agents.find((a) => a.id === state.winner);
  return {
    ...history,
    summary: winner
      ? translate('history.summary', locale, {
          name: winner.name,
          minutes: Math.floor(state.elapsed / 60),
          seconds: Math.floor(state.elapsed % 60),
          count: state.agents.length,
        })
      : translate('history.extinction', locale),
    chapters: history.chapters.map((chapter) => ({
      ...chapter,
      title: localizeText(chapter.title, locale),
      // Chapters concatenate independent events. Match each sentence separately so
      // greedy legacy name captures cannot swallow an earlier event into a name.
      text: englishKeys[chapter.text]
        ? localizeText(chapter.text, locale)
        : chapter.text
            .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
            .map((s) => localizeText(s, locale))
            .join(' '),
    })),
  };
}
export function localizeError(message, locale) {
  // Validation may already have produced a localized catalog message.
  if (Object.values(catalogs[locale] ?? catalogs.en).includes(message)) return message;
  const known = localizeText(message, locale);
  if (locale === 'en' || known !== message) return known;
  if (/fetch|network|Failed to fetch|ECONN|Load failed/i.test(message))
    return translate('error.network', locale);
  const status = message.match(/HTTP (\d+)/);
  if (status) return translate('error.http', locale, { status: status[1] });
  return translate('error.generic', locale);
}
