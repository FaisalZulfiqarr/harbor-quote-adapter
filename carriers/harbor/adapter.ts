/**
 * Harbor Assurance renters adapter: everything that connects our profile to
 * Harbor's form, including the decisions about which profile fields can and
 * can't answer Harbor's questions.
 */
import { ageOn, CalendarDate, formatDate, parseDate } from "@/lib/dates";
import {
  AnswerValue,
  Answers,
  buildRequest,
  CarrierForm,
  FormField,
  validateAnswers,
} from "@/lib/forms";
import { CustomerProfile, US_STATE_NAMES } from "@/lib/profile";
import formJson from "./form.json";

export const harborForm = formJson as CarrierForm;

function field(key: string): FormField {
  const found = harborForm.fields.find((f) => f.key === key);
  if (!found) throw new Error(`Harbor form has no field "${key}"`);
  return found;
}

/**
 * How the profile relates to one Harbor field:
 * - prefilled: the profile answers it, directly or after converting the format.
 * - confirm:   a reasonable starting answer that the customer has to look at,
 *              because the profile doesn't fully settle it.
 * - ask:       the profile can't answer it. A note can give the customer context.
 */
export type Resolution =
  | { status: "prefilled"; value: AnswerValue }
  | { status: "confirm"; value: AnswerValue; note: string }
  | { status: "ask"; note?: string };

const ask = (note?: string): Resolution => ({ status: "ask", note });

function resolveName(p: CustomerProfile): Resolution {
  const name = [p.first_name, p.last_name].map((s) => s?.trim()).filter(Boolean);
  return name.length === 2 ? { status: "prefilled", value: name.join(" ") } : ask();
}

function resolveBirthDate(p: CustomerProfile): Resolution {
  // Same key on both sides, different format.
  const date = parseDate(p.date_of_birth ?? "", "YYYY-MM-DD");
  const format = field("date_of_birth").format as string;
  return date ? { status: "prefilled", value: formatDate(date, format) } : ask();
}

function resolveState(p: CustomerProfile): Resolution {
  const name = US_STATE_NAMES[p.state?.trim().toUpperCase()];
  return name && field("residence_state").options?.includes(name)
    ? { status: "prefilled", value: name }
    : ask();
}

/**
 * What the customer's belongings are worth isn't the same as how much cover
 * they want to buy, and Harbor only sells fixed tiers. We start from the lowest
 * tier that covers the full value and let the customer change it.
 */
function resolveCoverage(p: CustomerProfile): Resolution {
  const value = p.personal_property_value;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return ask();

  const tiers = (field("contents_coverage").options as number[]).slice().sort((a, b) => a - b);
  const tier = tiers.find((t) => t >= value);
  const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

  if (tier === undefined) {
    const top = tiers[tiers.length - 1];
    return {
      status: "confirm",
      value: top,
      note: `Your belongings are valued at ${usd(value)}, which is more than Harbor's highest tier of ${usd(top)}. This tier would leave part of their value uncovered.`,
    };
  }
  return {
    status: "confirm",
    value: tier,
    note: `Your belongings are valued at ${usd(value)}, so we chose the lowest tier that covers all of it. A lower tier costs less but covers less.`,
  };
}

/**
 * has_dog only answers the dog half of "pets in the home". has_dog: false isn't
 * "None" because the customer may have a cat, and has_dog: true doesn't rule
 * out other pets.
 */
function resolvePets(p: CustomerProfile): Resolution {
  return p.has_dog === true
    ? {
        status: "confirm",
        value: ["Dog"],
        note: "Your profile lists a dog. Add any other pets in the home.",
      }
    : ask("Your profile says you don't have a dog, but doesn't mention other pets.");
}

const BREED_ALIASES: Record<string, string> = {
  labrador: "Labrador",
  lab: "Labrador",
  "labrador retriever": "Labrador",
  "pit bull": "Pit Bull",
  pitbull: "Pit Bull",
  "american pit bull terrier": "Pit Bull",
  rottweiler: "Rottweiler",
  rottie: "Rottweiler",
};

/**
 * Only exact breed matches are mapped. An unrecognized breed goes to the
 * customer rather than to "Other": "Pit mix" or "Staffie" filed as "Other" would
 * misstate the application on a question that likely matters for underwriting.
 */
