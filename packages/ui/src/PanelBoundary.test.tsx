import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PanelBoundary } from "./PanelBoundary";

let broken = true;
function Fragile() {
  if (broken) throw new Error("secret cell value");
  return <p>fine</p>;
}

describe("PanelBoundary", () => {
  it("contains a crash without showing the error text, and can show the panel again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <PanelBoundary name="workspace">
        <Fragile />
      </PanelBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("The workspace stopped working");
    expect(screen.queryByText(/secret cell value/)).toBeNull();
    broken = false;
    await userEvent.click(screen.getByRole("button", { name: "Show it again" }));
    expect(screen.getByText("fine")).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
