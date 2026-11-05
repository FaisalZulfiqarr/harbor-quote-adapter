/** Our platform's standard customer profile. */
export interface CustomerProfile {
  first_name: string;
  last_name: string;
  /** YYYY-MM-DD */
  date_of_birth: string;
  email: string;
  /** Two-letter code, e.g. "CA" */
  state: string;
  /** 5 digits, kept as a string so leading zeros survive */
  zip: string;
  /** USD */
  personal_property_value: number;
  has_dog: boolean;
  dog_breed: string | null;
  claims_last_3_years: number;
}

export const SAMPLE_PROFILES = {
  A: {
    first_name: "Maya",
    last_name: "Torres",
    date_of_birth: "1994-03-12",
    email: "maya@example.com",
    state: "OR",
    zip: "97205",
    personal_property_value: 32000,
    has_dog: true,
    dog_breed: "Labrador",
    claims_last_3_years: 0,
  },
  B: {
    first_name: "Sam",
    last_name: "Lee",
    date_of_birth: "2006-01-20",
    email: "sam@example.com",
    state: "NV",
    zip: "89501",
    personal_property_value: 12000,
    has_dog: false,
    dog_breed: null,
    claims_last_3_years: 1,
  },
} satisfies Record<string, CustomerProfile>;

/** Two-letter code to full name. Covers every state, not only the ones a carrier writes in. */
export const US_STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};
