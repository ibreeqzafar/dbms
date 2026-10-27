"""Add distinct public references in missing furniture categories; preserve existing rows."""
import collections,importlib.util,json,pathlib,re
root=pathlib.Path.cwd()
spec=importlib.util.spec_from_file_location('homelo_helpers',root/'scripts/import-homelo-catalogue.py');helpers=importlib.util.module_from_spec(spec);spec.loader.exec_module(helpers)
existing=json.loads((root/'src/data/catalogue.json').read_text(encoding='utf-8'));known={p['id'] for p in existing}
raw=[]
for n in [1,2]:raw+=json.loads((root/f'scripts/.homelo-reference-cache/expansion-page{n}.json').read_text(encoding='utf-8'))['products']
def group(p):
 t=(p['title']+' '+p['product_type']).lower()
 if re.search(r'\bkids?\b|toddle|newborn|nursery',t):return ('kids','bedroom',"Kids' furniture",[80,45,120])
 if re.search('vanity|dresser',t):return ('vanities','bedroom','Dressing tables & vanities',[110,45,140])
 if 'mirror' in t:return ('mirrors','bedroom','Mirrors',[65,4,170] if re.search('floor|full.length|standing|tall',t) else [65,4,90])
 if re.search('shoe.?rack|hallway|entryway',t):return ('entryway','living','Entryway & shoe storage',[100,35,85])
 if 'bench' in t:return ('benches','living','Benches',[140,45,48])
 if re.search(r'\btv\b|media stand|media console',t):return ('media','living','TV units & media consoles',[140,40,50])
 if 'console' in t:return ('entryway','living','Entryway consoles',[120,35,80])
 return None
targets={'mirrors':25,'vanities':10,'entryway':12,'benches':7,'kids':8,'media':8};pools=collections.defaultdict(list)
for p in raw:
 g=group(p)
 if g and p['handle'] not in known and p.get('images') and p.get('variants') and float(p['variants'][0]['price'])>0:pools[g[0]].append((p,g))
selected=[]
for key,count in targets.items():selected+=pools[key][:count]
seen=set();selected=[(p,g) for p,g in selected if not(p['handle'] in seen or seen.add(p['handle']))]
assert len(selected)>=50,'Insufficient distinct complementary products'
added=[]
for source,g in selected:
 kind,room,subcategory,fallback=g
 p=helpers.record(source,('chairs' if kind=='benches' else 'storage',room,subcategory))
 for axis,value in zip(['width','depth','height'],fallback):
  if axis in p.get('dimensionEstimates',[]):p['dimensions'][axis]=value
 p['tags']=[kind,subcategory.lower(),p['style'].lower()];added.append(p)
assert not known.intersection(p['id'] for p in added)
(root/'src/data/catalogue.json').write_text(json.dumps(existing+added,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def uid(s):
 import hashlib
 h=hashlib.sha256(s.encode()).hexdigest();return f'{h[:8]}-{h[8:12]}-4{h[13:16]}-a{h[17:20]}-{h[20:32]}'
def q(s):return "'"+str(s).replace("'","''")+"'"
chunks=[]
for start in range(0,len(added),20):
 sql='-- Add complementary catalogue categories. Existing stock, prices and orders are preserved.\nbegin;\n'
 for p in added[start:start+20]:
  pid=uid('product:'+p['id']);color=' / '.join(p['colors']);vid=uid(p['id']+':'+color);d=p['dimensions'];ref={k:v for k,v in p.items() if k not in ['demoPricePKR','demoStock']}
  sql+=f"insert into public.products(id,slug,category_id,name,brand,reference,source_url,demo_price_paisa) values('{pid}',{q(p['id'])},'{uid('category:'+p['category'])}',{q(p['name'])},'HOMELO',{q(json.dumps(ref,ensure_ascii=False,separators=(',',':')))}::jsonb,{q(p['sourceUrl'])},{round(p['demoPricePKR']*100)}) on conflict(slug) do nothing;\n"
  sql+=f"insert into public.variants(id,product_id,sku,color,materials,width_cm,depth_cm,height_cm,price_paisa,stock_on_hand) values('{vid}','{pid}',{q('ESS-'+p['id'].upper())},{q(color)},array[{','.join(q(m) for m in p['materials'])}]::text[],{d['width']},{d['depth']},{d['height']},{round(p['demoPricePKR']*100)},8) on conflict(sku) do nothing;\n"
  sql+=f"insert into public.product_media(id,variant_id,url,alt,source_url) values('{uid('media:'+vid)}','{vid}',{q(p['referenceImage'])},{q('ESSYRA '+p['name']+', '+color)},{q(p['sourceUrl'])}) on conflict(id) do nothing;\n"
 sql+='commit;\n';chunks.append(sql);(root/f'scripts/homelo-category-expansion-{start//20+1}.sql').write_text(sql,encoding='utf-8')
(root/'supabase/migrations/202610260010_complementary_catalogue.sql').write_text('\n'.join(chunks),encoding='utf-8')
report={'retrievedAt':'2026-10-26','added':len(added),'total':len(existing+added),'groups':dict(collections.Counter(g[0] for p,g in selected)),'notes':'First source configuration and PKR price. Stock is synthetic for this university project. Missing dimensions are explicitly marked as estimates. No retailer delivery or warranty promises copied.','products':[{'slug':p['id'],'sourceProductId':source['id'],'sourceVariantId':source['variants'][0]['id'],'sourceUrl':p['sourceUrl']} for p,(source,g) in zip(added,selected)]}
(root/'src/data/homelo-category-expansion-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:report[k] for k in ['added','total','groups']},indent=2))
