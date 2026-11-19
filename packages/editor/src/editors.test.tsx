import { undo } from "@codemirror/commands";
import { EditorSettingsProvider } from "@roost/ui";
import { act, render, screen } from "@testing-library/react";
import { EditorView } from "codemirror";

import { CodeEditor } from "./CodeEditor";
import { ReadOnlyCode } from "./ReadOnlyCode";
import { themeExtension } from "./theme";

/** jsdom cannot type into CodeMirror's contenteditable, so changes are dispatched directly. */
function replaceText(element: HTMLElement, text: string): void {
  const view = EditorView.findFromDOM(element);
  if (!view) throw new Error("not inside a CodeMirror editor");
  act(() => {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
  });
}

describe("ReadOnlyCode", () => {
  it("shows the text, labelled, and cannot be edited", () => {
    render(<ReadOnlyCode text='{"a": 1}' label="Response body" language="json" wrap />);

    const content = screen.getByLabelText("Response body");
    expect(content).toHaveTextContent('{"a": 1}');
    expect(content).toHaveAttribute("contenteditable", "false");
  });

  it("uses the app's own language when given one, plain text for an unknown one", () => {
    const yaml = vi.fn(() => []);
    render(<ReadOnlyCode text="a: 1" label="Spec" language="yaml" languages={{ yaml }} />);
    render(<ReadOnlyCode text="?" label="Other" language="cobol" />);

    expect(yaml).toHaveBeenCalled();
    expect(screen.getByLabelText("Other")).toHaveTextContent("?");
  });
});

describe("CodeEditor", () => {
  it("reports every change and marks invalid text", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CodeEditor
        initialText="{}"
        label="Body"
        language="json"
        wrap={false}
        invalid={false}
        onChange={onChange}
      />,
    );
    const content = screen.getByLabelText("Body");

    replaceText(content, '{"name": "ada"}');
    rerender(
      <CodeEditor
        initialText="{}"
        label="Body"
        language="json"
        wrap={false}
        invalid
        onChange={onChange}
      />,
    );

    expect(onChange).toHaveBeenLastCalledWith('{"name": "ada"}');
    expect(screen.getByLabelText("Body")).toHaveAttribute("aria-invalid", "true");
  });

  it("follows a new text from outside as one change that undo takes back", () => {
    const onChange = vi.fn();
    const editor = (text: string) => (
      <CodeEditor
        initialText='{"a":1}'
        text={text}
        label="Body"
        language="json"
        wrap={false}
        invalid={false}
        onChange={onChange}
      />
    );
    const { rerender } = render(editor('{"a":1}'));
    const view = EditorView.findFromDOM(screen.getByLabelText("Body"));
    if (!view) throw new Error("no editor");

    rerender(editor('{\n  "a": 1\n}'));
    expect(view.state.doc.toString()).toBe('{\n  "a": 1\n}');
    expect(onChange).toHaveBeenLastCalledWith('{\n  "a": 1\n}');

    // The same text again, as a parent echoing the editor's own change does: nothing happens.
    onChange.mockClear();
    rerender(editor('{\n  "a": 1\n}'));
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      undo(view);
    });
    expect(view.state.doc.toString()).toBe('{"a":1}');
  });

  it("keeps the text when the theme changes", () => {
    const dark = { theme: "dark" as const, font: { family: "mono", size: 13 } };
    const light = { theme: "light" as const, font: { family: "mono", size: 15 } };
    const editor = (
      <CodeEditor
        initialText="a"
        label="Body"
        language="text"
        wrap
        invalid={false}
        onChange={vi.fn()}
      />
    );
    const { rerender } = render(
      <EditorSettingsProvider settings={dark}>{editor}</EditorSettingsProvider>,
    );
    replaceText(screen.getByLabelText("Body"), "edited");
    rerender(<EditorSettingsProvider settings={light}>{editor}</EditorSettingsProvider>);

    expect(screen.getByLabelText("Body")).toHaveTextContent("edited");
  });
});

describe("themeExtension", () => {
  it("builds both themes", () => {
    expect(themeExtension("dark", { family: "mono", size: 12 })).toBeTruthy();
    expect(themeExtension("light", { family: "mono", size: 12 })).toBeTruthy();
  });
});
