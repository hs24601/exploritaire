from PIL import Image
import sys
W,H=48,48
OUT=(15,36,24,255); D=(28,72,44,255); M=(42,104,58,255); L=(74,148,72,255); HL=(140,198,104,255)
TR=(150,100,58,255); TRD=(104,66,36,255)
def pine(img, cx, base, h):
    px=img.load()
    trunk=max(3,h//8)
    fol_top=base-h; fol_bot=base-trunk
    for y in range(fol_bot-1, base):
        for dx in (-1,0):
            px[cx+dx,y]=TR if dx<0 else TRD
    tiers=4 if h>34 else 3
    fh=fol_bot-fol_top
    maxw=h*0.3
    seg=fh/tiers
    spans=[]
    for i in range(tiers):
        s0=fol_top+int(round(seg*i*0.9)) if i else fol_top
        e0=fol_top+int(round(seg*(i+1)))+ (0 if i==tiers-1 else 1)
        spans.append((s0,min(e0,fol_bot)))
    # bottom tier first so each upper tier overlaps the one below and casts a shadow on it
    for i in reversed(range(tiers)):
        s0,e0=spans[i]
        wtop=0.5 if i==0 else maxw*(0.18+0.42*i/tiers)
        wbot=maxw*(0.5+0.5*(i+1)/tiers)
        for y in range(s0,e0):
            f=(y-s0)/max(1,e0-s0-1)
            iw=int(round(wtop+(wbot-wtop)*f))
            for x in range(cx-iw, cx+iw+1):
                if not 0<=x<W: continue
                rel=(x-cx)/max(1,iw)
                c=L if rel<-0.4 else M if rel<0.2 else D
                if y==e0-1 and rel<-0.1 and (x%2==0): c=HL
                if y==e0-1 and rel>0.5: c=OUT
                px[x,y]=c
        # shadow under this tier on the tier below
        if i<tiers-1:
            y=e0
            iw=int(round(wbot))-1
            for x in range(cx-iw, cx+iw+1):
                if 0<=x<W and y<fol_bot and px[x,y][3]: px[x,y]=OUT if abs(x-cx)>iw*0.3 else D
    px[cx,fol_top-1]=L
def outline(img):
    px=img.load(); src=img.copy(); sp=src.load()
    for y in range(H):
        for x in range(W):
            if sp[x,y][3]==0:
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx,ny=x+dx,y+dy
                    if 0<=nx<W and 0<=ny<H and sp[nx,ny][3] and sp[nx,ny]!=OUT:
                        px[x,y]=OUT;break
img=Image.new('RGBA',(W,H),(0,0,0,0))
back=Image.new('RGBA',(W,H),(0,0,0,0))
pine(back,12,44,28); pine(back,35,43,32); outline(back)
back=Image.eval(back.convert("RGBA"),lambda v:v) ; r,g,b,a=back.split(); back=Image.merge("RGBA",[c.point(lambda v:int(v*0.78)) for c in (r,g,b)]+[a])
front=Image.new('RGBA',(W,H),(0,0,0,0))
pine(front,24,47,43); outline(front)
img=Image.alpha_composite(back,front)
img.save(sys.argv[1])
img.resize((W*8,H*8),Image.NEAREST).save(sys.argv[2])
