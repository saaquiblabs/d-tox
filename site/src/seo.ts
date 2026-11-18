// Each page's title and description, so the head and the pages can't drift.
// Shape ported from the saaquiblabs studio site's src/seo.ts.
import { fullName, origin, promise } from "./site";

export interface PageMeta {
  /** Page name; the home page has none. The <title> reads `Title — D-Tox for YouTube`. */
  title?: string;
  description: string;
}

export const pages = {
  "/": {
    description: `${promise} ${fullName} hides the parts of YouTube that pull you elsewhere, and stays measurably light. Free, open source, sends nothing anywhere.`,
  },
  "/welcome": {
    title: "Welcome",
    description: `${fullName} is installed. What it hides from the start, how to change it, and how to pin it to Chrome's toolbar.`,
  },
  "/privacy": {
    title: "Privacy",
    description: `${fullName} collects nothing and sends nothing anywhere. Your Settings stay in your Chrome. What this site counts, and how.`,
  },
} satisfies Record<string, PageMeta>;

export const urlOf = (path: string) => origin + path;
