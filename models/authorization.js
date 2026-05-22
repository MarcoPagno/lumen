import { InternalServerError } from "infra/errors";

const availableFeatures = [
  //USER
  "create:user",
  "read:user",
  "read:user:self",
  "update:user",
  "update:user:others",

  //SESSION
  "create:session",
  "read:session",

  //ACTIVATION_TOKEN
  "read:activation_token",

  //MIGRATION
  "create:migration",
  "read:migration",

  //STATUS
  "read:status",
  "read:status:all",
];

function can(user, feature, resource) {
  validateUser(user);
  validateFeature(feature);

  let authorizhed = false;

  if (user.features.includes(feature)) {
    authorizhed = true;
  }

  if (feature == "update:user" && resource) {
    authorizhed = false;

    if (user.id === resource.id || can(user, "update:user:others")) {
      authorizhed = true;
    }
  }

  return authorizhed;
}

function filterOutput(user, feature, resource) {
  validateUser(user);
  validateFeature(feature);
  validateResource(resource);

  if (feature === "read:user") {
    return {
      id: resource.id,
      username: resource.username,
      features: resource.features,
      created_at: resource.created_at,
      updated_at: resource.updated_at,
    };
  }
  if (feature === "read:user:self") {
    if (user.id === resource.id) {
      return {
        id: resource.id,
        username: resource.username,
        email: resource.email,
        features: resource.features,
        created_at: resource.created_at,
        updated_at: resource.updated_at,
      };
    }
  }

  if (feature === "read:session") {
    if (user.id === resource.user_id) {
      return {
        id: resource.id,
        token: resource.token,
        user_id: resource.user_id,
        created_at: resource.created_at,
        updated_at: resource.updated_at,
        expires_at: resource.expires_at,
      };
    }
  }

  if (feature === "read:activation_token") {
    return {
      id: resource.id,
      user_id: resource.user_id,
      created_at: resource.created_at,
      updated_at: resource.updated_at,
      expires_at: resource.expires_at,
      used_at: resource.used_at,
    };
  }

  if (feature === "read:migration") {
    return resource.map((migration) => {
      return {
        path: migration.path,
        name: migration.name,
        timestamp: migration.timestamp,
      };
    });
  }
  if (feature === "create:migration") {
    return resource.map((migration) => {
      return {
        path: migration.path,
        name: migration.name,
        timestamp: migration.timestamp,
      };
    });
  }

  if (feature === "read:status") {
    const output = {
      updated_at: resource.updated_at,
      dependencies: {
        database: {
          max_connections: resource.dependencies.database.max_connections,
          opened_connections: resource.dependencies.database.opened_connections,
        },
      },
    };

    if (can(user, "read:status:all")) {
      output.dependencies.database.version =
        resource.dependencies.database.version;
    }

    return output;
  }
}

function validateUser(user) {
  if (!user || !user.features) {
    throw new InternalServerError({
      cause:
        "A valid `user` with features must be provided to the authorization model",
    });
  }
}
function validateFeature(feature) {
  if (!feature || !availableFeatures.includes(feature)) {
    throw new InternalServerError({
      cause:
        "A valid and supported `feature` must be provided to the authorization model",
    });
  }
}
function validateResource(resource) {
  if (typeof resource !== "object") {
    throw new InternalServerError({
      cause: "`resource` must be an object in authorization.filterOutput()",
    });
  }

  if (!resource) {
    throw new InternalServerError({
      cause: "`resource` is required in authorization.filterOutput()",
    });
  }
}

const authorizationModel = {
  can,
  filterOutput,
};

export default authorizationModel;
