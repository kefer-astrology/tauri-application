#!/usr/bin/env python3
"""Acquire the curated ICRS/J2000 SIMBAD sample. Runtime calculations are fully offline.
SIMBAD proper motion in RA includes cos(dec); preserve that convention in the artifact.
"""
import csv, datetime, io, json, pathlib, urllib.parse, urllib.request
STARS = {
'alpheratz':'alf And', 'algenib':'gam Peg', 'hamal':'alf Ari', 'algol':'bet Per',
'alcyone':'eta Tau', 'aldebaran':'alf Tau', 'rigel':'bet Ori', 'capella':'alf Aur',
'bellatrix':'gam Ori', 'betelgeuse':'alf Ori', 'sirius':'alf CMa', 'canopus':'alf Car',
'procyon':'alf CMi', 'pollux':'bet Gem', 'regulus':'alf Leo', 'denebola':'bet Leo',
'zosma':'del Leo', 'vindemiatrix':'eps Vir', 'spica':'alf Vir', 'arcturus':'alf Boo',
'alphecca':'alf CrB', 'zuben_elgenubi':'alf02 Lib', 'zuben_eschamali':'bet Lib',
'antares':'alf Sco', 'vega':'alf Lyr', 'altair':'alf Aql', 'deneb':'alf Cyg',
'fomalhaut':'alf PsA', 'deneb_algedi':'del Cap', 'scheat':'bet Peg', 'markab':'alf Peg', 'achernar':'alf Eri'
}

def main():
    names = {f'* {value}': key for key, value in STARS.items()}
    query = 'SELECT ident.id, main_id, ra, dec, pmra, pmdec, plx_value, rvz_radvel FROM basic JOIN ident ON oid=oidref WHERE ident.id IN (' + ','.join("'"+name+"'" for name in names) + ')'
    params=urllib.parse.urlencode(dict(request='doQuery', lang='adql', format='csv', query=query))
    url='https://simbad.cfa.harvard.edu/simbad/sim-tap/sync?'+params
    with urllib.request.urlopen(url,timeout=30) as response: text=response.read().decode()
    stars=[]
    for row in csv.DictReader(io.StringIO(text)):
        key=names[row['id'].strip()]
        def number(field): return float(row[field]) if row[field].strip() else None
        stars.append(dict(id='star_'+key,name=key.replace('_',' ').title(),identifier=row['main_id'].strip(),
            epoch_jd=2451545.0,ra_deg=number('ra'),dec_deg=number('dec'),
            pm_ra_cosdec_mas_per_year=number('pmra'),pm_dec_mas_per_year=number('pmdec'),
            parallax_mas=number('plx_value'),radial_velocity_km_s=number('rvz_radvel')))
    if len(stars)!=len(STARS): raise RuntimeError(f'Expected {len(STARS)} distinct stars, received {len(stars)}: {text}')
    stars.sort(key=lambda item:list(STARS).index(item['id'][5:]))
    artifact=dict(schema_version=1,source='SIMBAD, CDS Strasbourg',source_url='https://simbad.cds.unistra.fr/',
        retrieved_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),reference_frame='ICRS',stars=stars)
    target=pathlib.Path(__file__).resolve().parent.parent/'contracts/points/fixed-stars.json'
    target.write_text(json.dumps(artifact,ensure_ascii=False,indent=2)+'\n')
    print(f'Wrote {len(stars)} stars to {target}')
if __name__=='__main__':main()
