"""Pin/prepare the small VSCO CE palette. Python standard library only.
Retain original WAVs and SFZ mappings; ship mono PCM16 at original sample rate.
"""
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import quote
from concurrent.futures import ThreadPoolExecutor
import array, hashlib, io, json, re, struct, sys, wave

COMMIT = '440300901dfe9275fd84e0b7763af1f8443ae62e'
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/assets/sources/audio/constellation-orchestra/v1'
RUNTIME = ROOT / 'public/assets/runtime/audio/constellation-orchestra/v1'
for p in [SOURCE, RUNTIME]: p.mkdir(parents=True, exist_ok=True)
SFZ_COMMIT='6dd651d55dde97fd4028699be9d4481f26917891'
def get(remote, local, commit=COMMIT):
    if not local.exists():
        local.parent.mkdir(parents=True, exist_ok=True)
        local.write_bytes(urlopen('https://raw.githubusercontent.com/sgossner/VSCO-2-CE/'+commit+'/'+quote(remote),timeout=90).read())
    return local.read_bytes()

for name in ['LICENSE','Readme.txt']:
    data=get(name,SOURCE/name);(RUNTIME/name).write_bytes(data)

# MIDI numbers come from the source SFZ, not the octave labels in filenames.
choices=[
 ('harp','Harp.sfz',[59,62,65,69,72,76,79,83],4.0,False),
 ('flute','FluteSusNV.sfz',[60,64,69,72,76,81,84],3.2,False),
 ('strings','ViolaEnsSusVib-Quiet.sfz',[48,55,59,62,69,72],3.8,True),
 ('pizzicato','CelloEnsPizz.sfz',[50,53,57,60,64,67,71,74],2.0,False),
 ('bells','Glockenspiel.sfz',[72,79,84,91,96],4.0,False),
]
jobs=[]
for instrument,sfz,roots,seconds,loop in choices:
    text=get(sfz,SOURCE/'mappings'/sfz,SFZ_COMMIT).decode('utf-8-sig')
    text=re.sub(r'//[^\n]*','',text)
    default=re.search(r'default_path=([^\r\n]*)',text)
    folder=default.group(1).strip().replace('\\','/') if default else ''
    for root in roots:
        regions=[]
        for region in text.split('<region>')[1:]:
            sample=re.search(r'sample=([^\r\n]*)',region);key=re.search(r'pitch_keycenter=(\d+)',region)
            if sample and key and int(key.group(1))==root: regions.append((sample.group(1).strip(),region))
        if not regions: raise ValueError(f'Missing MIDI {root} in {sfz}')
        filename,region=regions[0]
        remote=(folder+filename).replace('\\','/')
        jobs.append(dict(instrument=instrument,root=root,source=remote,seconds=seconds,loop=loop,file=f'{instrument}-{root}.wav'))

def prepare(job):
    raw=get(job['source'],SOURCE/'samples'/job['source'])
    with wave.open(io.BytesIO(raw),'rb') as w:
        channels,width,rate=w.getnchannels(),w.getsampwidth(),w.getframerate()
        pcm=w.readframes(min(w.getnframes(),round(rate*job['seconds'])))
    if width not in [2,3]:raise ValueError('Unexpected PCM width '+str(width))
    # Decode/channel average without resampling or changing tuning.
    samples=[]
    for offset in range(0,len(pcm),channels*width):
        samples.append(sum(int.from_bytes(pcm[offset+c*width:offset+(c+1)*width],'little',signed=True) for c in range(channels))/channels/(2**(width*8-1)))
    # Remove only leading recording silence, keeping the real attack.
    first=next((i for i,v in enumerate(samples) if abs(v)>.0005),0)
    trim=max(0,first-round(rate*.008));samples=samples[trim:]
    loop_data={}
    if job['loop']:
        start,end,cross=round(rate*1.3),min(len(samples),round(rate*3.65)),round(rate*.15)
        if end<=start+cross:raise ValueError('Sample too short for sustained strings')
        for i in range(cross):
            t=i/max(1,cross-1);samples[end-cross+i]=samples[end-cross+i]*(1-t)+samples[start+i]*t
        samples=samples[:end];loop_data={'loopStart':(start+cross)/rate,'loopEnd':end/rate}
    else:
        fade=min(round(rate*.08),len(samples))
        for i in range(fade):samples[-fade+i]*=1-i/max(1,fade-1)
    peak=max(max(map(abs,samples)),.0001);gain=.85/peak
    output=array.array('h',(round(max(-1,min(1,s*gain))*32767) for s in samples))
    if sys.byteorder!='little':output.byteswap()
    destination=RUNTIME/job['file']
    with wave.open(str(destination),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(output.tobytes())
    return dict(instrument=job['instrument'],root=job['root'],file=job['file'],duration=len(samples)/rate,bytes=destination.stat().st_size,source=job['source'],sourceSha256=hashlib.sha256(raw).hexdigest(),sha256=hashlib.sha256(destination.read_bytes()).hexdigest(),**loop_data)

with ThreadPoolExecutor(max_workers=4) as pool: entries=list(pool.map(prepare,jobs))
manifest=dict(version=1,library='VSCO 2 Community Edition',license='CC0-1.0',credits='Versilian Studios / Sam Gossner; Ivy Audio / Simon Dalzell; sample cutting Elan Hickler / Soundemote',sourceRepository='https://github.com/sgossner/VSCO-2-CE',sampleCommit=COMMIT,mappingCommit=SFZ_COMMIT,processing='Original sample rate; mono PCM16; leading silence trim; peak .85; short tail fades; crossfaded sustain loop for viola section',samples=entries)
(RUNTIME/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
(SOURCE/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'samples':len(entries),'runtimeBytes':sum(e['bytes'] for e in entries),'sampleCommit':COMMIT,'mappingCommit':SFZ_COMMIT}))
