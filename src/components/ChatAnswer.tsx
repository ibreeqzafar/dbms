import {Link} from 'react-router-dom';
import {chatHref,tableCells,tableDivider} from '../lib/chat-format';
function Inline({text}:{text:string}){
 const pieces=text.split(/(\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^\s)]+\)|https:\/\/[^\s<>|]+)/g);
 return <>{pieces.map((piece,i)=>{if(piece.startsWith('**')&&piece.endsWith('**'))return <strong key={i}>{piece.slice(2,-2)}</strong>;const marked=piece.match(/^\[([^\]]+)\]\(([^)]+)\)$/);const value=marked?.[2]||piece.replace(/[.,;)]+$/,'');const href=chatHref(value);if(href&&(marked||piece.startsWith('https://')))return <Link key={i} to={href}>{marked?.[1]||'View '+(href.startsWith('/product/')?'product':href.split('/')[1])}</Link>;return piece})}</>;
}
export default function ChatAnswer({text}:{text:string}){
 const lines=text.slice(0,5000).split('\n'),blocks=[];
 for(let i=0;i<lines.length;){
  if(!lines[i].trim()){i++;continue}
  if(lines[i].includes('|')&&i+1<lines.length&&tableDivider(lines[i+1])){
   const head=tableCells(lines[i]);i+=2;const rows:string[][]=[];while(i<lines.length&&lines[i].includes('|')){if(rows.length<8)rows.push(tableCells(lines[i]));i++}
   blocks.push(<div className="chat-ai-table" key={'table-'+i} role="region" aria-label="Assistant product details" tabIndex={0}><table><thead><tr>{head.map((cell,j)=><th key={j} scope="col"><Inline text={cell}/></th>)}</tr></thead><tbody>{rows.map((row,j)=><tr key={j}>{head.map((_,k)=><td key={k}><Inline text={row[k]||'—'}/></td>)}</tr>)}</tbody></table></div>);continue;
  }
  if(/^\s*[-*]\s+/.test(lines[i])){const entries=[];while(i<lines.length&&/^\s*[-*]\s+/.test(lines[i])){entries.push(lines[i].replace(/^\s*[-*]\s+/,''));i++}blocks.push(<ul key={'list-'+i}>{entries.map((line,j)=><li key={j}><Inline text={line}/></li>)}</ul>);continue}
  const paragraph=[];while(i<lines.length&&lines[i].trim()&&!(lines[i].includes('|')&&i+1<lines.length&&tableDivider(lines[i+1]))&&!/^\s*[-*]\s+/.test(lines[i])){paragraph.push(lines[i].replace(/^#{1,4}\s+/,''));i++}
  blocks.push(<p key={'paragraph-'+i}><Inline text={paragraph.join('\n')}/></p>);
 }
 return <div className="chat-formatted-answer">{blocks}</div>;
}
