export type GridCard={id:string;rank:number;suit:number};
export type GridSlot={top:string|null;v:string[];s:string[];turn:'v'|'s';vCapacity?:number;sCapacity?:number};
export type GridState={phase:'pick'|'play';fieldIndex?:number;originIndex?:number;field:(string|null)[];stock:string[];slots:Record<string,GridSlot>;found:string[];streak:number;over:null|'win'|'lose'};
export type GridPlacement={x:number;y:number;z:number;down?:boolean;gone?:boolean;peek?:'top'|'bottom'|'left'|'right';pick?:boolean;next?:boolean;rot?:number;pv?:'found'|'top'|'back'|'off'|null};
export type GridRender={phase:'pick'|'play';foundation:GridCard|null;rect:{x:number;y:number;width:number;height:number};scale:number;layout:Record<string,GridPlacement>;cards:Record<string,GridCard>;state:GridState};
export function mountGridTableau(options:{stage:HTMLElement;board:HTMLElement;cardScale?:number;maxScale?:number;minScale?:number|(()=>number);scrollable?:boolean;padding?:number;seed?:number;fieldColumns?:number;fieldRows?:number;fieldMask?:boolean[];denseBackfill?:boolean;pathField?:boolean;anyReach?:()=>boolean;singleClickPick?:boolean;stockReselect?:boolean;stockEnabled?:boolean;teamHand?:boolean;spellDeal?:{min:number;max?:number};stockLimit?:()=>number;paused?:()=>boolean;onCard?:(card:GridCard,kind:'start'|'play'|'stock')=>boolean|void;onRender?:(view:GridRender)=>void}):{readonly state:GridState;readonly cards:Record<string,GridCard>;bestPath():string[];bestSequence(excludeFoundationId?:string,preferredFoundationId?:string):{id:string|null;length:number;kind:'foundation'|'card'|'return'};preview(id:string|null):boolean;reopen():boolean;cancelReopen():boolean;refresh():void;activate(id:string):boolean;autoStep(draw?:boolean):boolean;setFoundationRank(rank:number):void;dispose():void};





