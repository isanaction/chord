/**
 * ブックマークレットのコードを作る（設計書 6.1）。
 * ブックマークレットは「ページの内容を自アプリに渡すだけ」にし、読み取りはアプリ側で行う。
 * 送り先は自アプリのオリジンに限定する。
 */
export function buildBookmarklet(appOrigin: string): string {
  const origin = JSON.stringify(appOrigin);
  const src = `(function(){
var A=${origin};
var w=window.open(A+'/import/receive','chord-import');
if(!w){alert('ポップアップがブロックされました。このサイトのポップアップを許可してください。');return;}
var p={type:'chord-import',version:1,url:location.href,title:document.title,html:document.documentElement.outerHTML,text:document.body?document.body.innerText:'',selection:String(window.getSelection()||'')};
function h(e){if(e.origin===A&&e.source===w&&e.data&&e.data.type==='chord-import-ready'){w.postMessage(p,A);window.removeEventListener('message',h);}}
window.addEventListener('message',h);
})();`;
  return 'javascript:' + encodeURIComponent(src.replace(/\n/g, ''));
}
