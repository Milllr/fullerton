"""Build web images from raw/ using tools/manifest.json.
Writes public/shows/<slug>/<id>.webp (2000w) and <id>-m.webp (1000w), and
src/data/assets.json (dimensions and credits). Images already built from an
unchanged original are kept. Run: python tools/build_assets.py [--force]"""
import json, os, sys
from PIL import Image, ImageOps
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
man=json.load(open(os.path.join(root,'tools','manifest.json')))
FORCE='--force' in sys.argv
out={}
for slug,items in man.items():
    d=os.path.join(root,'public','shows',slug); os.makedirs(d,exist_ok=True)
    out[slug]=[]
    for it in items:
        src=os.path.join(root,'raw',it['src'])
        targets=[(os.path.join(d,f"{it['id']}{suffix}.webp"),tw,q) for suffix,tw,q in (('',2000,82),('-m',1000,78))]
        fresh=not FORCE and all(os.path.exists(t) and os.path.getmtime(t)>=os.path.getmtime(src) for t,_,_ in targets)
        im=ImageOps.exif_transpose(Image.open(src))
        w,h=im.size
        if not fresh:
            im=im.convert('RGB')
            for t,tw,q in targets:
                k=min(1,tw/w); r=im.resize((round(w*k),round(h*k)),Image.LANCZOS) if k<1 else im
                r.save(t,'WEBP',quality=q,method=6)
        out[slug].append({'id':it['id'],'w':w,'h':h,'credit':it.get('credit')})
        print(slug,it['id'],w,h,'kept' if fresh else 'built',flush=True)
json.dump(out,open(os.path.join(root,'src','data','assets.json'),'w'),indent=1)
