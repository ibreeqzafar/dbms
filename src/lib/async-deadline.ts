export async function withDeadline<T>(task:(signal:AbortSignal)=>Promise<T>,parent:AbortSignal,milliseconds:number):Promise<T>{
 if(parent.aborted)throw Error('ABORTED');
 const controller=new AbortController();
 const cancel=()=>controller.abort(Error('ABORTED'));
 parent.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(()=>controller.abort(Error('AGENT_TIMEOUT')),milliseconds);
 let fail:()=>void=()=>{};
 const deadline=new Promise<T>((_,reject)=>{fail=()=>reject(controller.signal.reason||Error('AGENT_TIMEOUT'));controller.signal.addEventListener('abort',fail,{once:true})});
 try{return await Promise.race([task(controller.signal),deadline])}
 finally{clearTimeout(timer);parent.removeEventListener('abort',cancel);controller.signal.removeEventListener('abort',fail)}
}
