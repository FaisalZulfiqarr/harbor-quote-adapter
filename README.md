# Harbor Assurance quote adapter

Connects our standard customer profile to Harbor's renters quote form.

```bash
npm install
npm run dev     # http://localhost:3000, switch between the sample profiles at the top
npm test
```

| Path | What it does |
| --- | --- |
| `carriers/harbor/form.json` | Harbor's form definition |
| `carriers/harbor/adapter.ts` | Profile-to-Harbor mapping, eligibility check, `toHarborRequest()` |
| `lib/forms.ts` | Carrier-agnostic validation, `showIf` handling and request building |
| `components/` | Renders any field type from the JSON |

## How each field maps

| Harbor field | Profile source | Treatment |
| --- | --- | --- |
| `applicant_full_name` | `first_name` + `last_name` | Converted |
| `date_of_birth` | `date_of_birth` | Same key, converted to MM/DD/YYYY |
| `contact_email` | `email` | Direct |
| `postal_code` | `zip` | Direct |
| `residence_state` | `state` | Code converted to full name; a state Harbor doesn't offer makes the customer ineligible |
| `dog_breed` | `dog_breed` | Known spellings are mapped; anything else is asked |
| `contents_coverage` | `personal_property_value` | **Suggested, customer checks it.** Value isn't coverage, so we choose the lowest tier that covers the value |
| `pets` | `has_dog` | **Partial.** `true` starts with Dog and the customer can add pets. `false` is asked, because it doesn't mean "None" |
| `claims_last_5_years` | none | **Asked.** A 3-year count can't answer a 5-year question, so it's only shown as context |
| `phone` | none | Asked |
| `building_has_sprinklers` | none | Asked, optional. Left out of the request if blank, and never assumed to be "no" |

With the two samples, Maya is asked for phone and 5-year claims, plus the optional sprinklers question, and checks coverage ($50,000 for $32,000 of belongings) and pets. Sam gets no form: Harbor can't quote them because they're 20 and live in Nevada, and the page shows both reasons.

## Assumptions

- **Request shape.** The brief doesn't specify an envelope, so the request is a flat object of Harbor's field keys and values. Unanswered optional fields and hidden fields are omitted, and coverage stays a number.
- **Eligibility.** Only the rules Harbor states count: `minAge` and the listed states. Age is checked against today's date in the customer's timezone. I didn't invent rules for Pit Bulls, Rottweilers or claim counts, even though Harbor probably cares about them, because the definition doesn't say so.
- **Ineligible customers see no form.** There's no point collecting a phone number for a quote that can't happen. If the profile is wrong, it should be fixed at the profile level.
- **Legal name.** `first_name last_name` is treated as the legal name. It can be edited.
- **Rounding up coverage.** This avoids underinsuring by default, but it's a product decision that affects price and may have compliance implications, so I'd confirm it.
- **Unknown breeds.** They're asked rather than filed as "Other", since "Pit mix" as "Other" would misstate the application.
- **Phone format.** Harbor gives none, so we require 10 US digits and send what was typed.
- **Numbers.** The definition has no decimals property, so number fields accept whole numbers only.
- **Submission.** With no backend, submitting shows the payload that would be sent.

## With more time

- Confirm the open questions with Harbor: phone format, request envelope, breed and claim rules, and whether `minAge` is measured at quote or policy start.
- Check that the ZIP belongs to the state. Editing either field today can produce a mismatch.
- Warn if the 5-year claims answer is lower than the 3-year count on file, which should be impossible.
- Re-check eligibility on a real server at submit time, since the client's clock and code can't be trusted.
- Accessibility pass, including moving focus to the first error, plus component tests of the form.
- Save the customer's new answers back to the profile, with where and when each was collected.

## Scaling to 50 carriers

The split already in place is what scales: the form engine and renderer never change, and each carrier adds a definition and a mapping. Most of the remaining work is keeping the mapping decisions correct.

1. **Make mappings declarative.** Move most of each adapter into data that uses a shared set of tested transforms, such as `direct`, `formatDate`, `stateName`, `nextTierUp` and `enumAlias`. Unusual cases can still drop into code. Adding a carrier should mostly mean writing config.
2. **Require a decision for every field.** A check fails if a carrier field has no explicit entry, including an explicit `ask`. This stops new fields being matched on name alone, which is how `claims_last_3_years` ends up in `claims_last_5_years`. Time windows, units and definitions get human review, and AI-drafted mappings would go through the same review.
3. **Make eligibility declarative.** Carriers won't all express rules the way Harbor does, so normalize them into a common format (age, state, breed, claims, property value). That also lets us pre-screen a customer across all carriers and show who can quote them.
4. **Detect definition changes.** Version each definition and alert when a carrier's changes. New required fields or options should fail CI instead of failing on a customer's submission.
5. **Test each carrier with fixtures.** Run a shared set of profiles through every adapter and compare against saved requests, so an engine change that affects any carrier shows up in review.
6. **Grow the profile from data.** Track which questions get asked most across carriers. Phone, for example, should probably join the profile. Keeping answers with their time window lets one answer serve many carriers, and combining forms means a customer answers each question once.
7. **Extend the engine as needed.** Other carriers will need more `showIf` operators, field types and multi-step forms. Add these when a real definition needs them, and have the engine fail loudly on anything it doesn't recognize instead of skipping it.
