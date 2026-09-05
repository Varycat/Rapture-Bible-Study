
let studies=[],topics=[],verses={},currentStudy=null,currentTopic=0;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

async function init(){
  studies=await (await fetch('data/studies.json',{cache:'no-store'})).json();
  topics=await (await fetch('data/topics.json',{cache:'no-store'})).json();
  verses=await (await fetch('data/verses.json',{cache:'no-store'})).json();
  renderLibrary();
  bind();
  showLibrary();
}

function showLibrary(){
  $('#libraryView').hidden=false; $('#studyView').hidden=true; $('#topicView').hidden=true;
  currentStudy=null; renderSideStudies(); closeSide(); window.scrollTo(0,0);
}
function showStudy(){
  $('#libraryView').hidden=true; $('#studyView').hidden=false; $('#topicView').hidden=true;
  renderTopicIndex(); closeSide(); window.scrollTo(0,0);
}
function showTopic(){
  $('#libraryView').hidden=true; $('#studyView').hidden=true; $('#topicView').hidden=false;
  renderTopic(); closeSide(); window.scrollTo(0,0);
}
function renderLibrary(){
  $('#studyCards').innerHTML=studies.map((s,i)=>`<article class="studyCard"><div class="studyThumb">${s.icon}</div><h3>${s.title}</h3><p><b>${s.subtitle}</b></p><p>${s.description}</p><button class="${i===0?'primary':''}" data-study="${s.id}">Open Study →</button></article>`).join('');
  $$('[data-study]').forEach(b=>b.onclick=()=>openStudy(b.dataset.study));
}
function renderSideStudies(q=''){
  $('#sideHeading').textContent='Studies';
  const m=studies.filter(s=>(s.title+' '+s.subtitle+' '+s.description).toLowerCase().includes(q.toLowerCase()));
  $('#sideNav').innerHTML=`<button class="active">▦ All Studies<small>Browse all Bible studies</small></button>`+m.map(s=>`<button data-study="${s.id}">${s.icon} ${s.title}<small>${s.subtitle}</small></button>`).join('');
  $$('#sideNav [data-study]').forEach(b=>b.onclick=()=>openStudy(b.dataset.study));
}
function openStudy(id){
  currentStudy=studies.find(s=>s.id===id); if(!currentStudy)return;
  $('#studyTitle').textContent=currentStudy.title;
  $('#studyDescription').textContent=currentStudy.description;
  $('#studyCrumb').textContent=currentStudy.title;
  $('#crumbStudy').textContent=currentStudy.title;
  showStudy();
}
function renderTopicIndex(q=''){
  $('#sideHeading').textContent='Study Index';
  const m=topics.filter(t=>(t.title+' '+t.subtitle+' '+t.verses.join(' ')).toLowerCase().includes(q.toLowerCase()));
  $('#sideNav').innerHTML=m.map(t=>`<button data-topic="${t.id}">${topics.indexOf(t)+1}. ${t.title}<small>${t.subtitle}</small></button>`).join('');
  $('#topicCards').innerHTML=m.map(t=>`<button class="topicCard" data-topic="${t.id}"><h3>${topics.indexOf(t)+1}. ${t.title}</h3><p>${t.subtitle}</p></button>`).join('');
  $$('[data-topic]').forEach(b=>b.onclick=()=>openTopic(b.dataset.topic));
}
function openTopic(id){
  currentTopic=topics.findIndex(t=>t.id===id); if(currentTopic<0)return;
  showTopic();
}
function renderTopic(){
  const t=topics[currentTopic];
  $('#topicNumber').textContent=currentTopic+1;
  $('#topicTitle').textContent=t.title;
  $('#topicRefs').textContent=t.verses.join('   |   ');
  $('#crumbTopic').textContent=t.title;
  $('#preSummary').textContent=t.pretrib.summary;
  $('#sdaSummary').textContent=t.adventist.summary;
  $('#bibleFirst').textContent=t.bible_first;
  $('#featuredVerse').textContent=verses[t.verses[0]]||t.verses[0];
  $('#takeawayList').innerHTML=[
    `Key passage: ${t.verses[0]}.`,
    'Compare what each interpretation explicitly teaches.',
    'Open Bible Support to see how each side builds its case.',
    'Use Bible-First Observation to separate text from inference.'
  ].map(x=>`<li>${x}</li>`).join('');
  $('#relatedList').innerHTML=topics.filter((_,i)=>i!==currentTopic).slice(0,4).map(r=>`<button data-related="${r.id}">${r.title} ›</button>`).join('');
  $$('[data-related]').forEach(b=>b.onclick=()=>openTopic(b.dataset.related));
  renderSideTopicActive();
  $('#prevBtn').disabled=currentTopic===0; $('#nextBtn').disabled=currentTopic===topics.length-1;
}
function renderSideTopicActive(){
  $('#sideHeading').textContent='Study Index';
  $('#sideNav').innerHTML=topics.map(t=>`<button class="${topics.indexOf(t)===currentTopic?'active':''}" data-topic="${t.id}">${topics.indexOf(t)+1}. ${t.title}<small>${t.subtitle}</small></button>`).join('');
  $$('[data-topic]').forEach(b=>b.onclick=()=>openTopic(b.dataset.topic));
}
function detail(kind){
  const t=topics[currentTopic]; let title='',html='';
  if(kind==='preTeach'){title='Christian Pre-Tribulation — Their Teachings';html=`<p>${t.pretrib.teaching}</p>`}
  if(kind==='sdaTeach'){title='Seventh-day Adventist — Their Teachings';html=`<p>${t.adventist.teaching}</p>`}
  if(kind==='preSupport'){title='Christian Pre-Tribulation — Bible Support';html=supportHTML(t.pretrib.support)}
  if(kind==='sdaSupport'){title='Seventh-day Adventist — Bible Support';html=supportHTML(t.adventist.support)}
  openDialog(title,html);
}
function supportHTML(items){return items.map(x=>`<div class="supportItem"><button data-ref="${x.ref}">📖 ${x.ref}</button><p>${x.why}</p></div>`).join('')}
function openDialog(title,html){
  $('#dialogTitle').textContent=title; $('#dialogBody').innerHTML=html;
  $$('#dialogBody [data-ref]').forEach(b=>b.onclick=()=>showVerse(b.dataset.ref));
  $('#dialog').showModal();
}
function showVerse(ref){openDialog(ref,`<p style="white-space:pre-line;font-family:Georgia,serif;font-size:19px;line-height:1.6">${verses[ref]||'Verse text not added yet.'}</p>`)}
function closeSide(){$('#sidebar').classList.remove('open')}

