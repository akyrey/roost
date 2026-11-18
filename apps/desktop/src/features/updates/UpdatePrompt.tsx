import { UpdatePrompt as KitUpdatePrompt } from "@roost/updates";

import { describeUnsavedWork, unsavedWork } from "../edit/unsavedWork";
import { useUpdates } from "./updateStore";

const unsavedWarning = () => describeUnsavedWork(unsavedWork());

/** Offers a found update, and shows the download until the app restarts (D-036). */
export function UpdatePrompt() {
  return (
    <KitUpdatePrompt appName="Dunlin" useUpdates={useUpdates} unsavedWarning={unsavedWarning} />
  );
}
