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

  //TOPIC
  "create:topic",
  "read:topic:self",

  //REVIEW
  "create:review",
  "read:queue:self",
  "read:review_session:self",
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

  if (feature === "create:topic" || feature === "read:topic:self") {
    if (Array.isArray(resource)) {
      return resource.map((topic) => filterOutput(user, feature, topic));
    }

    if (user.id === resource.user_id) {
      return {
        id: resource.id,
        title: resource.title,
        source: resource.source,
        studied_at: resource.studied_at,
        status: resource.status,
        created_at: resource.created_at,
        updated_at: resource.updated_at,
      };
    }
    throw new ForbiddenError({
      message: "You are not allowed to read another user's topic",
      action: "Make sure you are accessing your own topic",
    });
  }

  if (feature === "read:queue:self") {
    return {
      queue: resource.queue.map((item) => ({
        review_id: item.review_id,
        topic_id: item.topic_id,
        type: item.type,
        scheduled_date: item.scheduled_date,
        title: item.title,
      })),
      fundamental_active_count: resource.fundamental_active_count,
    };
  }

  if (feature === "read:review_session:self") {
    return {
      topic_id: resource.topic_id,
      title: resource.title,
      type: resource.type,
      angle: resource.angle,
    };
  }

  if (feature === "create:review") {
    if (user.id !== resource.topic.user_id) {
      throw new ForbiddenError({
        message: "You are not allowed to complete another user's review",
        action: "Make sure you are accessing your own topic",
      });
    }

    return {
      topic: {
        id: resource.topic.id,
        title: resource.topic.title,
        source: resource.topic.source,
        studied_at: resource.topic.studied_at,
        status: resource.topic.status,
        created_at: resource.topic.created_at,
        updated_at: resource.topic.updated_at,
      },
      reviews: resource.reviews.map((review) => ({
        id: review.id,
        type: review.type,
        scheduled_date: review.scheduled_date,
        completed_at: review.completed_at,
        content: review.content,
        angle: review.angle,
        promoted: review.promoted,
      })),
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
