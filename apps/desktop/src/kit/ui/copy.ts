import { toast } from "./toastStore";
import { copyText } from "./clipboard";

/** Copies and says so in a toast, or says why it could not. Never rejects. */
export async function copyWithToast(text: string, what: string): Promise<void> {
  try {
    await copyText(text);
    toast.success(`Copied ${what}`);
  } catch {
    toast.error("The clipboard refused the copy. Try again, or select and copy by hand.");
  }
}
