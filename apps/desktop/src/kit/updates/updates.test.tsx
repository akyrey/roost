import { Toaster, useToasts } from "@roost/ui";
import { act, render, screen } from "@testing-library/react";

import { UpdatePrompt } from "./UpdatePrompt";
import { type UpdateBackend, createUpdateStore } from "./updateStore";

const update = { version: "1.1.0", currentVersion: "1.0.0", notes: "Faster." };

function backend(overrides: Partial<UpdateBackend> = {}): UpdateBackend {
  return {
    appName: "Whimbrel",
    check: vi.fn(() => Promise.resolve(update)),
    install: vi.fn(() => new Promise<void>(() => undefined)),
    describeError: (caught) => (caught instanceof Error ? caught.message : "unknown"),
    ...overrides,
  };
}

beforeEach(() => {
  useToasts.setState({ toasts: [] });
});

describe("@roost/updates", () => {
  it("names the app and warns about unsaved work", async () => {
    const useUpdates = createUpdateStore(backend());
    render(
      <UpdatePrompt appName="Whimbrel" useUpdates={useUpdates} unsavedWarning={() => "2 tabs."} />,
    );
    await act(() => useUpdates.getState().check("startup"));

    expect(screen.getByText("Whimbrel 1.1.0 is available. You have 1.0.0.")).toBeInTheDocument();
    expect(screen.getByText("Whimbrel restarts after the install. 2 tabs.")).toBeInTheDocument();
  });

  it("reports a manual check with the app's name and its own error text", async () => {
    const failing = vi.fn(() => Promise.reject(new Error("offline")));
    const upToDate = createUpdateStore(backend({ check: () => Promise.resolve(null) }));
    const broken = createUpdateStore(backend({ check: failing }));
    render(<Toaster />);

    await act(() => upToDate.getState().check("manual"));
    await act(() => broken.getState().check("manual"));
    expect(screen.getByRole("status")).toHaveTextContent("Whimbrel is up to date");
    expect(screen.getByRole("alert")).toHaveTextContent("offline");
  });

  it("follows the download progress and shows a failed install", async () => {
    let report: ((p: { downloaded: number; total: number | null }) => void) | undefined;
    let fail: ((e: Error) => void) | undefined;
    const useUpdates = createUpdateStore(
      backend({
        install: (onProgress) =>
          new Promise((_, reject) => {
            report = onProgress;
            fail = reject;
          }),
      }),
    );
    render(<UpdatePrompt appName="Whimbrel" useUpdates={useUpdates} />);
    await act(() => useUpdates.getState().check("manual"));

    act(() => void useUpdates.getState().install());
    act(() => report?.({ downloaded: 50, total: 200 }));
    expect(screen.getByRole("status")).toHaveTextContent("Downloading… 25%");
    await act(async () => {
      fail?.(new Error("bad signature"));
      await Promise.resolve();
    });
    expect(screen.getByRole("alert")).toHaveTextContent("bad signature");
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });
});
