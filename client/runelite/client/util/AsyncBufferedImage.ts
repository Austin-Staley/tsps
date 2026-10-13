import { BufferedImage } from "../../awt";
import { ClientThread } from "../callback/ClientThread";
/** A stable transparent image is populated once the native icon loader becomes ready. */
export class AsyncBufferedImage extends BufferedImage {
    private ready=false;private readonly listeners:(()=>void)[]=[];
    constructor(private readonly clientThread:ClientThread,width:number,height:number,imageType=BufferedImage.TYPE_INT_ARGB){super(width,height,imageType);}
    loaded():void{this.ready=true;for(const listener of this.listeners.splice(0))listener();}
    onLoaded(listener:()=>void):void{if(this.ready)this.clientThread.invokeLater(listener);else this.listeners.push(listener);}
    isLoaded():boolean{return this.ready;}
}
