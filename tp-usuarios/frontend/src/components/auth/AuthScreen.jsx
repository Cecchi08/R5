import { useEffect, useRef, useState } from 'react';
import ProviderIcon from './ProviderIcon';
import './AuthScreen.css';

const providerList = [
  { id: 'google', name: 'Google' }, { id: 'facebook', name: 'Facebook / Meta' },
  { id: 'github', name: 'GitHub' }, { id: 'x', name: 'X' },
  { id: 'discord', name: 'Discord' }, { id: 'twitch', name: 'Twitch' },
];
const oauthErrors = {
  cancelled: 'Cancelaste el acceso. Podés elegir otra cuenta o volver a intentarlo.',
  invalid_state: 'La solicitud expiró o pertenece a otra sesión. Volvé a intentarlo desde este navegador.',
  account_exists: 'Este correo ya tiene una cuenta. Iniciá sesión con el método que usaste al registrarte.',
  provider_failed: 'No pudimos completar el acceso con ese proveedor. Volvé a intentarlo.',
  unavailable: 'Este proveedor todavía no está disponible. Podés ingresar con tu correo.',
};
const base64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const errorMessage = error => error.response?.data?.error || 'No pudimos conectarnos. Verificá tu conexión e intentá nuevamente.';

export function validateForm(form, register) {
  const errors = {};
  if (register && !/^[\p{L}][\p{L} '\u2019-]{1,49}$/u.test(form.nombre.trim())) errors.nombre = 'Ingresá tu nombre: entre 2 y 50 letras.';
  if (!form.email.trim() || form.email.trim().length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Ingresá un correo electrónico válido.';
  if (!form.password) errors.password = 'Ingresá tu contraseña.';
  else if (new TextEncoder().encode(form.password).length > 72) errors.password = 'La contraseña supera el máximo de 72 bytes.';
  else if (register && (form.password.length < 8 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[\s\S]+$/.test(form.password))) errors.password = 'Usá al menos 8 caracteres, una mayúscula, una minúscula y un número.';
  if (register && (!form.confirm || form.password !== form.confirm)) errors.confirm = 'Las contraseñas deben coincidir.';
  return errors;
}

function ThemeIcon({ dark }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">{dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : <path d="M20 14A8.5 8.5 0 0 1 10 4a8.5 8.5 0 1 0 10 10Z" />}</svg>;
}

export default function AuthScreen({ mode, api, onAuthenticated, onSwitch, dark, toggle }) {
  const register = mode === 'register';
  const [form, setForm] = useState({ nombre: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [providers, setProviders] = useState(null);
  const [providerError, setProviderError] = useState('');
  const [retry, setRetry] = useState(0);
  const callbackStarted = useRef(false);
  const firstInput = useRef(null);

  useEffect(() => {
    document.body.classList.add('auth-active');
    return () => document.body.classList.remove('auth-active');
  }, []);

  useEffect(() => {
    let active = true;
    setProviderError('');
    api.get('/auth/providers').then(({ data }) => {
      if (active) setProviders(data);
    }).catch(() => {
      if (active) setProviderError('No pudimos cargar los accesos sociales.');
    });
    return () => { active = false; };
  }, [api, retry]);

  useEffect(() => {
    if (callbackStarted.current) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const code = params.get('oauth_code'), reason = params.get('oauth_error');
    if (!code && !reason) return;
    callbackStarted.current = true;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (reason) {
      sessionStorage.removeItem('r6_oauth_verifier');
      setError(oauthErrors[reason] || oauthErrors.provider_failed);
      return;
    }
    const verifier = sessionStorage.getItem('r6_oauth_verifier');
    if (!verifier) { setError(oauthErrors.invalid_state); return; }
    setBusy(true);
    api.post('/auth/exchange', { code, verifier }).then(({ data }) => {
      sessionStorage.removeItem('r6_oauth_verifier');
      onAuthenticated(data.user, data.token);
    }).catch(error => {
      sessionStorage.removeItem('r6_oauth_verifier');
      setError(errorMessage(error));
    }).finally(() => setBusy(false));
  }, [api, onAuthenticated]);

  const change = event => {
    const { name, value } = event.target;
    setForm(previous => ({ ...previous, [name]: value }));
    setErrors(previous => ({ ...previous, [name]: '', ...(name === 'password' ? { confirm: '' } : {}) }));
    setError('');
  };

  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    setError('');
    const validation = validateForm(form, register);
    setErrors(validation);
    if (Object.keys(validation).length) {
      event.currentTarget.elements.namedItem(Object.keys(validation)[0])?.focus();
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post(`/auth/${mode}`, { nombre: form.nombre.trim(), email: form.email.trim().toLowerCase(), password: form.password });
      onAuthenticated(data.user, data.token);
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  };

  const social = async id => {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
      const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
      sessionStorage.setItem('r6_oauth_verifier', verifier);
      const url = new URL(`${api.defaults.baseURL.replace(/\/$/, '')}/auth/${id}/start`, window.location.origin);
      url.searchParams.set('return_to', `${window.location.origin}${window.location.pathname}`);
      url.searchParams.set('challenge', challenge);
      window.location.assign(url.toString());
    } catch {
      setError('No pudimos abrir el acceso social. Verificá que el navegador permita guardar la sesión y usá HTTPS o localhost.');
      setBusy(false);
    }
  };

  const field = (name, label, type, placeholder, autoComplete, maxLength) => <div className="access-field">
    <label htmlFor={`access-${name}`}>{label}</label>
    <div className="access-input-wrap">
      <input ref={name === (register ? 'nombre' : 'email') ? firstInput : undefined} id={`access-${name}`} name={name} type={type === 'password' && visible ? 'text' : type} placeholder={placeholder} autoComplete={autoComplete} value={form[name]} onChange={change} required maxLength={maxLength} minLength={name === 'nombre' ? 2 : (register && type === 'password' ? 8 : undefined)} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `error-${name}` : register && name === 'password' ? 'password-hint' : undefined} disabled={busy} />
      {name === 'password' && <button className="access-reveal" type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible}>{visible ? 'Ocultar' : 'Ver'}</button>}
    </div>
    {errors[name] && <span id={`error-${name}`} className="access-field-error">{errors[name]}</span>}
  </div>;

  return <div className="auth-shell">
    <header className="access-topbar">
      <span className="access-brand"><span className="access-brand-mark" aria-hidden="true">t<span>·</span></span> TechStore<span className="access-brand-divider">/</span><span className="access-brand-sub">tu cuenta</span></span>
      <button className="access-theme" type="button" onClick={toggle} aria-label={dark ? 'Activar modo día' : 'Activar modo noche'} title={dark ? 'Modo día' : 'Modo noche'}><ThemeIcon dark={dark} /><span>{dark ? 'Modo día' : 'Modo noche'}</span></button>
    </header>
    <main className={`access-grid ${register ? 'is-register' : ''}`}>
      <section className="access-story" aria-label="Tu espacio TechStore">
        <div className="access-intro access-tile">
          <span className="access-eyebrow"><span /> TODO EMPIEZA CON VOS</span>
          <h1>Tu mundo.<br />Tus cuentas.<br /><span>Un solo lugar.</span></h1>
          <p>Conectate a lo que te gusta.<br />Entrá con tu cuenta de siempre y hacelo simple.</p>
          <div className="access-orbit" aria-hidden="true">
            <div className="orbit-line orbit-outer" /><div className="orbit-line orbit-inner" />
            <div className="orbit-core"><svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="23" r="10" stroke="currentColor" strokeWidth="2.5" /><path d="M14 51c0-10 8-17 18-17s18 7 18 17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg><span className="orbit-check">✓</span></div>
            {['google', 'github', 'discord', 'facebook', 'x', 'twitch'].map((id, index) => <span key={id} className={`orbit-provider orbit-${index}`}><ProviderIcon id={id} /></span>)}
            <span className="orbit-caption">Siempre vos. Desde cualquier cuenta.</span>
          </div>
        </div>
        <div className="access-mini-grid">
          <div className="access-mini access-tile"><span className="mini-symbol" aria-hidden="true">↗</span><strong>Menos pasos.</strong><p>Elegí cómo querés entrar.</p></div>
          <div className="access-mini access-tile access-mini-accent"><span className="mini-symbol" aria-hidden="true">◎</span><strong>Tu acceso, a tu manera.</strong><p>Correo o tu red favorita.</p></div>
        </div>
      </section>
      <section className="access-form-card access-tile" aria-labelledby="access-title" aria-busy={busy}>
        <div className="access-card-top"><span className="access-eyebrow">TU ESPACIO PERSONAL</span><span className="access-step">{register ? '02' : '01'} / 02</span></div>
        <div className="access-heading"><h2 id="access-title">{register ? 'Empezá por acá.' : 'Qué bueno verte.'}</h2><p>{register ? 'Creá tu cuenta y conectate con lo que viene.' : 'Iniciá sesión para seguir donde lo dejaste.'}</p></div>
        <div className="access-tabs" aria-label="Tipo de acceso"><button type="button" className={!register ? 'selected' : ''} aria-current={!register ? 'page' : undefined} disabled={busy} onClick={() => register && onSwitch()}>Iniciar sesión</button><button type="button" className={register ? 'selected' : ''} aria-current={register ? 'page' : undefined} disabled={busy} onClick={() => !register && onSwitch()}>Crear cuenta</button></div>
        <div className="access-social-grid" aria-label={register ? 'Registrarse con una cuenta social' : 'Ingresar con una cuenta social'}>
          {providerList.map(provider => {
            const enabled = providers?.find(item => item.id === provider.id)?.enabled;
            return <button key={provider.id} className="access-social" type="button" disabled={busy || !enabled} onClick={() => social(provider.id)} aria-label={`${register ? 'Registrarse' : 'Ingresar'} con ${provider.name}${providers && !enabled ? ', no disponible' : ''}`}><ProviderIcon id={provider.id} /><span>{provider.name}{providers && !enabled && <small>No disponible</small>}</span></button>;
          })}
        </div>
        {providerError ? <div className="access-provider-note" role="status">{providerError} <button type="button" onClick={() => setRetry(value => value + 1)}>Reintentar</button></div> : providers && !providers.some(item => item.enabled) ? <p className="access-provider-note">El acceso social todavía no está disponible. Podés continuar con tu correo.</p> : !providers ? <p className="access-provider-note" role="status">Cargando accesos sociales…</p> : null}
        <div className="access-separator"><span />o continuá con tu correo<span /></div>
        <form onSubmit={submit} noValidate>
          {register && field('nombre', 'Nombre completo', 'text', 'Tu nombre y apellido', 'name', 50)}
          {field('email', 'Correo electrónico', 'email', 'vos@ejemplo.com', 'email', 100)}
          {field('password', 'Contraseña', 'password', register ? 'Creá una contraseña' : 'Tu contraseña', register ? 'new-password' : 'current-password', 72)}
          {register && <p id="password-hint" className="access-hint">Al menos 8 caracteres, mayúscula, minúscula y número.</p>}
          {register && field('confirm', 'Repetí tu contraseña', 'password', 'Una vez más', 'new-password', 72)}
          {error && <div className="access-error" role="alert">{error}</div>}
          <button type="submit" className="access-submit" disabled={busy}>{busy ? <><span className="access-spinner" /> Conectando…</> : <>{register ? 'Crear mi cuenta' : 'Iniciar sesión'}<span aria-hidden="true">↗</span></>}</button>
        </form>
        <p className="access-switch">{register ? '¿Ya sos parte?' : '¿Primera vez por acá?'} <button type="button" onClick={onSwitch} disabled={busy}>{register ? 'Iniciá sesión' : 'Creá tu cuenta'}</button></p>
        <div className="access-private"><svg width="13" height="15" viewBox="0 0 16 18" fill="none" stroke="currentColor" aria-hidden="true"><rect x="2" y="7" width="12" height="9" rx="2" /><path d="M5 7V4a3 3 0 0 1 6 0v3" /></svg> Tu contraseña social se queda con tu proveedor.</div>
      </section>
    </main>
    <footer className="access-bottom"><span>TechStore © {new Date().getFullYear()}</span><span>Una cuenta. Más posibilidades.<span className="access-footer-dot" /></span></footer>
  </div>;
}
