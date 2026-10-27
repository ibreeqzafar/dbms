"""Import 150 public Homelo references; retain facts, not retailer marketing prose.

Fetch input with: curl.exe -L https://homelo.pk/products.json?limit=250&page=1
Store it at scripts/.homelo-reference-cache/page1.json before running this script.
Existing catalogue rows, prices and inventory are never modified.
"""
import collections, hashlib, html, json, pathlib, re

ROOT = pathlib.Path.cwd()
raw = json.loads((ROOT/'scripts/.homelo-reference-cache/page1.json').read_text(encoding='utf-8'))['products']
catalogue_path = ROOT/'src/data/catalogue.json'
existing = json.loads(catalogue_path.read_text(encoding='utf-8'))
baseline = [p for p in existing if not p['sourceUrl'].startswith('https://homelo.pk/')]

def plain(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', ' ', s or ''))).strip()

def group(p):
    title=p['title'].lower(); kind=p['product_type'].lower()
    if 'mirror' in title or 'mirror' in kind: return None
    if re.search(r'\bbed\b|\bbeds\b',title) and not re.search(r'bedside|day bed|sofa',title): return ('beds','bedroom','Beds')
    if re.search(r'kitchen|pantry|bar stool',title+' '+kind): return ('kitchen','kitchen','Kitchen islands' if 'island' in title else 'Kitchen storage' if re.search('cabinet|pantry',title+' '+kind) else 'Counter stools')
    if re.search('desk|study table|book ?shelf',title): return ('office','office','Office desks' if re.search('desk|study table',title) else 'Bookshelves')
    if 'dining' in title or 'dinning' in title or 'dining' in kind: return ('dining','dining','Dining chairs' if 'chair' in title and not re.search('set|table',title) else 'Dining sets')
    if re.search('chair|stool|bench',title): return ('chairs','living','Benches' if 'bench' in title else 'Chairs & armchairs')
    if 'sofa' in title or 'sofa' in kind: return ('sofas','living','Sofas')
    if re.search('cabinet|wardrobe|drawers|sideboard|console|shoe.?rack|dresser|vanity|shelf|shelves',title+' '+kind):
        room='bedroom' if re.search('wardrobe|dresser|vanity',title+' '+kind) else 'living'
        return ('storage',room,'Storage cabinets' if 'cabinet' in title else 'Wardrobes' if 'wardrobe' in title else 'Sideboards & storage')
    if re.search('table|nightstand',title+' '+kind): return ('tables','bedroom' if re.search('nightstand|bedside',title) else 'living','Coffee tables' if 'coffee' in title else 'Side tables')
    return None

def dimensions(p,g):
    text=plain(p.get('body_html')).replace('\u201d','"').replace('\u201c','"').replace('\u2033','"')
    marker=re.search(r'\b(?:dimensions|overall size|size)\s*:',text,re.I)
    region=text[marker.end():marker.end()+450] if marker else text
    region=re.split(r'chair dimensions|mattress|perfect for|delivery',region,flags=re.I)[0]
    result={}; labels={'w':'width','width':'width','d':'depth','depth':'depth','l':'depth','length':'depth','h':'height','height':'height'}
    number=r'(\d+(?:\.\d+)?)'; units=r'(cm|centimet(?:er|re)s?|inches|inch|in|\")'
    # Both 60" W and Width: 60 inches are common in this source.
    for pattern,postfix in [(rf'{number}\s*{units}\s*(width|depth|height|length|w|d|h|l)\b',True),(rf'\b(width|depth|height|length|w|d|h|l)\s*[:=]?\s*{number}\s*{units}',False)]:
        for m in re.finditer(pattern,region,re.I):
            value,unit,label=m.groups() if postfix else (m.group(2),m.group(3),m.group(1))
            axis=labels[label.lower()]; value=float(value)*(1 if unit.lower().startswith('c') else 2.54)
            if 1<=value<=700 and axis not in result: result[axis]=round(value,1)
    fallback={'beds':[193,218,110],'sofas':[220,95,85],'kitchen':[100,55,90],'office':[140,65,76],'dining':[180,90,76],'storage':[120,42,90],'chairs':[65,65,85],'tables':[80,55,48]}[g]
    if g=='office' and 'shelf' in p['title'].lower(): fallback=[90,35,180]
    if g=='chairs' and 'bench' in p['title'].lower(): fallback=[140,50,48]
    if g=='dining' and 'chair' in p['title'].lower() and 'table' not in p['title'].lower(): fallback=[55,58,85]
    if g=='storage' and 'wardrobe' in p['title'].lower(): fallback=[100,55,180]
    estimates=[axis for axis in ['width','depth','height'] if axis not in result]
    return {axis:result.get(axis,value) for axis,value in zip(['width','depth','height'],fallback)},estimates

def record(p,g):
    kind,room,subcategory=g; text=(p['title']+' '+plain(p.get('body_html'))).lower()
    name=re.sub(r'^HOMELO\s+', '',plain(p['title']),flags=re.I).replace('||',' ').replace('  ',' ').strip()
    if p['handle']=='square-bubble-boucle-bed': name='Square Bubble Bouclé Bed'
    base=p['variants'][0]; price=float(base['price'])
    colors=[]; configuration=[]
    for i,option in enumerate(p.get('options',[]),1):
        value=base.get('option'+str(i))
        if not value or value=='Default Title': continue
        if option['name'].lower() in ['color','colour']: colors.append(value.lower())
        elif option['name'].lower()!='title': configuration.append(value)
    if not colors: colors=['As pictured']
    material_patterns=[('Bouclé',r'boucl[eé]'),('Velvet',r'velvet'),('Leather',r'leather'),('MDF',r'\bmdf\b'),('Engineered wood',r'engineered wood'),('Solid wood',r'solid (?:hard)?wood'),('Sheesham wood',r'sheesham'),('Teak wood',r'teak'),('Oak',r'\boak\b'),('Iron',r'\biron\b'),('Steel',r'\bsteel\b'),('Metal',r'\bmetal\b'),('Rattan / cane',r'rattan|\bcane\b'),('Marble',r'\bmarble\b'),('Foam',r'\bfoam\b'),('Polyester',r'polyester'),('Linen blend',r'linen.blend'),('Glass',r'\bglass\b')]
    materials=[label for label,pattern in material_patterns if re.search(pattern,text)] or ['Material not specified']
    dims,estimates=dimensions(p,kind)
    image=p['images'][0]['src']; image+=('&' if '?' in image else '?')+'width=1000'
    style='Mid-century modern' if 'mid-century' in text else 'Japandi' if 'japandi' in text else 'Scandinavian' if 'scandinavian' in text else 'Contemporary'
    result={'id':p['handle'],'name':name,'brand':'HOMELO','category':room,'subcategory':subcategory,'description':f'{name}. {subcategory} for a considered {room} space.','dimensions':dims,'materials':materials,'colors':colors,'sourceUrl':'https://homelo.pk/products/'+p['handle'],'referenceImage':image,'demoPricePKR':price,'demoStock':8,'tags':[kind,subcategory.lower(),style.lower()],'style':style}
    if configuration: result['configuration']=' / '.join(configuration)
    if estimates: result['dimensionEstimates']=estimates
    return result

def main():
    pools=collections.defaultdict(list)
    known={p['id'] for p in baseline}
    for p in raw:
        g=group(p)
        if not g or not p.get('images') or not p.get('variants') or float(p['variants'][0]['price'])<=0 or p['handle'] in known: continue
        pools[g[0]].append((p,g))
    targets={'beds':35,'sofas':25,'kitchen':15,'office':15,'dining':20,'storage':20,'chairs':10,'tables':10}
    selected=[]
    for kind,target in targets.items(): selected.extend(pools[kind][:target])
    selected_ids={p['handle'] for p,g in selected}
    for p in raw:
        if len(selected)>=150: break
        g=group(p)
        if g and p['handle'] not in selected_ids and any(x[0]['handle']==p['handle'] for x in pools[g[0]]): selected.append((p,g));selected_ids.add(p['handle'])
    assert len(selected)==150
    added=[record(p,g) for p,g in selected]
    assert 'square-bubble-boucle-bed' in {p['id'] for p in added}
    assert len({p['id'] for p in baseline+added})==len(baseline)+150
    catalogue_path.write_text(json.dumps(baseline+added,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    def uid(s):
        h=hashlib.sha256(s.encode()).hexdigest();return f'{h[:8]}-{h[8:12]}-4{h[13:16]}-a{h[17:20]}-{h[20:32]}'
    def q(s): return "'"+str(s).replace("'","''")+"'"
    chunks=[]
    for start in range(0,150,30):
        sql='-- Additive Homelo reference import; existing prices, stock and orders are preserved.\nbegin;\n'
        for p in added[start:start+30]:
            pid=uid('product:'+p['id']);color=' / '.join(p['colors']);vid=uid(p['id']+':'+color);d=p['dimensions'];ref={k:v for k,v in p.items() if k not in ['demoPricePKR','demoStock']}
            sql+=f"insert into public.products(id,slug,category_id,name,brand,reference,source_url,demo_price_paisa) values('{pid}',{q(p['id'])},'{uid('category:'+p['category'])}',{q(p['name'])},'HOMELO',{q(json.dumps(ref,ensure_ascii=False,separators=(',',':')))}::jsonb,{q(p['sourceUrl'])},{round(p['demoPricePKR']*100)}) on conflict(slug) do nothing;\n"
            sql+=f"insert into public.variants(id,product_id,sku,color,materials,width_cm,depth_cm,height_cm,price_paisa,stock_on_hand) values('{vid}','{pid}',{q('ESS-'+p['id'].upper())},{q(color)},array[{','.join(q(m) for m in p['materials'])}]::text[],{d['width']},{d['depth']},{d['height']},{round(p['demoPricePKR']*100)},8) on conflict(sku) do nothing;\n"
            sql+=f"insert into public.product_media(id,variant_id,url,alt,source_url) values('{uid('media:'+vid)}','{vid}',{q(p['referenceImage'])},{q('ESSYRA '+p['name']+', '+color)},{q(p['sourceUrl'])}) on conflict(id) do nothing;\n"
        sql+='commit;\n';chunks.append(sql)
        (ROOT/f'scripts/homelo-import-{start//30+1}.sql').write_text(sql,encoding='utf-8')
    (ROOT/'supabase/migrations/202610260008_homelo_catalogue.sql').write_text('\n'.join(chunks),encoding='utf-8')
    audit={'retrievedAt':'2026-10-25','importedAt':'2026-10-26','source':'https://homelo.pk/products.json?limit=250&page=1','added':150,'total':len(baseline)+150,'byGroup':dict(collections.Counter(g[0] for p,g in selected)),'dimensionsEstimated':sum(bool(p.get('dimensionEstimates')) for p in added),'notes':'Source PKR prices for the first configuration. ESSYRA stock is synthetic, not supplier inventory. Missing measurements use explicitly marked estimates. Descriptions are original short summaries. No supplier delivery or warranty promises are copied.','products':[{'slug':p['id'],'sourceUrl':p['sourceUrl'],'sourceProductId':source['id'],'sourceVariantId':source['variants'][0]['id'],'configuration':p.get('configuration'),'dimensionEstimates':p.get('dimensionEstimates',[])} for p,(source,g) in zip(added,selected)]}
    (ROOT/'src/data/homelo-import-report.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:audit[k] for k in ['added','total','byGroup','dimensionsEstimated']},indent=2))

if __name__=="__main__": main()
