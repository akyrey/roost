import { Component, type ReactNode } from "react";

type Props = { name: string; children: ReactNode };
type State = { failed: boolean };

/** Nothing is reported anywhere: there is no telemetry.
 *
 * Keeps a rendering bug in one panel from blanking the window: the panel shows what happened
 * and can be shown again (task 8.11). The error's text is not shown, as it may quote data. */
export class PanelBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex flex-col items-start gap-2 p-4 text-sm text-rose-300">
        <p>The {this.props.name} stopped working because of a bug in Dunlin.</p>
        <button
          type="button"
          className="rounded bg-zinc-700 px-3 py-1 text-zinc-100 hover:bg-zinc-600"
          onClick={() => {
            this.setState({ failed: false });
          }}
        >
          Show it again
        </button>
      </div>
    );
  }
}
