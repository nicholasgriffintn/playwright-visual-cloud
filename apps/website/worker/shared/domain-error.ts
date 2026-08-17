export class DomainError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
