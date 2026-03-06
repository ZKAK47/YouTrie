export class AppError extends Error {
    constructor(message, status = 500, redirect = null, details = null) {
      super(message);
      this.name = 'AppError';
      this.status = status;
      this.redirect = redirect;
      this.details = details;
    }
  }
  
export const ErrorTypes = {
    UNAUTHORIZED: { status: 401, message: 'Unauthorized' },
    FORBIDDEN: { status: 403, message: 'Forbidden' },
    NOT_FOUND: { status: 404, message: 'Not found' },
    QUOTA_EXCEEDED: { status: 429, message: 'Quota exceeded' },
    VALIDATION_ERROR: { status: 400, message: 'Validation error' }
};