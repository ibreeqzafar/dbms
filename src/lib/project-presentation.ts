// Presentation aliases for explicitly identified generated records. Database keys stay unchanged.
export function projectId(id:string){
 const match=/^TEST-([COR])(\d+)$/.exec(id);
 if(!match)return id;
 const prefix={C:'CUS',O:'ESS',R:'REV'}[match[1] as 'C'|'O'|'R'];
 return `${prefix}-2026-${match[2].padStart(6,'0')}`;
}
export function projectIdentity(id:string){
 const first=['Amina','Zara','Hassan','Sara','Ali','Noor','Hamza','Hira','Usman','Maryam'];
 const last=['Farooq','Malik','Ahmed','Khan','Rehman','Siddiqui','Ali','Hussain','Raza','Noor','Sheikh','Qureshi'];
 const n=Number(/^TEST-C(\d+)$/.exec(id)?.[1]||1),index=Math.max(0,n-1),given=first[index%first.length],family=last[Math.floor(index/first.length)%last.length];
 return {name:`${given} ${family}`,email:`${given.toLowerCase()}.${family.toLowerCase()}${n}@example.com`};
}
