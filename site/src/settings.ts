// The Settings list (../../settings.json, ADR 0004): the extension, these pages and the checks
// all read it. tests/welcome.mjs checks /welcome against the same file, with its own copy of the rule.
import list from "../../settings.json";

export interface Setting {
  id: string;
  name: string;
  /** One line: "Hides …" (or, for a choice, what it shows). */
  hides: string;
  group: string;
  type: string;
  /** A switch: on or off. A choice (Home): the value it starts on, or false when it starts on
   * YouTube's own behaviour (so it is not in the Calm Default). */
  calmDefault: boolean | string;
}

export const settings: Setting[] = list;

/** What a fresh install starts with (CONTEXT.md, ADR 0002). */
export const calmDefault = settings.filter((s) => s.calmDefault === true || typeof s.calmDefault === "string");
