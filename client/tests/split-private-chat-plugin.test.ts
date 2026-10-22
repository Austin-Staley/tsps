import { strict as assert } from "node:assert";

import { ConfigManager } from "../runelite/client/config/ConfigManager";
import { CLIENT_TOKEN, PluginInjector } from "../runelite/client/plugins/PluginInjector";
import {
    SPLIT_PRIVATE_CHAT_VARP,
    SplitPrivateChatPlugin,
} from "../game/plugins/splitprivatechat/SplitPrivateChatPlugin";

let splitVarp = 0;
const fakeClient = { varManager: { getVarp: (id: number) => (id === SPLIT_PRIVATE_CHAT_VARP ? splitVarp : 0) } };
const plugin = new PluginInjector(new ConfigManager(undefined))
    .provide(CLIENT_TOKEN, fakeClient)
    .runWith(() => new SplitPrivateChatPlugin());

plugin.onChatMessage({ messageType: "private_in", text: "Hidden", from: "Alice" });
assert.equal(plugin.getState().messages.length, 0, "split chat off keeps private messages in the chatbox");
splitVarp = 1;
plugin.onChatMessage({ messageType: "private_in", text: "Shown", from: "Alice" });
assert.equal(plugin.getState().messages.length, 1, "split chat on shows private messages");
plugin.onSessionReset();
assert.equal(plugin.getState().messages.length, 0, "logging out clears split chat");

plugin.addMessage({ messageType: "public", text: "Hello", from: "Alice" }, 1_000);
assert.equal(plugin.getState().messages.length, 0, "public chat must stay out of split chat");

plugin.addMessage({ messageType: "private_in", text: "<col=ff0000>Hello</col>", from: "<img=1>Alice" }, 1_000);
plugin.addMessage({ messageType: "private_out", text: "Hi", from: "Bob" }, 1_001);
assert.deepEqual(
    plugin.getState().messages.map((message) => message.text),
    ["From Alice: Hello", "To Bob: Hi"],
);

plugin.prune(11_001);
assert.equal(plugin.getState().messages.length, 0, "expired messages must disappear");

console.log("split private chat plugin smoke test passed");
