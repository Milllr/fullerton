"""Build web images and sketch data from raw/ using tools/manifest.json.
Writes public/shows/<slug>/<id>.webp (2000w), <id>-m.webp (1000w), <id>.json (sketch)
and src/data/assets.json (dimensions). Run: python3 tools/build_assets.py [--sketch-only] [--missing]
--missing only builds photos that aren't in public/shows yet and keeps the rest as they are,
so new photos can be added without every original being on this machine."""
import json, os, subprocess, sys
from PIL import Image, ImageOps
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
man=json.load(open(os.path.join(root,'tools','manifest.json')))
SKETCH_ONLY='--sketch-only' in sys.argv
MISSING='--missing' in sys.argv
prev={}
if MISSING:
    try: prev=json.load(open(os.path.join(root,'src','data','assets.json')))
    except FileNotFoundError: pass
out={}
for slug,items in man.items():
    d=os.path.join(root,'public','shows',slug); os.makedirs(d,exist_ok=True)
    out[slug]=[]
    for it in items:
        done=next((p for p in prev.get(slug,[]) if p['id']==it['id']),None)
        if MISSING and done and all(os.path.exists(os.path.join(d,f"{it['id']}{x}")) for x in ('.webp','-m.webp','.json')):
            out[slug].append({**done,'credit':it.get('credit')}); continue
        src=os.path.join(root,'raw',it['src'])
        im=ImageOps.exif_transpose(Image.open(src)).convert('RGB')
        w,h=im.size
        for suffix,tw in (() if SKETCH_ONLY else (('',2000),('-m',1000))):
            k=min(1,tw/w); r=im.resize((round(w*k),round(h*k)),Image.LANCZOS) if k<1 else im
            r.save(os.path.join(d,f"{it['id']}{suffix}.webp"),'WEBP',quality=82 if suffix=='' else 78,method=6)
        # sketch uses an oriented temp copy so EXIF rotation is respected
        tmp=os.path.join(d,'_tmp.png'); im.save(tmp)
        subprocess.run([sys.executable,os.path.join(root,'tools','sketch.py'),tmp,os.path.join(d,f"{it['id']}.json")],check=True,capture_output=True)
        # Clean the trace so it reads as a Vectorworks Hidden Line render (see tools/hiddenline.py).
        subprocess.run([sys.executable,os.path.join(root,'tools','hiddenline.py'),os.path.join(d,f"{it['id']}.json")],check=True,capture_output=True)
        os.remove(tmp)
        out[slug].append({'id':it['id'],'w':w,'h':h,'credit':it.get('credit')})
        print(slug,it['id'],w,h,flush=True)
json.dump(out,open(os.path.join(root,'src','data','assets.json'),'w'),indent=1)
