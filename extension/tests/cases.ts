// What each Setting hides, on which saved page. Every Setting in ../settings.json needs an
// entry here and a saved page in tests/fixtures/, or the tests fail.
export type Case = {
  /** Saved page in tests/fixtures/ (capture one with tests/fixtures/capture.mjs). */
  fixture: string;
  /** The youtube.com URL the saved page is served at. */
  url: string;
  /** Something a person would see that this Setting must hide. */
  distraction: string;
  /** Things on the same page this Setting must leave visible. */
  keeps: string[];
};

export const cases: Record<string, Case> = {
  comments: {
    fixture: 'watch.html',
    url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    distraction: 'ytd-watch-flexy #comments ytd-comment-thread-renderer',
    keeps: ['ytd-watch-flexy ytd-watch-metadata', 'ytd-watch-flexy #secondary'],
  },
};
