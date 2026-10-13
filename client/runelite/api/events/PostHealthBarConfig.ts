import type { HealthBarConfig } from "../HealthBarConfig";
export class PostHealthBarConfig {
    constructor(private readonly healthBarConfig: HealthBarConfig) {}
    getHealthBarConfig(): HealthBarConfig { return this.healthBarConfig; }
}