function bind(){
  $('#menuBtn').onclick=()=>$('#sidebar').classList.add('open');
  $('#closeSide').onclick=closeSide;
  $('#homeBtn').onclick=$('#backLibrary').onclick=$('#crumbHome').onclick=showLibrary;
  $('#crumbStudy').onclick=showStudy;
  $('#aboutBtn').onclick=()=>openDialog('About This Library','<p>This web app is designed as a growing library of Bible studies. Each study can contain its own index, verses, interpretations, and comparisons.</p>');
  $('#search').oninput=e=>currentStudy?renderTopicIndex(e.target.value):renderSideStudies(e.target.value);
  $$('[data-action]').forEach(b=>b.onclick=()=>detail(b.dataset.action));
  $('#closeDialog').onclick=()=>$('#dialog').close();
  $('#readPassage').onclick=()=>{const t=topics[currentTopic];openDialog('Key Bible Passages',t.verses.map(r=>`<div class="supportItem"><button data-ref="${r}">📖 ${r}</button><p>${verses[r]||''}</p></div>`).join(''))};
  $('#keyObs').onclick=()=>openDialog('Bible-First Observation',`<p>${topics[currentTopic].bible_first}</p>`);
  $('#prevBtn').onclick=()=>{if(currentTopic>0){currentTopic--;showTopic()}};
  $('#nextBtn').onclick=()=>{if(currentTopic<topics.length-1){currentTopic++;showTopic()}};
  $('#openFirst').onclick=()=>openStudy(studies[0].id);
  $('#futureStudies').onclick=()=>openDialog('Future Bible Studies','<p>The library is ready for more studies. We can add new study cards and their own topic files as you continue building.</p>');
}
init();
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
