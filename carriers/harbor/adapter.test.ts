import { describe, expect, it } from "vitest";
import { CalendarDate } from "@/lib/dates";
import { CustomerProfile, SAMPLE_PROFILES } from "@/lib/profile";
import {
  checkHarborEligibility,
  initialAnswers,
  resolveHarborFields,
  toHarborRequest,
} from "./adapter";

const { A: maya, B: sam } = SAMPLE_PROFILES;
// A fixed date: Sam turns 21 on 2027-01-20, so a real clock would change results.
const ASOF: CalendarDate = { year: 2026, month: 11, day: 5 };

describe("sample profile A (Maya)", () => {
  it("prefills in Harbor's formats and asks only for what the profile can't answer", () => {
    expect(initialAnswers(maya)).toEqual({
      applicant_full_name: "Maya Torres",
      date_of_birth: "03/12/1994",
      contact_email: "maya@example.com",
      residence_state: "Oregon",
      postal_code: "97205",
      contents_coverage: 50000,
      pets: ["Dog"],
      dog_breed: "Labrador",
    });
  });

  it("is incomplete until the customer answers the missing fields", () => {
    const result = toHarborRequest(maya, {}, ASOF);
    expect(result).toEqual({
      status: "incomplete",
      errors: { phone: "This is required.", claims_last_5_years: "This is required." },
    });
  });

  it("produces Harbor's exact request and omits the optional question left blank", () => {
    const result = toHarborRequest(maya, { phone: "503-555-0100", claims_last_5_years: 0 }, ASOF);
    expect(result).toEqual({
      status: "ready",
      request: {
        applicant_full_name: "Maya Torres",
        date_of_birth: "03/12/1994",
        contact_email: "maya@example.com",
        phone: "503-555-0100",
        residence_state: "Oregon",
        postal_code: "97205",
        contents_coverage: 50000,
        pets: ["Dog"],
        dog_breed: "Labrador",
        claims_last_5_years: 0,
      },
    });
  });

  it("drops dog_breed if the customer removes the dog", () => {
    const result = toHarborRequest(
      maya,
      { phone: "503-555-0100", claims_last_5_years: 0, pets: ["Cat"] },
      ASOF,
    );
    expect(result.status === "ready" && result.request).not.toHaveProperty("dog_breed");
  });
});

describe("sample profile B (Sam)", () => {
  it("reports every reason Harbor can't quote", () => {
    const reasons = checkHarborEligibility(sam, ASOF);
    expect(reasons.map((r) => r.code)).toEqual(["under_min_age", "state_not_offered"]);
    expect(reasons[0].message).toContain("at least 21");
    expect(reasons[1].message).toContain("Nevada");
  });

  it("never produces a request, even with every answer supplied", () => {
    const result = toHarborRequest(sam, { phone: "775-555-0100", claims_last_5_years: 1 }, ASOF);
    expect(result.status).toBe("ineligible");
  });

  it("is still blocked by state after turning 21", () => {
    const reasons = checkHarborEligibility(sam, { year: 2027, month: 1, day: 20 });
    expect(reasons.map((r) => r.code)).toEqual(["state_not_offered"]);
  });

  it("doesn't turn has_dog: false into a pets answer", () => {
    expect(resolveHarborFields(sam).pets.status).toBe("ask");
    expect(initialAnswers(sam)).not.toHaveProperty("pets");
  });
});

describe("fields that look alike but aren't", () => {
  it("never copies the 3-year claims count into the 5-year question", () => {
    const claims = resolveHarborFields({ ...maya, claims_last_3_years: 2 }).claims_last_5_years;
    expect(claims.status).toBe("ask");
    expect(initialAnswers(maya)).not.toHaveProperty("claims_last_5_years");
  });

  it.each([
    [12000, 25000],
    [25000, 25000],
    [25001, 50000],
    [32000, 50000],
    [0, 10000],
    [90000, 75000],
  ])("suggests a coverage tier for property value %i: %i", (value, tier) => {
    const resolution = resolveHarborFields({ ...maya, personal_property_value: value })
      .contents_coverage;
    expect(resolution).toMatchObject({ status: "confirm", value: tier });
  });

  it("warns when the property value exceeds Harbor's highest tier", () => {
    const resolution = resolveHarborFields({ ...maya, personal_property_value: 90000 })
      .contents_coverage;
    expect(resolution.status === "confirm" && resolution.note).toContain("uncovered");
  });
});

describe("dog breed mapping", () => {
  const breedFor = (dog_breed: string | null, has_dog = true): CustomerProfile => ({
    ...maya,
    has_dog,
    dog_breed,
  });

  it("normalizes known spellings to Harbor's options", () => {
    expect(initialAnswers(breedFor("pitbull")).dog_breed).toBe("Pit Bull");
    expect(initialAnswers(breedFor(" Labrador Retriever ")).dog_breed).toBe("Labrador");
  });

  it("asks rather than assuming Other for an unrecognized breed", () => {
    const resolution = resolveHarborFields(breedFor("Pit mix")).dog_breed;
    expect(resolution).toMatchObject({ status: "ask" });
    expect(resolution.status === "ask" && resolution.note).toContain("Pit mix");
  });

  it("asks when a dog has no breed on file", () => {
    expect(resolveHarborFields(breedFor(null)).dog_breed.status).toBe("ask");
  });
});

describe("minimum age boundary", () => {
  it("passes on the 21st birthday and fails the day before", () => {
    const profile = { ...maya, date_of_birth: "2005-11-05" };
    expect(checkHarborEligibility(profile, ASOF)).toEqual([]);
    expect(checkHarborEligibility(profile, { ...ASOF, day: 4 })[0].code).toBe("under_min_age");
  });
});

describe("customer edits are validated against Harbor's rules", () => {
  const complete = { phone: "503-555-0100", claims_last_5_years: 0 };

  it.each([
    ["date_of_birth", { date_of_birth: "02/30/1994" }],
    ["date_of_birth", { date_of_birth: "01/01/2010" }],
    ["postal_code", { postal_code: "9720" }],
    ["contents_coverage", { contents_coverage: 32000 }],
    ["pets", { pets: ["None", "Dog"] }],
    ["claims_last_5_years", { claims_last_5_years: -1 }],
    ["claims_last_5_years", { claims_last_5_years: 1.5 }],
    ["phone", { phone: "12345" }],
  ])("rejects a bad %s", (key, change) => {
    const result = toHarborRequest(maya, { ...complete, ...change }, ASOF);
    expect(result.status === "incomplete" && result.errors).toHaveProperty(key);
  });

  it("accepts ZIP+4 and an explicit false on the optional sprinklers question", () => {
    const result = toHarborRequest(
      maya,
      { ...complete, postal_code: "97205-1234", building_has_sprinklers: false },
      ASOF,
    );
    expect(result.status === "ready" && result.request).toMatchObject({
      postal_code: "97205-1234",
      building_has_sprinklers: false,
    });
  });
});
