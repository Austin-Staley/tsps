import type { Widget } from "./widgets/Widget";
export interface ScriptEvent {
    getSource(): Widget | null;
    getTarget(): Widget | null;
    getArguments(): unknown[];
    getOp(): number;
    getOpbase(): string;
    getMouseX(): number;
    getMouseY(): number;
    getTypedKeyCode(): number;
    getTypedKeyChar(): number;
    run(): void;
}
