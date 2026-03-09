import * as SharedUtility from "../../shared/shared-utility";

describe("shared-utility", () => {
  describe("lastValue", () => {
    it("returns the second argument", () => {
      const result: NonNullable<number> = SharedUtility.lastValue(1, 2);
      expect(result).toBe(2);
    });

    it("returns the second argument for strings", () => {
      const result: NonNullable<string> = SharedUtility.lastValue("old", "new");
      expect(result).toBe("new");
    });
  });

  describe("isNotNullOrUndf", () => {
    it("returns false for null", () => {
      expect(SharedUtility.isNotNullOrUndf(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(SharedUtility.isNotNullOrUndf(undefined)).toBe(false);
    });

    it("returns true for 0", () => {
      expect(SharedUtility.isNotNullOrUndf(0)).toBe(true);
    });

    it("returns true for empty string", () => {
      expect(SharedUtility.isNotNullOrUndf("")).toBe(true);
    });

    it("returns true for objects", () => {
      expect(SharedUtility.isNotNullOrUndf({ key: "value" })).toBe(true);
    });
  });

  describe("isNotNullOrEmpty", () => {
    it("returns false for null", () => {
      expect(SharedUtility.isNotNullOrEmpty(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(SharedUtility.isNotNullOrEmpty(undefined)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(SharedUtility.isNotNullOrEmpty("")).toBe(false);
    });

    it("returns false for empty array", () => {
      expect(SharedUtility.isNotNullOrEmpty([])).toBe(false);
    });

    it("returns true for non-empty string", () => {
      expect(SharedUtility.isNotNullOrEmpty("hello")).toBe(true);
    });

    it("returns true for non-empty array", () => {
      expect(SharedUtility.isNotNullOrEmpty([1])).toBe(true);
    });
  });

  describe("applyDefault", () => {
    it("returns target when non-null", () => {
      const target: NonNullable<string> = "value";
      const result: NonNullable<string> = SharedUtility.applyDefault(target, "default");
      expect(result).toBe("value");
    });

    it("returns default when null", () => {
      const result: NonNullable<string> = SharedUtility.applyDefault(null, "default");
      expect(result).toBe("default");
    });

    it("returns default when undefined", () => {
      const result: NonNullable<string> = SharedUtility.applyDefault(undefined, "default");
      expect(result).toBe("default");
    });
  });
});
