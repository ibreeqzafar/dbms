import hashlib,json,pathlib,subprocess
ROOT=pathlib.Path.cwd();current=json.loads((ROOT/'src/data/catalogue.json').read_text(encoding='utf-8'));old={p['id']:p for p in json.loads(subprocess.check_output(['git','show','HEAD:src/data/catalogue.json']).decode('utf-8'))}
def uuid(s):
 h=hashlib.sha256(s.encode()).hexdigest();return f'{h[:8]}-{h[8:12]}-4{h[13:16]}-a{h[17:20]}-{h[20:32]}'
def q(s):return "'"+str(s).replace("'","''")+"'"
rows=[]
for p in current:
 if p['id'] in old and p['dimensions']==old[p['id']]['dimensions'] and p.get('dimensionEstimates')==old[p['id']].get('dimensionEstimates'):continue
 rows.append(p)
# Chunks keep the dashboard editor responsive and each chunk is independently atomic.
for start in range(0,len(rows),35):
 sql='begin;\n'
 for p in rows[start:start+35]:
  dims=p['dimensions'];est=p.get('dimensionEstimates',[]);pid=uuid('product:'+p['id']);vid=uuid(p['id']+':'+ ' / '.join(p['colors']))
  if p['id'] not in old:
   ref={k:v for k,v in p.items() if k not in ['demoPricePKR','demoStock']}
   sql+=f"insert into public.products(id,slug,category_id,name,brand,reference,source_url,demo_price_paisa) values('{pid}',{q(p['id'])},'{uuid('category:'+p['category'])}',{q(p['name'])},'IKEA',{q(json.dumps(ref,ensure_ascii=False))}::jsonb,{q(p['sourceUrl'])},{round(p['demoPricePKR']*100)}) on conflict(slug) do nothing;\n"
   sql+=f"insert into public.variants(id,product_id,sku,color,materials,width_cm,depth_cm,height_cm,price_paisa,stock_on_hand) values('{vid}','{pid}',{q('ESS-'+p['id'].upper())},{q(' / '.join(p['colors']))},array[{','.join(q(x) for x in p['materials'])}]::text[],{dims['width']},{dims['depth']},{dims['height']},{round(p['demoPricePKR']*100)},{p['demoStock']}) on conflict(sku) do nothing;\n"
   sql+=f"insert into public.product_media(id,variant_id,url,alt,source_url) values('{uuid('media:'+vid)}','{vid}',{q(p['referenceImage'])},{q('ESSYRA '+p['name'])},{q(p['sourceUrl'])}) on conflict(id) do nothing;\n"
  else:
   sql+=f"update public.products set reference=jsonb_set(jsonb_set(reference,'{{dimensions}}',{q(json.dumps(dims))}::jsonb),'{{dimensionEstimates}}',{q(json.dumps(est))}::jsonb) where slug={q(p['id'])};\n"
   sql+=f"update public.variants set width_cm={dims['width']},depth_cm={dims['depth']},height_cm={dims['height']} where product_id=(select id from public.products where slug={q(p['id'])});\n"
 sql+="update public.categories set name='Office' where slug='office';\ncommit;\n"
 (ROOT/f'scripts/catalogue-expansion-{start//35+1}.sql').write_text(sql,encoding='utf-8')
print('Prepared',len(rows),'new or corrected products in',(len(rows)+34)//35,'SQL batches')
