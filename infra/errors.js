export class InternalServerError extends Error {
  constructor({ cause, statusCode }) {
    super("An internal unexpected error occurred", {
      cause,
    });
    this.name = "InternalServerError";
    this.action = "Get in contact with the support";
    this.statusCode = statusCode || 500;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      action: this.action,
      status_code: this.statusCode,
    };
  }
}

export class ServiceError extends Error {
  constructor({ cause, message }) {
    super(message || "Service unavailable now", {
      cause,
    });
    this.name = "ServiceError";
    this.action = "Verify if the service is available";
    this.statusCode = 500;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      action: this.action,
      status_code: this.statusCode,
    };
  }
}

export class MethodNotAllowedError extends Error {
  constructor() {
    super("Method not allowed to this endpoint");
    this.name = "MethodNotAllowedError";
    this.action = "Verify if the HTTP method is valid to this endpoint";
    this.statusCode = 405;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      action: this.action,
      status_code: this.statusCode,
    };
  }
}
