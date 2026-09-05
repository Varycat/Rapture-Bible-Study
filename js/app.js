import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let user=null, owner=false, studies=[], allowedStudies=[], currentStudy=null, topics=[], verses={}, currentTopic=0;

const SETTINGS_KEY='bible-study-v11-settings';
const defaults={title:'Bible Study Library',subtitle:'INTERACTIVE BIBLE STUDIES',heroTitle:'Bible Study Library',heroTagline:'Explore. Compare. Discover. Grow.',footer:'Let the Bible speak, and let us compare scripture with scripture.',font:'system',fontSize:100,primary:'#0c73e6',background:'#f7fafe',text:'#08245b',card:'#ffffff',topbarBg:'#ffffff',tabBg:'#ffffff',tabText:'#081d55',sidebarBg:'#ffffff',sidebarText:'#092762',studyBar:'#9dcfff',studyBarText:'#082068',studyTitleFont:'',studyBarSize:100,density:'comfortable',cardStyle:'rounded',sidebar:true,quotes:true,animations:true};

function ekey(email){return String(email||'').trim().toLowerCase()}
function normalizeStudyId(id){ return id==='dead' ? 'state-of-the-dead' : id; }
function normalizeStudyIds(ids){ return [...new Set((ids||[]).map(normalizeStudyId))]; }
function settings(){try{return {...defaults,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch{return {...defaults}}}
function esc(t){return String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
const FONT_STACKS={system:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',modern:'Inter,Arial,Helvetica,sans-serif',serif:'Georgia,"Times New Roman",serif',rounded:'"Arial Rounded MT Bold","Trebuchet MS",sans-serif'};
function ytId(u){const m=String(u||'').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);return m?m[1]:''}
function videoGrid(urls){
  const ids=(urls||[]).map(ytId).filter(Boolean);
  return ids.length?`<div class="videoGrid">${ids.map(id=>`<div class="videoEmbed"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube video" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`).join('')}</div>`:''
}
function videoLines(sel){return $(sel).value.split('\n').map(x=>x.trim()).filter(x=>ytId(x))}
function applySettings(s){
  const r=document.documentElement.style;
  r.setProperty('--app-primary',s.primary);
  r.setProperty('--app-bg',s.background);
  r.setProperty('--app-text',s.text);
  r.setProperty('--app-card',s.card);
  r.setProperty('--app-topbar-bg',s.topbarBg);
  r.setProperty('--app-tab-bg',s.tabBg);
  r.setProperty('--app-tab-text',s.tabText);
  r.setProperty('--app-sidebar-bg',s.sidebarBg);
  r.setProperty('--app-sidebar-text',s.sidebarText);
  r.setProperty('--app-studybar',s.studyBar);
  r.setProperty('--app-studybar-text',s.studyBarText);
  r.setProperty('--app-studytitle-font',FONT_STACKS[s.studyTitleFont]||'inherit');
  r.setProperty('--app-studybar-scale',String((s.studyBarSize||100)/100));
  r.setProperty('--app-font-scale',String(s.fontSize/100));

  document.body.className=`font-${s.font} density-${s.density} card-${s.cardStyle}`+
    (s.sidebar?'':' no-sidebar')+
    (s.quotes?'':' hide-quotes')+
    (s.animations?'':' no-animations');

  $('#brandTitle').textContent=s.title;
  const sub=document.querySelector('.brand small'); if(sub)sub.textContent=s.subtitle;
  const heroTitle=$('#heroTitle'); if(heroTitle)heroTitle.textContent=s.heroTitle||s.title;
  const heroTagline=$('#heroTagline'); if(heroTagline)heroTagline.textContent=s.heroTagline;
  $$('.footerMessage').forEach(x=>x.textContent=s.footer);
  applyPhotos();
  if(studies.length&&!$('#libraryView').hidden){renderLibrary();if(!currentStudy)renderSidebar($('#search')?.value||'')}
  document.title=s.title;
}
let heroImageValue=null, bannersDraft=null;
let branding={hero:'',heroAdj:null,banners:{},icons:{}};
let iconsDraft=null;
function effIcons(){return iconsDraft===null?branding.icons:iconsDraft}
const DEFAULT_ADJ={posX:50,posY:50,zoom:100,bright:100,contrast:100,sat:100};
let heroAdjDraft=null;
function effHeroAdj(){return {...DEFAULT_ADJ,...(heroAdjDraft||branding.heroAdj||{})}}
function fillSettings(){
  const s=settings();
  $('#settingTitle').value=s.title;
  $('#settingSubtitle').value=s.subtitle;
  $('#settingHeroTitle').value=s.heroTitle||s.title;
  $('#settingHeroTagline').value=s.heroTagline;
  $('#settingFooter').value=s.footer;
  heroImageValue=branding.hero||'';
  $('#settingHeroImage').value=(branding.hero&&!branding.hero.startsWith('data:'))?branding.hero:'';
  $('#settingHeroImageFile').value='';
  const hp=$('#heroPhotoControls');if(hp)hp.hidden=!owner;
  const sbs=$('#studyBannerSection');if(sbs)sbs.hidden=!owner;
  heroAdjDraft={...effHeroAdj()};
  [['heroPosX','posX'],['heroPosY','posY'],['heroZoom','zoom'],['heroBright','bright'],['heroContrast','contrast'],['heroSat','sat']].forEach(([id,key])=>{
    const el=$('#'+id),out=$('#'+id+'Out');
    if(el){el.value=heroAdjDraft[key];if(out)out.value=heroAdjDraft[key]+'%'}
  });
  bannersDraft={...branding.banners};
  iconsDraft={...branding.icons};
  const bw=$('#studyBannerSettings');
  if(bw){
    const list=visibleStudies();
    bw.innerHTML=list.length?list.map(st=>`<div class="bannerRow"><b>${effIcons()[st.id]||st.icon||'📖'} ${esc(st.title)}</b><div class="iconRow"><label>Icon <input type="text" maxlength="4" data-banner-icon="${st.id}" value="${esc(iconsDraft[st.id]||st.icon||'')}" placeholder="📖"></label></div><input type="url" placeholder="https://... photo link" data-banner-url="${st.id}" value="${bannersDraft[st.id]&&!String(bannersDraft[st.id]).startsWith('data:')?esc(bannersDraft[st.id]):''}"><div class="bannerRowBtns"><label class="bannerUpload">⬆ Upload<input type="file" accept="image/*" data-banner-file="${st.id}" hidden></label><button type="button" data-banner-clear="${st.id}">Remove</button></div></div>`).join(''):'<p class="smallHelp">No studies are visible yet.</p>';
    $$('[data-banner-icon]').forEach(i=>i.addEventListener('input',()=>{
      const v=i.value.trim(),id=i.dataset.bannerIcon,cat=studies.find(x=>x.id===id);
      if(v&&v!==(cat?.icon||''))iconsDraft[id]=v;else delete iconsDraft[id];
      applySettings(readSettings());
    }));
    $$('[data-banner-url]').forEach(i=>i.addEventListener('input',()=>{const v=i.value.trim();if(v)bannersDraft[i.dataset.bannerUrl]=v;else delete bannersDraft[i.dataset.bannerUrl];applySettings(readSettings())}));
    $$('[data-banner-file]').forEach(f=>f.addEventListener('change',async()=>{
      try{const d=await fileToCompressedDataURL(f.files[0],1200,220000,300000);if(d){bannersDraft[f.dataset.bannerFile]=d;const u=bw.querySelector(`[data-banner-url="${f.dataset.bannerFile}"]`);if(u)u.value='';applySettings(readSettings())}}
      catch(e){openDialog('Study Banner',`<p>${e.message}</p>`)}
    }));
    $$('[data-banner-clear]').forEach(b=>b.addEventListener('click',()=>{
      delete bannersDraft[b.dataset.bannerClear];
      const u=bw.querySelector(`[data-banner-url="${b.dataset.bannerClear}"]`);if(u)u.value='';
      const f=bw.querySelector(`[data-banner-file="${b.dataset.bannerClear}"]`);if(f)f.value='';
      applySettings(readSettings());
    }));
  }
  $('#settingFont').value=s.font;
  $('#settingFontSize').value=s.fontSize;
  $('#fontSizeOutput').value=s.fontSize+'%';
  $('#settingPrimary').value=s.primary;
  $('#settingBackground').value=s.background;
  $('#settingText').value=s.text;
  $('#settingCard').value=s.card;
  $('#settingTopbarBg').value=s.topbarBg;
  $('#settingTabBg').value=s.tabBg;
  $('#settingTabText').value=s.tabText;
  $('#settingSidebarBg').value=s.sidebarBg;
  $('#settingSidebarText').value=s.sidebarText;
  $('#settingStudyBar').value=s.studyBar;
  $('#settingStudyBarText').value=s.studyBarText;
  $('#settingStudyTitleFont').value=s.studyTitleFont;
  $('#settingStudyBarSize').value=s.studyBarSize;
  $('#studyBarSizeOut').value=s.studyBarSize+'%';
  $('#settingDensity').value=s.density;
  $('#settingCardStyle').value=s.cardStyle;
  $('#settingSidebar').checked=s.sidebar;
  $('#settingQuotes').checked=s.quotes;
  $('#settingAnimations').checked=s.animations;
}
function readSettings(){return {
  title:$('#settingTitle').value.trim()||defaults.title,
  subtitle:$('#settingSubtitle').value.trim()||defaults.subtitle,
  heroTitle:$('#settingHeroTitle').value.trim()||defaults.heroTitle,
  heroTagline:$('#settingHeroTagline').value.trim()||defaults.heroTagline,
  footer:$('#settingFooter').value.trim()||defaults.footer,
  font:$('#settingFont').value,
  fontSize:+$('#settingFontSize').value,
  primary:$('#settingPrimary').value,
  background:$('#settingBackground').value,
  text:$('#settingText').value,
  card:$('#settingCard').value,
  topbarBg:$('#settingTopbarBg').value,
  tabBg:$('#settingTabBg').value,
  tabText:$('#settingTabText').value,
  sidebarBg:$('#settingSidebarBg').value,
  sidebarText:$('#settingSidebarText').value,
  studyBar:$('#settingStudyBar').value,
  studyBarText:$('#settingStudyBarText').value,
  studyTitleFont:$('#settingStudyTitleFont').value,
  studyBarSize:+$('#settingStudyBarSize').value,
  density:$('#settingDensity').value,
  cardStyle:$('#settingCardStyle').value,
  sidebar:$('#settingSidebar').checked,
  quotes:$('#settingQuotes').checked,
  animations:$('#settingAnimations').checked
}}

async function isOwner(){
  if(!user)return false;
  return (await getDoc(doc(db,'owners',user.uid))).exists();
}
async function loadPermissions(){
  if(owner)return studies.map(s=>s.id);
  const snap=await getDoc(doc(db,'permissions',ekey(user.email)));
  return snap.exists()?normalizeStudyIds(snap.data().allowedStudies||[]):[];
}
async function loadStudyCatalog(){
  // Public file contains titles/metadata only. Actual study content remains protected in Firestore.
  return await (await fetch('data/studies.json',{cache:'no-store'})).json();
}
async function loadStudyContent(id){
  id=normalizeStudyId(id);
  const studySnap=await getDoc(doc(db,'studies',id)); if(!studySnap.exists()) throw new Error('Study content not found in Firestore.');
  const tSnap=await getDocs(collection(db,'studies',id,'topics'));
  topics=tSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.order||999)-(b.order||999));
  const vSnap=await getDocs(collection(db,'studies',id,'verses'));
  verses={};vSnap.docs.forEach(d=>{const x=d.data();verses[x.ref||decodeURIComponent(d.id)]=x.text||''});
  return studySnap.data();
}
async function progressDoc(email=user.email){
  const snap=await getDoc(doc(db,'progress',ekey(email)));
  return snap.exists()?snap.data():{completedStudies:[],completedTopics:{}};
}
async function markTopicComplete(topicId){
  const p=await progressDoc(); const ct=p.completedTopics||{}; const arr=new Set(ct[currentStudy.id]||[]); arr.add(topicId); ct[currentStudy.id]=[...arr];
  await setDoc(doc(db,'progress',ekey(user.email)),{completedStudies:p.completedStudies||[],completedTopics:ct,updatedAt:new Date().toISOString()},{merge:true});
  await refreshProgressUI();
}
async function markStudyComplete(){
  const p=await progressDoc(); const done=new Set(p.completedStudies||[]);done.add(currentStudy.id);
  await setDoc(doc(db,'progress',ekey(user.email)),{completedStudies:[...done],completedTopics:p.completedTopics||{},updatedAt:new Date().toISOString()},{merge:true});
  await refreshProgressUI();
  openDialog('Study Completed','<p>Your completion has been saved. The owner can now see that you finished this study and may unlock the next one for you.</p>');
}
async function refreshProgressUI(){
  if(!user||!currentStudy)return;
  const p=await progressDoc(); const topicDone=new Set((p.completedTopics||{})[currentStudy.id]||[]);
  const studyDone=new Set(p.completedStudies||[]);
  const btn=$('#completeTopicBtn'); if(btn)btn.textContent=topicDone.has(topics[currentTopic]?.id)?'✓ Topic Completed':'✓ Mark Topic Complete';
  const sbtn=$('#completeStudyBtn'); if(sbtn)sbtn.textContent=studyDone.has(currentStudy.id)?'✓ Study Completed':'✓ Mark Study Complete';
}

function showLibrary(){$('#libraryView').hidden=false;$('#studyView').hidden=true;$('#topicView').hidden=true;currentStudy=null;renderLibrary();renderSidebar();refreshNotesScope();closeSide();scrollTo(0,0)}
function showStudy(){$('#libraryView').hidden=true;$('#studyView').hidden=false;$('#topicView').hidden=true;renderTopicIndex();refreshNotesScope();closeSide();scrollTo(0,0)}
function showTopic(){$('#libraryView').hidden=true;$('#studyView').hidden=true;$('#topicView').hidden=false;renderTopic();closeSide();scrollTo(0,0)}
function closeSide(){$('#sidebar').classList.remove('open')}

function visibleStudies(){return owner?studies:studies.filter(s=>allowedStudies.includes(s.id))}
function renderLibrary(){
  const list=visibleStudies();
  $('#featuredStudies').innerHTML=list.length?list.map((s,i)=>`<article class="studyCard ${i===0?'primary':''}"><div class="studyThumb${effBanners()[s.id]?' hasPhoto':''}"${effBanners()[s.id]?` style="--card-photo:url('${effBanners()[s.id]}')"`:''}><span class="thumbIcon">${effIcons()[s.id]||s.icon||'📖'}</span></div><div class="cardBody"><h3 class="thumbTitle">${s.title}</h3><div class="sub">${s.subtitle||''}</div><p>${s.description||''}</p><button data-study="${s.id}">Open Study →</button></div></article>`).join(''):'<article class="studyCard"><div class="cardBody"><h3>No studies unlocked yet</h3><p>Ask the owner to give you access to your first study.</p></div></article>';
  $$('[data-study]').forEach(b=>b.onclick=()=>openStudy(b.dataset.study));
}
function renderSidebar(q=''){
  const list=visibleStudies().filter(s=>(s.title+' '+(s.subtitle||'')).toLowerCase().includes(q.toLowerCase()));
  $('#sideTitle').textContent='📖 Studies';
  $('#sideNav').innerHTML=
    `<button id="navAllStudies" class="navItem active"><span class="navIcon">▦</span><span class="navText">All Studies<small>Browse all Bible studies</small></span></button>`
    +list.map(s=>`<button class="navItem" data-study="${s.id}"><span class="navIcon">${effIcons()[s.id]||s.icon||'📖'}</span><span class="navText">${s.title}<small>${s.subtitle||''}</small></span></button>`).join('');
  $$('#sideNav [data-study]').forEach(b=>b.onclick=()=>openStudy(b.dataset.study));
  const all=$('#navAllStudies'); if(all)all.onclick=showLibrary;
}
function applyStudyHeaderBanner(){
  const tc=document.querySelector('.studyTitleCard');if(!tc)return;
  const ban=currentStudy&&effBanners()[currentStudy.id];
  if(ban){tc.classList.add('hasPhoto');tc.style.setProperty('--card-photo',`url("${ban}")`)}
  else{tc.classList.remove('hasPhoto');tc.style.removeProperty('--card-photo')}
}
async function openStudy(id){
  id=normalizeStudyId(id);
  if(!owner&&!allowedStudies.includes(id))return;
  currentStudy=studies.find(s=>s.id===id); if(!currentStudy)return;
  try{const sdata=await loadStudyContent(id);Object.assign(currentStudy,sdata)}catch(e){openDialog('Study Not Ready',`<p>${e.message}</p>`);return}
  $('#studyTitle').textContent=currentStudy.title;$('#studyDescription').textContent=currentStudy.description||'';$('#studyCrumb').textContent=currentStudy.title;$('#crumbStudy').textContent=currentStudy.title;
  $('#studyVideos').innerHTML=videoGrid(currentStudy.videos);
  applyStudyHeaderBanner();
  showStudy();
}
function renderTopicIndex(q=''){
  const m=topics.filter(t=>(t.title+' '+(t.subtitle||'')+' '+(t.verses||[]).join(' ')).toLowerCase().includes(q.toLowerCase()));
  $('#sideTitle').textContent='📖 Study Index';
  $('#sideNav').innerHTML=m.map((t,i)=>`<button data-topic="${t.id}">${topics.indexOf(t)+1}. ${t.title}<small>${t.subtitle||''}</small></button>`).join('');
  $('#topicCards').innerHTML=m.map(t=>`<button data-topic="${t.id}"><h3>${topics.indexOf(t)+1}. ${t.title}</h3><p>${t.subtitle||''}</p></button>`).join('');
  $$('[data-topic]').forEach(b=>b.onclick=()=>openTopic(b.dataset.topic));
  const c=$('#completeStudyBtn'); if(c)c.hidden=false; updateOwnerButtons(); refreshProgressUI();
}
function openTopic(id){currentTopic=topics.findIndex(t=>t.id===id);if(currentTopic>=0)showTopic()}
function renderTopic(){
  const t=topics[currentTopic];$('#topicNumber').textContent=currentTopic+1;$('#topicTitle').textContent=t.title;$('#topicRefs').textContent=(t.verses||[]).join('   |   ');$('#crumbTopic').textContent=t.title;
  $('#preSummary').textContent=t.pretrib?.summary||'';$('#sdaSummary').textContent=t.adventist?.summary||'';$('#bibleFirst').textContent=t.bible_first||'';
  $('#topicVideos').innerHTML=videoGrid(t.videos);
  $('#preVideos').innerHTML=videoGrid(t.pretrib?.videos);
  $('#sdaVideos').innerHTML=videoGrid(t.adventist?.videos);
  $('#bibleVideos').innerHTML=videoGrid(t.bible_videos);
  $('#featuredVerse').textContent='“'+(verses[(t.verses||[])[0]]||'')+'”';$('#takeawayList').innerHTML=(t.takeaways||[]).map(x=>`<li>${x}</li>`).join('');
  renderTopicExtras(t);updateOwnerButtons();
  $('#relatedList').innerHTML=topics.filter((_,i)=>i!==currentTopic).slice(0,4).map(r=>`<button data-related="${r.id}">${r.title} ›</button>`).join('');
  $$('[data-related]').forEach(b=>b.onclick=()=>openTopic(b.dataset.related));
  $('#sideNav').innerHTML=topics.map((x,i)=>`<button class="${i===currentTopic?'active':''}" data-topic="${x.id}">${i+1}. ${x.title}<small>${x.subtitle||''}</small></button>`).join('');
  $$('#sideNav [data-topic]').forEach(b=>b.onclick=()=>openTopic(b.dataset.topic));
  $('#prevBtn').disabled=currentTopic===0;$('#nextBtn').disabled=currentTopic===topics.length-1;refreshProgressUI();
}
function supportHTML(items=[]){return items.map(x=>`<div class="supportItem"><button data-ref="${x.ref}">📖 ${x.ref}</button><p>${x.why}</p></div>`).join('')}
function detail(kind){
  const t=topics[currentTopic];let title='',html='';
  if(kind==='preTeach'){title='Christian Pre-Tribulation — Their Teachings';html=`<p>${t.pretrib?.teaching||''}</p>`+videoGrid(t.pretrib?.videos)}
  if(kind==='preSupport'){title='Christian Pre-Tribulation — Bible Support';html=supportHTML(t.pretrib?.support)}
  if(kind==='sdaTeach'){title='Seventh-day Adventist — Their Teachings';html=`<p>${t.adventist?.teaching||''}</p>`+videoGrid(t.adventist?.videos)}
  if(kind==='sdaSupport'){title='Seventh-day Adventist — Bible Support';html=supportHTML(t.adventist?.support)}
  openDialog(title,html)
}
function openDialog(title,html){$('#dialogTitle').textContent=title;$('#dialogBody').innerHTML=html;$$('#dialogBody [data-ref]').forEach(b=>b.onclick=()=>showVerse(b.dataset.ref));$('#dialog').showModal()}
function showVerse(ref){openDialog(ref,`<p style="font-family:Georgia,serif;font-size:19px;line-height:1.6">${verses[ref]||'Verse text not added yet.'}</p>`)}

async function renderOwnerPanel(){
  const sec=$('#ownerAccessSection'); if(!sec)return; sec.hidden=!owner;if(!owner)return;
  $('#readerStudyChecks').innerHTML=studies.map(s=>`<label class="accessItem"><span><b>${s.title}</b><small>${s.subtitle||''}</small></span><input type="checkbox" data-reader-study="${s.id}"></label>`).join('');
  const perm=await getDocs(collection(db,'permissions')); const progress=await getDocs(collection(db,'progress')); const pm={};progress.docs.forEach(d=>pm[d.id]=d.data());
  $('#readerAccessList').innerHTML=perm.empty?'<p>No readers yet.</p>':perm.docs.map(d=>{
    const a=normalizeStudyIds(d.data().allowedStudies||[]), p=pm[d.id]||{}, done=normalizeStudyIds(p.completedStudies||[]);
    return `<div class="readerAccessItem"><div><b>${d.id}</b><small>Access: ${a.length?a.join(', '):'None'}<br>Completed: ${done.length?done.join(', '):'None'}</small></div><div><button data-edit-reader="${d.id}">Edit</button><button data-remove-reader="${d.id}">Remove</button></div></div>`;
  }).join('');
  $$('[data-edit-reader]').forEach(b=>b.onclick=async()=>loadReaderForEdit(b.dataset.editReader));
  $$('[data-remove-reader]').forEach(b=>b.onclick=async()=>{await deleteDoc(doc(db,'permissions',b.dataset.removeReader));await renderOwnerPanel()});
}
async function loadReaderForEdit(email){
  $('#readerEmail').value=email; const snap=await getDoc(doc(db,'permissions',email)); const allowed=snap.exists()?normalizeStudyIds(snap.data().allowedStudies||[]):[];
  $$('[data-reader-study]').forEach(c=>c.checked=allowed.includes(c.dataset.readerStudy));
}
async function saveReader(){
  if(!owner)return;const email=ekey($('#readerEmail').value);if(!email){openDialog('Reader Access','<p>Enter the reader email.</p>');return}
  const allowed=normalizeStudyIds($$('[data-reader-study]:checked').map(c=>c.dataset.readerStudy));
  await setDoc(doc(db,'permissions',email),{allowedStudies:allowed,updatedAt:new Date().toISOString()},{merge:true});
  $('#readerEmail').value='';$$('[data-reader-study]').forEach(c=>c.checked=false);await renderOwnerPanel();
}
async function importSeedFile(file){
  if(!owner||!file)return;
  const data=JSON.parse(await file.text()), id=data.study.id;
  const batch=writeBatch(db);
  batch.set(doc(db,'studies',id),data.study);
  (data.topics||[]).forEach((t,idx)=>batch.set(doc(db,'studies',id,'topics',t.id),{...t,order:idx+1}));
  Object.entries(data.verses||{}).forEach(([ref,text])=>batch.set(doc(db,'studies',id,'verses',encodeURIComponent(ref)),{ref,text}));
  await batch.commit();
  openDialog('Import Complete',`<p>${data.study.title} was uploaded to Firestore.</p>`);
  studies=await loadStudyCatalog();allowedStudies=await loadPermissions();renderLibrary();await renderOwnerPanel();
}


function applyPreset(name){
  const presets={
    blue:{primary:'#0c73e6',background:'#f7fafe',text:'#08245b',card:'#ffffff',topbarBg:'#ffffff',tabBg:'#ffffff',tabText:'#081d55',sidebarBg:'#ffffff',sidebarText:'#092762',studyBar:'#9dcfff',studyBarText:'#082068'},
    forest:{primary:'#2f7d4a',background:'#f4faf5',text:'#173d28',card:'#ffffff',topbarBg:'#ffffff',tabBg:'#eef7ef',tabText:'#173d28',sidebarBg:'#f0f8f1',sidebarText:'#1c4a30',studyBar:'#a9dcb4',studyBarText:'#173d28'},
    warm:{primary:'#b86232',background:'#fff9f2',text:'#4b2b1c',card:'#ffffff',topbarBg:'#fffdf8',tabBg:'#fdf1e4',tabText:'#4b2b1c',sidebarBg:'#fdf4ea',sidebarText:'#55311c',studyBar:'#f4c9a4',studyBarText:'#4b2b1c'},
    dark:{primary:'#66aaff',background:'#0d1624',text:'#edf5ff',card:'#172336',topbarBg:'#111c2e',tabBg:'#1a2941',tabText:'#dce9ff',sidebarBg:'#111c2e',sidebarText:'#dce9ff',studyBar:'#24406b',studyBarText:'#dce9ff'},
    ocean:{primary:'#0e7f96',background:'#f2fafc',text:'#083744',card:'#ffffff',topbarBg:'#ffffff',tabBg:'#e4f4f8',tabText:'#0a4553',sidebarBg:'#eaf6f9',sidebarText:'#0a4553',studyBar:'#a3dcec',studyBarText:'#083744'},
    sunset:{primary:'#d3542e',background:'#fff7f3',text:'#4c2417',card:'#ffffff',topbarBg:'#fff2ea',tabBg:'#ffe6d9',tabText:'#5a2a18',sidebarBg:'#fff0e7',sidebarText:'#5a2a18',studyBar:'#ffc9ad',studyBarText:'#5a2a18'},
    lavender:{primary:'#6d4fc4',background:'#f9f7ff',text:'#2d2352',card:'#ffffff',topbarBg:'#ffffff',tabBg:'#efeafb',tabText:'#352a5e',sidebarBg:'#f2eefc',sidebarText:'#352a5e',studyBar:'#cfc2f2',studyBarText:'#2d2352'},
    olive:{primary:'#6a7a2c',background:'#fafbf2',text:'#2f3517',card:'#ffffff',topbarBg:'#ffffff',tabBg:'#f0f3df',tabText:'#39411d',sidebarBg:'#f3f6e5',sidebarText:'#39411d',studyBar:'#d3ddab',studyBarText:'#2f3517'},
    sepia:{primary:'#8a5a2b',background:'#f8f2e7',text:'#3e2f1c',card:'#fffaf0',topbarBg:'#fbf5ea',tabBg:'#f1e6d2',tabText:'#4a3820',sidebarBg:'#f5ecdb',sidebarText:'#4a3820',studyBar:'#e3cba3',studyBarText:'#3e2f1c'},
    slate:{primary:'#4a6284',background:'#f4f6f9',text:'#232c38',card:'#ffffff',topbarBg:'#ffffff',tabBg:'#e8edf4',tabText:'#2b3646',sidebarBg:'#edf1f6',sidebarText:'#2b3646',studyBar:'#c3d0e2',studyBarText:'#232c38'},
    rose:{primary:'#b8375f',background:'#fff6f8',text:'#4c1a2b',card:'#ffffff',topbarBg:'#ffffff',tabBg:'#fbe7ee',tabText:'#5a2036',sidebarBg:'#fcecf1',sidebarText:'#5a2036',studyBar:'#f6c3d3',studyBarText:'#4c1a2b'},
    midnight:{primary:'#8f7bff',background:'#0b0f1e',text:'#e9ecff',card:'#161c33',topbarBg:'#101528',tabBg:'#1c2340',tabText:'#d7ddff',sidebarBg:'#101528',sidebarText:'#d7ddff',studyBar:'#2c3560',studyBarText:'#d7ddff'}
  };
  const p=presets[name]; if(!p)return;
  $('#settingPrimary').value=p.primary;
  $('#settingBackground').value=p.background;
  $('#settingText').value=p.text;
  $('#settingCard').value=p.card;
  $('#settingTopbarBg').value=p.topbarBg;
  $('#settingTabBg').value=p.tabBg;
  $('#settingTabText').value=p.tabText;
  $('#settingSidebarBg').value=p.sidebarBg;
  $('#settingSidebarText').value=p.sidebarText;
  $('#settingStudyBar').value=p.studyBar;
  $('#settingStudyBarText').value=p.studyBarText;
  applySettings(readSettings());
}


let editorExtraSections=[];

function updateOwnerButtons(){
  $$('.ownerOnlyBtn').forEach(b=>b.hidden=!owner);
}

function openStudyEditor(){
  if(!owner||!currentStudy)return;
  $('#editorTitle').textContent='Edit Study';
  $('#studyEditorPanel').hidden=false;
  $('#topicEditorPanel').hidden=true;
  $('#editStudyTitle').value=currentStudy.title||'';
  $('#editStudySubtitle').value=currentStudy.subtitle||'';
  $('#editStudyDescription').value=currentStudy.description||'';
  $('#editStudyOwnerNote').value=currentStudy.editorNote||'';
  $('#editStudyVideos').value=(currentStudy.videos||[]).join('\n');
  $('#editorDialog').showModal();
}

async function saveStudyEditor(){
  if(!owner||!currentStudy)return;
  const patch={
    title:$('#editStudyTitle').value.trim(),
    subtitle:$('#editStudySubtitle').value.trim(),
    description:$('#editStudyDescription').value.trim(),
    editorNote:$('#editStudyOwnerNote').value.trim(),
    videos:videoLines('#editStudyVideos'),
    updatedAt:new Date().toISOString()
  };
  await setDoc(doc(db,'studies',currentStudy.id),patch,{merge:true});
  Object.assign(currentStudy,patch);
  const cat=studies.find(s=>s.id===currentStudy.id); if(cat)Object.assign(cat,patch);
  $('#studyTitle').textContent=currentStudy.title;
  $('#studyDescription').textContent=currentStudy.description;
  $('#studyVideos').innerHTML=videoGrid(currentStudy.videos);
  $('#editorDialog').close();
  renderLibrary(); renderSidebar();
}

function openTopicEditor(){
  if(!owner||!currentStudy||!topics[currentTopic])return;
  const t=topics[currentTopic];
  $('#editorTitle').textContent='Edit Topic';
  $('#studyEditorPanel').hidden=true;
  $('#topicEditorPanel').hidden=false;

  $('#editTopicTitle').value=t.title||'';
  $('#editTopicSubtitle').value=t.subtitle||'';
  $('#editTopicVerses').value=(t.verses||[]).join(', ');
  $('#editTopicVideos').value=(t.videos||[]).join('\n');
  $('#editPreSummary').value=t.pretrib?.summary||'';
  $('#editPreTeaching').value=t.pretrib?.teaching||'';
  $('#editPreVideos').value=(t.pretrib?.videos||[]).join('\n');
  $('#editSdaSummary').value=t.adventist?.summary||'';
  $('#editSdaTeaching').value=t.adventist?.teaching||'';
  $('#editSdaVideos').value=(t.adventist?.videos||[]).join('\n');
  $('#editBibleFirst').value=t.bible_first||'';
  $('#editBibleVideos').value=(t.bible_videos||[]).join('\n');
  $('#editTopicFont').value=t.style?.font||'';
  $('#editTakeaways').value=(t.takeaways||[]).join('\n');
  $('#editNotes').value=t.notes||'';
  $('#editImageUrl').value=t.image?.src?.startsWith('data:')?'':(t.image?.src||'');
  $('#editImageFile').value='';
  $('#editImageCaption').value=t.image?.caption||'';
  $('#editImagePosition').value=t.image?.position||'top';
  $('#editTopicFontSize').value=t.style?.fontSize||100;
  $('#editTopicFontSizeOut').value=(t.style?.fontSize||100)+'%';
  $('#editTopicTextColor').value=t.style?.textColor||'#08245b';
  $('#editTopicBackground').value=t.style?.background||'#ffffff';
  editorExtraSections=JSON.parse(JSON.stringify(t.extraSections||[]));
  renderExtraSectionEditor();
  $('#editorDialog').showModal();
}

function renderExtraSectionEditor(){
  $('#extraSectionEditorList').innerHTML=editorExtraSections.map((s,i)=>`
    <div class="extraEditorItem">
      <div><b>${s.title||'Untitled Section'}</b><small>${(s.content||'').slice(0,120)}</small></div>
      <button type="button" data-extra-remove="${i}">Remove</button>
    </div>`).join('');
  $$('[data-extra-remove]').forEach(b=>b.onclick=()=>{editorExtraSections.splice(+b.dataset.extraRemove,1);renderExtraSectionEditor()});
}

function addExtraSection(){
  const title=$('#editExtraTitle').value.trim(), content=$('#editExtraContent').value.trim();
  if(!title&&!content)return;
  editorExtraSections.push({title:title||'Additional Notes',content});
  $('#editExtraTitle').value='';$('#editExtraContent').value='';renderExtraSectionEditor();
}

async function fileToCompressedDataURL(file,max=1000,soft=260000,hard=350000){
  if(!file)return '';
  const bitmap=await createImageBitmap(file);
  const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));
  canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  let quality=.78, data=canvas.toDataURL('image/jpeg',quality);
  while(data.length>soft && quality>.35){quality-=.1;data=canvas.toDataURL('image/jpeg',quality)}
  if(data.length>hard)throw new Error('Image is still too large. Please choose a smaller image.');
  return data;
}

