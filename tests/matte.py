import sys,numpy as np
from PIL import Image
def matte(k,w,out,pad=.05):
    K=np.asarray(Image.open(k).convert('RGB'),float);Wt=np.asarray(Image.open(w).convert('RGB'),float)
    a=np.clip(1-(Wt-K).mean(2)/255,0,1)
    c=np.where(a[...,None]>1e-3,K/np.maximum(a[...,None],1e-3),0);c=np.clip(c,0,255)
    img=np.dstack([c,a*255]).astype(np.uint8)
    ys,xs=np.where(a>.004);y0,y1,x0,x1=ys.min(),ys.max(),xs.min(),xs.max();p=int(pad*max(y1-y0,x1-x0))
    H,W=a.shape;img=img[max(0,y0-p):min(H,y1+p),max(0,x0-p):min(W,x1+p)]
    Image.fromarray(img,'RGBA').save(out,dpi=(300,300));print(out,img.shape)
    for bg,n in [((255,255,255),'_on_white'),((0,0,0),'_on_black')]:
        im=Image.fromarray(img,'RGBA');B=Image.new('RGBA',im.size,bg+(255,));B.alpha_composite(im);B.convert('RGB').resize((im.size[0]//4,im.size[1]//4)).save(out.replace('.png',n+'.jpg'))
matte(*sys.argv[1:4])
