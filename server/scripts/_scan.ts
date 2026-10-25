import path = require("path");
import { CachePipeline } from "../src/main/typescript/elvarg/game/cache/CachePipeline";
import { CacheIndexDat2 } from "../src/main/typescript/elvarg/game/cache/codec/rs/cache/CacheIndex";
import { IndexType } from "../src/main/typescript/elvarg/game/cache/codec/rs/cache/IndexType";
import { hasLongCounts, readScript } from "./cs2-reader";
(async()=>{
 await CachePipeline.initialize(path.resolve(__dirname, ".."));
 const index = CacheIndexDat2.fromStore(IndexType.DAT2.clientScript, CachePipeline.getStore());
 const want = new Set(process.argv.slice(2).map(Number));
 for (let id=0; id<30000; id++){
  const f = index.getFileSmart(id); if(!f) continue;
  try{ const {instructions}=readScript(new Int8Array(f.data), hasLongCounts(CachePipeline.getActive().revision));
   const hits=instructions.filter(i=>typeof i.operand==="number"&&want.has(i.operand)).map(i=>i.operand);
   if(hits.length) console.log(id,[...new Set(hits)].join(","));}catch(e){}
 }
})();
