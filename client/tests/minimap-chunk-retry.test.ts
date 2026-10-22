import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";

import { runWithSparseRetry } from "../game/worker/SparseRetry";
import { GroupMissingError } from "../rs/cache/js5/GroupMissingError";
import type { GroupSpan } from "../rs/cache/store/SparseMemoryStore";

function sparseCache() {
    const present = new Set<number>();
    const pending = new Set<number>();
    const store = {
        missCount: 0,
        onMiss: (span: GroupSpan) => { pending.add(span.archiveId); },
        isGroupPresent: (_index: number, archive: number) => present.has(archive),
    };
    const js5 = {
        store,
        requestGroup: async (_index: number, archive: number) => { present.add(archive); pending.delete(archive); },
        settled: async () => { for (const archive of pending) present.add(archive); pending.clear(); },
    };
    const missing = (archive: number) => {
        if (present.has(archive)) return false;
        store.missCount++;
        store.onMiss({ indexId: 7, archiveId: archive, startByte: 0, byteLength: 520 } as GroupSpan);
        return true;
    };
    return { state: { js5 } as any, js5, missing };
}

test("worker rebuilds minimap data after a missing terrain chunk arrives", async () => {
    const cache = sparseCache();
    const outcome = { complete: false };
    const listener = cache.js5.store.onMiss;
    let attempts = 0;

    const result = await runWithSparseRetry(
        cache.state,
        async () => {
            attempts++;
            if (cache.missing(1)) return { minimapBlobs: [] };
            return { minimapBlobs: [new Uint8Array([1, 2, 3])] };
        },
        undefined,
        outcome,
    );

    assert.equal(attempts, 2);
    assert.deepEqual(result.minimapBlobs, [new Uint8Array([1, 2, 3])]);
    assert.equal(outcome.complete, true);
    assert.equal(cache.js5.store.onMiss, listener, "the coordinator's miss listener is restored");
});

test("worker waits for every dependency beyond eight download waves", async () => {
    const cache = sparseCache();
    let attempts = 0;
    const outcome = { complete: false };
    const result = await runWithSparseRetry(cache.state, async () => {
        attempts++;
        for (let group = 0; group < 12; group++) {
            if (cache.missing(group)) return { geometry: "incomplete" };
        }
        return { geometry: "complete" };
    }, undefined, outcome);
    assert.equal(attempts, 13);
    assert.equal(result.geometry, "complete", "incomplete geometry must never leave the worker");
    assert.equal(outcome.complete, true);
});

test("blocking group downloads recover from transient fetch errors", async (t) => {
    t.mock.method(console, "warn", () => {});
    const cache = sparseCache();
    const request = cache.js5.requestGroup;
    let requests = 0;
    cache.js5.requestGroup = async (index, archive) => {
        if (++requests < 3) throw new Error("temporary fetch failure");
        return request(index, archive);
    };
    const result = await runWithSparseRetry(cache.state, async () => {
        if (cache.missing(1)) throw new GroupMissingError(7, 1, 0, 520);
        return "complete";
    });
    assert.equal(requests, 3);
    assert.equal(result, "complete");
});

test("permanently missing groups fail instead of publishing a partial scene", async () => {
    const cache = sparseCache();
    cache.js5.settled = async () => {};
    const listener = cache.js5.store.onMiss;
    const outcome = { complete: false };
    let attempts = 0;
    await assert.rejects(runWithSparseRetry(cache.state, async () => {
        attempts++;
        cache.missing(1);
        return { geometry: "incomplete" };
    }, undefined, outcome), /Incomplete build: no download progress after 8 attempts \(7:1\)/);
    assert.equal(attempts, 8);
    assert.equal(outcome.complete, false);
    assert.equal(cache.js5.store.onMiss, listener);
});

test("lost coordinator replies cannot leave a build waiting forever", async (t) => {
    t.mock.method(console, "warn", () => {});
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const cache = sparseCache();
    cache.js5.settled = () => new Promise(() => {});
    const rejected = assert.rejects(runWithSparseRetry(cache.state, async () => {
        cache.missing(1);
        return "incomplete";
    }), /Incomplete build: no download progress/);
    for (let attempt = 0; attempt < 8; attempt++) {
        await setImmediate();
        t.mock.timers.tick(30000);
        await setImmediate();
        t.mock.timers.tick(250);
    }
    await rejected;
});

test("ordinary build errors propagate and restore the sparse miss listener", async () => {
    const cache = sparseCache();
    const listener = cache.js5.store.onMiss;
    await assert.rejects(runWithSparseRetry(cache.state, async () => {
        throw new Error("invalid model data");
    }), /invalid model data/);
    assert.equal(cache.js5.store.onMiss, listener);
});
