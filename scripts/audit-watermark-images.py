import concurrent.futures,json,pathlib,subprocess,urllib.parse
root=pathlib.Path.cwd();out=root.parent/'essyra-image-audit';out.mkdir(exist_ok=True)
products=[p for p in json.loads((root/'src/data/catalogue.json').read_text(encoding='utf-8')) if 'homelo.pk' in p.get('sourceUrl','')]
rows=[{'index':i+1,'slug':p['id'],'name':p['name'],'url':p['referenceImage']} for i,p in enumerate(products)]
(out/'manifest.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
def fetch(p):
 dest=out/(str(p['index']).zfill(3)+'.jpg')
 if dest.exists() and dest.stat().st_size>3000:return True
 u=urllib.parse.urlsplit(p['url']);q=dict(urllib.parse.parse_qsl(u.query));q.update(width='640',format='jpg');url=urllib.parse.urlunsplit((u.scheme,u.netloc,u.path,urllib.parse.urlencode(q),''))
 r=subprocess.run(['curl.exe','-f','-L','-s','--max-time','20','-o',str(dest),url],capture_output=True)
 return r.returncode==0 and dest.exists() and dest.stat().st_size>3000
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 results=list(pool.map(fetch,rows))
print('Downloaded catalogue inspection images:',sum(results),'/',len(rows))
(out/'downloads.json').write_text(json.dumps(results),encoding='utf-8')
