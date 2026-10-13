
export class WidgetLoaded {
    constructor(private groupId: number) {}
    getGroupId(): number { return this.groupId; }
    setGroupId(value: number): void { this.groupId = value; }
}