function resolveBreed(p: CustomerProfile): Resolution {
  if (p.has_dog !== true) return ask();
  const breed = p.dog_breed?.trim();
  if (!breed) return ask();
  const mapped = BREED_ALIASES[breed.toLowerCase()];
  return mapped
    ? { status: "prefilled", value: mapped }
    : ask(`Your profile says "${breed}". Choose the closest match on Harbor's list.`);
}

/**
 * A 3-year count can't produce a 5-year count: claims from years 4 and 5 are
 * unknown. It's only a floor, so we use it as context and never as the answer.
 */
function resolveClaims(p: CustomerProfile): Resolution {
  const known = p.claims_last_3_years;
  if (typeof known !== "number") return ask();
  const count = known === 1 ? "1 claim" : `${known} claims`;
  return ask(`Your profile shows ${count} in the past 3 years. Harbor asks about the past 5 years.`);
}

export function resolveHarborFields(p: CustomerProfile): Record<string, Resolution> {
  return {
    applicant_full_name: resolveName(p),
    date_of_birth: resolveBirthDate(p),
    contact_email: p.email?.trim() ? { status: "prefilled", value: p.email.trim() } : ask(),
    phone: ask(), // Not in our profile.
    residence_state: resolveState(p),
    postal_code: p.zip?.trim() ? { status: "prefilled", value: p.zip.trim() } : ask(),
    contents_coverage: resolveCoverage(p),
    pets: resolvePets(p),
    dog_breed: resolveBreed(p),
    claims_last_5_years: resolveClaims(p),
    building_has_sprinklers: ask(), // Not in our profile. Never assume "no".
  };
}

/** The answers the profile lets us start the form with. */
export function initialAnswers(p: CustomerProfile): Answers {
  const answers: Answers = {};
  for (const [key, resolution] of Object.entries(resolveHarborFields(p))) {
    if (resolution.status !== "ask") answers[key] = resolution.value;
  }
  return answers;
}

export interface IneligibilityReason {
  code: "under_min_age" | "state_not_offered";
  message: string;
}

/**
 * Rules come from Harbor's definition, so a new age or state list only needs a
 * new form.json. All failing rules are returned so the customer sees the whole
 * picture at once. A missing or malformed date or state isn't a rejection: the
 * form asks for it and validates the answer.
 */
export function checkHarborEligibility(
  p: CustomerProfile,
  asOf: CalendarDate,
): IneligibilityReason[] {
  const reasons: IneligibilityReason[] = [];

  const birth = parseDate(p.date_of_birth ?? "", "YYYY-MM-DD");
  const minAge = field("date_of_birth").validation?.minAge;
  if (birth && minAge !== undefined) {
    const age = ageOn(birth, asOf);
    if (age < minAge) {
      reasons.push({
        code: "under_min_age",
        message: `Harbor requires applicants to be at least ${minAge}. Your date of birth on file makes you ${age}.`,
      });
    }
  }

  const stateName = US_STATE_NAMES[p.state?.trim().toUpperCase()];
  const offered = field("residence_state").options ?? [];
  if (stateName && !offered.includes(stateName)) {
    reasons.push({
      code: "state_not_offered",
      message: `Harbor doesn't offer renters insurance in ${stateName}. It's available in ${offered.join(", ")}.`,
    });
  }

  return reasons;
}

export type HarborRequestResult =
  | { status: "ineligible"; reasons: IneligibilityReason[] }
  | { status: "incomplete"; errors: Record<string, string> }
  | { status: "ready"; request: Record<string, AnswerValue> };

/**
 * Profile in, Harbor quote request out. `answers` holds what the customer
 * entered on the form and takes priority over values from the profile.
 */
export function toHarborRequest(
  p: CustomerProfile,
  answers: Answers,
  asOf: CalendarDate,
): HarborRequestResult {
  const reasons = checkHarborEligibility(p, asOf);
  if (reasons.length > 0) return { status: "ineligible", reasons };

  const merged = { ...initialAnswers(p), ...answers };
  const errors = validateAnswers(harborForm, merged, asOf);
  if (Object.keys(errors).length > 0) return { status: "incomplete", errors };

  return { status: "ready", request: buildRequest(harborForm, merged) };
}
