import concurrent.futures,importlib.util,json,pathlib,re,html,sys
ROOT=pathlib.Path.cwd();spec=importlib.util.spec_from_file_location('original',ROOT/'scripts/import-ikea-catalogue.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
records=json.loads((ROOT/'src/data/catalogue.json').read_text(encoding='utf-8'));known={p['id'] for p in records};added=[];failures=[]
groups={
'beds':('bedroom',20,['beds-bm003','double-beds-16284']),
'sofas':('living',15,['sofas-fu003','two-seat-sofas-10668','corner-sofas-10671']),
'kitchen':('kitchen',15,['kitchen-trolleys-islands-10471','kitchen-wall-storage-20676','kitchen-cabinets-700292']),
'office':('office',15,['desks-computer-desks-20649','office-storage-20650','desk-chairs-20652'])}
if '--beds-only' in sys.argv:groups={'beds':('bedroom',16,['single-beds-16285','upholstered-beds-49096','beds-with-storage-25205'])}
report={}
for group,(room,target,pages) in groups.items():
 urls=[]
 for page in pages:
  try:
   body,_=m.fetch(m.BASE+'cat/'+page+'/');urls.extend(html.unescape(x).split('?')[0].split('#')[0] for x in re.findall(r'href="(https://www.ikea.com/gb/en/p/[^"?]+)',body))
  except Exception as e:failures.append({'page':page,'error':str(e)})
 urls=list(dict.fromkeys(u for u in urls if u.split('/p/')[1].strip('/') not in known));count=0
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
  futures={pool.submit(m.parse,room,url):url for url in urls[:130]}
  for f in concurrent.futures.as_completed(futures):
   try:
    p=f.result()
    if not p or not p['materials'] or not p['colors'] or p['id'] in known:continue
    if group=='beds' and not re.search(r'\bbed\b|\bbeds\b|bunk|divan',p['name']+' '+p['subcategory'],re.I):continue
    if group=='sofas' and not re.search(r'sofa|chaise',p['name'],re.I):continue
    if count>=target:continue
    p['demoPricePKR']={'beds':55000,'sofas':65000,'kitchen':8500,'office':15000}[group]+count*2750;p['demoStock']=6+count%9
    records.append(p);added.append(p['id']);known.add(p['id']);count+=1
   except Exception as e:failures.append({'url':futures[f],'error':str(e)})
 report[group]=count;print(group,count,flush=True)
# Prefer assembled-product measurement names, never packaging measurements.
def fill(p):
 body,_=m.fetch(p['sourceUrl']);values={}
 for hit in re.finditer(r'"measurements":',body):
  try:items,_=json.JSONDecoder().raw_decode(body[hit.end():])
  except Exception:continue
  if isinstance(items,list):
   for item in items:
    if isinstance(item,dict) and 'measure' in item and 'name' in item:
     value=m.number(item['measure'])
     if value:values[item['name'].lower()]=value
 d=p['dimensions']
 choices={'width':['width','max. width','diameter'],'depth':['depth','length','max. depth','diameter'],'height':['height','max. height','headboard height','height including back cushions']}
 for axis,names in choices.items():
  if d[axis] is None:
   d[axis]=next((values[n] for n in names if n in values),None)
 return p
missing=[p for p in records if any(v is None for v in p['dimensions'].values())]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 fs={pool.submit(fill,p):p for p in missing}
 for f in concurrent.futures.as_completed(fs):
  try:f.result()
  except Exception as e:failures.append({'url':fs[f]['sourceUrl'],'error':str(e)})
for p in records:
 axes=[k for k,v in p['dimensions'].items() if v is None]
 if not axes:continue
 text=(p['name']+' '+p['subcategory']).lower()
 if re.search(r'bed|bunk|divan',text):fallback=[160,210,100]
 elif re.search(r'sofa|chaise',text):fallback=[210,95,85]
 elif re.search(r'chair|stool',text):fallback=[60,60,95]
 elif 'desk' in text:fallback=[140,70,75]
 elif 'table' in text:fallback=[100,60,75]
 elif re.search(r'cabinet|wardrobe|shelv|bookcase',text):fallback=[80,40,180]
 elif re.search(r'trolley|island',text):fallback=[80,45,90]
 else:fallback=[80,45,80]
 for axis,value in zip(['width','depth','height'],fallback):
  if axis in axes:p['dimensions'][axis]=value
 p['dimensionEstimates']=axes
(ROOT/'src/data/catalogue.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
prior_path=ROOT/'src/data/catalogue-expansion-report.json'
prior=json.loads(prior_path.read_text(encoding='utf-8')) if prior_path.exists() else {}
combined={k:prior.get('added',{}).get(k,0)+report.get(k,0) for k in set(prior.get('added',{}))|set(report)}
prior_path.write_text(json.dumps({'added':combined,'newIds':prior.get('newIds',[])+added,'estimatedProducts':sum(bool(p.get('dimensionEstimates')) for p in records),'failures':prior.get('failures',[])+failures},indent=2),encoding='utf-8')
print('TOTAL',len(records),'ADDED',report,'ESTIMATED',sum(bool(p.get('dimensionEstimates')) for p in records),flush=True)