async function saveTopicEditor(){
  if(!owner||!currentStudy||!topics[currentTopic])return;
  const t=topics[currentTopic];
  let imgSrc=t.image?.src||'';
  const file=$('#editImageFile').files[0];
  if(file) imgSrc=await fileToCompressedDataURL(file);
  else if($('#editImageUrl').value.trim()) imgSrc=$('#editImageUrl').value.trim();

  const patch={
    title:$('#editTopicTitle').value.trim(),
    subtitle:$('#editTopicSubtitle').value.trim(),
    verses:$('#editTopicVerses').value.split(',').map(x=>x.trim()).filter(Boolean),
    videos:videoLines('#editTopicVideos'),
    pretrib:{...(t.pretrib||{}),summary:$('#editPreSummary').value.trim(),teaching:$('#editPreTeaching').value.trim(),videos:videoLines('#editPreVideos')},
    adventist:{...(t.adventist||{}),summary:$('#editSdaSummary').value.trim(),teaching:$('#editSdaTeaching').value.trim(),videos:videoLines('#editSdaVideos')},
    bible_first:$('#editBibleFirst').value.trim(),
    bible_videos:videoLines('#editBibleVideos'),
    takeaways:$('#editTakeaways').value.split('\n').map(x=>x.trim()).filter(Boolean),
    notes:$('#editNotes').value.trim(),
    image:{src:imgSrc,caption:$('#editImageCaption').value.trim(),position:$('#editImagePosition').value},
    style:{font:$('#editTopicFont').value,fontSize:+$('#editTopicFontSize').value,textColor:$('#editTopicTextColor').value,background:$('#editTopicBackground').value},
    extraSections:editorExtraSections,
    updatedAt:new Date().toISOString()
  };
  await setDoc(doc(db,'studies',currentStudy.id,'topics',t.id),patch,{merge:true});
  Object.assign(t,patch);
  $('#editorDialog').close();
  renderTopic(); renderTopicIndex();
}

