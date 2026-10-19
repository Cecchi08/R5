import { providers, providerConfig, canonicalProviderId } from './providers/index.js';
import { callbackUrl } from '../config.js';
import { OAuthError } from './errors.js';
import { redact } from './redact.js';
import { callbackPath } from './paths.js';

const panels = {
  google: 'Google Cloud → cliente OAuth web → URIs de redireccionamiento autorizados',
  facebook: 'Facebook Login → Valid OAuth Redirect URIs',
  github: 'GitHub OAuth App → Authorization callback URL',
  x: 'X → OAuth 2.0 → Callback URI / Redirect URL',
  discord: 'Discord → OAuth2 → Redirects',
  twitch: 'Twitch → OAuth Redirect URLs',
};

// Catalogo unico: agregar aqui los nuevos codigos mantiene coherentes logs, API y UI.
export const errorCatalog = Object.freeze({
  UNKNOWN_PROVIDER: ['El proveedor solicitado no existe.', 'Elegí uno de los proveedores disponibles.'],
  PROVIDER_NOT_CONFIGURED: ['El proveedor todavía no tiene credenciales configuradas.', 'Completá CLIENT_ID y CLIENT_SECRET del proveedor en backend/.env.'],
  MISSING_ENV_VAR: ['Falta una variable de entorno requerida.', 'Completá la variable indicada en backend/.env y reiniciá el backend.'],
  INVALID_ENV_VAR: ['Una variable de entorno tiene un formato inválido.', 'Corregí el valor según details.expected y reiniciá el backend.'],
  REDIRECT_URI_MISMATCH: ['El proveedor rechazó la URL de retorno.', 'Registrá exactamente la redirect_uri enviada en el panel del proveedor.'],
  INVALID_CLIENT: ['El proveedor rechazó las credenciales de la aplicación.', 'Verificá CLIENT_ID y CLIENT_SECRET del mismo cliente OAuth; el proveedor no permite saber cuál de los dos es incorrecto.'],
  INVALID_STATE: ['La solicitud expiró, ya fue usada o pertenece a otra sesión.', 'Volvé a iniciar el acceso desde este navegador y usá el mismo host para inicio y callback.'],
  INVALID_VERIFIER: ['El verificador PKCE no es válido.', 'Iniciá un acceso nuevo; conservá el verificador original hasta completar el intercambio.'],
  INVALID_CODE: ['El código de acceso falta, expiró o ya fue utilizado.', 'Iniciá un acceso nuevo y no reutilices códigos anteriores.'],
  INVALID_REQUEST: ['La solicitud de acceso social no es válida.', 'Iniciá el acceso desde la página de login autorizada.'],
  AUTHORIZATION_DENIED: ['Cancelaste o denegaste el acceso al proveedor.', 'Volvé a intentarlo y aceptá los permisos para continuar.'],
  AUTHORIZATION_FAILED: ['No se pudo completar la autorización.', 'Revisá la configuración y los permisos de la aplicación en el proveedor.'],
  TOKEN_EXCHANGE_FAILED: ['No se pudo intercambiar el código por un token.', 'Revisá el estado HTTP y la respuesta del proveedor; iniciá un acceso nuevo.'],
  USERINFO_FAILED: ['No se pudo obtener un perfil válido del proveedor.', 'Revisá los scopes, permisos y la respuesta del endpoint de perfil.'],
  EMAIL_REQUIRED: ['El proveedor no devolvió un email y la cuenta no pudo crearse.', 'Usá un proveedor que comparta email o revisá si tu base de datos permite cuentas sin email.'],
  DB_ERROR: ['No se pudo consultar o guardar el acceso social.', 'Revisá la conexión SQL, las tablas y restricciones indicadas en el diagnóstico.'],
  SESSION_FAILED: ['No se pudo crear la sesión.', 'Revisá JWT_SECRET y el servicio de sesiones; luego iniciá un acceso nuevo.'],
  CALLBACK_FAILED: ['No se pudo procesar el retorno del proveedor.', 'Iniciá un acceso nuevo y revisá el diagnóstico del callback.'],
});

// Respetar los alias que ya acepta providerConfig, sin inventar formatos de credenciales.
// Son valores opacos: podemos detectar vacios/espacios/placeholders, no su validez remota.
function environmentVariables(id) {
  const provider = providers[id];
  return ['CLIENT_ID', 'CLIENT_SECRET', 'REDIRECT_URI'].map(suffix => {
    const variable = `${provider.env}_${suffix}`;
    const alias = suffix !== 'REDIRECT_URI' && provider.envAlias ? `${provider.envAlias}_${suffix}` : null;
    const source = !process.env[variable] && alias && process.env[alias] ? alias : variable;
    const value = process.env[source];
    return { variable, source, value, present: Boolean(value?.trim()), secret: suffix === 'CLIENT_SECRET' };
  });
}

