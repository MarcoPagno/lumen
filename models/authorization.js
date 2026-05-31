import { ForbiddenError, InternalServerError } from "infra/errors";

const availableFeatures = [
  //USER
  "create:user",
  "read:user",
  "read:user:self",
  "update:user:self",
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

  //SYSTEM_ACTIVITY_TYPE
  "read:system_activity_type",
  "create:system_activity_type",
  "update:system_activity_type",

  //SYSTEM_ACTIVITY_ITEM
  "read:system_activity_item",
  "create:system_activity_item",
  "update:system_activity_item",
];

function can(user, feature) {
  validateUser(user);
  validateFeature(feature);

  if (user.features.includes(feature)) {
    return true;
  }

  return false;
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
    throw new ForbiddenError({
      message: "You are not allowed to read another user's data",
      action: "Make sure you are accessing your own user data",
    });
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
    throw new ForbiddenError({
      message: "You are not allowed to read another user's session",
      action: "Make sure you are accessing your own session",
    });
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

  if (feature === "read:system_activity_type") {
    const format = (activityType) => ({
      id: activityType.id,
      slug: activityType.slug,
      name: activityType.name,
      category: activityType.category,
      color: activityType.color,
      is_default_active: activityType.is_default_active,
      frequency: activityType.frequency,
      expires_after_days: activityType.expires_after_days,
      source: activityType.source,
      source_url: activityType.source_url,
    });

    return Array.isArray(resource) ? resource.map(format) : format(resource);
  }

  if (feature === "read:system_activity_item") {
    return {
      id: resource.id,
      system_activity_type_id: resource.system_activity_type_id,
      title: resource.title,
      subtitle: resource.subtitle,
      url: resource.url,
      published_at: resource.published_at,
      created_at: resource.created_at,
      updated_at: resource.updated_at,
    };
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
