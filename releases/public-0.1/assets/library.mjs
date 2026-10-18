document.documentElement.classList.add('js');
const $=(s,r=document)=>r.querySelector(s);
const norm=s=>s.replaceAll('ſ','s').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().normalize('NFC').replace(/[\s.,:·'’‘“”()\-]/g,'');
const live=s=>{const n=$('#live');if(n)n.textContent=s;};
const menu=$('.menu-toggle'),nav=$('#site-nav');
if(menu){menu.hidden=false;menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'메뉴 닫기':'메뉴 열기');});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('open'))menu.click();});}

const narrow=window.matchMedia('(max-width:700px)');
for(const panel of document.querySelectorAll('.author-menu,.reading-settings'))panel.open=!narrow.matches;
narrow.addEventListener('change',()=>{for(const panel of document.querySelectorAll('.author-menu,.reading-settings'))panel.open=!narrow.matches;});
document.addEventListener('keydown',e=>{if(e.key==='Escape')for(const panel of document.querySelectorAll('.chapter-menu,.reading-settings,.author-menu'))if(narrow.matches&&panel.open){panel.open=false;panel.querySelector('summary')?.focus();}});
const catalog=$('.catalog-page');
if(catalog){
  const params=new URLSearchParams(location.search);
  // Filter groups mirror the data-filter-group attributes; each name is also the data-* key on the catalogue rows.
  const filters={tradition:params.get('tradition')||'all',issuer:params.get('issuer')||'all'};
  const input=$('#q');input.value=params.get('q')||'';const rows=[...document.querySelectorAll('.catalog-row')];
  const metadata=new Map(rows.map(row=>[row.dataset.work,norm(row.dataset.search)]));
  let bodyIndex=null,bodyRequest=null,bodyFailed=false;
  const loadBodyIndex=()=>{
    if(bodyRequest)return;
    bodyRequest=fetch(new URL('../data/search.json',import.meta.url)).then(response=>{
      if(!response.ok)throw Error('Search index request failed');
      return response.json();
    }).then(data=>{
      if(data.schema_version!=='confessions-search-1'||!rows.every(row=>typeof data.works?.[row.dataset.work]==='string'))throw Error('Search index format differs');
      bodyIndex=new Map(Object.entries(data.works));bodyFailed=false;refresh(false);
    }).catch(()=>{bodyRequest=null;bodyFailed=true;refresh(false);});
  };
  const refresh=(update=true)=>{
    let total=0;const q=norm(input.value.trim());
    const loading=Boolean(q&&!bodyIndex&&!bodyFailed);
    for(const row of rows){const visible=Object.entries(filters).every(([g,v])=>v==='all'||row.dataset[g]===v)&&(!q||(bodyIndex||metadata).get(row.dataset.work).includes(q));row.hidden=!visible;if(visible)total++;}
    // Issuer and tradition headings follow their works: a heading with no visible work is hidden.
    for(const group of document.querySelectorAll('.author-group'))group.hidden=!group.querySelector('.catalog-row:not([hidden])');
    for(const group of document.querySelectorAll('.corpus-group'))group.hidden=!group.querySelector('.author-group:not([hidden])');
    $('.catalog-results').setAttribute('aria-busy',String(loading));
    $('.result-count').textContent=loading?'본문 검색 중…':total+'편'+(q&&bodyFailed?' · 문헌 정보 검색 결과입니다. 본문 검색을 불러오지 못했습니다.':'');$('#selected-author').textContent=filters.issuer==='all'?'전체':filters.issuer;$('.empty-result').hidden=loading||total!==0;
    document.querySelectorAll('[data-filter-group] a').forEach(a=>{const group=a.closest('[data-filter-group]').dataset.filterGroup;a.setAttribute('aria-current',String(a.dataset.filter===filters[group]));});
    if(update){const p=new URLSearchParams();if(input.value.trim())p.set('q',input.value.trim());for(const [g,v] of Object.entries(filters))if(v!=='all')p.set(g,v);history.replaceState(null,'',location.pathname+(p.size?'?'+p:''));}
    if(loading)loadBodyIndex();
  };
  input.addEventListener('input',()=>{bodyFailed=false;refresh();});$('.search').addEventListener('submit',e=>{e.preventDefault();bodyFailed=false;refresh();live($('.result-count').textContent);});
  document.querySelectorAll('[data-filter-group] a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const group=a.closest('[data-filter-group]').dataset.filterGroup;filters[group]=a.dataset.filter;if(group==='issuer'&&narrow.matches){const panel=a.closest('details');if(panel)panel.open=false;}refresh();}));
  refresh(false);
}

if($('.reader')){
  const store=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
  const read=(key,fallback)=>{try{return localStorage.getItem(key)||fallback;}catch{return fallback;}};
  let scale=Number(read('nt-reading-scale','100'));if(!Number.isFinite(scale)||scale<85||scale>140)scale=100;
  const fonts=$('.font-controls');fonts.hidden=false;
  function setSize(){document.documentElement.style.setProperty('--reader-size',(18*scale/100)+'px');$('#font-size').textContent=scale+'%';$('[data-size="-1"]').disabled=scale<=85;$('[data-size="1"]').disabled=scale>=140;store('nt-reading-scale',String(scale));}
  document.querySelectorAll('[data-size]').forEach(b=>b.addEventListener('click',()=>{scale=b.dataset.size==='reset'?100:Math.max(85,Math.min(140,scale+Number(b.dataset.size)*5));setSize();}));setSize();
  const source=$('.source-toggle');source.hidden=false;const toggle=$('#show-original');toggle.checked=read('nt-reading-original','true')==='true';
  const setSource=()=>{document.body.classList.toggle('hide-source',!toggle.checked);store('nt-reading-original',String(toggle.checked));};toggle.addEventListener('change',setSource);setSource();
  document.querySelectorAll('.reading-tools>details').forEach(panel=>panel.addEventListener('toggle',()=>{if(narrow.matches&&panel.open)document.querySelectorAll('.reading-tools>details').forEach(other=>{if(other!==panel)other.open=false;});}));
  document.addEventListener('click',e=>{if(narrow.matches&&!e.target.closest('.reading-tools'))document.querySelectorAll('.reading-tools>details').forEach(panel=>panel.open=false);});
  document.querySelectorAll('.chapter-menu a').forEach(a=>a.addEventListener('click',()=>a.closest('.chapter-menu').open=false));
  const reader=$('.reader'),passages=[...document.querySelectorAll('.passage')];
  const passageIndexes=new Map(passages.map((p,i)=>[p.dataset.ref,i]));
  // The text is one tab stop: up and down move between passages, right or Enter explores the phrase alignment.
  const noteLinks=new Map();
  for(const passage of passages){const link=passage.querySelector('.note-link');if(link){link.tabIndex=-1;noteLinks.set(passage,link);}}
  for(const unit of reader.querySelectorAll('[data-align]'))unit.tabIndex=-1;
  const keys=document.createElement('p');keys.id='reader-keys';keys.className='sr-only';keys.textContent='위아래 화살표로 대목을 옮깁니다. 오른쪽 화살표나 Enter로 표현 대응을 살펴보고 Esc로 대목에 돌아옵니다.';reader.append(keys);
  let roving=null,hinted=false;
  function setRoving(passage){
    if(!passage||passage===roving)return;
    if(roving){roving.removeAttribute('tabindex');roving.removeAttribute('aria-label');roving.removeAttribute('aria-describedby');noteLinks.get(roving)?.setAttribute('tabindex','-1');}
    roving=passage;passage.tabIndex=0;passage.setAttribute('aria-label',passage.querySelector('.passage-number').textContent.trim());
    if(!hinted)passage.setAttribute('aria-describedby','reader-keys');
    noteLinks.get(passage)?.removeAttribute('tabindex');
  }
  setRoving(passages[0]);
  reader.addEventListener('focusin',e=>{const passage=e.target.closest?.('.passage');if(passage)setRoving(passage);});
  reader.addEventListener('keydown',e=>{
    const passage=e.target;if(!passage.classList?.contains('passage')||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
    if(e.key==='ArrowRight'||e.key==='Enter'){const unit=passage.querySelector('.translation [data-align]');if(unit){e.preventDefault();unit.focus();}return;}
    const i=passageIndexes.get(passage.dataset.ref);
    const next=e.key==='ArrowDown'?passages[i+1]:e.key==='ArrowUp'?passages[i-1]:e.key==='Home'?passages[0]:e.key==='End'?passages.at(-1):undefined;
    if(next===undefined&&!['ArrowDown','ArrowUp'].includes(e.key))return;
    e.preventDefault();if(!next)return;
    if(!hinted){hinted=true;passage.removeAttribute('aria-describedby');}
    setRoving(next);next.focus();
  });
  const chapterLinks=[...document.querySelectorAll('[data-chapter-link]')],rangeGroups=new Map();
  for(const link of chapterLinks){
    const key=link.dataset.rangeStart+':'+link.dataset.rangeEnd;
    if(!rangeGroups.has(key))rangeGroups.set(key,{start:Number(link.dataset.rangeStart),end:Number(link.dataset.rangeEnd),links:[]});
    rangeGroups.get(key).links.push(link);link.setAttribute('aria-current','false');
  }
  const ranges=[...rangeGroups.values()];let markedLinks=[],openBook=null;
  // Multi-book works: a row of book buttons stays on top of the index and shows one book's ranges at a time.
  const showBook=book=>{for(const group of document.querySelectorAll('.nav-book'))group.open=group.dataset.book===book;for(const button of document.querySelectorAll('.nav-book-switch button'))button.setAttribute('aria-pressed',String(button.dataset.book===book));};
  for(const index of document.querySelectorAll('.grouped-nav')){
    const switcher=document.createElement('div');switcher.className='nav-book-switch';switcher.setAttribute('role','group');switcher.setAttribute('aria-label',index.dataset.groupLabel||'묶음 선택');
    for(const group of index.querySelectorAll('.nav-book')){const button=document.createElement('button');button.type='button';button.textContent=button.dataset.book=group.dataset.book;button.setAttribute('aria-pressed',String(group.open));button.addEventListener('click',()=>showBook(group.dataset.book));switcher.append(button);}
    index.prepend(switcher);
  }
  // The book being read opens when the reading position enters it.
  const followBook=links=>{const group=links[0]?.closest('.nav-book');if(!group||group.dataset.book===openBook)return;openBook=group.dataset.book;showBook(openBook);};
  const position=$('.tools-range');
  const showPosition=link=>{if(!position)return;const book=link?.closest('.nav-book')?.dataset.book,label=link?.textContent.trim()||'';position.textContent=book&&!label.includes(book)?book+' '+label:label;};
  // A long index scrolls inside the sidebar. Scroll only the index (never the page) so the marked link stays in view below the group buttons.
  const revealLink=link=>{const index=link.closest('.chapter-index');if(!index||!index.getClientRects().length||index.scrollHeight<=index.clientHeight)return;const box=index.getBoundingClientRect(),l=link.getBoundingClientRect(),top=index.querySelector('.nav-book-switch')?.getBoundingClientRect().bottom??box.top;if(l.top<top)index.scrollTop-=top-l.top;else if(l.bottom>box.bottom)index.scrollTop+=l.bottom-box.bottom;};
  const markLinks=links=>{if(links===markedLinks)return;for(const link of markedLinks)link.setAttribute('aria-current','false');for(const link of links)link.setAttribute('aria-current','true');markedLinks=links;followBook(links);showPosition(links[0]);for(const link of links)revealLink(link);};
  function firstAfter(items,before){let lo=0,hi=items.length;while(lo<hi){const mid=(lo+hi)>>>1;if(before(items[mid]))lo=mid+1;else hi=mid;}return lo;}
  const markRange=ref=>{const i=passageIndexes.get(ref);const range=i===undefined?null:ranges[firstAfter(ranges,r=>r.end<i)];markLinks(range&&range.start<=i?range.links:[]);};
  function targetHash(){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}const target=document.getElementById(id);if(!target)return;if(id.startsWith('note-')){const details=target.closest('details');if(details)details.open=true;}const ref=target.closest('[data-ref]')?.dataset.ref;markRange(ref);requestAnimationFrame(()=>{target.scrollIntoView({block:'start'});scheduleRange();});}
  let frame=null;
  function refreshRange(){
    frame=null;const y=innerHeight*.18;
    const selected=passages[Math.min(passages.length-1,firstAfter(passages,target=>target.getBoundingClientRect().bottom<=y))];
    if(selected&&!reader.contains(document.activeElement))setRoving(selected);
    if(selected)markRange(selected.dataset.ref);
  }
  function scheduleRange(){if(frame===null)frame=requestAnimationFrame(refreshRange);}
  window.addEventListener('hashchange',targetHash);targetHash();
  window.addEventListener('scroll',scheduleRange,{passive:true});window.addEventListener('resize',scheduleRange);
  toggle.addEventListener('change',scheduleRange);
  if('ResizeObserver' in window)new ResizeObserver(scheduleRange).observe($('.reader'));
  document.fonts?.ready.then(scheduleRange);
  scheduleRange();
}
