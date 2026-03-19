import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const MENU_EVENT_NAME = "menu-action";

type MenuActionName =
  | "project.open"
  | "project.open_recent"
  | "project.switch"
  | "project.refresh_context"
  | "project.close"
  | "review.commit"
  | "review.workspace"
  | "review.refresh"
  | "review.next_file"
  | "review.previous_file"
  | "ai.summary"
  | "ai.explain_diff"
  | "ai.surface_risks"
  | "ai.suggest_fix"
  | "ai.draft_comment"
  | "view.toggle_sidebar"
  | "view.focus_diff"
  | "view.reset_layout"
  | "window.bring_all_to_front"
  | "help.welcome"
  | "help.shortcuts"
  | "help.about"
  | "app.settings";

export type MenuAction = {
  action: MenuActionName;
  value?: string | null;
};

function isMenuActionName(value: string): value is MenuActionName {
  return [
    "project.open",
    "project.open_recent",
    "project.switch",
    "project.refresh_context",
    "project.close",
    "review.commit",
    "review.workspace",
    "review.refresh",
    "review.next_file",
    "review.previous_file",
    "ai.summary",
    "ai.explain_diff",
    "ai.surface_risks",
    "ai.suggest_fix",
    "ai.draft_comment",
    "view.toggle_sidebar",
    "view.focus_diff",
    "view.reset_layout",
    "window.bring_all_to_front",
    "help.welcome",
    "help.shortcuts",
    "help.about",
    "app.settings",
  ].includes(value);
}

function parseMenuAction(payload: unknown): MenuAction | null {
  if (!payload || typeof payload !== "object") return null;

  const action = "action" in payload ? payload.action : undefined;
  const value = "value" in payload ? payload.value : undefined;

  if (typeof action !== "string" || !isMenuActionName(action)) return null;
  if (value !== undefined && value !== null && typeof value !== "string") return null;

  return {
    action,
    value: value ?? null,
  };
}

export function useMenuActions(onAction: (action: MenuAction) => void): void {
  useEffect(() => {
    let active = true;

    const unlistenPromise = getCurrentWindow().listen(MENU_EVENT_NAME, (event) => {
      if (!active) return;
      const action = parseMenuAction(event.payload);
      if (action) {
        onAction(action);
      }
    });

    return () => {
      active = false;
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [onAction]);
}
