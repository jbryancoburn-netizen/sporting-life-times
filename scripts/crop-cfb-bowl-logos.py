from pathlib import Path
from PIL import Image
import json

manifest_path=Path('cfb-bowl-local-logos.js')
report_path=Path('data/cfb-bowl-logo-cache-report.json')
prefix='window.CFB_BOWL_LOCAL_LOGOS='
manifest=json.loads(manifest_path.read_text().split(prefix,1)[1].rstrip().rstrip(';'))
report=json.loads(report_path.read_text())
for name in ('Poinsettia Bowl','Cactus Bowl'):
    source=manifest.get(name)
    if not source or not Path(source).exists():
        continue
    row=next((x for x in report['report'] if x['name']==name),None)
    if name=='Cactus Bowl' and row and 'yimg.com' in row.get('source',''):
        continue  # The confirmed standalone 2026 logo needs no editing.
    with Image.open(source) as im:
        width,height=im.size
        if name=='Poinsettia Bowl':
            # Official 2026 stadium banner has the bowl mark on the left,
            # with event copy on the right. Extract just the crest.
            box=(0,0,round(width*.46),height)
        else:
            # When the standalone mark is unavailable, limit the poster
            # to the upper logo portion rather than the stadium advertisement.
            box=(0,0,width,round(height*.45))
        cropped=im.convert('RGBA').crop(box)
        dest='assets/bowl-logos/'+name.lower().replace(' ','-')+'.png'
        cropped.save(dest,optimize=True)
        manifest[name]=dest
        if row:
            row['local']=dest
            row['cropped_to_logo_region']=True
        print(name,'cropped', (width,height),'->',cropped.size)
manifest_path.write_text(prefix+json.dumps(manifest,indent=2)+';\n')
report_path.write_text(json.dumps(report,indent=2)+'\n')
