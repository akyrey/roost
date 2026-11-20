import { releaseNotes } from "./release-notes.mjs";

const changelog = `# Changelog

Intro.

## [Unreleased]

## [1.2.0] - 2026-11-20

### Added

- Faster.

## [1.1.0] - 2026-11-19

### Fixed

- Slower.
`;

describe("release notes", () => {
  it("takes the section of the tag's version, not the first one", () => {
    expect(releaseNotes(changelog, "v1.2.0")).toBe("### Added\n\n- Faster.");
  });

  it("takes the last section up to the end of the file", () => {
    expect(releaseNotes(changelog, "v1.1.0")).toBe("### Fixed\n\n- Slower.");
  });

  it("accepts a version without the v", () => {
    expect(releaseNotes(changelog, "1.2.0")).toBe("### Added\n\n- Faster.");
  });

  it("does not take a version that only starts the same", () => {
    const text = "## [1.2.0-beta.1] - 2026-11-01\n\n- Beta.\n";
    expect(() => releaseNotes(text, "v1.2.0")).toThrow("no section for 1.2.0");
  });

  it("fails when the version has no section", () => {
    expect(() => releaseNotes(changelog, "v9.9.9")).toThrow("no section for 9.9.9");
  });

  it("fails when the version's section is empty", () => {
    const text = "## [2.0.0] - 2026-11-21\n\n## [1.2.0] - 2026-11-20\n\n- Faster.\n";
    expect(() => releaseNotes(text, "v2.0.0")).toThrow("section for 2.0.0 is empty");
  });
});
