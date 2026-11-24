/** Confirm only a rapid second deliberate tap on the same candidate. */
export function createFoundationTapConfirmation(interval=500){
 let previous:{id:string;time:number}|undefined;
 return {tap(id:string,time=performance.now()){
   const confirm=previous?.id===id&&time>=previous.time&&time-previous.time<=interval;
   previous=confirm?undefined:{id,time};return confirm;
  },reset(){previous=undefined;}};
}
