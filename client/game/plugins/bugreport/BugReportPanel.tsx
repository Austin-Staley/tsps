import { useCallback, useSyncExternalStore } from "react";

import { NavigationButton } from "@runelite/client/ui/NavigationButton";
import type { BugReportPlugin, BugReportState } from "./BugReportPlugin";

function BugIcon({ label }: { label: string }): JSX.Element {
    return (
        <svg
            className="rl-sidebar-icon-svg"
            viewBox="0 0 24 24"
            role="img"
            aria-label={label}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="4.6" r="1.8" />
            <path d="M10.6 3.2 9.4 1.6M13.4 3.2l1.2-1.6" />
            <ellipse cx="12" cy="14" rx="5" ry="6.5" />
            <path d="M12 7.5v13" />
            <path d="M7.4 10.5 4.2 9M16.6 10.5l3.2-1.5M6.9 14H3.4M17.1 14h3.5M7.4 17.5l-3 2M16.6 17.5l3 2" />
        </svg>
    );
}

/** Report a Bug: describe it here, copy the screenshot, then file it on the prefilled GitHub issue. */
export function BugReportPanel({ plugin }: { plugin: BugReportPlugin }): JSX.Element {
    const subscribe = useCallback((listener: () => void) => plugin.subscribe(listener), [plugin]);
    const getSnapshot = useCallback(() => plugin.getState(), [plugin]);
    const state: BugReportState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    const ready = state.description.trim().length > 0;
    return (
        <form
            className="rl-sidebar-panel-content rl-sidebar-scrollable"
            onSubmit={(event) => {
                event.preventDefault();
                plugin.openIssue();
            }}
        >
            <label className="rl-sidebar-field">
                What went wrong?
                <textarea
                    className="rl-sidebar-textarea"
                    rows={6}
                    maxLength={2000}
                    required
                    value={state.description}
                    placeholder="What happened, and what did you expect? Steps to make it happen again help most."
                    onChange={(event) => plugin.setDescription(event.target.value)}
                />
            </label>
            <p className="rl-sidebar-panel-copy">
                {state.capturing
                    ? "Taking a screenshot…"
                    : state.screenshot
                      ? "Screenshot ready."
                      : "No screenshot yet: log in to take one, or paste your own."}
            </p>
            <button
                type="button"
                className="rl-sidebar-text-button"
                disabled={state.capturing}
                onClick={() => void plugin.copyScreenshotToClipboard()}
            >
                Copy game screenshot to clipboard
            </button>
            <p className="rl-sidebar-panel-copy">
                Filing opens a GitHub issue with your description, player and account state
                (position, skills, inventory, equipment), world, client details, game messages
                and recent errors. No address, identifier or browsing data is sent.
            </p>
            {state.notice ? (
                <p className="rl-sidebar-panel-copy" role="status">
                    {state.notice}
                </p>
            ) : null}
            <button type="submit" className="rl-sidebar-text-button" disabled={!ready}>
                Open GitHub issue
            </button>
        </form>
    );
}

/** The Report a Bug button, second on the rail so more plugin buttons never push it off. */
export function createBugReportNavigationButton(plugin: BugReportPlugin): NavigationButton {
    return NavigationButton.builder()
        .tooltip("Report a Bug")
        .icon(BugIcon)
        .priority(1)
        .panel(() => <BugReportPanel plugin={plugin} />)
        .build();
}
