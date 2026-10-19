// Fuente unica para el montaje de Express y la validacion local de callbacks.
export const OAUTH_BASE_PATH = '/api/auth';
export const OAUTH_CALLBACK_ROUTE = '/:provider/callback';
export const callbackPath = provider => `${OAUTH_BASE_PATH}${OAUTH_CALLBACK_ROUTE.replace(':provider', provider)}`;
