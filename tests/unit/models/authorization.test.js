import { ForbiddenError, InternalServerError } from "infra/errors.js";
import authorizationModel from "models/authorization.js";

describe("models/authorization.js", () => {
  describe(".can()", () => {
    test("throws when `user` is not provided", () => {
      expect(() => {
        authorizationModel.can();
      }).toThrow(InternalServerError);
    });

    test("throws when `user.features` is missing", () => {
      const createdUser = {
        username: "UserWithoutFeatures",
      };

      expect(() => {
        authorizationModel.can(createdUser);
      }).toThrow(InternalServerError);
    });

    test("throws when `feature` is unknown", () => {
      const createdUser = {
        username: "UserWithUnknownFeatures",
        features: [],
      };

      expect(() => {
        authorizationModel.can(createdUser, "unknown:feature");
      }).toThrow(InternalServerError);
    });

    test("returns true/false with valid `user` and known `feature`", () => {
      const createdUser = {
        username: "UserWithUnknownFeatures",
        features: ["create:user"],
      };

      expect(authorizationModel.can(createdUser, "create:user")).toBe(true);
    });
  });

  describe(".filterOutput()", () => {
    test("throws when `user` is not provided", () => {
      expect(() => {
        authorizationModel.filterOutput();
      }).toThrow(InternalServerError);
    });

    test("throws when `user.features` is missing", () => {
      const createdUser = {
        username: "UserWithoutFeatures",
      };

      expect(() => {
        authorizationModel.filterOutput(createdUser);
      }).toThrow(InternalServerError);
    });

    test("throws when `feature` is unknown", () => {
      const createdUser = {
        features: [],
      };

      expect(() => {
        authorizationModel.filterOutput(createdUser, "unknown:feature");
      }).toThrow(InternalServerError);
    });

    test("throws when `resource` is not provided", () => {
      const createdUser = {
        features: ["read:user"],
      };

      expect(() => {
        authorizationModel.filterOutput(createdUser, "read:user");
      }).toThrow(InternalServerError);
    });

    test("throws when `resource` is null or undefined", () => {
      const createdUser = {
        features: ["read:user"],
      };

      expect(() =>
        authorizationModel.filterOutput(createdUser, "read:user", null),
      ).toThrow(InternalServerError);
      expect(() =>
        authorizationModel.filterOutput(createdUser, "read:user", undefined),
      ).toThrow(InternalServerError);
    });

    test("throws when `resource` is not an object", () => {
      const createdUser = {
        features: ["read:user"],
      };

      expect(() =>
        authorizationModel.filterOutput(createdUser, "read:user", 0),
      ).toThrow(InternalServerError);

      expect(() =>
        authorizationModel.filterOutput(createdUser, "read:user", 1),
      ).toThrow(InternalServerError);
    });

    test("returns filtered output with valid `user`, known `feature`, and `resource`", () => {
      const createdUser = {
        features: ["read:user"],
      };

      const resource = {
        id: 1,
        username: "resource",
        features: ["read:user"],
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        email: "resource@resource.com",
        password: "resource",
      };

      const result = authorizationModel.filterOutput(
        createdUser,
        "read:user",
        resource,
      );

      expect(result).toEqual({
        id: 1,
        username: "resource",
        features: ["read:user"],
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      });
    });

    test("returns filtered output for `read:user:self` when user is the resource owner", () => {
      const createdUser = {
        id: 1,
        features: ["read:user:self"],
      };
      const resource = {
        id: 1,
        username: "resource",
        email: "resource@resource.com",
        features: ["read:user:self"],
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        password: "hashed",
      };
      const result = authorizationModel.filterOutput(
        createdUser,
        "read:user:self",
        resource,
      );
      expect(result).toEqual({
        id: 1,
        username: "resource",
        email: "resource@resource.com",
        features: ["read:user:self"],
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      });
    });

    test("throws ForbiddenError for `read:user:self` when user is not the resource owner", () => {
      const createdUser = {
        id: 2,
        features: ["read:user:self"],
      };
      const resource = {
        id: 1,
        username: "resource",
        email: "resource@resource.com",
        features: ["read:user:self"],
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      };
      expect(() =>
        authorizationModel.filterOutput(
          createdUser,
          "read:user:self",
          resource,
        ),
      ).toThrow(ForbiddenError);
    });

    test("returns filtered output for `read:session` when user owns the session", () => {
      const createdUser = {
        id: 1,
        features: ["read:session"],
      };
      const resource = {
        id: "session-id",
        token: "token-abc",
        user_id: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        expires_at: "2026-02-01T00:00:00.000Z",
      };
      const result = authorizationModel.filterOutput(
        createdUser,
        "read:session",
        resource,
      );
      expect(result).toEqual({
        id: "session-id",
        token: "token-abc",
        user_id: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        expires_at: "2026-02-01T00:00:00.000Z",
      });
    });

    test("throws ForbiddenError for `read:session` when user does not own the session", () => {
      const createdUser = {
        id: 2,
        features: ["read:session"],
      };
      const resource = {
        id: "session-id",
        token: "token-abc",
        user_id: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        expires_at: "2026-02-01T00:00:00.000Z",
      };
      expect(() =>
        authorizationModel.filterOutput(createdUser, "read:session", resource),
      ).toThrow(ForbiddenError);
    });
  });
});
