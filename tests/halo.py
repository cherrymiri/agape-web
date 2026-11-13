import sys,numpy as np
from PIL import Image, ImageFilter
im=Image.open(sys.argv[1]).convert('RGBA');a=np.asarray(im,float)/255;pre=a[...,:3]*a[...,3:4]
pad=int(.08*max(im.size));W,H=im.size[0]+2*pad,im.size[1]+2*pad
P=np.zeros((H,W,4));P[pad:-pad,pad:-pad,:3]=pre;P[pad:-pad,pad:-pad,3]=a[...,3]
bl=lambda x,r:np.asarray(Image.fromarray((np.clip(x,0,1)*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)),float)/255
ha=np.clip(bl(P[...,3],max(im.size)*.03)*.5+bl(P[...,3],max(im.size)*.012)*.35,0,1)*.55
oa=P[...,3]+ha*(1-P[...,3]);oc=P[...,:3]+np.array([.86,.82,1.])*ha[...,None]*(1-P[...,3:4])
out=np.dstack([np.where(oa[...,None]>1e-4,oc/np.maximum(oa[...,None],1e-4),0),oa])
Image.fromarray((np.clip(out,0,1)*255).astype(np.uint8),'RGBA').save(sys.argv[2],dpi=(300,300));print(sys.argv[2],Image.open(sys.argv[2]).size)
