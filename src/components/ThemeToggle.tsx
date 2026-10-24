import {useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
export default function ThemeToggle(){
 const [theme,setTheme]=useState<'light'|'dark'>(()=>document.documentElement.dataset.theme==='dark'?'dark':'light');
 useEffect(()=>{const media=window.matchMedia('(prefers-color-scheme: dark)');const sync=()=>{try{if(!localStorage.getItem('essyra:theme'))setTheme(media.matches?'dark':'light')}catch{setTheme(media.matches?'dark':'light')}};const storage=(e:StorageEvent)=>{if(e.key==='essyra:theme')setTheme(e.newValue==='dark'?'dark':e.newValue==='light'?'light':media.matches?'dark':'light')};media.addEventListener('change',sync);window.addEventListener('storage',storage);return()=>{media.removeEventListener('change',sync);window.removeEventListener('storage',storage)}},[]);
 useEffect(()=>{document.documentElement.dataset.theme=theme;document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#191f1a':'#f7f5ef')},[theme]);
 return <button className="theme-toggle icon-btn" aria-label="Dark mode" aria-pressed={theme==='dark'} title={theme==='dark'?'Switch to light mode':'Switch to dark mode'} onClick={()=>{const next=theme==='dark'?'light':'dark';setTheme(next);try{localStorage.setItem('essyra:theme',next)}catch{/* Theme remains usable when browser storage is unavailable. */}}}>{theme==='dark'?<Sun size={19} aria-hidden="true"/>:<Moon size={19} aria-hidden="true"/>}<span className="sr-only">{theme==='dark'?'Switch to light mode':'Switch to dark mode'}</span></button>;
}
