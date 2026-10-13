export class Gson {
    toJson(value: unknown): string { return JSON.stringify(value); }
    fromJson<T>(text: string, _type?: unknown): T { return JSON.parse(text) as T; }
}
