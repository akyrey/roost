// Writes the updater's `latest.json` for a release (D-036).
//
//   node scripts/updater-manifest.mjs <release dir> <tag> <owner/repo> <notes file>
//
// Every signed bundle in <release dir> (a file with a `.sig` next to it) becomes a platform
// entry pointing at its download URL on the GitHub release. The updater looks for
// `{os}-{arch}-{bundle}` first, then `{os}-{arch}`; the plain Linux key points at the AppImage,
// which any Linux install can run.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ARCHES = { amd64: "x86_64", x86_64: "x86_64", arm64: "aarch64", aarch64: "aarch64" };

/** The architecture a Linux package name says, or `null`. */
function linuxArch(name) {
  const match = /[._-](amd64|x86_64|arm64|aarch64)[._]/.exec(name);
  return match ? ARCHES[match[1]] : null;
}

/** The manifest keys a bundle file serves, or an empty list for other files. */
export function platformKeys(name) {
  // One universal macOS app serves both architectures.
  if (name.endsWith(".app.tar.gz")) return ["darwin-aarch64", "darwin-x86_64"];
  const arch = linuxArch(name);
  if (!arch) return [];
  if (name.endsWith(".AppImage")) return [`linux-${arch}-appimage`, `linux-${arch}`];
  if (name.endsWith(".deb")) return [`linux-${arch}-deb`];
  if (name.endsWith(".rpm")) return [`linux-${arch}-rpm`];
  return [];
}

/**
 * The manifest for `bundles` (`{ name, signature }`), downloaded from the release `tag` of
 * `repo`. Fails when two bundles claim one key or when nothing is signed.
 */
export function buildManifest({ bundles, tag, repo, notes, pubDate }) {
  const platforms = {};
  for (const { name, signature } of bundles) {
    const url = `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(name)}`;
    for (const key of platformKeys(name)) {
      if (platforms[key]) throw new Error(`${key} is served by two files, the second is ${name}`);
      platforms[key] = { url, signature: signature.trim() };
    }
  }
  if (Object.keys(platforms).length === 0) throw new Error("No signed bundle was found");
  return { version: tag.replace(/^v/, ""), notes: notes.trim(), pub_date: pubDate, platforms };
}

function main([dir, tag, repo, notesFile]) {
  if (!dir || !tag || !repo || !notesFile) {
    throw new Error("usage: updater-manifest.mjs <release dir> <tag> <owner/repo> <notes file>");
  }
  const files = new Set(readdirSync(dir));
  const bundles = [...files]
    .filter((name) => files.has(`${name}.sig`))
    .map((name) => ({ name, signature: readFileSync(join(dir, `${name}.sig`), "utf8") }));
  const manifest = buildManifest({
    bundles,
    tag,
    repo,
    notes: readFileSync(notesFile, "utf8"),
    pubDate: new Date().toISOString(),
  });
  writeFileSync(join(dir, "latest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main(process.argv.slice(2));
