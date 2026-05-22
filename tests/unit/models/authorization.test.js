import { InternalServerError } from "infra/errors";
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
        created_at: "2026-0101T00:00:00.000Z",
        updated_at: "2026-0101T00:00:00.000Z",
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
        created_at: "2026-0101T00:00:00.000Z",
        updated_at: "2026-0101T00:00:00.000Z",
      });
    });
  });
});