export function diagnoseEnvironment(value) {
  const id = canonicalProviderId(value);
  if (!Object.hasOwn(providers, id)) return [{ code: 'UNKNOWN_PROVIDER', message: errorCatalog.UNKNOWN_PROVIDER[0] }];
  const problems = [];
  for (const entry of environmentVariables(id)) {
    const { variable, source, value: current, present, secret } = entry;
    const expected = variable.endsWith('REDIRECT_URI')
      ? `URL absoluta que termine exactamente en ${callbackPath(id)}, sin query, fragmento ni barra final; HTTP solo en loopback`
      : 'Credencial del panel del proveedor, no vacía, sin espacios ni placeholders';
    const details = { variable: source, current: secret && current ? '[REDACTED]' : redact(current ?? null), expected };
    if (!present) problems.push({ code: 'MISSING_ENV_VAR', message: `Falta ${source}.`, ...details });
    else if (variable.endsWith('REDIRECT_URI')) {
      try { callbackUrl(id); } catch {
        problems.push({ code: 'INVALID_ENV_VAR', message: `${source} no coincide con el formato y ruta requeridos.`, ...details });
      }
    } else if (/\s/.test(current) || /^(?:\.{3}|<.*>|(?:your|tu|replace|changeme)[_-].*)$/i.test(current)) {
      problems.push({ code: 'INVALID_ENV_VAR', message: `${source} contiene espacios o un valor de ejemplo.`, ...details });
    }
  }
  // La version de Facebook es opcional, pero un valor explicito mal escrito no debe ignorarse.
  if (id === 'facebook' && process.env.FACEBOOK_API_VERSION !== undefined && !/^v\d+\.\d+$/.test(process.env.FACEBOOK_API_VERSION)) {
    problems.push({ code: 'INVALID_ENV_VAR', variable: 'FACEBOOK_API_VERSION', current: redact(process.env.FACEBOOK_API_VERSION), expected: 'vN.N, por ejemplo v23.0', message: 'FACEBOOK_API_VERSION tiene un formato inválido.' });
  }
  return problems;
}

export function assertEnvironment(provider) {
  const problems = diagnoseEnvironment(provider);
  if (!problems.length) return;
  const id = canonicalProviderId(provider);
  const credentials = Object.hasOwn(providers, id) ? environmentVariables(id).slice(0, 2) : [];
  const code = credentials.length && credentials.every(item => !item.present) ? 'PROVIDER_NOT_CONFIGURED' : problems[0].code;
  // Conservar mensajes internos anteriores ayuda a clientes que ya manejaban unavailable.
  throw new OAuthError(`unavailable: ${problems.map(item => item.variable || item.code).join(', ')}`, {
    provider: id, diagnosticCode: code, problems,
  });
}

export function environmentReport() {
  return Object.keys(providers).map(id => {
    const variables = environmentVariables(id);
    const redirectUri = variables[2].value;
    let routeMatches = false;
    try { routeMatches = new URL(redirectUri).pathname === callbackPath(id); } catch { /* URL invalida */ }
    const problems = diagnoseEnvironment(id);
    return {
      provider: id, configured: providerConfig(id).enabled, valid: problems.length === 0,
      variables: Object.fromEntries(variables.map(item => [item.variable, { present: item.present, source: item.source }])),
      missing: variables.filter(item => !item.present).map(item => item.source),
      redirect_uri: redact(redirectUri ?? null), expectedPath: callbackPath(id), routeMatches,
      providerRegistration: 'not_verified', problems,
    };
  });
}

