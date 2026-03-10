import * as Util from "../../shared/util";

describe("util", () => {
  describe("lastValue", () => {
    it("returns the second argument", () => {
      const result: NonNullable<number> = Util.lastValue(1, 2);
      expect(result).toBe(2);
    });

    it("returns the second argument for strings", () => {
      const result: NonNullable<string> = Util.lastValue("old", "new");
      expect(result).toBe("new");
    });
  });

  describe("isNotNullOrUndf", () => {
    it("returns false for null", () => {
      expect(Util.isNotNullOrUndf(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(Util.isNotNullOrUndf(undefined)).toBe(false);
    });

    it("returns true for 0", () => {
      expect(Util.isNotNullOrUndf(0)).toBe(true);
    });

    it("returns true for empty string", () => {
      expect(Util.isNotNullOrUndf("")).toBe(true);
    });

    it("returns true for objects", () => {
      expect(Util.isNotNullOrUndf({ key: "value" })).toBe(true);
    });
  });

  describe("isNotNullOrEmpty", () => {
    it("returns false for null", () => {
      expect(Util.isNotNullOrEmpty(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(Util.isNotNullOrEmpty(undefined)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(Util.isNotNullOrEmpty("")).toBe(false);
    });

    it("returns false for empty array", () => {
      expect(Util.isNotNullOrEmpty([])).toBe(false);
    });

    it("returns true for non-empty string", () => {
      expect(Util.isNotNullOrEmpty("hello")).toBe(true);
    });

    it("returns true for non-empty array", () => {
      expect(Util.isNotNullOrEmpty([1])).toBe(true);
    });
  });

  describe("applyDefault", () => {
    it("returns target when non-null", () => {
      const target: NonNullable<string> = "value";
      const result: NonNullable<string> = Util.applyDefault(target, "default");
      expect(result).toBe("value");
    });

    it("returns default when null", () => {
      const result: NonNullable<string> = Util.applyDefault(null, "default");
      expect(result).toBe("default");
    });

    it("returns default when undefined", () => {
      const result: NonNullable<string> = Util.applyDefault(undefined, "default");
      expect(result).toBe("default");
    });
  });
});
