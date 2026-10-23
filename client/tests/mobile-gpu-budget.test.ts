import assert from "node:assert/strict";

Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
    userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/156.0.0.0 Mobile Safari/537.36",
    maxTouchPoints: 5,
} });
(globalThis as any).self = globalThis;
for (const ext of [".png", ".jpg", ".webp", ".glsl"]) {
    require.extensions[ext] = (module, file) => { module.exports = file; };
}

async function main(): Promise<void> {
    const { GameRenderer } = await import("../game/GameRenderer");
    const { AntiAliasingMode, GpuConfig } = await import("../game/plugins/gpu/GpuConfig");
    const { ConfigManager } = await import("../runelite/client/config/ConfigManager");
    let gpu: { fpsLimit: number } | undefined = { fpsLimit: 240 };
    const host: any = {
        fpsLimit: 120,
        osrsClient: { targetFps: 20, clientPlugins: { gpuSettings: () => gpu } },
    };
    const limit = () => (GameRenderer.prototype as any).getEffectiveFpsLimit.call(host);
    assert.equal(limit(), 20, "enabling GPU must preserve the mobile battery limit");
    gpu.fpsLimit = 10;
    assert.equal(limit(), 10, "a stricter explicit GPU cap still applies");
    host.osrsClient.targetFps = 0;
    assert.equal(limit(), 10, "no battery cap preserves the selected GPU cap");
    gpu.fpsLimit = 0;
    host.osrsClient.targetFps = 30;
    assert.equal(limit(), 30, "unlimited GPU FPS must still honour the mobile cap");
    gpu = undefined;
    assert.equal(limit(), 30, "the same battery setting applies with GPU off");

    const manager = new ConfigManager();
    const config = manager.getConfig(GpuConfig);
    assert.equal(config.antiAliasingMode(), AntiAliasingMode.DISABLED);
    assert.equal(config.fpsLimit(), 60, "new handheld settings use a conservative display cap");
    manager.setConfiguration("gpu", "antiAliasingMode", AntiAliasingMode.MSAA_4);
    manager.setConfiguration("gpu", "fpsLimit", 120);
    assert.equal(config.antiAliasingMode(), AntiAliasingMode.MSAA_4, "saved graphics choices stay selected");
    assert.equal(config.fpsLimit(), 120);
    console.log("Mobile GPU budget regression tests passed");
}

void main();
