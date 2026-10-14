"""Trace a photo into drafting-style line segments.
usage: sketch.py in.jpg out.json [preview.png] [--det 900] [--nfa 2.0] [--min 9] [--cap 260]
Segments are stored normalized to the image width (x,y in 0..1 * aspect)."""
import sys, cv2, numpy as np, math, json, argparse
ap=argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('out'); ap.add_argument('preview',nargs='?')
ap.add_argument('--det',type=int,default=900)
ap.add_argument('--nfa',type=float,default=2.0)
ap.add_argument('--min',type=float,default=9)
ap.add_argument('--cap',type=float,default=260)
ap.add_argument('--cell',type=int,default=60)
ap.add_argument('--sr',type=int,default=24)
ap.add_argument('--bright',type=int,default=235)
ap.add_argument('--blobmin',type=int,default=3)
ap.add_argument('--maxfx',type=int,default=90)
ap.add_argument('--th',type=int,default=17)
ap.add_argument('--curves',type=int,default=1)
ap.add_argument('--c1',type=int,default=60)
ap.add_argument('--c2',type=int,default=150)
ap.add_argument('--clen',type=int,default=60)
ap.add_argument('--thmin',type=int,default=70)
a=ap.parse_args()
im=cv2.imread(a.src); h,w=im.shape[:2]
W=a.det; s=W/w; H=int(round(h*s))
im=cv2.resize(im,(W,H),interpolation=cv2.INTER_AREA)
sm=cv2.pyrMeanShiftFiltering(im, 8, a.sr)
sm=cv2.bilateralFilter(sm,5,25,5)
g=cv2.cvtColor(sm,cv2.COLOR_BGR2GRAY)
lsd=cv2.createLineSegmentDetector(cv2.LSD_REFINE_ADV)
lines,width,prec,nfa=lsd.detect(g)
L=lines.reshape(-1,4); nfa=nfa.reshape(-1)
keep=nfa>=a.nfa
L=L[keep]; nfa=nfa[keep]
def merge(segs, ang_tol=math.radians(2.2), dist_tol=1.4, gap_tol=7):
    segs=[list(map(float,s)) for s in segs]
    changed=True
    while changed:
        changed=False
        segs.sort(key=lambda s:-math.hypot(s[2]-s[0],s[3]-s[1]))
        angs=[math.atan2(s[3]-s[1],s[2]-s[0])%math.pi for s in segs]
        out=[]; used=[False]*len(segs)
        for i in range(len(segs)):
            if used[i]: continue
            x1,y1,x2,y2=segs[i]; ang=angs[i]
            dx,dy=math.cos(ang),math.sin(ang); nx,ny=-dy,dx
            for j in range(i+1,len(segs)):
                if used[j]: continue
                d=abs(angs[j]-ang); d=min(d,math.pi-d)
                if d>ang_tol: continue
                bx1,by1,bx2,by2=segs[j]
                p1=(bx1-x1)*nx+(by1-y1)*ny; p2=(bx2-x1)*nx+(by2-y1)*ny
                if abs(p1)>dist_tol or abs(p2)>dist_tol: continue
                ta=sorted([0,(x2-x1)*dx+(y2-y1)*dy]); tb=sorted([(bx1-x1)*dx+(by1-y1)*dy,(bx2-x1)*dx+(by2-y1)*dy])
                if max(tb[0]-ta[1], ta[0]-tb[1])>gap_tol: continue
                lo=min(ta[0],tb[0]); hi=max(ta[1],tb[1])
                x1,y1,x2,y2=x1+dx*lo,y1+dy*lo,x1+dx*hi,y1+dy*hi
                used[j]=True; changed=True
            used[i]=True; out.append([x1,y1,x2,y2])
        segs=out
    return segs
