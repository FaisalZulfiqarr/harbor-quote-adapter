"use client";

import { AnswerValue, FormField, isExclusiveOption } from "@/lib/forms";

const INPUT_TYPES: Partial<Record<FormField["type"], string>> = {
  email: "email",
  tel: "tel",
};

function displayOption(field: FormField, option: string | number): string {
  return typeof option === "number" && /usd/i.test(field.label)
    ? `$${option.toLocaleString("en-US")}`
    : String(option);
}

interface Props {
  field: FormField;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue | undefined) => void;
}

/** Renders one field from its JSON definition. Values stay in the carrier's format. */
export function FieldInput({ field, value, onChange }: Props) {
  const options = field.options ?? [];

  switch (field.type) {
    case "select":
      return (
        <select
          id={field.key}
          value={value === undefined ? "" : String(value)}
          onChange={(e) =>
            // Look the option up so numeric options stay numbers in the request.
            onChange(options.find((o) => String(o) === e.target.value))
          }
        >
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o} value={String(o)}>
              {displayOption(field, o)}
            </option>
          ))}
        </select>
      );

    case "multiselect": {
      const selected = Array.isArray(value) ? value : [];
      const toggle = (option: string, checked: boolean) => {
        if (!checked) return onChange(selected.filter((s) => s !== option));
        onChange(
          isExclusiveOption(option)
            ? [option]
            : [...selected.filter((s) => !isExclusiveOption(s)), option],
        );
      };
      return (
        <div className="choices" role="group" aria-labelledby={`${field.key}-label`}>
          {options.map((o) => (
            <label key={o}>
              <input
                type="checkbox"
                checked={selected.includes(String(o))}
                onChange={(e) => toggle(String(o), e.target.checked)}
              />
              {String(o)}
            </label>
          ))}
        </div>
      );
    }

    case "boolean":
      // Radios, not a checkbox: an untouched checkbox would read as "no".
      return (
        <div className="choices" role="radiogroup" aria-labelledby={`${field.key}-label`}>
          {[true, false].map((option) => (
            <label key={String(option)}>
              <input
                type="radio"
                name={field.key}
                checked={value === option}
                onChange={() => onChange(option)}
              />
              {option ? "Yes" : "No"}
            </label>
          ))}
          {!field.required && value !== undefined && (
            <button type="button" className="link" onClick={() => onChange(undefined)}>
              Clear
            </button>
          )}
        </div>
      );

    case "number":
      return (
        <input
          id={field.key}
          type="number"
          min={field.min}
          step={1}
          value={typeof value === "number" ? value : ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? undefined : Number(e.target.value))
          }
        />
      );

    default:
      return (
        <input
          id={field.key}
          type={INPUT_TYPES[field.type] ?? "text"}
          placeholder={field.format}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
