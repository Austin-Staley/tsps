import assert from "node:assert/strict";

import { decodeServerPacket } from "../network/packet/ServerBinaryDecoder";
import {
    encodeCameraReset,
    encodeCameraShake,
    encodeCameraMoveTo,
    encodeCameraLookAt,
} from "../../server/src/main/typescript/elvarg/net/protocol/ClientProtocol";

// The server's camera shake and reset reach the client's CAMERA_CONTROL decoder intact.
const shake = decodeServerPacket(new Uint8Array(encodeCameraShake(1, 7, 0, 0))) as any;
assert.deepEqual(shake, {
    type: "camera",
    payload: { mode: "shake", slot: 1, randomAmplitude: 7, sineAmplitude: 0, sineFrequency: 0 },
});

const reset = decodeServerPacket(new Uint8Array(encodeCameraReset())) as any;
assert.deepEqual(reset, { type: "camera", payload: { mode: "reset" } });

for (const [encode, mode] of [[encodeCameraMoveTo, "move"], [encodeCameraLookAt, "look"]] as const) {
    for (const instant of [true, false]) {
        assert.deepEqual(decodeServerPacket(new Uint8Array(encode(2850, 10230, 1200, instant))), {
            type: "camera", payload: { mode, x: 2850, y: 10230, height: 1200, instant },
        });
    }
}

console.log("camera shake packet: ok");
