"""Pack ImageGen watercolor copies into the existing rig rectangles; never modify originals."""
import json, sys, math
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'output/imagegen/actor-watercolor-v1'
WORK.mkdir(parents=True, exist_ok=True)
OLD = ROOT / 'public/assets/deprecated/pixel/characters/battle'
NEW = OLD / 'watercolor-v1'

def clean_cutout(cut):
 """Keep substantial connected paint, discarding generator haze and stray flecks."""
 alpha=cut.getchannel('A'); raw=alpha.tobytes(); width,height=cut.size
 seen=bytearray(len(raw)); components=[]
 for start,a in enumerate(raw):
  if a<=200 or seen[start]: continue
  queue=[start]; seen[start]=1
  for p in queue:
   x,y=p%width,p//width
   for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
    nx,ny=x+dx,y+dy
    if nx<0 or ny<0 or nx>=width or ny>=height: continue
    n=ny*width+nx
    if raw[n]>200 and not seen[n]: seen[n]=1; queue.append(n)
  components.append(queue)
 largest=max((len(c) for c in components),default=0)
 mask=bytearray(len(raw))
 for component in components:
  if len(component)>=max(60,largest*.005):
   for p in component: mask[p]=255
 core=Image.frombytes('L',cut.size,bytes(mask)).filter(ImageFilter.MaxFilter(11))
 cut.putalpha(ImageChops.multiply(alpha,core))
 return cut
low = [[48,20,206,251],[41,289,272,248],[19,546,321,254],[25,812,291,256],[55,1080,183,273]]
high = [[44,43,194,228],[44,274,242,228],[28,509,286,242],[41,753,258,254],[71,1022,174,398]]
slime = [[38,114,357,269],[449,102,360,281],[874,104,350,274],[40,495,344,275],[448,501,361,269],[875,522,334,257],[41,896,344,261],[448,893,353,264],[882,883,327,302]]
specs = {
 'heroLow': ('hero-directions-low-v1.png', low, 2, 3),
 'heroHigh': ('hero-directions-high-v1.png', high, 2, 3),
 'slime': ('dark-slime-directions-v1.png', slime, 3, 3),
}
for pose in ['Sitting', 'Walking']:
 data = json.loads((ROOT / f'src/proto/art/hero{pose}Layout.json').read_text())
 for tier in ['low', 'high']:
  rects = data[tier]['rects']
  if pose == 'Walking': rects = [r for row in rects for r in row]
  specs[f'hero{pose}{tier.title()}'] = (f'hero-{pose.lower()}-{tier}-v1.png', rects, 4 if pose == 'Walking' else 3, (6 if tier == 'high' else 5) if pose == 'Walking' else 3)
data = json.loads((ROOT / 'src/proto/art/heroCombatLayout.json').read_text())
for pose in ['flinch', 'down']:
 specs[f'hero{pose.title()}'] = (f'hero-{pose}-atlas-v1.png', data[pose]['rects'], 3, 3)

if sys.argv[1] == 'references':
 manifest = {}
 for key, (name, rects, cols, rows) in specs.items():
  src = Image.open(OLD/name).convert('RGBA')
  # Full bodies only: exclude the legacy unused detached pieces.
  cell = 384
  sheet = Image.new('RGBA', (cols*cell, rows*cell))
  for i, (x,y,w,h) in enumerate(rects):
   cut = src.crop((x,y,x+w,y+h))
   cut.thumbnail((cell-64, cell-64), Image.Resampling.LANCZOS)
   sheet.alpha_composite(cut, ((i%cols)*cell+(cell-cut.width)//2,(i//cols)*cell+cell-32-cut.height))
  sheet.save(WORK/f'{key}-reference.png')
  manifest[key] = dict(original=name, originalSize=list(src.size), rects=rects, cols=cols, rows=rows)
 (WORK/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 print('Prepared',len(manifest),'reference sheets')
else:
 key = sys.argv[1]
 source = Path(sys.argv[2])
 spec = json.loads((WORK/'manifest.json').read_text())[key]
 src = Image.open(source).convert('RGBA')
 src.save(WORK/f'{key}-generated.png')
 target = Image.new('RGBA', tuple(spec['originalSize']))
 checks = []
 for i,(x,y,w,h) in enumerate(spec['rects']):
  c,r=i%spec['cols'],i//spec['cols']
  box=(round(c*src.width/spec['cols']),round(r*src.height/spec['rows']),round((c+1)*src.width/spec['cols']),round((r+1)*src.height/spec['rows']))
  # The five-view concept sheets have irregular row spacing, inspected manually.
  custom = {
   'heroLow': [(80,25,495,500),(530,25,1010,500),(15,515,535,980),(550,515,1015,985),(95,970,500,1510)],
   'heroHigh': [(85,25,495,480),(535,25,1015,480),(20,490,530,950),(565,495,1020,970),(120,970,400,1535)],
  }
  if key in custom: box=tuple(custom[key][i])
  if key == 'heroWalkingHigh':
   row_edges=[0,250,495,690,930,1190,1536]
   box=(box[0],row_edges[r],box[2],row_edges[r+1])
  if key == 'heroWalkingLow':
   row_edges=[0,270,560,800,1090,src.height]
   box=(box[0],row_edges[r],box[2],row_edges[r+1])
   if r in [2,3]:
    edges=[0,292,572,830,src.width] if r==2 else [0,300,580,850,src.width]
    box=(edges[c],box[1],edges[c+1],box[3])
  if key in ['heroSittingLow','heroSittingHigh']:
   row_edges=[0,405,800 if key=='heroSittingLow' else 805,src.height]
   box=(box[0],row_edges[r],box[2],row_edges[r+1])
  if key in ['heroFlinch','heroDown']:
   col_edges=([0,435,845,src.width] if key=='heroFlinch' else [0,430,835,src.width]) if r==0 else [0,445,865,src.width]
   box=(col_edges[c],box[1],col_edges[c+1],box[3])
  cut=src.crop(box)
  cut=clean_cutout(cut)
  alpha=cut.getchannel('A')
  bounds=alpha.point(lambda a:255 if a>128 else 0).getbbox()
  if not bounds: raise ValueError(f'{key} frame {i} is empty')
  if bounds[0]<1 or bounds[1]<1 or bounds[2]>cut.width-1 or bounds[3]>cut.height-1:
   print(f'Inspect {key} frame {i}: paint reaches source cell boundary {bounds}')
  # Retain a small translucent fringe; normalize each coherent body uniformly.
  bounds=(max(0,bounds[0]-3),max(0,bounds[1]-3),min(cut.width,bounds[2]+3),min(cut.height,bounds[3]+3))
  cut=cut.crop(bounds)
  scale=min((w-4)/cut.width,(h-4)/cut.height)
  cut=cut.resize((max(1,round(cut.width*scale)),max(1,round(cut.height*scale))),Image.Resampling.LANCZOS)
  target.alpha_composite(cut,(x+(w-cut.width)//2,y+h-2-cut.height))
  checks.append(dict(frame=i,sourceCell=list(box),sourceBounds=list(bounds),targetRect=[x,y,w,h],size=list(cut.size)))
 NEW.mkdir(parents=True,exist_ok=True)
 output=NEW/spec['original'].replace('-v1.png','-watercolor-v1.png')
 target.save(output)
 (WORK/f'{key}-packing.json').write_text(json.dumps(dict(sourceSize=list(src.size),output=str(output.relative_to(ROOT)),outputSize=list(target.size),frames=checks),indent=2)+'\n')
 print(key,'packed',len(checks),'frames into',output)


