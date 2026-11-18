// The check that /welcome agrees with the Settings list (#26). Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { welcomeProblems, inCalmDefault } from "./welcome.mjs";

const settings = [
  { id: "shorts", name: "Shorts", hides: "Hides Shorts everywhere.", calmDefault: true },
  { id: "comments", name: "Comments", hides: "Hides the comments.", calmDefault: false },
  { id: "home", name: "Home", hides: "Shows the Intention Page.", type: "select", calmDefault: "intention" },
];

const page = (items) =>
  `<html><body><ul data-calm-default>${items
    .map(([id, text]) => `<li data-setting="${id}"><b>x</b> ${text}</li>`)
    .join("")}</ul></body></html>`;

test("a Setting is in the Calm Default when it is true or starts on a value of its own", () => {
  assert.deepEqual(settings.filter(inCalmDefault).map((s) => s.id), ["shorts", "home"]);
});

test("a page that lists exactly the Calm Default, with each hides line, passes", () => {
  const html = page([["shorts", "Hides Shorts everywhere."], ["home", "Shows the Intention Page."]]);
  assert.deepEqual(welcomeProblems(html, settings), []);
});

test("a missing Calm Default Setting fails", () => {
  const html = page([["shorts", "Hides Shorts everywhere."]]);
  assert.match(welcomeProblems(html, settings).join("\n"), /home.*missing/);
});

test("a Setting that is not in the Calm Default fails", () => {
  const html = page([
    ["shorts", "Hides Shorts everywhere."],
    ["home", "Shows the Intention Page."],
    ["comments", "Hides the comments."],
  ]);
  assert.match(welcomeProblems(html, settings).join("\n"), /comments.*not in the Calm Default/);
});

test("a stale hides line fails", () => {
  const html = page([["shorts", "Hides some Shorts."], ["home", "Shows the Intention Page."]]);
  assert.match(welcomeProblems(html, settings).join("\n"), /shorts.*hides/);
});

test("a page without the list fails", () => {
  assert.match(welcomeProblems("<html></html>", settings).join("\n"), /no .*data-calm-default/);
});

test("an empty Calm Default needs an empty list, not a missing one", () => {
  const none = settings.map((s) => ({ ...s, calmDefault: false }));
  assert.deepEqual(welcomeProblems(page([]), none), []);
});
