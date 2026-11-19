// Every link and fact the pages share, in one place so the header, footer and pages can't drift.
// Pattern ported from the saaquiblabs studio site's src/site.ts.
export interface Link {
  label: string;
  href: string;
}

export const name = "D-Tox";
export const fullName = "D-Tox for YouTube";
export const promise = "YouTube for what you came for.";
export const origin = "https://d-tox.saaquiblabs.com";

export const store: Link = {
  label: "Add to Chrome",
  href: "https://chromewebstore.google.com/detail/ocngpkbaoflpfjamgcnnjbdnhmakmgel",
};
export const repo = "https://github.com/saaquiblabs/d-tox";
export const email = "hello@saaquiblabs.com";
export const mailto = `mailto:${email}`;
export const studio: Link = { label: "Saaquib Labs", href: "https://saaquiblabs.com" };

/** Popup and page footers carry the same three links (grill, 2026-11-18). */
export const footer: Link[] = [
  { label: "Privacy", href: "/privacy" },
  { label: "What’s new", href: "/changelog" },
  { label: "Sponsor", href: "https://github.com/sponsors/saaquiblabs" },
];

/** Self-hosted Umami (saaquiblabs ADR 0007), cookieless. One website per site in
 * analytics.saaquiblabs.com. `domains` keeps local builds, previews and the checks from counting.
 * The tag is left out until `websiteId` is filled in (a [HUMAN] step in site/README.md). */
export const analytics = {
  src: "https://analytics.saaquiblabs.com/script.js",
  websiteId: "3b2b96c5-06f9-4aa2-861a-e46e361bba97",
  domains: "d-tox.saaquiblabs.com",
};
