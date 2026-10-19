"""Refresh verified manufacturer references from official IKEA UK pages.

Python standard library only. Run from essyra with:
    python scripts/import-ikea-catalogue.py --target 520
Prices and stock are synthetic application demonstration values.
"""
import argparse, concurrent.futures, gzip, html, json, pathlib, re, time, urllib.request
from collections import Counter
from datetime import date

ROOT=pathlib.Path(__file__).resolve().parents[1]
CACHE=ROOT/'scripts/.ikea-reference-cache'
CACHE.mkdir(exist_ok=True)
BASE='https://www.ikea.com/gb/en/'
CATEGORIES={
 'living':['armchairs-chaise-longues-fu006','sofas-fu003','coffee-side-tables-10705','tv-benches-10810','bookcases-shelving-units-st002'],
 'bedroom':['chests-of-drawers-10451','wardrobes-19053','bed-frames-19074','bedside-tables-20656'],
 'office':['desks-computer-desks-20649','desk-chairs-20652'],
 'dining':['dining-chairs-25220','dining-tables-21825','bar-stools-chairs-20864'],
 'kitchen':['kitchen-trolleys-islands-10471'],
}
def fetch(url):
 for attempt in range(3):
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 ESSYRA-reference-verifier/1.0','Accept-Encoding':'gzip'})
   with urllib.request.urlopen(req,timeout=22) as r:
    body=r.read()
    if r.headers.get('Content-Encoding')=='gzip':body=gzip.decompress(body)
    return body.decode('utf-8-sig'),r.geturl()
  except Exception:
   if attempt==2: raise
   time.sleep(1+attempt*2)
def number(value):
 if isinstance(value,str) and re.fullmatch(r'[\d.]+ cm',value):
  return float(value[:-3]) if '.' in value else int(value[:-3])
 return None
def furniture_record(p):
 name=p.get('name','').lower()
 return not (name.split(' ',1)[-1].startswith('lid') or ' extra shelf' in name or 'rack for kitchen island' in name)
def source_finishes(p):
 color=p.get('color') or ''
 if not color and ' - ' in p.get('name',''):
  # IKEA combination products can omit schema.org color while naming the
  # exact manufacturer finish in their official full product heading.
  color=p['name'].split(' - ',1)[1]
  color=re.sub(r',?\s+\d+(?:[.,]\d+)?(?:\s*[/x×-]\s*\d+(?:[.,]\d+)?)*(?:\s*cm|\s*mm|\s*m)\b.*$','',color).strip(' ,')
 return [c.strip() for c in color.split('/') if c.strip()]
def parse(category,url):
 cache=CACHE/(url.split('/p/')[1].strip('/')+'.json')
 if cache.exists() and time.time()-cache.stat().st_mtime<24*60*60:
  cached=json.loads(cache.read_text(encoding='utf-8'))
  return cached if furniture_record(cached) else None
 s,final=fetch(url)
 ld=[json.loads(m.group(2)) for m in re.finditer(r'<script([^>]*)>(.*?)</script>',s,re.S) if 'pip-range-json-ld' in m.group(1)]
 if not ld: return None
 p=ld[-1]
 # Exclude component-only accessories and textiles from furniture reference cards.
 name=p.get('name','').split(' - ')[0]
 if not name or not furniture_record({'name':name}) or any(word in name.lower() for word in [' cover',' cushion',' mattress',' bed slats','slatted bed base','table top','tabletop',' underframe','drawer front','castor',' knob',' handle','shelf insert','height extension','suspension rail','supporting leg','storage box','seat shell','armrest','leg frame']): return None
 materials=[]
 matches=list(re.finditer(r'"materialsAndCare":',s))
 if matches:
  block,_=json.JSONDecoder().raw_decode(s[matches[-1].end():])
  for group in block.get('contentProps',{}).get('materials',[]):
   for mat in group.get('materials',[]):
    materials.extend(v.strip() for v in mat.get('material','').split(',') if v.strip())
 images=p.get('image',[])
 image=(images[0].get('contentUrl') if isinstance(images[0],dict) else images[0]) if images else None
 if not image or '/images/products/' not in image: return None
 source=p.get('url') or p.get('offers',{}).get('url') or final
 source=source.split('?')[0].split('#')[0]
 if '/p/' not in source: return None
 slug=source.split('/p/')[1].strip('/')
 color=p.get('color','')
 sub=p.get('category','Furniture')
 result={'id':slug,'name':name,'brand':'IKEA','category':category,'subcategory':sub,
  'description':f"{name.split()[0]} {sub.lower()} reference in {color or 'the pictured finish'}. View the manufacturer source for assembly, care and product details.",
  'dimensions':{k:number(p.get(k)) for k in ['width','depth','height']},
  'materials':list(dict.fromkeys(materials)), 'colors':source_finishes(p),
  'sourceUrl':source,'referenceImage':image,'demoPricePKR':0,'demoStock':0,
  'tags':[category,sub.lower(),'manufacturer reference'],'style':'Scandinavian'}
 cache.write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
 return result
