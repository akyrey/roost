import { buildManifest, platformKeys } from "./updater-manifest.mjs";

const release = {
  tag: "v1.2.0",
  repo: "owner/dunlin",
  notes: "  Faster.\n",
  pubDate: "2026-11-15T00:00:00Z",
};

describe("updater manifest", () => {
  it("maps every bundle the release builds to its updater keys", () => {
    expect(platformKeys("Dunlin.app.tar.gz")).toEqual(["darwin-aarch64", "darwin-x86_64"]);
    expect(platformKeys("Dunlin_1.2.0_amd64.AppImage")).toEqual([
      "linux-x86_64-appimage",
      "linux-x86_64",
    ]);
    expect(platformKeys("Dunlin_1.2.0_aarch64.AppImage")).toEqual([
      "linux-aarch64-appimage",
      "linux-aarch64",
    ]);
    expect(platformKeys("Dunlin_1.2.0_amd64.deb")).toEqual(["linux-x86_64-deb"]);
    expect(platformKeys("Dunlin_1.2.0_arm64.deb")).toEqual(["linux-aarch64-deb"]);
    expect(platformKeys("Dunlin-1.2.0-1.x86_64.rpm")).toEqual(["linux-x86_64-rpm"]);
    expect(platformKeys("Dunlin-1.2.0-1.aarch64.rpm")).toEqual(["linux-aarch64-rpm"]);
    expect(platformKeys("Dunlin_1.2.0_universal.dmg")).toEqual([]);
    expect(platformKeys("SHA256SUMS")).toEqual([]);
  });

  it("points each key at the release download with the file's signature", () => {
    const manifest = buildManifest({
      ...release,
      bundles: [
        { name: "Dunlin.app.tar.gz", signature: "mac-sig\n" },
        { name: "Dunlin_1.2.0_amd64.deb", signature: "deb-sig" },
      ],
    });

    expect(manifest).toEqual({
      version: "1.2.0",
      notes: "Faster.",
      pub_date: "2026-11-15T00:00:00Z",
      platforms: {
        "darwin-aarch64": {
          url: "https://github.com/owner/dunlin/releases/download/v1.2.0/Dunlin.app.tar.gz",
          signature: "mac-sig",
        },
        "darwin-x86_64": {
          url: "https://github.com/owner/dunlin/releases/download/v1.2.0/Dunlin.app.tar.gz",
          signature: "mac-sig",
        },
        "linux-x86_64-deb": {
          url: "https://github.com/owner/dunlin/releases/download/v1.2.0/Dunlin_1.2.0_amd64.deb",
          signature: "deb-sig",
        },
      },
    });
  });

  it("refuses a release with nothing signed or with two files for one key", () => {
    expect(() => buildManifest({ ...release, bundles: [] })).toThrow("No signed bundle");
    expect(() =>
      buildManifest({
        ...release,
        bundles: [
          { name: "Dunlin_1.2.0_amd64.deb", signature: "a" },
          { name: "Other_1.2.0_amd64.deb", signature: "b" },
        ],
      }),
    ).toThrow("linux-x86_64-deb is served by two files");
  });
});
