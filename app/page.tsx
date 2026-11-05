"use client";

import { useState } from "react";
import { checkHarborEligibility } from "@/carriers/harbor/adapter";
import { QuoteForm } from "@/components/QuoteForm";
import { today } from "@/lib/dates";
import { SAMPLE_PROFILES } from "@/lib/profile";

type ProfileId = keyof typeof SAMPLE_PROFILES;

export default function Page() {
  const [profileId, setProfileId] = useState<ProfileId>("A");
  const profile = SAMPLE_PROFILES[profileId];
  const reasons = checkHarborEligibility(profile, today());

  return (
    <main>
      <h1>Harbor Assurance renters quote</h1>

      <fieldset className="switcher">
        <legend>Sample profile</legend>
        {(Object.keys(SAMPLE_PROFILES) as ProfileId[]).map((id) => (
          <label key={id}>
            <input
              type="radio"
              name="profile"
              checked={profileId === id}
              onChange={() => setProfileId(id)}
            />
            {id}: {SAMPLE_PROFILES[id].first_name} {SAMPLE_PROFILES[id].last_name}
          </label>
        ))}
      </fieldset>

      {reasons.length > 0 ? (
        <section className="ineligible" role="alert">
          <h2>Harbor can&apos;t quote you</h2>
          <ul>
            {reasons.map((reason) => (
              <li key={reason.code}>{reason.message}</li>
            ))}
          </ul>
          <p>We haven&apos;t submitted anything to Harbor.</p>
        </section>
      ) : (
        // The key resets all form state when the profile changes.
        <QuoteForm key={profileId} profile={profile} />
      )}
    </main>
  );
}