async function addNewTopic(){
  if(!owner||!currentStudy)return;
  const id='topic-'+Date.now();
  const order=(topics.reduce((m,t)=>Math.max(m,t.order||0),0)||0)+1;
  const t={
    id,order,title:'New Topic',subtitle:'Click Edit Topic to add content',verses:[],
    pretrib:{summary:'',teaching:'',support:[]},
    adventist:{summary:'',teaching:'',support:[]},
    bible_first:'',takeaways:[],notes:'',
    image:{src:'',caption:'',position:'top'},
    style:{fontSize:100,textColor:'#08245b',background:'#ffffff'},
    extraSections:[]
  };
  await setDoc(doc(db,'studies',currentStudy.id,'topics',id),t);
  topics.push(t);topics.sort((a,b)=>(a.order||999)-(b.order||999));
  currentTopic=topics.findIndex(x=>x.id===id);showTopic();openTopicEditor();
}

async function moveTopic(delta){
  if(!owner||!topics[currentTopic])return;
  const ni=currentTopic+delta;if(ni<0||ni>=topics.length)return;
  const a=topics[currentTopic],b=topics[ni];
  const ao=a.order||currentTopic+1,bo=b.order||ni+1;
  a.order=bo;b.order=ao;
  const batch=writeBatch(db);
  batch.set(doc(db,'studies',currentStudy.id,'topics',a.id),{order:a.order},{merge:true});
  batch.set(doc(db,'studies',currentStudy.id,'topics',b.id),{order:b.order},{merge:true});
  await batch.commit();
  topics.sort((x,y)=>(x.order||999)-(y.order||999));
  currentTopic=topics.findIndex(x=>x.id===a.id);
  openTopicEditor();
}

