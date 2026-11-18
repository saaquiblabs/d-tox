// What each Setting does, on which saved pages. Every Setting in ../settings.json needs an
// entry here and its saved pages in tests/fixtures/, or the tests fail. Selectors here may use
// text and :has() freely: they describe what a person sees, and they are deliberately not the
// stylesheet's selectors.
export type Case = Hides | Acts;

export type SavedPage = {
  /** Saved page in tests/fixtures/ (capture one with tests/fixtures/capture.mjs). */
  fixture: string;
  /** The youtube.com URL the saved page is served at. */
  url: string;
  /** The window width it was captured at, if not capture.mjs's default 1280. The nightly check opens it at this width. */
  width?: number;
  /** The page the nightly check opens instead of `url`, when live YouTube shows the Distractions more reliably there. */
  liveUrl?: string;
};

/** A Setting that hides a Distraction. settings.spec.ts tests it from this entry. */
export type Hides = SavedPage & {
  /** Things a person would see that this Setting must hide. */
  distractions: string[];
  /** Things on the same page this Setting must leave visible. */
  keeps: string[];
  /** Other saved pages this Setting acts on or must leave alone: what it hides there (if
   *  anything) and what it must leave visible. */
  elsewhere?: (SavedPage & { distractions?: string[]; keeps: string[] })[];
  /** Distractions the nightly check can't find on live YouTube, with what they need. It plays no
   *  video and is signed out, so it skips these; the saved-page tests still check them. */
  needs?: Record<string, 'a playing video' | 'a signed-in account'>;
};

/** A Setting that changes a YouTube behaviour. Its own spec file tests it. */
export type Acts = SavedPage & {
  /** The spec in tests/ that tests what this Setting does. */
  spec: string;
};

// Live, "python tutorial" gets no Shorts shelf in Hindi; "cooking" gets shelves and single Shorts in both languages (2026-11-19).
export const search: SavedPage = {
  fixture: 'search.html',
  url: 'https://www.youtube.com/results?search_query=python+tutorial',
  liveUrl: 'https://www.youtube.com/results?search_query=cooking',
};
const channelShorts: SavedPage = { fixture: 'channel-shorts.html', url: 'https://www.youtube.com/@NASA/shorts' };
// Signed out, YouTube's home is empty, so /gaming stands in for a browse page with Shorts
// shelves. It is captured 1600 px wide, so the full menu is in it.
const gaming: SavedPage = { fixture: 'gaming.html', url: 'https://www.youtube.com/gaming', width: 1600 };
/** A Short opened from a link. No Setting may hide it. */
export const short: SavedPage = { fixture: 'short.html', url: 'https://www.youtube.com/shorts/k5Z7sFwFF7Q' };

const watchPlaylist: SavedPage = {
  fixture: 'watch-playlist.html',
  url: 'https://www.youtube.com/watch?v=aircAruvnKk&list=PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi',
};

