import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { lazy, Suspense } from 'react';
const StoryPage = lazy(() => import('./story/StoryPage.jsx'));
function Route() {
  const { t } = useLocale();
  const match = location.pathname.match(/^\/(story|replay)\/([^/]+)$/);
  return match?.[1] === 'story' ? (
    <Suspense fallback={<div className="startup">{t('story.loading')}</div>}>
      <StoryPage id={decodeURIComponent(match[2])} />
    </Suspense>
  ) : (
    <App
      initialReplayId={match?.[1] === 'replay' ? decodeURIComponent(match[2]) : null}
      initialReplayTime={Number(new URLSearchParams(location.search).get('t')) || 0}
    />
  );
}
import './style.css';
import { LocaleProvider, useLocale } from './i18n/LocaleProvider.jsx';
function ErrorFallback({ error }) {
  const { t, error: localizeError } = useLocale();
  return (
    <div className="startup">
      <h1>{t('connection.interrupted')}</h1>
      <p>{localizeError(error.message)}</p>
      <button onClick={() => location.reload()}>{t('connection.reconnect')}</button>
    </div>
  );
}
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    return this.state.error ? <ErrorFallback error={this.state.error} /> : this.props.children;
  }
}
createRoot(document.getElementById('root')).render(
  <LocaleProvider>
    <ErrorBoundary>
      <Route />
    </ErrorBoundary>
  </LocaleProvider>,
);
