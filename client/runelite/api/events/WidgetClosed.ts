
export class WidgetClosed {
    constructor(private readonly groupId: number, private readonly modalMode: number, private readonly unload: boolean) {}
    getGroupId(): number { return this.groupId; }
    getModalMode(): number { return this.modalMode; }
    getUnload(): boolean { return this.unload; }
    isUnload(): boolean { return this.unload; }
}
