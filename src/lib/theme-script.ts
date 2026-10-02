export const THEME_STORAGE_KEY = 'chord-theme';

/** 描画前に配色を決めて、ちらつきを防ぐ（サーバー側のレイアウトから埋め込む） */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}`;
