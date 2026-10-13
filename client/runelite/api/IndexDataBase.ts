export interface IndexDataBase { getFileIds(archiveId:number):Int32Array; loadData(archiveId:number,fileId:number):Int8Array|null; }