async function deleteCurrentTopic(){
  if(!owner||!topics[currentTopic])return;
  if(!confirm('Delete this topic permanently?'))return;
  const t=topics[currentTopic];
  await deleteDoc(doc(db,'studies',currentStudy.id,'topics',t.id));
  topics.splice(currentTopic,1);
  currentTopic=Math.max(0,Math.min(currentTopic,topics.length-1));
  $('#editorDialog').close();
  if(topics.length)showTopic(); else showStudy();
}

function renderTopicExtras(t){
  const wrap=$('#topicImageWrap'),img=$('#topicImage'),cap=$('#topicImageCaption');
  const passage=$('#topicView .passageCard');
  if(wrap&&passage){if(t.image?.position==='afterVerse')passage.after(wrap);else passage.before(wrap)}
  if(t.image?.src){wrap.hidden=false;img.src=t.image.src;cap.textContent=t.image.caption||''}
  else{wrap.hidden=true;img.removeAttribute('src');cap.textContent=''}
  $('#topicNotesCard').hidden=!t.notes;
  $('#topicNotes').textContent=t.notes||'';
  $('#extraSections').innerHTML=(t.extraSections||[]).map(s=>`<article class="extraSectionCard"><h3>${s.title||'Additional Section'}</h3><p>${(s.content||'').replace(/\n/g,'<br>')}</p></article>`).join('');
  const topicRoot=$('#topicView');
  if(topicRoot){
    topicRoot.style.setProperty('--topic-font-scale',String((t.style?.fontSize||100)/100));
    topicRoot.style.setProperty('--topic-text-color',t.style?.textColor||'#08245b');
    topicRoot.style.setProperty('--topic-background',t.style?.background||'#ffffff');
    topicRoot.style.fontFamily=FONT_STACKS[t.style?.font]||'';
  }
}

