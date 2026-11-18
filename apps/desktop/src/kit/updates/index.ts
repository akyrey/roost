// @roost/updates: in-app update state and prompt, on top of the app's updater IPC.
export { UpdatePrompt } from "./UpdatePrompt";
export {
  type CheckMode,
  type UpdateBackend,
  type UpdateInfo,
  type UpdateProgress,
  type UpdateState,
  type UpdateStatus,
  type UpdateStore,
  createUpdateStore,
} from "./updateStore";
