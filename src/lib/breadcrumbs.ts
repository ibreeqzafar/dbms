import {roomNames} from './domain.ts';
import {furnitureCategories} from './categories.ts';
export type Breadcrumb={label:string;href:string};
export function collectionBreadcrumbs(search:string):Breadcrumb[]{
 const params=new URLSearchParams(search),room=params.get('room')||'',type=furnitureCategories.find(c=>c.slug===params.get('type')),sale=params.get('sale')==='1';
 const validRoom=Object.hasOwn(roomNames,room)?room as keyof typeof roomNames:null;
 const trail:Breadcrumb[]=[{label:'Home',href:'/'}];
 if(sale)trail.push({label:'Sale',href:'/collection?sale=1'});
 if(validRoom)trail.push({label:roomNames[validRoom],href:'/collection?room='+validRoom+(sale?'&sale=1':'')});
 if(type){const query=new URLSearchParams();if(validRoom)query.set('room',validRoom);query.set('type',type.slug);if(sale)query.set('sale','1');trail.push({label:type.label,href:'/collection?'+query})}
 if(trail.length===1)trail.push({label:'All furniture',href:'/collection'});
 return trail;
}
