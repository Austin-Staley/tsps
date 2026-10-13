import { Script } from "../../../rs/cs2/Script";
import opcodes from "./opcodes.json";
const codeByName: Record<string, number> = opcodes;
const branches = new Set([6, 7, 8, 9, 10, 31, 32]);
type Instruction = { code: number; operand: string; line: number; cases?: Array<[number, string]> };
/** RuneLite rs2asm: resolve labels after instruction positions and switch tables are known. */
export function assemble(source: string, name = "RuneLite", symbols: Record<string, number | undefined> = {}): Script {
    const script = new Script(); script.name = name;
    const labels = new Map<string, number>();
    const instructions: Instruction[] = [];
    const fail = (line: number, message: string): never => { throw new Error(`${name}:${line}: ${message}`); };
    const integer = (value: string, line: number): number => {
        if (value.startsWith(":")) { const symbol = symbols[value.slice(1)]; return symbol ?? fail(line, `Unknown symbol ${value}`); }
        if (!/^-?\d+$/.test(value)) return fail(line, `Expected integer: ${value}`);
        const result = Number(value);
        if (!Number.isSafeInteger(result) || result < -2147483648 || result > 2147483647) return fail(line, "Integer outside int32");
        return result;
    };
    source.split(/\r?\n/).forEach((raw, offset) => {
        const line = offset + 1;
        // Semicolons in quoted strings are data, not comments.
        const text = raw.match(/^(?:"(?:\\.|[^"\\])*"|[^;])*/)?.[0]?.trim() ?? "";
        if (!text) return;
        const header = /^\.(\w+)\s+(.+)$/.exec(text);
        if (header) {
            const value = integer(header[2], line);
            if (header[1] !== "id" && (value < 0 || value > 65535)) fail(line, "Argument count outside uint16");
            switch (header[1]) {
                case "id": script.id = value; break;
                case "int_arg_count": script.intArgCount = value; break;
                case "obj_arg_count": script.objArgCount = value; break;
                case "long_arg_count": script.longArgCount = value; break;
                default: fail(line, `Unknown header ${header[1]}`);
            }
            return;
        }
        const label = /^(\w+):$/.exec(text);
        if (label) { if (labels.has(label[1])) fail(line, "Duplicate label"); labels.set(label[1], instructions.length); return; }
        const switchCase = /^(-?\d+):\s*(\w+)$/.exec(text);
        if (switchCase) {
            const previous = instructions[instructions.length - 1];
            if (previous?.code !== 60) fail(line, "Switch case without switch");
            (previous.cases ??= []).push([integer(switchCase[1], line), switchCase[2]]); return;
        }
        const match = /^(\S+)(?:\s+(.*))?$/.exec(text)!;
        const code = /^\d+$/.test(match[1]) ? integer(match[1], line) : codeByName[match[1]];
        if (code === undefined) fail(line, `Unknown instruction ${match[1]}`);
        instructions.push({ code, operand: match[2] ?? "", line });
    });
    if (script.id < 0) fail(1, "Missing script id");
    script.localIntCount = script.intArgCount; script.localObjCount = script.objArgCount; script.localLongCount = script.longArgCount;
    script.instructions = Int32Array.from(instructions.map(i => i.code));
    script.intOperands = new Int32Array(instructions.length);
    script.longOperands = new BigInt64Array(instructions.length);
    script.stringOperands = new Array(instructions.length).fill(null);
    const switchTables: Map<number, number>[] = [];
    const relative = (label: string, pc: number, line: number) => {
        const target = labels.get(label); if (target === undefined) return fail(line, `Undefined label ${label}`);
        return target - pc - 1;
    };
    instructions.forEach((instruction, pc) => {
        const { code, operand, line } = instruction;
        if (code === 3) {
            try { const value: unknown = JSON.parse(operand); if (typeof value !== "string") fail(line, "sconst needs a quoted string"); script.stringOperands[pc] = value as string; }
            catch { fail(line, "Invalid sconst string"); }
        } else if (code === 61) {
            if (!/^-?\d+$/.test(operand)) fail(line, "Invalid long constant");
            const value = BigInt(operand);
            if (value < -(1n << 63n) || value >= (1n << 63n)) fail(line, "Long constant outside int64");
            script.longOperands[pc] = value;
        } else if (branches.has(code)) script.intOperands[pc] = relative(operand, pc, line);
        else if (code === 60) {
            script.intOperands[pc] = switchTables.length;
            const table = new Map<number, number>();
            for (const [key, label] of instruction.cases ?? []) { if (table.has(key)) fail(line, "Duplicate switch case"); table.set(key, relative(label, pc, line)); }
            switchTables.push(table);
        } else if (operand) script.intOperands[pc] = integer(operand, line);
        if ([33, 34, 35, 36, 64, 65].includes(code) && (script.intOperands[pc] < 0 || script.intOperands[pc] >= 65535)) fail(line, "Local index outside uint16");
        if ([33, 34].includes(code)) script.localIntCount = Math.max(script.localIntCount, script.intOperands[pc] + 1);
        if ([35, 36].includes(code)) script.localObjCount = Math.max(script.localObjCount, script.intOperands[pc] + 1);
        if ([64, 65].includes(code)) script.localLongCount = Math.max(script.localLongCount, script.intOperands[pc] + 1);
    });
    script.switches = switchTables.length ? switchTables : null;
    return script;
}