/* ===== v20: Bible versions (Firestore + on-device cache) ===== */
const BIBLE_SOURCES=[
  {id:'en-kjv',name:'King James Version (English)',lang:'en',url:'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json'},
  {id:'en-bbe',name:'Bible in Basic English',lang:'en',url:'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_bbe.json'},
  {id:'es-rvr',name:'Reina Valera (Español)',lang:'es',url:'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/es_rvr.json'},
  {id:'pt-acf',name:'Almeida Corrigida Fiel (Português)',lang:'pt',url:'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/pt_acf.json'}
];
let installedBibles=[], bibleData=null, bibleId='', bibleBook=0, bibleChapter=0;

function idbOpen(){return new Promise((res,rej)=>{const r=indexedDB.open('bible-study-cache',1);r.onupgradeneeded=()=>r.result.createObjectStore('bibles');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function idbGet(key){try{const d=await idbOpen();return await new Promise((res,rej)=>{const t=d.transaction('bibles').objectStore('bibles').get(key);t.onsuccess=()=>res(t.result);t.onerror=()=>rej(t.error)})}catch{return null}}
async function idbSet(key,val){try{const d=await idbOpen();await new Promise((res,rej)=>{const t=d.transaction('bibles','readwrite').objectStore('bibles').put(val,key);t.onsuccess=res;t.onerror=()=>rej(t.error)})}catch{}}
async function idbDel(key){try{const d=await idbOpen();await new Promise((res,rej)=>{const t=d.transaction('bibles','readwrite').objectStore('bibles').delete(key);t.onsuccess=res;t.onerror=()=>rej(t.error)})}catch{}}

function bibleStatus(msg){const el=$('#bibleStatus');if(el)el.textContent=msg}
async function refreshBibleList(){
  try{const snap=await getDocs(collection(db,'bibles'));installedBibles=snap.docs.map(d=>({id:d.id,...d.data()}))}catch{installedBibles=[]}
  const sel=$('#bibleVersionSel');
  if(sel){
    sel.innerHTML=installedBibles.length
      ?'<option value="">Choose version…</option>'+installedBibles.map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('')
      :'<option value="">No versions installed yet</option>';
    if(bibleId)sel.value=bibleId;
  }
  renderBibleAdmin();
}
function renderBibleAdmin(){
  const sec=$('#bibleAdminSection');if(!sec)return;sec.hidden=!owner;if(!owner)return;
  const installed=id=>installedBibles.some(b=>b.id===id);
  $('#bibleCatalogList').innerHTML=BIBLE_SOURCES.map(s=>`<div class="readerAccessItem"><div><b>${esc(s.name)}</b><small>${installed(s.id)?'Installed ✓':'Public domain — free download'}</small></div><div>${installed(s.id)?`<button data-bible-remove="${s.id}">Remove</button>`:`<button data-bible-install="${s.id}">Install</button>`}</div></div>`).join('')
    +installedBibles.filter(b=>!BIBLE_SOURCES.some(s=>s.id===b.id)).map(b=>`<div class="readerAccessItem"><div><b>${esc(b.name)}</b><small>Uploaded version — installed ✓</small></div><div><button data-bible-remove="${b.id}">Remove</button></div></div>`).join('');
  $$('[data-bible-install]').forEach(x=>x.onclick=()=>{x.disabled=true;installBibleFromCatalog(x.dataset.bibleInstall).catch(e=>{x.disabled=false;bibleStatus('Install failed: '+e.message)})});
  $$('[data-bible-remove]').forEach(x=>x.onclick=()=>removeBible(x.dataset.bibleRemove).catch(e=>bibleStatus('Remove failed: '+e.message)));
}
async function installBibleFromCatalog(id){
  const src=BIBLE_SOURCES.find(s=>s.id===id);if(!src||!owner)return;
  bibleStatus(`Downloading ${src.name}…`);
  const res=await fetch(src.url);if(!res.ok)throw new Error('Download failed ('+res.status+')');
  const books=JSON.parse((await res.text()).replace(/^\uFEFF/,''));
  await writeBibleToFirestore(src.id,{name:src.name,lang:src.lang},books);
}
async function importBibleFile(file){
  if(!owner||!file)return;
  bibleStatus('Reading file…');
  const data=JSON.parse((await file.text()).replace(/^\uFEFF/,''));
  let id,meta,books;
  if(Array.isArray(data)){
    id=file.name.replace(/\.json$/i,'').toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'')||('bible-'+Date.now());
    meta={name:file.name.replace(/\.json$/i,''),lang:''};books=data;
  }else{
    id=String(data.id||data.name||'bible-'+Date.now()).toLowerCase().replace(/[^a-z0-9-]+/g,'-');
    meta={name:data.name||id,lang:data.lang||''};books=data.books;
  }
  await writeBibleToFirestore(id,meta,books);
}
async function writeBibleToFirestore(id,meta,books){
  if(!owner)throw new Error('Owner only.');
  if(!Array.isArray(books)||!books.length||!Array.isArray(books[0]?.chapters))throw new Error('Unrecognized Bible file format.');
  for(let i=0;i<books.length;i+=15){
    const batch=writeBatch(db);
    books.slice(i,i+15).forEach((b,j)=>{
      const n=i+j;
      batch.set(doc(db,'bibles',id,'books',String(n).padStart(3,'0')),{order:n,name:b.name||b.abbrev||('Book '+(n+1)),abbrev:b.abbrev||'',chapters:JSON.stringify(b.chapters)});
    });
    await batch.commit();
    bibleStatus(`Saving ${meta.name}… ${Math.min(i+15,books.length)}/${books.length} books`);
  }
  await setDoc(doc(db,'bibles',id),{...meta,books:books.length,installedAt:new Date().toISOString()});
  await idbSet(id,{meta:{id,...meta},books:books.map((b,n)=>({order:n,name:b.name||b.abbrev||('Book '+(n+1)),abbrev:b.abbrev||'',chapters:b.chapters}))});
  bibleStatus(`${meta.name} installed ✓ Readers can now open it from the 📖 Bible panel.`);
  await refreshBibleList();
}
async function removeBible(id){
  if(!owner)return;
  if(!confirm('Remove this Bible version for all readers?'))return;
  bibleStatus('Removing…');
  const snap=await getDocs(collection(db,'bibles',id,'books'));
  for(let i=0;i<snap.docs.length;i+=400){
    const batch=writeBatch(db);
    snap.docs.slice(i,i+400).forEach(d=>batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db,'bibles',id));
  await idbDel(id);
  if(bibleId===id){bibleId='';bibleData=null;renderBibleReader()}
  bibleStatus('Removed ✓');
  await refreshBibleList();
}
async function loadBibleVersion(id){
  if(!id){bibleId='';bibleData=null;renderBibleReader();return}
  const content=$('#bibleContent');if(content)content.innerHTML='<p>Loading version…</p>';
  let data=await idbGet(id);
  if(!data){
    const snap=await getDocs(collection(db,'bibles',id,'books'));
    if(snap.empty)throw new Error('This version has no content in Firestore.');
    const books=snap.docs.map(d=>d.data()).sort((a,b)=>(a.order||0)-(b.order||0)).map(b=>({...b,chapters:JSON.parse(b.chapters)}));
    data={meta:installedBibles.find(b=>b.id===id)||{id},books};
    await idbSet(id,data);
  }
  bibleId=id;bibleData=data;bibleBook=0;bibleChapter=0;
  renderBibleReader();
}
function renderBibleReader(){
  const bookSel=$('#bibleBookSel'),chapSel=$('#bibleChapterSel'),content=$('#bibleContent');
  if(!bookSel)return;
  if(!bibleData){
    bookSel.innerHTML='';chapSel.innerHTML='';
    if(content)content.innerHTML=installedBibles.length?'<p>Choose a Bible version above to start reading.</p>':'<p>No Bible versions installed yet. The owner can install them in Settings → 📖 Bible Versions.</p>';
    return;
  }
  bookSel.innerHTML=bibleData.books.map((b,i)=>`<option value="${i}">${esc(b.name)}</option>`).join('');
  bookSel.value=String(bibleBook);
  const book=bibleData.books[bibleBook];
  chapSel.innerHTML=book.chapters.map((_,i)=>`<option value="${i}">${i+1}</option>`).join('');
  chapSel.value=String(bibleChapter);
  content.innerHTML=`<h4>${esc(book.name)} ${bibleChapter+1}</h4>`+(book.chapters[bibleChapter]||[]).map((v,i)=>`<sup>${i+1}</sup>${esc(v)} `).join('');
}
function bibleSearchRun(q){
  const content=$('#bibleContent');
  if(!bibleData||!content)return;
  q=q.trim().toLowerCase();
  if(q.length<3){renderBibleReader();return}
  const out=[];
  outer:for(let b=0;b<bibleData.books.length;b++){
    const book=bibleData.books[b];
    for(let c=0;c<book.chapters.length;c++){
      const ch=book.chapters[c];
      for(let v=0;v<ch.length;v++){
        if(ch[v].toLowerCase().includes(q)){
          out.push({b,c,v,text:ch[v],name:book.name});
          if(out.length>=60)break outer;
        }
      }
    }
  }
  content.innerHTML=out.length
    ?`<p><b>${out.length>=60?'60+':out.length} result(s)</b></p>`+out.map(r=>`<p><button class="bibleJump" data-b="${r.b}" data-c="${r.c}" style="border:0;background:none;color:var(--app-primary);font-weight:800;cursor:pointer;padding:0;font-family:inherit">${esc(r.name)} ${r.c+1}:${r.v+1}</button><br>${esc(r.text)}</p>`).join('')
    :'<p>No results in this version.</p>';
  $$('.bibleJump').forEach(x=>x.onclick=()=>{bibleBook=+x.dataset.b;bibleChapter=+x.dataset.c;$('#bibleSearch').value='';renderBibleReader()});
}

/* ===== v20: Personal notes (saved to Firestore, private per user) ===== */
let notesData={}, notesTimer=null;
function notesScopeKey(){return $('#notesScope')?.value||'general'}
function refreshNotesScope(){
  const sel=$('#notesScope');if(!sel)return;
  const cur=sel.value;
  sel.innerHTML='<option value="general">General notes</option>'+(currentStudy?`<option value="${currentStudy.id}">${esc(currentStudy.title)}</option>`:'');
  sel.value=(cur&&[...sel.options].some(o=>o.value===cur))?cur:(currentStudy?currentStudy.id:'general');
  const ta=$('#notesText');if(ta)ta.value=notesData[notesScopeKey()]||'';
}
async function loadNotes(){
  if(!user)return;
  try{const snap=await getDoc(doc(db,'notes',ekey(user.email)));notesData=snap.exists()?(snap.data().text||{}):{}}catch{notesData={}}
  refreshNotesScope();
}
function queueNotesSave(){
  notesData[notesScopeKey()]=$('#notesText').value;
  $('#notesStatus').textContent='Saving…';
  clearTimeout(notesTimer);
  notesTimer=setTimeout(async()=>{
    try{
      await setDoc(doc(db,'notes',ekey(user.email)),{text:notesData,updatedAt:new Date().toISOString()},{merge:true});
      $('#notesStatus').textContent='Saved ✓';
    }catch(e){$('#notesStatus').textContent='Could not save: '+e.message}
  },800);
}

/* ===== v20: Global search across studies, topics, verses and Bible ===== */
function searchRun(q){
  const box=$('#searchResults');if(!box)return;
  q=q.trim().toLowerCase();
  if(q.length<2){box.innerHTML='<small>Type at least 2 letters. Searches your studies, topics, study verses'+(bibleData?' and the loaded Bible version':'')+'.</small>';return}
  const out=[];
  visibleStudies().forEach(s=>{if((s.title+' '+(s.subtitle||'')+' '+(s.description||'')).toLowerCase().includes(q))out.push({label:`📚 ${s.title}`,small:s.subtitle||'Study',act:()=>openStudy(s.id)})});
  if(currentStudy)topics.forEach(t=>{
    const hay=[t.title,t.subtitle,t.pretrib?.summary,t.pretrib?.teaching,t.adventist?.summary,t.adventist?.teaching,t.bible_first,(t.takeaways||[]).join(' '),t.notes].join(' ').toLowerCase();
    if(hay.includes(q))out.push({label:`📖 ${t.title}`,small:currentStudy.title,act:()=>openTopic(t.id)});
  });
  Object.entries(verses).forEach(([ref,text])=>{if((ref+' '+text).toLowerCase().includes(q))out.push({label:`📜 ${ref}`,small:String(text).slice(0,110),act:()=>showVerse(ref)})});
  if(bibleData&&q.length>=3){
    let n=0;
    outer:for(let b=0;b<bibleData.books.length;b++){
      const book=bibleData.books[b];
      for(let c=0;c<book.chapters.length;c++){
        const ch=book.chapters[c];
        for(let v=0;v<ch.length;v++){
          if(ch[v].toLowerCase().includes(q)){
            out.push({label:`✝ ${book.name} ${c+1}:${v+1}`,small:ch[v].slice(0,110),act:()=>{openPanel('biblePanel');bibleBook=b;bibleChapter=c;$('#bibleSearch').value='';renderBibleReader()}});
            if(++n>=25)break outer;
          }
        }
      }
    }
  }
  box.innerHTML=out.length?out.slice(0,80).map((r,i)=>`<button data-sres="${i}"><b>${esc(r.label)}</b><small>${esc(r.small)}</small></button>`).join(''):'<small>No results.</small>';
  $$('[data-sres]').forEach(el=>el.onclick=()=>out[+el.dataset.sres].act());
}

/* ===== v20: Floating panels + printing ===== */
function openPanel(id){
  ['notesPanel','searchPanel','biblePanel'].forEach(p=>{const el=$('#'+p);if(el)el.hidden=(p!==id)});
  if(id==='notesPanel')refreshNotesScope();
  if(id==='searchPanel')$('#globalSearch')?.focus();
  if(id==='biblePanel'&&!bibleData)renderBibleReader();
}
function togglePanel(id){const el=$('#'+id);if(!el)return;if(el.hidden)openPanel(id);else el.hidden=true}
function printHTML(title,bodyHTML){
  const w=window.open('','_blank','width=820,height=940');
  if(!w){openDialog('Print','<p>Your browser blocked the print window. Please allow pop-ups for this site.</p>');return}
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Georgia,serif;line-height:1.7;padding:28px;color:#111;max-width:760px;margin:auto}h1{font-size:24px;border-bottom:2px solid #333;padding-bottom:8px}button{border:0;background:none;font:inherit;font-weight:bold;padding:0;text-align:left}small{color:#555;display:block}sup{color:#555;font-weight:bold;margin-right:4px}iframe,.videoGrid{display:none}</style></head><body><h1>${esc(title)}</h1>${bodyHTML}</body></html>`);
  w.document.close();w.focus();
  setTimeout(()=>w.print(),350);
}

/* ===== v24: Shared photos in Firestore (branding) ===== */
function effBanners(){return bannersDraft===null?branding.banners:bannersDraft}
function applyPhotos(){
  const hero=document.querySelector('.hero');
  const h=heroImageValue===null?branding.hero:heroImageValue;
  if(hero){
    if(h){
      const a=effHeroAdj();
      hero.classList.add('hasPhoto');
      hero.style.setProperty('--hero-photo',`url("${h}")`);
      hero.style.setProperty('--hero-pos',`${a.posX}% ${a.posY}%`);
      hero.style.setProperty('--hero-zoom',String((a.zoom||100)/100));
      hero.style.setProperty('--hero-bright',String((a.bright||100)/100));
      hero.style.setProperty('--hero-contrast',String((a.contrast||100)/100));
      hero.style.setProperty('--hero-sat',String((a.sat||100)/100));
    }
    else{hero.classList.remove('hasPhoto');hero.style.removeProperty('--hero-photo')}
  }
  applyStudyHeaderBanner();
}
async function loadBranding(){
  try{
    const snap=await getDocs(collection(db,'branding'));
    const b={hero:'',heroAdj:null,banners:{},icons:{}};
    snap.docs.forEach(d=>{const x=d.data();if(d.id==='hero'){b.hero=x.src||'';b.heroAdj=x.adj||null}else if(d.id.startsWith('banner-')){const id=d.id.slice(7);if(x.src)b.banners[id]=x.src;if(x.icon)b.icons[id]=x.icon}});
    branding=b;
  }catch(e){console.warn('Branding not loaded:',e.message)}
  applyPhotos();
  if(studies.length&&!$('#libraryView').hidden)renderLibrary();
}
async function saveBranding(){
  if(!owner)return;
  const hero=heroImageValue===null?branding.hero:heroImageValue;
  const banners=bannersDraft===null?branding.banners:bannersDraft;
  const icons=iconsDraft===null?branding.icons:iconsDraft;
  const batch=writeBatch(db);
  const now=new Date().toISOString();
  const adj=effHeroAdj();
  if(hero)batch.set(doc(db,'branding','hero'),{src:hero,adj,updatedAt:now});
  else batch.delete(doc(db,'branding','hero'));
  const ids=new Set([...Object.keys(banners),...Object.keys(icons),...Object.keys(branding.banners),...Object.keys(branding.icons)]);
  ids.forEach(id=>{
    const data={updatedAt:now};
    if(banners[id])data.src=banners[id];
    if(icons[id])data.icon=icons[id];
    if(data.src||data.icon)batch.set(doc(db,'branding','banner-'+id),data);
    else batch.delete(doc(db,'branding','banner-'+id));
  });
  await batch.commit();
  branding={hero,heroAdj:{...adj},banners:{...banners},icons:{...icons}};
}

function bind(){
  const on=(sel,event,fn)=>{
    const el=$(sel);
    if(el) el.addEventListener(event,fn);
  };

  on('#loginForm','submit',async e=>{
    e.preventDefault();
    const msg=$('#loginMessage'); if(msg)msg.textContent='Signing in…';
    try{
      await signInWithEmailAndPassword(auth,$('#loginEmail').value.trim(),$('#loginPassword').value);
      if(msg)msg.textContent='';
    }catch{
      if(msg)msg.textContent='Sign in failed. Check the email and password.';
    }
  });

  on('#signOutBtn','click',()=>signOut(auth));
  on('#menuBtn','click',()=>$('#sidebar')?.classList.add('open'));
  on('#closeSide','click',closeSide);
  on('#homeBtn','click',showLibrary);
  on('#backLibrary','click',showLibrary);
  on('#crumbHome','click',showLibrary);
  on('#crumbStudy','click',showStudy);
  on('#search','input',e=>currentStudy?renderTopicIndex(e.target.value):renderSidebar(e.target.value));

  $$('[data-action]').forEach(b=>b.addEventListener('click',()=>detail(b.dataset.action)));
  on('#prevBtn','click',()=>{if(currentTopic>0){currentTopic--;showTopic()}});
  on('#nextBtn','click',()=>{if(currentTopic<topics.length-1){currentTopic++;showTopic()}});

  const readPassage=()=>{
    const t=topics[currentTopic];
    if(!t){openDialog('Read Full Passage','<p>Open a topic first.</p>');return}
    openDialog('Read Full Passage',(t.verses||[]).map(r=>`<div class="supportItem"><button data-ref="${r}">📖 ${r}</button><p>${verses[r]||''}</p></div>`).join(''));
  };
  on('#readFull','click',readPassage);
  on('#whatBible','click',readPassage);
  on('#keyObs','click',()=>openDialog('Key Observations',`<p>${topics[currentTopic]?.bible_first||''}</p>`+videoGrid(topics[currentTopic]?.bible_videos)));
  on('#closeDialog','click',()=>$('#dialog')?.close());

  on('#aboutBtn','click',()=>openDialog('About This Library','<p>This is a private progressive Bible Study Library. The owner decides which study each reader can access.</p>'));
  on('#settingsBtn','click',async()=>{
    fillSettings();
    renderBibleAdmin();
    await renderOwnerPanel().catch(()=>{});
    const d=$('#settingsDialog'); if(d&&!d.open)d.showModal();
  });
  on('#closeSettings','click',()=>$('#settingsDialog')?.close());

  on('#settingFontSize','input',e=>{
    const o=$('#fontSizeOutput'); if(o)o.value=e.target.value+'%';
    applySettings(readSettings());
  });
  on('#settingStudyBarSize','input',e=>{
    const o=$('#studyBarSizeOut'); if(o)o.value=e.target.value+'%';
    applySettings(readSettings());
  });
  on('#settingHeroImage','input',e=>{heroImageValue=e.target.value.trim();applySettings(readSettings())});
  on('#settingHeroImageFile','change',async e=>{
    try{
      heroImageValue=await fileToCompressedDataURL(e.target.files[0],1600,420000,600000);
      $('#settingHeroImage').value='';
      applySettings(readSettings());
    }catch(err){openDialog('Hero Photo',`<p>${err.message}</p>`)}
  });
  on('#clearHeroImage','click',()=>{heroImageValue='';heroAdjDraft={...DEFAULT_ADJ};$('#settingHeroImage').value='';$('#settingHeroImageFile').value='';applySettings(readSettings())});
  [['heroPosX','posX'],['heroPosY','posY'],['heroZoom','zoom'],['heroBright','bright'],['heroContrast','contrast'],['heroSat','sat']].forEach(([id,key])=>{
    on('#'+id,'input',e=>{
      if(heroAdjDraft===null)heroAdjDraft={...effHeroAdj()};
      heroAdjDraft[key]=+e.target.value;
      const out=$('#'+id+'Out');if(out)out.value=e.target.value+'%';
      applyPhotos();
    });
  });
  on('#heroResetAdj','click',()=>{
    heroAdjDraft={...DEFAULT_ADJ};
    [['heroPosX','posX'],['heroPosY','posY'],['heroZoom','zoom'],['heroBright','bright'],['heroContrast','contrast'],['heroSat','sat']].forEach(([id,key])=>{
      const el=$('#'+id),out=$('#'+id+'Out');if(el){el.value=DEFAULT_ADJ[key];if(out)out.value=DEFAULT_ADJ[key]+'%'}
    });
    applyPhotos();
  });
  on('#heroPreviewBtn','click',()=>{
    $('#settingsDialog')?.close();
    showLibrary();
    const b=$('#backToSettings');if(b)b.hidden=false;
  });
  on('#backToSettings','click',()=>{
    const b=$('#backToSettings');if(b)b.hidden=true;
    const d=$('#settingsDialog');if(d&&!d.open)d.showModal();
  });
  ['settingTitle','settingSubtitle','settingHeroTitle','settingHeroTagline','settingFooter','settingFont','settingPrimary','settingBackground','settingText','settingCard','settingTopbarBg','settingTabBg','settingTabText','settingSidebarBg','settingSidebarText','settingStudyBar','settingStudyBarText','settingStudyTitleFont','settingDensity','settingCardStyle','settingSidebar','settingQuotes','settingAnimations']
    .forEach(id=>on('#'+id,'input',()=>applySettings(readSettings())));

  $$('[data-preset]').forEach(b=>b.addEventListener('click',()=>applyPreset(b.dataset.preset)));
  on('#saveSettings','click',async()=>{
    const s=readSettings();
    localStorage.setItem(SETTINGS_KEY,JSON.stringify(s));
    applySettings(s);
    if(owner){
      const btn=$('#saveSettings');btn.disabled=true;btn.textContent='Saving…';
      try{await saveBranding()}
      catch(e){openDialog('Save Photos',`<p>Could not save the photos to Firestore: ${e.message}</p><p>Check that the latest firestore.rules are published.</p>`)}
      btn.disabled=false;btn.textContent='Save Settings';
    }
    $('#settingsDialog')?.close();
  });
  on('#resetSettings','click',()=>{
    localStorage.setItem(SETTINGS_KEY,JSON.stringify(defaults));
    applySettings(defaults);
    fillSettings();
  });

  on('#saveReaderAccess','click',()=>saveReader().catch(e=>openDialog('Reader Access',`<p>${e.message}</p>`)));
  on('#seedImport','change',e=>importSeedFile(e.target.files[0]).catch(err=>openDialog('Import Failed',`<p>${err.message}</p>`)));
  on('#completeTopicBtn','click',()=>{if(topics[currentTopic])markTopicComplete(topics[currentTopic].id)});
  on('#completeStudyBtn','click',markStudyComplete);

  on('#editStudyBtn','click',openStudyEditor);
  on('#addTopicBtn','click',()=>addNewTopic().catch(e=>openDialog('Could Not Add Topic',`<p>${e.message}</p>`)));
  on('#editTopicBtn','click',openTopicEditor);
  on('#closeEditor','click',()=>$('#editorDialog')?.close());
  on('#saveStudyEdit','click',()=>saveStudyEditor().catch(e=>openDialog('Could Not Save',`<p>${e.message}</p>`)));
  on('#saveTopicEdit','click',()=>saveTopicEditor().catch(e=>openDialog('Could Not Save',`<p>${e.message}</p>`)));
  on('#addExtraSectionBtn','click',addExtraSection);
  on('#editTopicFontSize','input',e=>{const o=$('#editTopicFontSizeOut');if(o)o.value=e.target.value+'%'});
  on('#moveTopicUp','click',()=>moveTopic(-1));
  on('#moveTopicDown','click',()=>moveTopic(1));
  on('#deleteTopicBtn','click',deleteCurrentTopic);

  on('#viewAllBtn','click',()=>$('#featuredStudies')?.scrollIntoView({behavior:'smooth',block:'start'}));

  // Home-page Quick Links
  on('#howBtn','click',()=>openDialog('How to Use This Library','<p>Select a study, choose a topic from its Study Index, read the comparison, open the Bible passages, and mark topics complete as you progress.</p>'));
  on('#faqBtn','click',()=>openDialog('Frequently Asked Questions','<p><b>Can readers see every study?</b> No. The owner controls access in Settings.<br><br><b>Can readers edit studies?</b> No. Editing controls are owner-only.</p>'));
  on('#suggestBtn','click',()=>openDialog('Suggest a New Study','<p>Use the Owner Study Editor to add a new topic now. Additional complete studies can also be added as private Firestore seed files.</p>'));
  on('#shareBtn','click',async()=>{
    const url=location.href;
    try{
      if(navigator.share) await navigator.share({title:document.title,url});
      else {await navigator.clipboard.writeText(url);openDialog('Share This Project','<p>The web app link was copied to your clipboard.</p>')}
    }catch{}
  });

  // Floating tools: notes, search, Bible
  on('#fabNotes','click',()=>togglePanel('notesPanel'));
  on('#fabSearch','click',()=>togglePanel('searchPanel'));
  on('#fabBible','click',()=>togglePanel('biblePanel'));
  $$('[data-close-panel]').forEach(b=>b.addEventListener('click',()=>{const el=$('#'+b.dataset.closePanel);if(el)el.hidden=true}));
  on('#notesScope','change',()=>{$('#notesText').value=notesData[notesScopeKey()]||'';$('#notesStatus').textContent=''});
  on('#notesText','input',queueNotesSave);
  on('#globalSearch','input',e=>searchRun(e.target.value));
  on('#bibleVersionSel','change',e=>loadBibleVersion(e.target.value).catch(err=>{const c=$('#bibleContent');if(c)c.innerHTML=`<p>Could not load: ${esc(err.message)}</p>`}));
  on('#bibleBookSel','change',e=>{bibleBook=+e.target.value;bibleChapter=0;renderBibleReader()});
  on('#bibleChapterSel','change',e=>{bibleChapter=+e.target.value;renderBibleReader()});
  let bibleSearchTimer;
  on('#bibleSearch','input',e=>{clearTimeout(bibleSearchTimer);bibleSearchTimer=setTimeout(()=>bibleSearchRun(e.target.value),250)});
  on('#bibleUpload','change',e=>importBibleFile(e.target.files[0]).catch(err=>bibleStatus('Upload failed: '+err.message)));
  on('#printNotes','click',()=>{const sc=$('#notesScope');printHTML('My Notes — '+(sc.options[sc.selectedIndex]?.text||''),`<p>${esc($('#notesText').value).replace(/\n/g,'<br>')}</p>`)});
  on('#printSearch','click',()=>printHTML('Search results — '+$('#globalSearch').value,$('#searchResults').innerHTML));
  on('#printBible','click',()=>printHTML(installedBibles.find(b=>b.id===bibleId)?.name||'Bible',$('#bibleContent').innerHTML));
}

onAuthStateChanged(auth,async u=>{
  user=u;
  if(!u){
    if($('#authGate'))$('#authGate').hidden=false;
    return;
  }
  if($('#authGate'))$('#authGate').hidden=true;
  try{
    owner=await isOwner();
    studies=await loadStudyCatalog();
    allowedStudies=await loadPermissions();
  }catch(e){
    console.error('Startup data error:',e);
    try{ studies=await loadStudyCatalog(); }catch{}
    allowedStudies=owner?studies.map(s=>s.id):[];
  }
  updateOwnerButtons();
  applySettings(settings());
  renderOwnerPanel().catch(()=>{});
  loadNotes().catch(()=>{});
  refreshBibleList().catch(()=>{});
  loadBranding();
  showLibrary();
});

bind();
applySettings(settings());
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
