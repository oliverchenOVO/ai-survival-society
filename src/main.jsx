import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
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
      <App />
    </ErrorBoundary>
  </LocaleProvider>,
);