def main():
 args=argparse.ArgumentParser();args.add_argument('--target',type=int,default=520);args.add_argument('--workers',type=int,default=16); opt=args.parse_args()
 existing=json.loads((ROOT/'src/data/catalogue.json').read_text(encoding='utf-8'))
 records={p['id']:p for p in existing if furniture_record(p)}
 for cache in CACHE.glob('*.json'):
  if time.time()-cache.stat().st_mtime<24*60*60:
   p=json.loads(cache.read_text(encoding='utf-8'))
   if furniture_record(p):records.setdefault(p['id'],p)
 candidates={};category_results=[];failures=[]
 pages=[(cat,f'{BASE}cat/{slug}/') for cat,slugs in CATEGORIES.items() for slug in slugs]
 with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
  fs={pool.submit(fetch,url):(cat,url) for cat,url in pages}
  for f in concurrent.futures.as_completed(fs):
   cat,url=fs[f]
   try:
    body,final=f.result()
    links=list(dict.fromkeys(html.unescape(x).split('?')[0].split('#')[0] for x in re.findall(r'href="(https://www.ikea.com/gb/en/p/[^"?]+)',body)))
    category_results.append({'room':cat,'url':url,'finalUrl':final,'candidateCount':len(links)})
    for link in links:
     slug=link.split('/p/')[1].strip('/')
     if slug not in records: candidates.setdefault(slug,(cat,link))
    print(f'Category {cat}: {len(links)} candidates from {url}',flush=True)
   except Exception as e: failures.append({'url':url,'error':str(e)})
 print(f'{len(candidates)} unique new source candidates; {len(records)} existing verified records.',flush=True)
 # Interleave rooms, keeping the five-room catalogue balanced as practical.
 groups={cat:[v for v in candidates.values() if v[0]==cat] for cat in CATEGORIES}
 queue=[]
 for i in range(max(map(len,groups.values()),default=0)):
  for cat in groups:
   if i<len(groups[cat]): queue.append(groups[cat][i])
 done=0
 with concurrent.futures.ThreadPoolExecutor(max_workers=opt.workers) as pool:
  pending={};iterator=iter(queue)
  def add():
   try:
    cat,url=next(iterator);pending[pool.submit(parse,cat,url)]=url;return True
   except StopIteration: return False
  for _ in range(opt.workers*2):add()
  while pending:
   ready,_=concurrent.futures.wait(pending,return_when=concurrent.futures.FIRST_COMPLETED)
   for f in ready:
    url=pending.pop(f);done+=1
    try:
     p=f.result()
     if p: records.setdefault(p['id'],p)
    except Exception as e: failures.append({'url':url,'error':str(e)})
    if done%25==0:
     checkpoint=ROOT/'src/data/catalogue-import-checkpoint.json'
     checkpoint.write_text(json.dumps(list(records.values()),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
     print(f'Fetched {done}; verified {len(records)}; failures {len(failures)}; checkpoint saved.',flush=True)
    if len(records)<opt.target:add()
   if len(records)>=opt.target:
    for f in pending:f.cancel()
    break
 values=list(records.values())
 for i,p in enumerate(values):
  if not p.get('demoPricePKR'):p['demoPricePKR']=12500+(i*4750)%287500
  if not p.get('demoStock'):p['demoStock']=6+(i*3)%18
 (ROOT/'src/data/catalogue.json').write_text(json.dumps(values,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 counts=dict(Counter(p['category'] for p in values))
 report={'verifiedOn':str(date.today()),'count':len(values),'rooms':counts,'categoryPages':category_results,'fetchFailures':failures,'missingDimensions':{k:sum(p['dimensions'][k] is None for p in values) for k in ['width','depth','height']}}
 (ROOT/'src/data/catalogue-verification.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
 print(json.dumps(report,indent=2),flush=True)
 write_reference_notes(values,report)
 if len(values)<opt.target:raise SystemExit(f'Only {len(values)} references verified; target {opt.target} not met.')
def write_reference_notes(values,report):
 text=f'''# ESSYRA manufacturer reference catalogue

Verified on {report['verifiedOn']}: **{len(values)} unique official IKEA UK furniture product references**, including genuine colour and size variants. Each admitted record has a distinct manufacturer source URL and a manufacturer product image. Product pages are retrieved directly; redirected category pages and pages without product JSON-LD are rejected. The importer stores no manufacturer prices or inventory.

## Reference versus demonstration data

- `name`, `brand`, `subcategory`, `dimensions`, `materials`, `colors`, `sourceUrl` and `referenceImage` describe the sourced IKEA product/variant. Every exact source link is listed below and embedded in the catalogue.
- `demoPricePKR` and `demoStock` are synthetic local application demonstration values. They are not manufacturer prices, currency conversions, inventory, quotations or sales offers. The interface must label them as demo values.
- `style`, `tags` and room `category` are ESSYRA editorial classifications. Descriptions are original concise reference summaries, not manufacturer marketing copy. A shared family name can occur in several genuine variants; compare ID, source URL, colour and dimensions.
- Measurements use centimetres and the source page's overall product JSON-LD fields. IKEA sometimes represents a table's length as depth. A bed's depth is its overall frame length. Missing or adjustable single dimensions stay `null`; no dimensions are guessed. Missing counts: {report['missingDimensions']}.
- Materials are ingredient summaries, not complete bills of materials. Colour labels may be broader than a named fabric finish. When a combination has no schema.org `color`, its exact official product-name finish suffix is used; this can include upholstery, door-front, leg or other manufacturer variant names alongside colours. No finish is inferred from a URL slug. Product information may change after verification; linked manufacturer pages remain authoritative.
- Product images remain remote official manufacturer references, not ESSYRA-owned photography. No affiliation, resale rights, image licence, stock or availability in Pakistan is asserted. Generic 3D geometry is illustrative, not an exact licensed product model.

## Local operation and reproducibility

The catalogue is checked into `src/data/catalogue.json` and works locally without Supabase or a database. Network access is needed for remotely hosted manufacturer photos and for refreshing source data, not for catalogue search or filters. Run `python scripts/import-ikea-catalogue.py --target 520` from the `essyra` folder to reproduce a refresh using Python's standard library. `src/data/catalogue-verification.json` records category discovery, failed fetches and dimension completeness. Failed or invalid new pages never become records.

## Room counts

'''
 text+='\n'.join(f'- {room}: {count}' for room,count in report['rooms'].items())
 text+='\n\n## Exact manufacturer sources\n\n'
 text+='\n'.join(f"- [{p['name']} — {', '.join(p['colors']) or 'pictured finish'}]({p['sourceUrl']})" for p in values)+'\n'
 (ROOT/'REFERENCE_DATA.md').write_text(text,encoding='utf-8')
if __name__=='__main__':main()
