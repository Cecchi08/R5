export class OAuthError extends Error {
  constructor(code, { provider, status, cause, stage, diagnosticCode, problems, responseBody, endpoint, transport } = {}) {
    super(code, { cause });
    this.name = 'OAuthError';
    this.code = code;
    this.provider = provider;
    this.status = status;
    Object.assign(this, { stage, diagnosticCode, problems, responseBody, endpoint, transport });
  }
}
