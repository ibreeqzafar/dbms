export function suggestStrongPassword(){
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';
 const cutoff=256-(256%alphabet.length);
 let password='';
 do{
  password='';
  while(password.length<20){for(const byte of crypto.getRandomValues(new Uint8Array(32))){if(byte<cutoff)password+=alphabet[byte%alphabet.length];if(password.length===20)break}}
 }while(!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password)||!/[!@#$%&*?]/.test(password));
 return password;
}
