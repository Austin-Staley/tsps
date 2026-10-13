import { SeqType } from "../../../rs/config/seqtype/SeqType";
import { HealthBarDefinition } from "../../../rs/config/healthbar/HealthBarDefinition";
import { HealthBarConfigImpl } from "../HealthBarConfigImpl";
import { PostAnimation, PostHealthBarConfig } from "../../api/events";
import { BaseTypeLoader } from "../../../rs/config/TypeLoader";
import type { Type } from "../../../rs/config/Type";
import { ObjType } from "../../../rs/config/objtype/ObjType";
import { LocType } from "../../../rs/config/loctype/LocType";
import { StructType } from "../../../rs/config/structtype/StructType";
import type { ClientImpl } from "../ClientImpl";
import type { EventBus } from "../../client/eventbus/EventBus";
import { PostItemComposition, PostObjectComposition, PostStructComposition } from "../../api/events";
export function bindCacheEvents(client: ClientImpl, bus: EventBus): () => void {
    const decoded = (type: Type) => {
        if (type instanceof SeqType && bus.hasSubscribers(PostAnimation)) bus.post(new PostAnimation(client.loadAnimation(type.id)));
        else if (type instanceof HealthBarDefinition && bus.hasSubscribers(PostHealthBarConfig)) bus.post(new PostHealthBarConfig(new HealthBarConfigImpl(client.engine, type)));
        else if (type instanceof ObjType && bus.hasSubscribers(PostItemComposition)) bus.post(new PostItemComposition(client.getItemDefinition(type.id)));
        else if (type instanceof LocType && bus.hasSubscribers(PostObjectComposition)) bus.post(new PostObjectComposition(client.getObjectDefinition(type.id)));
        else if (type instanceof StructType && bus.hasSubscribers(PostStructComposition)) bus.post(new PostStructComposition(client.getStructComposition(type.id)));
    };
    BaseTypeLoader.typeDecodedListeners.add(decoded);
    return () => BaseTypeLoader.typeDecodedListeners.delete(decoded);
}
