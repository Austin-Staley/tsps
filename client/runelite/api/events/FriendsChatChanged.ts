export class FriendsChatChanged {
    constructor(private joined: boolean) {}
    isJoined(): boolean { return this.joined; }
    setJoined(value: boolean): void { this.joined = value; }
}
