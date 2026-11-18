// What each Setting hides, on which saved pages. Every Setting in ../settings.json needs an
// entry here, and every page a saved copy in tests/fixtures/<page>.html, or the tests fail.
// Selectors here may use text and :has() freely: they describe what a person sees, and they
// are deliberately not the stylesheet's selectors.

/** Saved pages and the youtube.com URL each is served at. Capture one with tests/fixtures/capture.mjs. */
export const pages = {
  watch: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  search: 'https://www.youtube.com/results?search_query=python+tutorial',
  'channel-shorts': 'https://www.youtube.com/@NASA/shorts',
  // Signed out, YouTube's home is empty, so /gaming stands in for a browse page with Shorts
  // shelves. It is captured 1600 px wide, so the full menu is in it.
  gaming: 'https://www.youtube.com/gaming',
  // A Short opened from a link. No Setting may hide it.
  short: 'https://www.youtube.com/shorts/k5Z7sFwFF7Q',
} as const;

export type PageName = keyof typeof pages;

export type Spot = {
  page: PageName;
  /** Distractions this Setting must hide on this page, each a whole element: every match is
   *  hidden when on, and nothing outside them may disappear. */
  hides: string[];
  /** Things on the same page this Setting must leave visible (every match). */
  keeps: string[];
};

/** Per Setting, the pages it acts on. The first Spot is the one the popup tests use. A Setting
 *  that hides nothing (shorts-redirect) has none, and is checked to change nothing anywhere. */
export const cases: Record<string, Spot[]> = {
  comments: [
    {
      page: 'watch',
      hides: ['ytd-watch-flexy #comments'],
      keeps: ['ytd-watch-flexy ytd-watch-metadata', 'ytd-watch-flexy #secondary'],
    },
  ],
  shorts: [
    {
      page: 'search',
      hides: [
        'ytd-search ytd-video-renderer:has(a#thumbnail[href^="/shorts/"])',
        'ytd-search grid-shelf-view-model:has(a[href^="/shorts/"])',
        'ytd-mini-guide-entry-renderer a[title="Shorts"]',
      ],
      keeps: [
        'ytd-search ytd-video-renderer:not(:has(a#thumbnail[href^="/shorts/"]))',
        'ytd-search ytd-item-section-renderer > #contents > yt-lockup-view-model',
        'ytd-mini-guide-entry-renderer a[href="/"]',
      ],
    },
    {
      page: 'gaming',
      hides: ['ytd-reel-shelf-renderer', 'ytd-guide-entry-renderer > a[title="Shorts"]'],
      keeps: ['ytd-guide-entry-renderer > a[href="/feed/subscriptions"]', 'ytd-browse ytd-horizontal-card-list-renderer'],
    },
    {
      page: 'channel-shorts',
      hides: ['ytd-browse ytd-rich-item-renderer:has(a[href^="/shorts/"])'],
      keeps: ['ytd-browse #page-header', 'ytd-mini-guide-entry-renderer a[href="/"]'],
    },
    {
      page: 'short',
      hides: ['ytd-mini-guide-entry-renderer a[title="Shorts"]'],
      keeps: ['ytd-shorts ytd-reel-video-renderer'],
    },
  ],
  'shorts-redirect': [],
  'search-clean-up': [
    {
      page: 'search',
      hides: ['ytd-search ytd-item-section-renderer > #contents > grid-shelf-view-model'],
      // Every result stays, Shorts results included: they are results, not shelves.
      keeps: [
        'ytd-search ytd-item-section-renderer > #contents > ytd-video-renderer',
        'ytd-search ytd-item-section-renderer > #contents > yt-lockup-view-model',
      ],
    },
  ],
  explore: [
    {
      page: 'gaming',
      hides: ['ytd-guide-section-renderer:has(a[title="Music"][href^="/channel/"])'],
      keeps: [
        'ytd-guide-entry-renderer > a[href="/feed/subscriptions"]',
        'ytd-guide-entry-renderer > a[href="/feed/history"]',
        'ytd-guide-section-renderer:has(a[href="/premium"])',
      ],
    },
  ],
  bell: [
    {
      page: 'search',
      hides: ['ytd-masthead ytd-notification-topbar-button-renderer'],
      keeps: ['ytd-masthead ytd-topbar-menu-button-renderer', 'ytd-search ytd-video-renderer'],
    },
  ],
};
