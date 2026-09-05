
let studies=[],topics=[],verses={},currentStudy=null,currentTopic=0;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
async function init(){
  studies=await (await fetch('data/studies.json',{cache:'no-store'})).json();
  topics=await (await fetch('data/topics.json',{cache:'no-store'})).json();
  verses=await (await fetch('data/verses.json',{cache:'no-store'})).json();
  renderLibrary(); bind(); showLibrary();
}
function closeSide(){$('#sidebar').classList.remove('open')}
function showLibrary(){
  $('#libraryView').hidden=false;$('#studyView').hidden=true;$('#topicView').hidden=true;
  currentStudy=null;$('#brandTitle').textContent='Bible Study Library';renderStudySidebar();closeSide();scrollTo(0,0)
}
function showStudy(){
  $('#libraryView').hidden=true;$('#studyView').hidden=false;$('#topicView').hidden=true;
  $('#brandTitle').textContent=currentStudy.title;renderTopicIndex();closeSide();scrollTo(0,0)
}
function showTopic(){
  $('#libraryView').hidden=true;$('#studyView').hidden=true;$('#topicView').hidden=false;
  $('#brandTitle').textContent=currentStudy.title;renderTopic();closeSide();scrollTo(0,0)
}
function renderLibrary(){
  const feat=studies.slice(0,3);
  $('#featuredStudies').innerHTML=feat.map((s,i)=>`<article class="studyCard ${i===0?'primary':''}">
  <div class="studyThumb">${s.icon}</div><h3>${s.title}</h3><div class="sub">${s.subtitle}</div><p>${s.description}</p>
  <button data-study="${s.id}">${s.available?'Open Study →':'Coming Soon'}</button></article>`).join('');
  $$('#featuredStudies [data-study]').forEach(b=>b.onclick=()=>openStudy(b.dataset.study));
}
function renderStudySidebar(q=''){
  $('#sideTitle').textContent='📖 Studies';
  const m=studies.filter(s=>(s.title+' '+s.subtitle).toLowerCase().includes(q.toLowerCase()));
  $('#sideNav').innerHTML=`<button class="active">▦ All Studies<small>Browse all Bible studies</small></button>`+
  m.map(s=>`<button data-study="${s.id}">${s.icon} ${s.title}<small>${s.subtitle}</small></button>`).join('');
  $$('#sideNav [data-study]').forEach(b=>b.onclick=()=>openStudy(b.dataset.study));
}
function openStudy(id){
  const s=studies.find(x=>x.id===id); if(!s)return;
  if(!s.available){openDialog(s.title,'<p>This study is listed in the library and can be added next.</p>');return}
  currentStudy=s;$('#studyTitle').textContent=s.title;$('#studyDescription').textContent=s.description;$('#studyCrumb').textContent=s.title;$('#crumbStudy').textContent=s.title;showStudy();
}
function renderTopicIndex(q=''){
  $('#sideTitle').textContent='📖 Study Index';
  const m=topics.filter(t=>(t.title+' '+t.subtitle+' '+t.verses.join(' ')).toLowerCase().includes(q.toLowerCase()));
  $('#sideNav').innerHTML=m.map((t)=>`<button data-topic="${t.id}">${topics.indexOf(t)+1}. ${t.title}<small>${t.subtitle}</small></button>`).join('');
  $('#topicCards').innerHTML=m.map(t=>`<button data-topic="${t.id}"><h3>${topics.indexOf(t)+1}. ${t.title}</h3><p>${t.subtitle}</p></button>`).join('');
  $$('[data-topic]').forEach(b=>b.onclick=()=>openTopic(b.dataset.topic));
}
function openTopic(id){currentTopic=topics.findIndex(t=>t.id===id);if(currentTopic>=0)showTopic()}
function renderTopic(){
  const t=topics[currentTopic];
  $('#topicNumber').textContent=currentTopic+1;$('#topicTitle').textContent=t.title;$('#topicRefs').textContent=t.verses.join('   |   ');
  $('#crumbTopic').textContent=t.title;$('#preSummary').textContent=t.pretrib.summary;$('#sdaSummary').textContent=t.adventist.summary;$('#bibleFirst').textContent=t.bible_first;
  $('#featuredVerse').textContent='“'+(verses[t.verses[0]]||t.verses[0])+'”';
  $('#takeawayList').innerHTML=t.takeaways.map(x=>`<li>${x}</li>`).join('');
  $('#relatedList').innerHTML=topics.filter((_,i)=>i!==currentTopic).slice(0,4).map(r=>`<button data-related="${r.id}">${r.title} ›</button>`).join('');
  $$('[data-related]').forEach(b=>b.onclick=()=>openTopic(b.dataset.related));
  $('#sideTitle').textContent='📖 Study Index';
  $('#sideNav').innerHTML=topics.map((x,i)=>`<button class="${i===currentTopic?'active':''}" data-topic="${x.id}">${i+1}. ${x.title}<small>${x.subtitle}</small></button>`).join('');
  $$('#sideNav [data-topic]').forEach(b=>b.onclick=()=>openTopic(b.dataset.topic));
  $('#prevBtn').disabled=currentTopic===0;$('#nextBtn').disabled=currentTopic===topics.length-1;
}
function supportHTML(items){return items.map(x=>`<div class="supportItem"><button data-ref="${x.ref}">📖 ${x.ref}</button><p>${x.why}</p></div>`).join('')}
function detail(kind){
  const t=topics[currentTopic];let title='',html='';
  if(kind==='preTeach'){title='Christian Pre-Tribulation — Their Teachings';html=`<p>${t.pretrib.teaching}</p>`}
  if(kind==='preSupport'){title='Christian Pre-Tribulation — Bible Support';html=supportHTML(t.pretrib.support)}
  if(kind==='sdaTeach'){title='Seventh-day Adventist — Their Teachings';html=`<p>${t.adventist.teaching}</p>`}
  if(kind==='sdaSupport'){title='Seventh-day Adventist — Bible Support';html=supportHTML(t.adventist.support)}
  openDialog(title,html);
}
function openDialog(title,html){$('#dialogTitle').textContent=title;$('#dialogBody').innerHTML=html;$$('#dialogBody [data-ref]').forEach(b=>b.onclick=()=>showVerse(b.dataset.ref));$('#dialog').showModal()}
function showVerse(ref){openDialog(ref,`<p style="font-family:Georgia,serif;font-size:19px;line-height:1.6">${verses[ref]||'Verse text not added yet.'}</p>`)}
function bind(){
  $('#menuBtn').onclick=()=>$('#sidebar').classList.add('open');$('#closeSide').onclick=closeSide;
  $('#homeBtn').onclick=$('#backLibrary').onclick=$('#crumbHome').onclick=showLibrary;$('#crumbStudy').onclick=showStudy;
  $('#search').oninput=e=>currentStudy?renderTopicIndex(e.target.value):renderStudySidebar(e.target.value);
  $$('#featuredStudies [data-study]').forEach(b=>b.onclick=()=>openStudy(b.dataset.study));
  $$('[data-action]').forEach(b=>b.onclick=()=>detail(b.dataset.action));
  $('#prevBtn').onclick=()=>{if(currentTopic>0){currentTopic--;showTopic()}};$('#nextBtn').onclick=()=>{if(currentTopic<topics.length-1){currentTopic++;showTopic()}};
  $('#readFull').onclick=$('#whatBible').onclick=()=>{const t=topics[currentTopic];openDialog('Read Full Passage',t.verses.map(r=>`<div class="supportItem"><button data-ref="${r}">📖 ${r}</button><p>${verses[r]||''}</p></div>`).join(''))};
  $('#keyObs').onclick=()=>openDialog('Key Observations',`<p>${topics[currentTopic].bible_first}</p>`);
  $('#aboutBtn').onclick=()=>openDialog('About This Library','<p>This web app is a growing collection of interactive Bible studies.</p>');
  $('#settingsBtn').onclick=()=>openDialog('Settings','<p>Settings can be expanded later.</p>');
  $('#howBtn').onclick=()=>openDialog('How to Use This Library','<p>Choose a study, open its index, then select a topic. Use the colored buttons to compare teachings and Bible support.</p>');
  $('#faqBtn').onclick=()=>openDialog('Frequently Asked Questions','<p>More FAQ content can be added later.</p>');
  $('#suggestBtn').onclick=()=>openDialog('Suggest a New Study','<p>Add the next Bible study to data/studies.json and its topics to a new data file.</p>');
  $('#shareBtn').onclick=()=>openDialog('Share This Project','<p>Share your GitHub Pages link with anyone who wants to use the study.</p>');
  $('#closeDialog').onclick=()=>$('#dialog').close();
}
init();
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
