#!/usr/bin/env python3
"""Build the seven curated TNO SPKs from resolved JPL identifiers; never guess target IDs."""
import argparse, json, pathlib, subprocess, sys, urllib.parse, urllib.request
BODIES=['eris','sedna','haumea','makemake','quaoar','orcus','varuna']
p=argparse.ArgumentParser();p.add_argument('--mkspk',required=True);p.add_argument('--lsk',required=True);p.add_argument('--start',default='1900-01-01');p.add_argument('--stop',default='2100-01-01');args=p.parse_args()
root=pathlib.Path(__file__).resolve().parent.parent
for body in BODIES:
    output=root/'src-tauri/resources'/f'{body}_1900_2100_type13.bsp'
    if output.exists() and pathlib.Path(str(output)+'.json').exists() and json.loads(pathlib.Path(str(output)+'.json').read_text())['validation']['method']=='held_out_interleaved_horizons_vectors':
        print(f'Existing {body} package retained',flush=True);continue
    url='https://ssd-api.jpl.nasa.gov/sbdb.api?'+urllib.parse.urlencode({'sstr':body})
    with urllib.request.urlopen(url,timeout=120) as response:data=json.load(response)
    obj=data['object'];target=int(obj['spkid']);designation=obj['des']
    print(f"Resolved {body}: {obj['fullname']}, target {target}",flush=True)
    command=[sys.executable,str(root/'scripts/generate-horizons-type13.py'),
        '--body-id',body,'--name',body.title(),'--command',f'{designation};',
        '--naif-target-id',str(target),'--start',args.start,'--stop',args.stop,
        '--step-days','4','--chunk-years','200','--degree','7',
        '--max-position-error-km','1','--max-velocity-error-km-s','0.00001',
        '--mkspk',args.mkspk,'--lsk',args.lsk,'--output',str(output),'--force']
    for step in ['4','2','1']:
        command[command.index('--step-days')+1]=step
        result=subprocess.run(command,text=True,capture_output=True)
        print(result.stdout,flush=True)
        if result.returncode==0: break
        print(result.stderr,flush=True)
        if 'validation failed:' not in result.stderr: raise SystemExit(result.returncode)
    else: raise SystemExit(f'{body} failed validation even with daily samples')