segs=merge(L)
segs=[s for s in segs if math.hypot(s[2]-s[0],s[3]-s[1])>=a.min]
# density cap: per cell, keep longest until total length budget used
segs.sort(key=lambda s:-math.hypot(s[2]-s[0],s[3]-s[1]))
budget={}
final=[]
for s_ in segs:
    l=math.hypot(s_[2]-s_[0],s_[3]-s_[1])
    cx=int(((s_[0]+s_[2])/2)//a.cell); cy=int(((s_[1]+s_[3])/2)//a.cell)
    used=budget.get((cx,cy),0)
    if l<40 and used+l>a.cap: continue
    budget[(cx,cy)]=used+l; final.append(s_)
# organic outlines (people, curves) from strong edges, minus what the straight lines already cover
if a.curves:
    gb=cv2.GaussianBlur(g,(0,0),1.4)
    ed=cv2.Canny(gb,a.c1,a.c2)
    cov=np.zeros_like(g)
    for x1,y1,x2,y2 in final: cv2.line(cov,(round(x1),round(y1)),(round(x2),round(y2)),255,5)
    cnts,_=cv2.findContours(ed,cv2.RETR_LIST,cv2.CHAIN_APPROX_NONE)
    extra=[]
    for c in cnts:
        if cv2.arcLength(c,False)<a.clen: continue
        ap_=cv2.approxPolyDP(c,1.3,False).reshape(-1,2)
        for i in range(len(ap_)-1):
            (x1,y1),(x2,y2)=ap_[i],ap_[i+1]
            l=math.hypot(x2-x1,y2-y1)
            if l<3: continue
            mx,my=int((x1+x2)/2),int((y1+y2)/2)
            if cov[min(H-1,my),min(W-1,mx)]: continue
            extra.append([float(x1),float(y1),float(x2),float(y2)])
    # density cap on curves too
    cb={}
    for s_ in extra:
        l=math.hypot(s_[2]-s_[0],s_[3]-s_[1])
        key=(int(s_[0]//a.cell),int(s_[1]//a.cell))
        if cb.get(key,0)+budget.get(key,0)+l>a.cap*1.15: continue
        cb[key]=cb.get(key,0)+l; final.append(s_)
# light sources -> fixture symbols (bright blobs on the original, not the smoothed image)
hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV)
v=hsv[:,:,2]; sat=hsv[:,:,1]
k=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(a.th,a.th))
tophat=cv2.morphologyEx(v,cv2.MORPH_TOPHAT,k)
mask=((v>=a.bright)&(sat<140)&(tophat>=a.thmin)).astype(np.uint8)
n,lab,stats,cent=cv2.connectedComponentsWithStats(mask,8)
fx=[]
for i in range(1,n):
    x,y,ww,hh,area=stats[i]
    if area<a.blobmin or max(ww,hh)>W*0.022: continue
    fill=area/(ww*hh)
    if max(ww,hh)/max(1,min(ww,hh))>1.7: continue
    if fill<0.5: continue
    cx,cy=cent[i]
    fx.append(['c',cx,cy,max(1.6,math.sqrt(area/math.pi))])
fx.sort(key=lambda f:-(f[3]))
fx=fx[:a.maxfx]
data={"w":W,"h":H,"aspect":H/W,"segs":[[round(v/W,4) for v in s_] for s_ in final],
      "fx":[[f[0]]+[round(v/W,4) for v in f[1:]] for f in fx]}
json.dump(data,open(a.out,'w'),separators=(',',':'))
if a.preview:
    P=1600; k=P/W
    c=np.full((int(H*k),P,3),(10,9,8),np.uint8)
    for x1,y1,x2,y2 in final:
        l=math.hypot(x2-x1,y2-y1); al=min(1,0.35+l/120)
        col=tuple(int(v*al) for v in (190,205,222))
        cv2.line(c,(round(x1*k),round(y1*k)),(round(x2*k),round(y2*k)),col,1,cv2.LINE_AA)
    for f in fx:
        if f[0]=='c': cv2.circle(c,(round(f[1]*k),round(f[2]*k)),max(2,round(f[3]*k)),(150,190,230),1,cv2.LINE_AA)
        else: cv2.rectangle(c,(round((f[1]-f[3])*k),round((f[2]-f[4])*k)),(round((f[1]+f[3])*k),round((f[2]+f[4])*k)),(150,190,230),1,cv2.LINE_AA)
    cv2.imwrite(a.preview,c)
print(len(L),len(final),len(fx))
