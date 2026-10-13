// RuneLite event API. Original notices: ../../LICENSE.txt.
export class MenuShouldLeftClick {
    private forceRightClick = false;
    isForceRightClick() { return this.forceRightClick; }
    setForceRightClick(value: boolean) { this.forceRightClick = value; }
}
