import { Component, PropsWithChildren, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class AppErrorBoundary extends Component<PropsWithChildren, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ maxWidth: 720, margin: '12vh auto', padding: 32, fontFamily: 'Arial, sans-serif', color: '#0f3a5b' }}>
          <h1>HESA</h1>
          <h2>La plateforme n&apos;a pas pu se charger</h2>
          <p>Rechargez la page. Si le probleme persiste, effacez les donnees du site hesahvac.com puis reconnectez-vous.</p>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#991b1b' }}>{this.state.error.message}</pre>
        </main>
      )
    }

    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
