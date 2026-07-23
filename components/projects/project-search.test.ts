import assert from "node:assert/strict";
import test from "node:test";
import { matchesProjectSearch } from "./project-search";

const projectName = "danish-democracy-data-main";

test("matches project names across spaces and hyphens", () => {
  assert.equal(matchesProjectSearch(projectName, "danish democracy"), true);
  assert.equal(matchesProjectSearch(projectName, "danish-democracy"), true);
});

test("matches a single project-name token", () => {
  assert.equal(matchesProjectSearch(projectName, "danish"), true);
});

test("does not match an unrelated query", () => {
  assert.equal(matchesProjectSearch(projectName, "swedish parliament"), false);
});

test("matches case-insensitively", () => {
  assert.equal(
    matchesProjectSearch("DANISH-DEMOCRACY-DATA-MAIN", "DaNiSh DeMoCrAcY"),
    true,
  );
});
