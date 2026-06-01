import type { KeyboardEvent as ReactKeyboardEvent } from "react";

export function isActivationKey(event: Pick<ReactKeyboardEvent, "key">): boolean {
  return event.key === "Enter" || event.key === " ";
}

export function onKeyboardActivate(
  action: () => void,
): (event: ReactKeyboardEvent<HTMLElement>) => void {
  return (event) => {
    if (!isActivationKey(event)) {
      return;
    }
    event.preventDefault();
    action();
  };
}
