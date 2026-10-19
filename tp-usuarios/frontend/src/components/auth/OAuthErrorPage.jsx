import { useEffect, useState } from 'react';
import { parseOAuthError } from './oauthError';
import './OAuthErrorPage.css';

export default function OAuthErrorPage() {
  const [error] = useState(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1)).get('oauth_diagnostic');
    let stored;
    try { stored = sessionStorage.getItem('r6_oauth_last_error'); } catch { /* Sin storage */ }
    return parseOAuthError(fragment || stored, import.meta.env.DEV);
  });
  useEffect(() => {
    // Quitar el diagnostico de la barra de direcciones; permitir recargar esta pagina.
    window.history.replaceState(null, '', window.location.pathname);
    try {
      sessionStorage.setItem('r6_oauth_last_error', JSON.stringify(error));
      sessionStorage.removeItem('r6_oauth_verifier');
      sessionStorage.removeItem('r6_oauth_provider');
    } catch { /* No impedir la recuperacion si sessionStorage esta bloqueado. */ }
  }, [error]);

  return <main className="oauth-error-page">
    <section className="oauth-error-card" aria-labelledby="oauth-error-title">
      <p className="oauth-error-eyebrow">Acceso a tu cuenta</p>
      <h1 id="oauth-error-title">No pudimos completar el acceso</h1>
      <p role="alert">{error.message}</p>
      <p>{error.hint}</p>
      {/* React escapa texto/JSON; nunca renderizar HTML recibido del proveedor. */}
      {import.meta.env.DEV && <details>
        <summary>Detalles técnicos</summary>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </details>}
      <a href="/login" className="oauth-error-retry" onClick={() => {
        try { sessionStorage.removeItem('r6_oauth_last_error'); } catch { /* Sin storage */ }
      }}>Volver a iniciar sesión</a>
    </section>
  </main>;
}