// stage localiza la operacion; source distingue configuracion, proveedor, peticion, SQL y sesion.
// No afirmar mismatch por un simple invalid_grant: tambien puede ser un codigo vencido.
export function formatOAuthError(stage, provider, error = {}, context = {}) {
  const id = canonicalProviderId(provider);
  const safeProvider = Object.hasOwn(providers, id) ? id : 'unknown';
  stage = error.stage || stage;
  if (!['authorization', 'token_exchange', 'userinfo', 'callback', 'db', 'session'].includes(stage)) stage = 'callback';
  const name = error.code || error.message;
  const remote = JSON.stringify(error.responseBody ?? context.providerResponse ?? error.message ?? '');
  const defaults = { authorization: 'AUTHORIZATION_FAILED', token_exchange: 'TOKEN_EXCHANGE_FAILED', userinfo: 'USERINFO_FAILED', callback: 'CALLBACK_FAILED', db: 'DB_ERROR', session: 'SESSION_FAILED' };
  const codes = { unknown_provider: 'UNKNOWN_PROVIDER', invalid_state: 'INVALID_STATE', invalid_verifier: 'INVALID_VERIFIER', invalid_code: 'INVALID_CODE', invalid_request: 'INVALID_REQUEST', cancelled: 'AUTHORIZATION_DENIED', unavailable: 'PROVIDER_NOT_CONFIGURED', email_required: 'EMAIL_REQUIRED' };
  let code = error.diagnosticCode || codes[name] || defaults[stage];
  if (/redirect_(?:uri_)?mismatch|redirect(?:[_ -]?uri|[_ -]?url).{0,100}(?:mismatch|not.{0,10}(?:match|allowed|registered|whitelisted)|invalid)|(?:invalid|unauthorized|unregistered).{0,30}redirect[_ -]?(?:uri|url)|url blocked/i.test(remote)) code = 'REDIRECT_URI_MISMATCH';
  else if (/invalid_client|incorrect_client_credentials|unauthorized_client/i.test(remote)) code = 'INVALID_CLIENT';
  if (!Object.hasOwn(errorCatalog, code)) code = defaults[stage];
  let [message, hint] = errorCatalog[code];
  const source = ['MISSING_ENV_VAR', 'INVALID_ENV_VAR', 'PROVIDER_NOT_CONFIGURED', 'REDIRECT_URI_MISMATCH', 'INVALID_CLIENT'].includes(code) ? 'configuration'
    : ['INVALID_STATE', 'INVALID_VERIFIER', 'INVALID_CODE', 'INVALID_REQUEST', 'UNKNOWN_PROVIDER', 'AUTHORIZATION_DENIED'].includes(code) ? 'request'
      : stage === 'db' ? 'database' : stage === 'session' ? 'session' : error.transport ? 'network' : 'provider';
  const details = { source };
  if (context.operation) details.operation = redact(context.operation);
  if (error.status) details.httpStatus = error.status;
  if (error.endpoint) details.endpoint = error.endpoint;
  if (error.transport) details.transport = error.transport;
  if (error.responseBody !== undefined || context.providerResponse !== undefined) details.providerResponse = redact(error.responseBody ?? context.providerResponse, context.secrets);
  if (error.problems?.length) {
    details.problems = error.problems.map(item => ({
      code: Object.hasOwn(errorCatalog, item.code) ? item.code : 'INVALID_ENV_VAR',
      variable: redact(item.variable), current: /SECRET|PASSWORD|TOKEN/.test(item.variable || '') && item.current ? '[REDACTED]' : redact(item.current),
      expected: redact(item.expected), message: redact(item.message),
    }));
    Object.assign(details, { variable: details.problems[0].variable, current: details.problems[0].current, expected: details.problems[0].expected });
    message = `${message} ${details.problems.map(item => item.message).join(' ')}`;
  }
  if (stage === 'db' && /^ER_[A-Z_]+$|^ECONNREFUSED$|^ETIMEDOUT$/.test(name)) details.databaseCode = name;
  if (['REDIRECT_URI_MISMATCH', 'INVALID_CLIENT'].includes(code) && safeProvider !== 'unknown') {
    details.redirect_uri = redact(process.env[`${providers[id].env}_REDIRECT_URI`] ?? null);
    details.variables = [`${providers[id].env}_CLIENT_ID`, `${providers[id].env}_CLIENT_SECRET`, `${providers[id].env}_REDIRECT_URI`];
    details.providerRegistration = 'not_verified';
    if (code === 'REDIRECT_URI_MISMATCH') hint = `Verificá que la URL enviada esté EXACTAMENTE registrada en ${panels[id]}.`;
  }
  return { stage, provider: safeProvider, code, message, details, hint };
}

export function logOAuthError(diagnostic) {
  const line = `[OAUTH ERROR] provider=${diagnostic.provider} | stage=${diagnostic.stage} | code=${diagnostic.code}`;
  const redirect = diagnostic.details.redirect_uri ? `\n→ redirect_uri enviado: ${diagnostic.details.redirect_uri}` : '';
  const summary = `${line}${redirect}\n→ ${diagnostic.message}\n→ ${diagnostic.hint}`;
  // El objeto ya esta filtrado. Nunca pasar error/cause originales a console.error.
  if (process.env.NODE_ENV !== 'production') console.error(`\x1b[31m${summary}\x1b[0m\n${JSON.stringify(diagnostic, null, 2)}`);
  else console.error(`${summary}\n${JSON.stringify(diagnostic)}`);
}

export function publicOAuthError(diagnostic) {
  if (process.env.NODE_ENV !== 'production') return diagnostic;
  const { details, ...result } = diagnostic;
  return { ...result, message: errorCatalog[result.code][0], hint: details.source === 'configuration' || ['db', 'session'].includes(result.stage)
    ? 'Intentá más tarde o contactá al soporte de la tienda.' : errorCatalog[result.code][1] };
}
