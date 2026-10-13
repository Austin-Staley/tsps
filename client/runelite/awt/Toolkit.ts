import { Dimension } from "./Dimension";
/** Browser screen coordinates are logical CSS pixels, as AWT user coordinates are. */
export class Toolkit {
    private static readonly instance = new Toolkit();
    static getDefaultToolkit(): Toolkit { return this.instance; }
    getScreenSize(): Dimension {
        if (typeof window === "undefined")
            throw new Error("Screen information is unavailable outside a browser");
        return new Dimension(window.screen.width, window.screen.height);
    }
    getScreenResolution(): number { return 96 * (typeof window !== "undefined" ? window.devicePixelRatio : 1); }
}
