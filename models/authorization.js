import { ForbiddenError, InternalServerError } from "infra/errors";
import availableFeatures from "models/features.json";

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

  if (feature === "read:reading" && Array.isArray(resource.items)) {
    return {
      items: resource.items.map((item) => ({
        id: item.id,
        title: item.title,
        collection: item.collection,
        source: item.source,
        kind: item.kind,
        area: item.area,
        tone: item.tone,
        themes: item.themes,
        year: item.year,
        excerpt: item.excerpt,
        part_total: item.part_total,
        total_minutes: item.total_minutes,
        read_parts: item.read_parts,
        is_favorite: Boolean(item.favorited_at),
        author: { name: item.author_name, slug: item.author_slug },
      })),
      total: resource.total,
      page: resource.page,
      page_size: resource.page_size,
    };
  }

  if (feature === "read:reading" && resource.authors && resource.kinds) {
    return {
      authors: resource.authors,
      kinds: resource.kinds,
      areas: resource.areas,
      sources: resource.sources,
    };
  }

  if (feature === "update:reading_favorite:self") {
    return {
      reading_id: resource.reading_id,
      is_favorite: resource.is_favorite,
    };
  }

  if (feature === "read:reading" || feature === "create:reading") {
    return {
      id: resource.id,
      title: resource.title,
      collection: resource.collection,
      url: resource.url,
      source: resource.source,
      mode: resource.mode,
      content: resource.content,
      excerpt: resource.excerpt,
      word_count: resource.word_count,
      reading_minutes: resource.reading_minutes,
      kind: resource.kind,
      area: resource.area,
      tone: resource.tone,
      themes: resource.themes,
      year: resource.year,
      part_number: resource.part_number,
      part_total: resource.part_total,
      reason: resource.reason ?? null,
      is_favorite: resource.is_favorite ?? false,
      author: {
        name: resource.author_name,
        slug: resource.author_slug,
        bio: resource.author_bio,
        image_url: resource.author_image_url,
        wikipedia_url: resource.author_wikipedia_url,
        birth_year: resource.author_birth_year,
        death_year: resource.author_death_year,
      },
    };
  }

  if (feature === "create:reading_log" || feature === "read:reading_log:self") {
    if (Array.isArray(resource)) {
      return resource.map((log) => filterOutput(user, feature, log));
    }

    if (user.id !== resource.user_id) {
      throw new ForbiddenError({
        message: "You are not allowed to read another user's reading log",
        action: "Make sure you are accessing your own reading log",
      });
    }

    return {
      id: resource.id,
      reading_id: resource.reading_id,
      status: resource.status,
      reaction: resource.reaction,
      note: resource.note,
      title: resource.title,
      author_name: resource.author_name,
      kind: resource.kind,
      area: resource.area,
      themes: resource.themes,
      reading_minutes: resource.reading_minutes,
      part_number: resource.part_number,
      part_total: resource.part_total,
      created_at: resource.created_at,
      updated_at: resource.updated_at,
    };
  }

  if (
    feature === "create:diary_entry" ||
    feature === "read:diary_entry:self" ||
    feature === "update:diary_entry:self" ||
    feature === "delete:diary_entry:self"
  ) {
    if (Array.isArray(resource)) {
      return resource.map((entry) => filterOutput(user, feature, entry));
    }

    if (user.id !== resource.user_id) {
      throw new ForbiddenError({
        message: "You are not allowed to access another user's diary",
        action: "Make sure you are accessing your own diary",
      });
    }

    return {
      id: resource.id,
      entry_date: resource.entry_date,
      content: resource.content,
      created_at: resource.created_at,
      updated_at: resource.updated_at,
    };
  }

  if (feature === "create:reading_import") {
    return resource;
  }

  if (
    feature === "create:book" ||
    feature === "read:book:self" ||
    feature === "update:book:self"
  ) {
    if (Array.isArray(resource)) {
      return resource.map((book) => filterOutput(user, feature, book));
    }

    if (user.id !== resource.user_id) {
      throw new ForbiddenError({
        message: "You are not allowed to read another user's book",
        action: "Make sure you are accessing your own book",
      });
    }

    return {
      id: resource.id,
      title: resource.title,
      author_name: resource.author_name,
      themes: resource.themes,
      subjects: resource.subjects,
      status: resource.status,
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
