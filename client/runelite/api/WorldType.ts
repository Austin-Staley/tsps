/*
 * Copyright (c) 2018, Tomas Slusny <slusnucky@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
// Ported to TypeScript.
export enum WorldType {
    MEMBERS = 1,
    PVP = 1 << 2,
    BOUNTY = 1 << 5,
    PVP_ARENA = 1 << 6,
    SKILL_TOTAL = 1 << 7,
    QUEST_SPEEDRUNNING = 1 << 8,
    HIGH_RISK = 1 << 10,
    LAST_MAN_STANDING = 1 << 14,
    BETA_WORLD = 1 << 16,
    LEGACY_ONLY = 1 << 22,
    EOC_ONLY = 1 << 23,
    NOSAVE_MODE = 1 << 25,
    TOURNAMENT_WORLD = 1 << 26,
    FRESH_START_WORLD = 1 << 27,
    DEADMAN = 1 << 29,
    SEASONAL = 1 << 30,
}
export namespace WorldType {
    export function fromMask(mask: number): Set<WorldType> { return new Set(Object.values(WorldType).filter(v => typeof v === "number" && (mask & v) !== 0) as WorldType[]); }
    export function toMask(types: Set<WorldType>): number { let mask=0; for (const t of types) mask|=t; return mask; }
    export function isPvpWorld(types: Set<WorldType>): boolean { return types.has(WorldType.PVP) || types.has(WorldType.DEADMAN); }
}
