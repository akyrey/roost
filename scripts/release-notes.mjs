// Prints a release's notes: the section of CHANGELOG.md for the tag's version.
//
//   node scripts/release-notes.mjs <changelog> <tag>
//
// The changelog follows Keep a Changelog: one `## [X.Y.Z] - date` heading per release. The
// notes are the lines under the heading, without it. Fails when the version has no section or
// an empty one, so a release never goes out with no notes.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const HEADING = /^## \[([^\]]+)\]/;

/** The body of the `tag`'s section of `changelog`, trimmed. */
export function releaseNotes(changelog, tag) {
  const version = tag.replace(/^v/, "");
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => HEADING.exec(line)?.[1] === version);
  if (start === -1) throw new Error(`CHANGELOG.md has no section for ${version}`);
  const next = lines.findIndex((line, index) => index > start && HEADING.test(line));
  const body = lines
    .slice(start + 1, next === -1 ? undefined : next)
    .join("\n")
    .trim();
  if (body === "") throw new Error(`CHANGELOG.md's section for ${version} is empty`);
  return body;
}

function main([changelogFile, tag]) {
  if (!changelogFile || !tag) throw new Error("usage: release-notes.mjs <changelog> <tag>");
  process.stdout.write(`${releaseNotes(readFileSync(changelogFile, "utf8"), tag)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main(process.argv.slice(2));
