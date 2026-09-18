export class OAuthError extends Error {
  constructor(code, { provider, status, cause } = {}) {
    super(code, { cause });
    this.name = 'OAuthError';
    this.code = code;
    this.provider = provider;
    this.status = status;
  }
}
