import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  getNextOpenProjectMenuId,
  getProjectCardId,
} from "./project-card-state";
import { ScanProjectCard } from "./scan-project";

const cards = [
  { source: "upload" as const, scanId: "scan-1", project: "project-1" },
  { source: "upload" as const, scanId: "scan-2", project: "project-2" },
  { source: "github" as const, scanId: "scan-3", project: "project-3" },
];

function renderCards(openMenuId: string | null): string {
  return renderToStaticMarkup(
    <div>
      {cards.map((card) => {
        const cardId = getProjectCardId(card);

        return (
          <ScanProjectCard
            key={cardId}
            {...card}
            status="failed"
            score={42}
            errors={1}
            warnings={2}
            createdAt="2026-07-24T00:00:00.000Z"
            repositoryFullName={
              card.source === "github" ? "owner/project-3" : null
            }
            prNumber={card.source === "github" ? 3 : null}
            canRerun
            menuOpen={openMenuId === cardId}
            onMenuOpenChange={() => undefined}
            onRename={async () => true}
            onRerun={async () => undefined}
            onDelete={async () => undefined}
          />
        );
      })}
    </div>,
  );
}

function expandedMenuCount(markup: string): number {
  return markup.match(/aria-expanded="true"/g)?.length ?? 0;
}

test("only the most recently opened project menu stays open", () => {
  const secondCardId = getProjectCardId(cards[1]);
  const thirdCardId = getProjectCardId(cards[2]);
  let openMenuId: string | null = null;

  openMenuId = getNextOpenProjectMenuId(openMenuId, secondCardId, true);
  let markup = renderCards(openMenuId);

  assert.equal(expandedMenuCount(markup), 1);
  assert.match(
    markup,
    /aria-label="More actions for project 2"[^>]*aria-expanded="true"/,
  );

  openMenuId = getNextOpenProjectMenuId(openMenuId, thirdCardId, true);
  openMenuId = getNextOpenProjectMenuId(openMenuId, secondCardId, false);
  markup = renderCards(openMenuId);

  assert.equal(openMenuId, thirdCardId);
  assert.equal(expandedMenuCount(markup), 1);
  assert.match(
    markup,
    /aria-label="More actions for owner\/project-3 #3"[^>]*aria-expanded="true"/,
  );
});

test("card identity is namespaced across upload and GitHub scans", () => {
  assert.notEqual(
    getProjectCardId({ source: "upload", scanId: "shared-id" }),
    getProjectCardId({ source: "github", scanId: "shared-id" }),
  );
});
