import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {Link} from 'react-router-dom';
import type {DesignerAccess as Access} from '../lib/designer-access';
export default function DesignerAccess({access,busy,loading,onGuest,accountForm,error,onAuthenticated}:{access:Access|null;busy:boolean;loading:boolean;onGuest:()=>Promise<boolean>;accountForm:(onAuthenticated:()=>Promise<void>)=>ReactNode;error:string;onAuthenticated:()=>Promise<void>}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [guestChosen,setGuestChosen]=useState(false),[register,setRegister]=useState(false);
 const needsChoice=!access?.registered&&!guestChosen;
 useEffect(()=>{
  const modal=dialog.current;if(!modal)return;
  if(needsChoice){if(!modal.open)modal.showModal();const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{modal.close();document.body.style.overflow=previous}}
  modal.close();
 },[needsChoice]);
 if(access?.registered)return <section className="designer-access compact" aria-label="Designer account access"><div><span className="eyebrow">YOUR DESIGNER ACCESS</span><p>Signed in with a verified email. Explore recommendations and save your favourite designs.</p></div><Link className="text-link" to="/account">Your account</Link></section>;
 const exhausted=access?.remaining===0;
 const refill=access?.resetsAt?new Intl.DateTimeFormat('en-PK',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Karachi'}).format(new Date(access.resetsAt)):null;
 return <>
  <dialog ref={dialog} className="designer-access-dialog" aria-labelledby="designer-access-title" aria-describedby="designer-access-description" onCancel={e=>e.preventDefault()} onClose={e=>{const modal=e.currentTarget;queueMicrotask(()=>{if(needsChoice&&modal.isConnected&&!modal.open)modal.showModal()})}}>
   <span className="eyebrow">ESSYRA DESIGN STUDIO</span><h2 id="designer-access-title">Make room for <em>your ideas.</em></h2>
   <p id="designer-access-description">Create an account for more designer access and privately saved designs, or explore with 3 guest generations every 24 hours. The refill timer starts with your first successful generation.</p>
   {register&&<><button type="button" className="text-button" onClick={()=>setRegister(false)}>Back to access options</button>{accountForm(async()=>{await onAuthenticated();setGuestChosen(true)})}</>}
   {!register&&<button autoFocus className="btn full" disabled={loading||busy} onClick={()=>setRegister(true)}>Register or sign in</button>}
   <button className="btn secondary full" disabled={loading||busy} onClick={async()=>{if(await onGuest())setGuestChosen(true)}}>{loading?'Checking your access...':busy?'Starting guest mode...':access?`Continue as guest - ${access.remaining} remaining`:'Continue as guest - 3 free generations'}</button>
   {error&&<p className="error" role="alert">{error}</p>}
   <small>{refill&&<>Full guest refill: {refill} (Pakistan time).<br/></>}Email verification is required for registered designer access. Guest access does not require a password.</small>
   <Link className="text-link" to="/collection">Back to the collection</Link>
  </dialog>
  <section className={'designer-access '+(exhausted?'exhausted':'')} aria-label="Designer guest access"><div><span className="eyebrow">YOUR DESIGNER ACCESS</span><h2>{exhausted?'Your next chapter starts here.':'Your space, your way.'}</h2><p>{exhausted?'You have used your 3 guest generations. Register and verify your email to continue, or wait for your 24-hour refill.':access?`${access.remaining} of 3 guest generations remaining. Your full allowance refills 24 hours after your first successful generation.`:'Choose your access to begin.'}</p><small>{refill&&<>Full guest refill: {refill} (Pakistan time).<br/></>}Recommendations use your furniture preferences. The room canvas is an illustrative overlay; AI image generation will be available when the rendering service is connected.</small></div><button className="btn" onClick={()=>{setRegister(true);setGuestChosen(false)}}>Register or sign in</button></section>
 </>;
}
