const paths:Record<string,string>={
 lock:'M6 10h12v11H6ZM8 10V6a4 4 0 0 1 8 0v4M12 14v3',unlock:'M6 10h12v11H6ZM8 10V6a4 4 0 0 1 7.5-2M12 14v3',
 text:'M4 4h16M12 4v16M8 20h8',prop:'m12 3 9 5-9 5-9-5ZM3 8v10l9 5 9-5V8M12 13v10',region:'M3 3h18v18H3ZM3 9h18M9 3v18m3-3 6-6',preview:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Zm13 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0',undo:'M9 5 3 11l6 6M3 11h11a6 6 0 0 1 0 12',redo:'m15 5 6 6-6 6M21 11H10a6 6 0 0 0 0 12',
 paint:'M14 3l7 7-8 8-7-7ZM6 14c-4 0-4 7-4 7s7 0 7-4',
 editor:'M3 3h18v18H3ZM3 8h18M15 8v13M7 12h4M7 16h4',fold:'M3 5l6-2 6 3 6-2v15l-6 2-6-3-6 2ZM9 3v15M15 6v15',framing:'M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M8 12h8M12 8v8',delete:'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
 save:'M5 3h12l4 4v14H3V3h2ZM7 3v6h10V3M7 21v-8h10v8',
 reload:'M20 7v5h-5M20 12a8 8 0 1 0-2 6M20 7l-3-3',
 json:'M8 4H6v6l-3 2 3 2v6h2M16 4h2v6l3 2-3 2v6h-2',
 chapter:'M4 4h7l2 3h7v14H4ZM8 14h8M12 10v8',
 scene:'M4 3h12l4 4v14H4ZM8 13h8M12 9v8',
 camera:'M3 7h4l2-3h6l2 3h4v14H3ZM16 13a4 4 0 1 0-8 0 4 4 0 0 0 8 0',
 play:'m8 4 12 8-12 8Z',pause:'M7 4v16M17 4v16',stop:'M5 5h14v14H5Z',
 go:'M4 12h15M13 6l6 6-6 6',rename:'m4 16 11-11 4 4L8 20H4ZM13 7l4 4',
 copy:'M9 8h12v13H9ZM16 8V3H3v13h6',update:'M4 6h16v14H4ZM8 3v6M16 3v6M8 14l3 3 5-6',
 up:'m5 14 7-7 7 7',down:'m5 10 7 7 7-7',open:'M5 4h14v16H5ZM9 4v16M12 8l4 4-4 4',close:'M5 4h14v16H5ZM9 4v16M16 8l-4 4 4 4',import:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5'
};
function actionIcon(label:string){if(label.startsWith('Save')||label==='Saving…')return'save';if(label==='Reload disk')return'reload';if(label.includes('JSON'))return'json';if(label.includes('Chapter')||label==='Add chapter')return'chapter';if(label==='+ Scene'||label==='Add scene')return'scene';if(label==='Capture shot')return'camera';if(label==='Play')return'play';if(label==='Pause')return'pause';if(label==='Stop')return'stop';if(label==='Go to')return'go';if(label==='Rename')return'rename';if(label==='Copy as')return'copy';if(label==='Replace with current view')return'update';if(label==='↑'||label==='Move shot up')return'up';if(label==='↓'||label==='Move shot down')return'down';if(label==='Add paint breakpoint'||label==='Preview paint breakpoint')return'paint';if(label==='Import')return'import';if(label==='Delete shot')return'delete';return'open';}
export function setSceneIcon(button:HTMLElement,label:string,icon=actionIcon(label)){
 button.classList.add('book-scene-icon');button.setAttribute('aria-label',label.replace(/ •$/,''));button.title=label;button.replaceChildren();
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.6');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[icon]??paths.open);svg.append(path);button.append(svg);
}
