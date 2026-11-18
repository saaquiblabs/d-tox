// What each Setting does, on which saved page. Every Setting in ../settings.json needs an
// entry here and a saved page in tests/fixtures/, or the tests fail.
export type Case = Hides | Acts;

type SavedPage = {
  /** Saved page in tests/fixtures/ (capture one with tests/fixtures/capture.mjs). */
  fixture: string;
  /** The youtube.com URL the saved page is served at. */
  url: string;
};

/** A Setting that hides a Distraction. settings.spec.ts tests it from this entry. */
export type Hides = SavedPage & {
  /** Things a person would see that this Setting must hide. */
  distractions: string[];
  /** Things on the same page this Setting must leave visible. */
  keeps: string[];
  /** Other saved pages, with what this Setting must leave visible on each. */
  elsewhere?: (SavedPage & { keeps: string[] })[];
};

/** A Setting that changes a YouTube behaviour. Its own spec file tests it. */
export type Acts = SavedPage & {
  /** The spec in tests/ that tests what this Setting does. */
  spec: string;
};

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
  },
  'autoplay-off': { ...watchPlaylist, spec: 'autoplay.spec.ts' },
  comments: {
    fixture: 'watch.html',
    url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    distractions: ['ytd-watch-flexy #comments ytd-comment-thread-renderer'],
    keeps: ['ytd-watch-flexy ytd-watch-metadata', 'ytd-watch-flexy #secondary'],
  },
};