export const cases: Record<string, Case> = {
  recommendations: {
    ...watchPlaylist,
    distractions: ['ytd-watch-flexy ytd-watch-next-secondary-results-renderer yt-lockup-view-model'],
    keeps: [
      'ytd-watch-flexy ytd-watch-metadata',
      'ytd-watch-flexy ytd-playlist-panel-renderer#playlist ytd-playlist-panel-video-renderer',
      'ytd-watch-flexy [target-id="engagement-panel-macro-markers-description-chapters"] ytd-macro-markers-list-item-renderer',
      'ytd-watch-flexy [target-id="engagement-panel-searchable-transcript"] ytd-engagement-panel-title-header-renderer',
    ],
    elsewhere: [
      {
        fixture: 'watch-live.html',
        url: 'https://www.youtube.com/watch?v=7yKPg0OKT-A',
        keeps: ['ytd-watch-flexy ytd-live-chat-frame#chat iframe#chatframe'],
      },
    ],
  },
  'end-screens': {
    ...watchPlaylist,
    distractions: [
      'ytd-watch-flexy #movie_player .ytp-ce-element',
      'ytd-watch-flexy #movie_player .ytp-fullscreen-grid .ytp-modern-videowall-still',
      'ytd-watch-flexy #movie_player .html5-endscreen button',
      'ytd-watch-flexy #movie_player .ytp-cards-button',
      'ytd-watch-flexy #movie_player .ytp-cards-teaser',
    ],
    keeps: ['ytd-watch-flexy #movie_player .ytp-chrome-bottom', 'ytd-watch-flexy ytd-watch-metadata'],
    needs: {
      'ytd-watch-flexy #movie_player .ytp-ce-element': 'a playing video',
      'ytd-watch-flexy #movie_player .html5-endscreen button': 'a playing video',
    },
  },
  'autoplay-off': { ...watchPlaylist, spec: 'autoplay.spec.ts' },
  comments: {
    fixture: 'watch.html',
    url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    distractions: ['ytd-watch-flexy #comments ytd-comment-thread-renderer'],
    keeps: ['ytd-watch-flexy ytd-watch-metadata', 'ytd-watch-flexy #secondary'],
  },
  shorts: {
    ...search,
    distractions: [
      'ytd-search ytd-video-renderer:has(a#thumbnail[href^="/shorts/"])',
      'ytd-search grid-shelf-view-model:has(a[href^="/shorts/"])',
      'ytd-mini-guide-entry-renderer a[title="Shorts"]',
    ],
    // Real results are lockups; in this saved page every ytd-video-renderer is a Short.
    keeps: ['ytd-search ytd-item-section-renderer > #contents > yt-lockup-view-model', 'ytd-mini-guide-entry-renderer a[href="/"]'],
    elsewhere: [
      {
        ...gaming,
        distractions: ['ytd-reel-shelf-renderer', 'ytd-guide-entry-renderer > a[title="Shorts"]'],
        keeps: ['ytd-guide-entry-renderer > a[href="/feed/subscriptions"]', 'ytd-browse ytd-horizontal-card-list-renderer'],
      },
      {
        ...channelShorts,
        distractions: ['ytd-browse ytd-rich-grid-renderer:has(a[href^="/shorts/"])', 'ytd-mini-guide-entry-renderer a[title="Shorts"]'],
        keeps: ['ytd-browse #page-header', 'ytd-mini-guide-entry-renderer a[href="/"]'],
      },
      { ...short, distractions: ['ytd-mini-guide-entry-renderer a[title="Shorts"]'], keeps: ['ytd-shorts ytd-reel-video-renderer'] },
    ],
  },
  'shorts-redirect': { ...short, spec: 'shorts-redirect.spec.ts' },
  'search-clean-up': {
    ...search,
    distractions: ['ytd-search ytd-item-section-renderer > #contents > grid-shelf-view-model'],
    // Every result stays, Shorts results included: they are results, not shelves.
    keeps: [
      'ytd-search ytd-item-section-renderer > #contents > ytd-video-renderer',
      'ytd-search ytd-item-section-renderer > #contents > yt-lockup-view-model',
    ],
  },
  explore: {
    ...gaming,
    // The menu's Explore section, found by its YouTube Music link: the address, so it holds in Hindi too.
    distractions: ['ytd-guide-section-renderer:has(a[href="/channel/UC-9-kyTW8ZkZNDHQJ6FgpwQ"])'],
    keeps: [
      'ytd-guide-entry-renderer > a[href="/feed/subscriptions"]',
      'ytd-guide-entry-renderer > a[href="/feed/history"]',
      'ytd-guide-section-renderer:has(a[href="/premium"])',
    ],
  },
  bell: {
    ...search,
    distractions: ['ytd-masthead ytd-notification-topbar-button-renderer'],
    needs: { 'ytd-masthead ytd-notification-topbar-button-renderer': 'a signed-in account' },
    keeps: ['ytd-masthead ytd-topbar-menu-button-renderer', 'ytd-search yt-lockup-view-model'],
  },
};

/** A case's own page and its other pages. */
export const pagesOf = (c: Case) => [c, ...('elsewhere' in c ? (c.elsewhere ?? []) : [])];

/** Every saved page any case names, once each, by fixture. */
export const savedPages: SavedPage[] = [
  ...new Map(
    Object.values(cases)
      .flatMap(pagesOf)
      .map((p) => [p.fixture, { fixture: p.fixture, url: p.url }] as const),
  ).values(),
];
