import {Link} from 'react-router-dom';
import {ArrowUpRight} from 'lucide-react';
import HomeExperience from './HomeExperience';
import {roomNames} from '../lib/domain';
export default function HousePage(){return <><HomeExperience standalone/><section id="after-experience" className="wrap section house-edits"><span className="eyebrow">FROM INSPIRATION TO YOUR OWN SPACE</span><div className="section-heading"><h2>Take the feeling<br/><em>home.</em></h2><Link className="text-link" to="/studio">Design your room <ArrowUpRight size={18}/></Link></div><div className="house-edit-links">{Object.entries(roomNames).map(([slug,name])=><Link key={slug} to={'/collection?room='+slug}>{name}<ArrowUpRight size={18}/></Link>)}</div><p className="caption">Explore the furniture collection by room, or try the <Link to="/walkthrough/layout">interactive layout study</Link>.</p></section></>}
