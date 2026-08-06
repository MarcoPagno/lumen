import reviewModel from "models/review.js";

describe("models/review.js", () => {
  describe(".addDays()", () => {
    test("adds days across a month boundary", () => {
      expect(reviewModel.addDays("2026-01-30", 3)).toBe("2026-02-02");
    });
  });

  describe(".getEndOfWeekSunday()", () => {
    test("returns the Sunday of the same week for a Monday", () => {
      // 2026-08-03 is a Monday
      expect(reviewModel.getEndOfWeekSunday("2026-08-03")).toBe("2026-08-09");
    });

    test("returns the Sunday of the same week for a Saturday", () => {
      // 2026-08-08 is a Saturday
      expect(reviewModel.getEndOfWeekSunday("2026-08-08")).toBe("2026-08-09");
    });

    test("pushes to the following Sunday when the study date is itself a Sunday", () => {
      // 2026-08-09 is a Sunday
      expect(reviewModel.getEndOfWeekSunday("2026-08-09")).toBe("2026-08-16");
    });
  });

  describe(".getEndOfMonth()", () => {
    test("returns the last day of the given month", () => {
      expect(reviewModel.getEndOfMonth("2026-02-05")).toBe("2026-02-28");
    });

    test("handles a leap year February", () => {
      expect(reviewModel.getEndOfMonth("2028-02-01")).toBe("2028-02-29");
    });

    test("handles December, rolling into the next year internally", () => {
      expect(reviewModel.getEndOfMonth("2026-12-15")).toBe("2026-12-31");
    });
  });

  describe(".getEndOfNextMonth()", () => {
    test("returns the last day of the month after the given date", () => {
      expect(reviewModel.getEndOfNextMonth("2026-02-05")).toBe("2026-03-31");
    });

    test("rolls over into the next year", () => {
      expect(reviewModel.getEndOfNextMonth("2026-12-05")).toBe("2027-01-31");
    });
  });
});
