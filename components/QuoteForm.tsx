"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  harborForm,
  initialAnswers,
  resolveHarborFields,
  Resolution,
} from "@/carriers/harbor/adapter";
import { today } from "@/lib/dates";
import {
  AnswerValue,
  Answers,
  buildRequest,
  FormField,
  isEmpty,
  isVisible,
  validateAnswers,
} from "@/lib/forms";
import { CustomerProfile } from "@/lib/profile";
import { FieldInput } from "./FieldInput";

function displayValue(value: AnswerValue | undefined): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number") return value.toLocaleString("en-US");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value ?? "";
}

export function QuoteForm({ profile }: { profile: CustomerProfile }) {
  const resolutions = useMemo(() => resolveHarborFields(profile), [profile]);
  const [answers, setAnswers] = useState<Answers>(() => initialAnswers(profile));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [request, setRequest] = useState<Record<string, AnswerValue> | null>(null);

  const visible = harborForm.fields.filter((f) => isVisible(f, answers));
  const inGroup = (status: Resolution["status"]) =>
    visible.filter((f) => resolutions[f.key]?.status === status);

  const update = (key: string, value: AnswerValue | undefined) => {
    setAnswers((current) => ({ ...current, [key]: value }));
    setErrors(({ [key]: _cleared, ...rest }) => rest);
    setRequest(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validateAnswers(harborForm, answers, today());
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // A prefilled field with an error has to be open so it can be corrected.
      setEditing((current) => new Set([...current, ...Object.keys(found)]));
      setRequest(null);
      return;
    }
    setRequest(buildRequest(harborForm, answers));
  };

  const renderInput = (field: FormField, note?: string) => (
    <div className="field" key={field.key}>
      <label htmlFor={field.key} id={`${field.key}-label`}>
        {field.label}
        {!field.required && <span className="optional"> (optional)</span>}
      </label>
      <FieldInput
        field={field}
        value={answers[field.key]}
        onChange={(value) => update(field.key, value)}
      />
      {note && <p className="note">{note}</p>}
      {errors[field.key] && (
        <p className="error" role="alert">
          {errors[field.key]}
        </p>
      )}
    </div>
  );

  const toConfirm = inGroup("confirm");
  const prefilled = inGroup("prefilled");
  const noteFor = (field: FormField) => {
    const resolution = resolutions[field.key];
    return resolution && "note" in resolution ? resolution.note : undefined;
  };

  return (
    <form onSubmit={submit} noValidate>
      <section>
        <h2>We still need</h2>
        {inGroup("ask").map((f) => renderInput(f, noteFor(f)))}
      </section>

      {toConfirm.length > 0 && (
        <section>
          <h2>Please check</h2>
          {toConfirm.map((f) => renderInput(f, noteFor(f)))}
        </section>
      )}

      {prefilled.length > 0 && (
        <section>
          <h2>From your profile</h2>
          {prefilled.map((f) =>
            editing.has(f.key) ? (
              renderInput(f)
            ) : (
              <div className="summary-row" key={f.key}>
                <span className="summary-label">{f.label}</span>
                <span>{isEmpty(answers[f.key]) ? "—" : displayValue(answers[f.key])}</span>
                <button
                  type="button"
                  className="link"
                  aria-label={`Edit ${f.label}`}
                  onClick={() => setEditing((current) => new Set([...current, f.key]))}
                >
                  Edit
                </button>
              </div>
            ),
          )}
        </section>
      )}

      <button type="submit">Review quote request</button>

      {request && (
        <section className="result">
          <h2>Quote request for Harbor</h2>
          <p className="note">
            This exercise has no backend, so nothing was sent. This is the exact payload we would
            submit.
          </p>
          <pre data-testid="harbor-request">{JSON.stringify(request, null, 2)}</pre>
        </section>
      )}
    </form>
  );
}
