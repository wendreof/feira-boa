import { deleteAccountButton, pushFeedback, signOutButton, status } from "./dom";

export function setStatus(message: string): void {
  status.textContent = message;
}

export function setActionsDisabled(disabled: boolean): void {
  signOutButton.disabled = disabled;
  deleteAccountButton.disabled = disabled;
}

export function setPushFeedback(message = ""): void {
  if (!pushFeedback) return;
  pushFeedback.textContent = message;
  pushFeedback.hidden = !message;
}
