import type { PluginClass } from "../Plugin";

type Listener = (pluginClass: PluginClass) => void;

let pending: PluginClass | undefined;
const listeners = new Set<Listener>();

/**
 * Opens a plugin's settings in the Configuration panel (RuneLite's
 * ConfigPlugin.openConfigurationPanel), e.g. from an overlay's "Configure" menu entry.
 */
export function openConfiguration(pluginClass: PluginClass): void {
    pending = pluginClass;
    for (const listener of listeners) listener(pluginClass);
}

/** The Configuration plugin and its panel listen; returns the unsubscribe function. */
export function onConfigurationRequest(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** A request made before the panel was showing; taken once. */
export function takePendingConfiguration(): PluginClass | undefined {
    const request = pending;
    pending = undefined;
    return request;
}
