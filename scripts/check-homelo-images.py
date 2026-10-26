"""Validate remote image responses without copying retailer media locally."""
import concurrent.futures,json,pathlib,subprocess
root=pathlib.Path.cwd();products=json.loads((root/'src/data/catalogue.json').read_text(encoding='utf-8'))
products=[p for p in products if p['sourceUrl'].startswith('https://homelo.pk/')]
def check(p):
    r=subprocess.run(['curl.exe','-I','-L','-s','--max-time','35','-w','\nSTATUS:%{http_code}',p['referenceImage']],capture_output=True,text=True,encoding='utf-8')
    result={'slug':p['id'],'ok':r.returncode==0 and 'STATUS:200' in r.stdout and 'content-type: image/' in r.stdout.lower()}
    return result
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool: results=list(pool.map(check,products))
for result in results:
    if not result['ok']: result.update(check(next(p for p in products if p['id']==result['slug'])))
(root/'src/data/homelo-image-verification.json').write_text(json.dumps({'checkedAt':'2026-10-26','results':results},indent=2)+'\n')
print('Verified image HTTP 200 and image content type:',sum(r['ok'] for r in results),'/',len(results))
assert len(results)==150 and all(r['ok'] for r in results)
