import { describe, expect, it } from "vitest";
import { FACINGS, TICKS_PER_SECOND, turnLeft, turnRight, type Facing } from "./index";

describe("sim scaffold", () => {
  it("ticks at 10Hz", () => {
    expect(TICKS_PER_SECOND).toBe(10);
  });

  it("turnRight cycles N → E → S → W → N", () => {
    expect(turnRight("N")).toBe("E");
    expect(turnRight("E")).toBe("S");
    expect(turnRight("S")).toBe("W");
    expect(turnRight("W")).toBe("N");
  });

  it("turnLeft is the inverse of turnRight", () => {
    for (const f of FACINGS) {
      expect(turnLeft(turnRight(f))).toBe<Facing>(f);
    }
  });
});
