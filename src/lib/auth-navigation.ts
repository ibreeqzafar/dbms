/** Only allow a local route after sign-in, never an external redirect. */
export function safeReturnPath(value:string|null){return value&&value.startsWith('/')&&!value.startsWith('//')&&!/[\\\u0000-\u0020]/.test(value)&&!value.startsWith('/account')?value:'/'}

/** Report OAuth failures without reflecting provider details or codes into the page. */
export function oauthReturnError(search:string,hash:string){
 const query=new URLSearchParams(search),fragment=new URLSearchParams(hash.replace(/^#/,''));
 const code=query.get('error')||fragment.get('error');
 if(!code)return '';
 return code==='access_denied'?'Google sign-in was cancelled or access was denied. Try again or sign in with email.':'Google could not complete sign-in. Try again or sign in with email. If this repeats, contact ESSYRA support.';
}
