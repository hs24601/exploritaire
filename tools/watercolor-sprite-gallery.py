"""Inspect final packed frames and record alpha/dimensions/source hashes."""
import json, hashlib
from pathlib import Path
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parents[1]
work=root/'output/imagegen/actor-watercolor-v1'
manifest=json.loads((work/'manifest.json').read_text())
gallery=Image.new('RGB',(1000,9*250),'#17302d')
draw=ImageDraw.Draw(gallery); report={}
for row,(key,spec) in enumerate(manifest.items()):
 packing=json.loads((work/f'{key}-packing.json').read_text())
 atlas=Image.open(root/packing['output']).convert('RGBA')
 assert list(atlas.size)==spec['originalSize']
 assert atlas.getchannel('A').getextrema()[0]==0
 rects=spec['rects']; selected=[0,min(2,len(rects)-1),min(4,len(rects)-1),len(rects)-1]
 for col,index in enumerate(selected):
  x,y,w,h=rects[index]; frame=atlas.crop((x,y,x+w,y+h))
  assert frame.getchannel('A').getbbox()
  frame.thumbnail((225,220),Image.Resampling.LANCZOS)
  gallery.paste(frame,(col*250+(250-frame.width)//2,row*250+20+(220-frame.height)//2),frame)
 draw.text((10,row*250+3),key,fill='#f1e4be')
 alpha=atlas.getchannel('A').histogram()
 original=root/'public/assets/deprecated/pixel/characters/battle'/spec['original']
 report[key]={'frames':len(rects),'size':list(atlas.size),'partialAlphaPixels':sum(alpha[1:255]),'originalSha256':hashlib.sha256(original.read_bytes()).hexdigest(),'output':packing['output']}
gallery.save(work/'packed-gallery.jpg')
(work/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
print('Validated',sum(r['frames'] for r in report.values()),'frames in',len(report),'atlases')
