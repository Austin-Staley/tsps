import type { CacheIndex } from "../../rs/cache/CacheIndex";
import type { IndexDataBase } from "../api/IndexDataBase";
import { isGroupMissingError } from "../../rs/cache/js5/GroupMissingError";
export class IndexDataBaseImpl implements IndexDataBase {
    constructor(private readonly index:CacheIndex) {}
    getFileIds(archiveId:number):Int32Array { return this.index.getFileIds(archiveId) ?? new Int32Array(); }
    loadData(archiveId:number,fileId:number):Int8Array|null { try { return this.index.getFile(archiveId,fileId)?.data ?? null; } catch(e){if(isGroupMissingError(e))return null;throw e;} }
}
