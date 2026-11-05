/**
 * Carrier-agnostic form engine: knows how to read a carrier's JSON definition,
 * validate answers against it, and build a request from them. Nothing in here
 * knows about Harbor or about our customer profile.
 */
import { ageOn, CalendarDate, parseDate } from "./dates";

export type OptionValue = string | number;

export interface FormField {
  key: string;
  label: string;
  type: "text" | "date" | "email" | "tel" | "select" | "multiselect" | "number" | "boolean";
  required: boolean;
  options?: OptionValue[];
  format?: string;
  pattern?: string;
  min?: number;
  validation?: { minAge?: number };
  showIf?: { field: string; includes: string };
}

export interface CarrierForm {
  carrier: string;
  product: string;
  fields: FormField[];
}

export type AnswerValue = string | number | boolean | string[];
/** Answers in the carrier's own format, keyed by the carrier's field keys. */
export type Answers = Record<string, AnswerValue | undefined>;

export function isEmpty(value: AnswerValue | undefined): boolean {
  return (
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function isVisible(field: FormField, answers: Answers): boolean {
  if (!field.showIf) return true;
  const controller = answers[field.showIf.field];
  return Array.isArray(controller) && controller.includes(field.showIf.includes);
}

/** Convention: a "None" option can't be combined with the other options. */
export function isExclusiveOption(option: OptionValue): boolean {
  return String(option).toLowerCase() === "none";
}

function validateField(field: FormField, value: AnswerValue, asOf: CalendarDate): string | null {
  switch (field.type) {
    case "date": {
      const format = field.format ?? "YYYY-MM-DD";
      const date = typeof value === "string" ? parseDate(value.trim(), format) : null;
      if (!date) return `Enter a valid date as ${format}.`;
      const minAge = field.validation?.minAge;
      if (minAge !== undefined && ageOn(date, asOf) < minAge) {
        return `You must be at least ${minAge} years old to get this quote.`;
      }
      return null;
    }
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)) ? null : "Enter a valid email address.";
    case "tel": {
      const digits = String(value).replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
      return digits.length === 10 ? null : "Enter a 10-digit phone number.";
    }
    case "select":
      return field.options?.includes(value as OptionValue) ? null : "Choose one of the listed options.";
    case "multiselect": {
      if (!Array.isArray(value) || !value.every((v) => field.options?.includes(v))) {
        return "Choose from the listed options.";
      }
      return value.length > 1 && value.some(isExclusiveOption)
        ? `"${value.find(isExclusiveOption)}" can't be combined with other options.`
        : null;
    }
    case "number":
      // Definitions have no step or decimals property, so numbers are whole numbers.
      if (typeof value !== "number" || !Number.isInteger(value)) return "Enter a whole number.";
      return field.min !== undefined && value < field.min ? `Must be ${field.min} or more.` : null;
    case "boolean":
      return typeof value === "boolean" ? null : "Choose yes or no.";
    case "text":
      return field.pattern && !new RegExp(field.pattern).test(String(value).trim())
        ? `"${value}" isn't in the format this field expects.`
        : null;
  }
}

/** Returns an error message per field key. Hidden fields are never validated. */
export function validateAnswers(
  form: CarrierForm,
  answers: Answers,
  asOf: CalendarDate,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of form.fields) {
    if (!isVisible(field, answers)) continue;
    const value = answers[field.key];
    if (isEmpty(value)) {
      if (field.required) errors[field.key] = "This is required.";
      continue;
    }
    const error = validateField(field, value as AnswerValue, asOf);
    if (error) errors[field.key] = error;
  }
  return errors;
}

/** The request body: visible, answered fields only, using the carrier's keys and values. */
export function buildRequest(form: CarrierForm, answers: Answers): Record<string, AnswerValue> {
  const request: Record<string, AnswerValue> = {};
  for (const field of form.fields) {
    const value = answers[field.key];
    if (!isVisible(field, answers) || isEmpty(value)) continue;
    request[field.key] = typeof value === "string" ? value.trim() : (value as AnswerValue);
  }
  return request;
}
