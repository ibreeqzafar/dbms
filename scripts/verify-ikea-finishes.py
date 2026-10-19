"""Fill missing finish labels only from exact official product JSON-LD names."""
import concurrent.futures,importlib.util,json,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('catalogue_importer',ROOT/'scripts/import-ikea-catalogue.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
path=ROOT/'src/data/catalogue.json'
records=json.loads(path.read_text(encoding='utf-8'))
missing=[p for p in records if not p['colors']]
def verify(record):
 body,final=module.fetch(record['sourceUrl'])
 products=[json.loads(m.group(2)) for m in re.finditer(r'<script([^>]*)>(.*?)</script>',body,re.S) if 'pip-range-json-ld' in m.group(1)]
 if not products:return {'id':record['id'],'sourceUrl':record['sourceUrl'],'colors':[],'reason':'No product JSON-LD found'}
 p=products[-1]
 return {'id':record['id'],'sourceUrl':record['sourceUrl'],'sourceProductName':p.get('name'),'colors':module.source_finishes(p)}
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
 futures={pool.submit(verify,p):p for p in missing}
 for f in concurrent.futures.as_completed(futures):
  p=futures[f]
  try:
   result=f.result();p['colors']=result['colors'];results.append(result)
   cache=module.CACHE/(p['id']+'.json')
   if cache.exists():
    data=json.loads(cache.read_text(encoding='utf-8'));data['colors']=p['colors'];cache.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
   print(f"Verified {len(results)}/{len(missing)}: {p['id']} -> {p['colors']}",flush=True)
  except Exception as e:results.append({'id':p['id'],'sourceUrl':p['sourceUrl'],'colors':[],'reason':str(e)})
path.write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
report_path=ROOT/'src/data/catalogue-verification.json'
report=json.loads(report_path.read_text(encoding='utf-8'))
report['finishVerification']={'initiallyEmpty':len(missing),'filledFromOfficialProductNames':sum(bool(p['colors']) for p in results),'remainingEmpty':sum(not p['colors'] for p in records),'sources':results}
report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
module.write_reference_notes(records,report)
print('Remaining empty finish arrays:',sum(not p['colors'] for p in records),flush=True)
