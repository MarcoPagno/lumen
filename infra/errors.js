export class InternalServerError extends Error {
  constructor({ cause, statusCode }) {
    super("An unexpected internal error occurred", {
      cause,
    });
    this.name = "InternalServerError";
    this.action = "Contact support if the issue persists";
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
    super(message || "Service is currently unavailable", {
      cause,
    });
    this.name = "ServiceError";
    this.action = "Try again later or check service status";
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
    super("HTTP method not allowed for this endpoint");
    this.name = "MethodNotAllowedError";
    this.action = "Use a valid HTTP method for this endpoint";
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

export class ValidationError extends Error {
  constructor({ cause, message, action }) {
    super(message || "Invalid request data", {
      cause,
    });
    this.name = "ValidationError";
    this.action = action || "Review the input data and try again";
    this.statusCode = 400;
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

export class NotFoundError extends Error {
  constructor({ cause, message, action }) {
    super(message || "Resource not found", {
      cause,
    });
    this.name = "NotFoundError";
    this.action = action || "Verify the request parameters and try again";
    this.statusCode = 404;
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

export class UnauthorizedError extends Error {
  constructor({ cause, message, action }) {
    super(message || "Authentication required", {
      cause,
    });
    this.name = "UnauthorizedError";
    this.action = action || "Authenticate and try again";
    this.statusCode = 401;
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

export class ForbiddenError extends Error {
  constructor({ cause, message, action }) {
    super(message || "Access denied", {
      cause,
    });
    this.name = "ForbiddenError";
    this.action = action || "You do not have permission to perform this action";
    this.statusCode = 403;
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
