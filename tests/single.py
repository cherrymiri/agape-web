import base64,re,subprocess,glob,os
os.chdir('/home/claude/agape-web')
subprocess.run('npx esbuild src/main.js --bundle --minify --format=iife --target=es2019 --outfile=/tmp/ag.js --log-level=error',shell=True,check=True)
js=open('/tmp/ag.js').read().replace('</script','<\\/script')
css=re.sub(r"@import[^;]+;\n",'',open('src/style.css').read()).replace(':root{--void',':root{color-scheme:dark;--void',1)
body=open('index.html').read()
body=body[body.index('<canvas'):body.index('<script type="module"')]
M={os.path.basename(f):base64.b64encode(open(f,'rb').read()).decode() for f in glob.glob('public/glb/*.glb')}
head='<title>AGAPE</title>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap">\n<style>'+css+'</style>\n'
def page(nomic):
    return head+body+'<script>window.AGAPE_MODELS='+str(M).replace("'",'"')+';window.AGAPE_NO_MIC='+('true' if nomic else 'false')+';</script>\n<script>'+js+'</script>\n'
os.makedirs('single',exist_ok=True)
open('single/artifact_concept.html','w').write(page(True))
open('single/AGAPE_테스트5_콘셉트.html','w').write('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"></head><body>'+page(False)+'</body></html>')
print(os.path.getsize('single/artifact_concept.html'))
