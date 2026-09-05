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
const defaults={title:'Bible Study Library',subtitle:'INTERACTIVE BIBLE STUDIES',heroTitle:'Bible Study Library',heroTagline:'Explore. Compare. Discover. Grow.',footer:'Let the Bible speak, and let us compare scripture with scripture.',font:'system',fontSize:100,primary:'#0c73e6',background:'#f7fafe',text:'#08245b',card:'#ffffff',density:'comfortable',cardStyle:'rounded',sidebar:true,quotes:true,animations:true};

function ekey(email){return String(email||'').trim().toLowerCase()}
function normalizeStudyId(id){ return id==='dead' ? 'state-of-the-dead' : id; }
function normalizeStudyIds(ids){ return [...new Set((ids||[]).map(normalizeStudyId))]; }
function settings(){try{return {...defaults,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch{return {...defaults}}}
function applySettings(s){
  const r=document.documentElement.style;
  r.setProperty('--app-primary',s.primary);
  r.setProperty('--app-bg',s.background);
  r.setProperty('--app-text',s.text);
  r.setProperty('--app-card',s.card);
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
  document.title=s.title;
}
function fillSettings(){
  const s=settings();
  $('#settingTitle').value=s.title;
  $('#settingSubtitle').value=s.subtitle;
  $('#settingHeroTitle').value=s.heroTitle||s.title;
  $('#settingHeroTagline').value=s.heroTagline;
  $('#settingFooter').value=s.footer;
  $('#settingFont').value=s.font;
  $('#settingFontSize').value=s.fontSize;
  $('#fontSizeOutput').value=s.fontSize+'%';
  $('#settingPrimary').value=s.primary;
  $('#settingBackground').value=s.background;
  $('#settingText').value=s.text;
  $('#settingCard').value=s.card;
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
  verses={};vSnap.docs.forEach(d=>verses[d.id]=d.data().text||'');
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

function showLibrary(){$('#libraryView').hidden=false;$('#studyView').hidden=true;$('#topicView').hidden=true;currentStudy=null;renderLibrary();renderSidebar();closeSide();scrollTo(0,0)}
function showStudy(){$('#libraryView').hidden=true;$('#studyView').hidden=false;$('#topicView').hidden=true;renderTopicIndex();closeSide();scrollTo(0,0)}
function showTopic(){$('#libraryView').hidden=true;$('#studyView').hidden=true;$('#topicView').hidden=false;renderTopic();closeSide();scrollTo(0,0)}
function closeSide(){$('#sidebar').classList.remove('open')}

function visibleStudies(){return owner?studies:studies.filter(s=>allowedStudies.includes(s.id))}
function renderLibrary(){
  const list=visibleStudies();
  $('#featuredStudies').innerHTML=list.length?list.map((s,i)=>`<article class="studyCard ${i===0?'primary':''}"><div class="studyThumb">${s.icon||'📖'}</div><h3>${s.title}</h3><div class="sub">${s.subtitle||''}</div><p>${s.description||''}</p><button data-study="${s.id}">Open Study →</button></article>`).join(''):'<article class="studyCard"><h3>No studies unlocked yet</h3><p>Ask the owner to give you access to your first study.</p></article>';
  $$('[data-study]').forEach(b=>b.onclick=()=>openStudy(b.dataset.study));
}
function renderSidebar(q=''){
  const list=visibleStudies().filter(s=>(s.title+' '+(s.subtitle||'')).toLowerCase().includes(q.toLowerCase()));
  $('#sideTitle').textContent='📖 Studies';$('#sideNav').innerHTML=list.map(s=>`<button data-study="${s.id}">${s.icon||'📖'} ${s.title}<small>${s.subtitle||''}</small></button>`).join('');
  $$('#sideNav [data-study]').forEach(b=>b.onclick=()=>openStudy(b.dataset.study));
}
async function openStudy(id){
  id=normalizeStudyId(id);
  if(!owner&&!allowedStudies.includes(id))return;
  currentStudy=studies.find(s=>s.id===id); if(!currentStudy)return;
  try{await loadStudyContent(id)}catch(e){openDialog('Study Not Ready',`<p>${e.message}</p>`);return}
  $('#studyTitle').textContent=currentStudy.title;$('#studyDescription').textContent=currentStudy.description||'';$('#studyCrumb').textContent=currentStudy.title;$('#crumbStudy').textContent=currentStudy.title;
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
  if(kind==='preTeach'){title='Christian Pre-Tribulation — Their Teachings';html=`<p>${t.pretrib?.teaching||''}</p>`}
  if(kind==='preSupport'){title='Christian Pre-Tribulation — Bible Support';html=supportHTML(t.pretrib?.support)}
  if(kind==='sdaTeach'){title='Seventh-day Adventist — Their Teachings';html=`<p>${t.adventist?.teaching||''}</p>`}
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
  // Verse doc IDs are encoded, loadStudyContent uses data ref in doc values below:
  openDialog('Import Complete',`<p>${data.study.title} was uploaded to Firestore.</p>`);
  studies=await loadStudyCatalog();allowedStudies=await loadPermissions();renderLibrary();await renderOwnerPanel();
}
// Override loadStudyContent verse loading to use stored ref.
const _loadStudyContent=loadStudyContent;
loadStudyContent=async function(id){
  id=normalizeStudyId(id);
  const studySnap=await getDoc(doc(db,'studies',id)); if(!studySnap.exists())throw new Error('Study content not found in Firestore.');
  const tSnap=await getDocs(collection(db,'studies',id,'topics'));topics=tSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.order||999)-(b.order||999));
  const vSnap=await getDocs(collection(db,'studies',id,'verses'));verses={};vSnap.docs.forEach(d=>{const x=d.data();verses[x.ref||decodeURIComponent(d.id)]=x.text||''});
};


function applyPreset(name){
  const presets={
    blue:{primary:'#0c73e6',background:'#f7fafe',text:'#08245b',card:'#ffffff'},
    forest:{primary:'#2f7d4a',background:'#f4faf5',text:'#173d28',card:'#ffffff'},
    warm:{primary:'#b86232',background:'#fff9f2',text:'#4b2b1c',card:'#ffffff'},
    dark:{primary:'#66aaff',background:'#0d1624',text:'#edf5ff',card:'#172336'}
  };
  const p=presets[name]; if(!p)return;
  $('#settingPrimary').value=p.primary;
  $('#settingBackground').value=p.background;
  $('#settingText').value=p.text;
  $('#settingCard').value=p.card;
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
  $('#editorDialog').showModal();
}

async function saveStudyEditor(){
  if(!owner||!currentStudy)return;
  const patch={
    title:$('#editStudyTitle').value.trim(),
    subtitle:$('#editStudySubtitle').value.trim(),
    description:$('#editStudyDescription').value.trim(),
    editorNote:$('#editStudyOwnerNote').value.trim(),
    updatedAt:new Date().toISOString()
  };
  await setDoc(doc(db,'studies',currentStudy.id),patch,{merge:true});
  Object.assign(currentStudy,patch);
  const cat=studies.find(s=>s.id===currentStudy.id); if(cat)Object.assign(cat,patch);
  $('#studyTitle').textContent=currentStudy.title;
  $('#studyDescription').textContent=currentStudy.description;
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
  $('#editPreSummary').value=t.pretrib?.summary||'';
  $('#editPreTeaching').value=t.pretrib?.teaching||'';
  $('#editSdaSummary').value=t.adventist?.summary||'';
  $('#editSdaTeaching').value=t.adventist?.teaching||'';
  $('#editBibleFirst').value=t.bible_first||'';
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

async function fileToCompressedDataURL(file){
  if(!file)return '';
  const bitmap=await createImageBitmap(file);
  const max=1000, scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));
  canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  let quality=.78, data=canvas.toDataURL('image/jpeg',quality);
  while(data.length>260000 && quality>.35){quality-=.1;data=canvas.toDataURL('image/jpeg',quality)}
  if(data.length>350000)throw new Error('Image is still too large. Please choose a smaller image.');
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
    pretrib:{...(t.pretrib||{}),summary:$('#editPreSummary').value.trim(),teaching:$('#editPreTeaching').value.trim()},
    adventist:{...(t.adventist||{}),summary:$('#editSdaSummary').value.trim(),teaching:$('#editSdaTeaching').value.trim()},
    bible_first:$('#editBibleFirst').value.trim(),
    takeaways:$('#editTakeaways').value.split('\n').map(x=>x.trim()).filter(Boolean),
    notes:$('#editNotes').value.trim(),
    image:{src:imgSrc,caption:$('#editImageCaption').value.trim(),position:$('#editImagePosition').value},
    style:{fontSize:+$('#editTopicFontSize').value,textColor:$('#editTopicTextColor').value,background:$('#editTopicBackground').value},
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
  }
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
  on('#keyObs','click',()=>openDialog('Key Observations',`<p>${topics[currentTopic]?.bible_first||''}</p>`));
  on('#closeDialog','click',()=>$('#dialog')?.close());

  on('#aboutBtn','click',()=>openDialog('About This Library','<p>This is a private progressive Bible Study Library. The owner decides which study each reader can access.</p>'));
  on('#settingsBtn','click',async()=>{
    fillSettings();
    await renderOwnerPanel().catch(()=>{});
    const d=$('#settingsDialog'); if(d&&!d.open)d.showModal();
  });
  on('#closeSettings','click',()=>$('#settingsDialog')?.close());

  on('#settingFontSize','input',e=>{
    const o=$('#fontSizeOutput'); if(o)o.value=e.target.value+'%';
    applySettings(readSettings());
  });
  ['settingTitle','settingSubtitle','settingHeroTitle','settingHeroTagline','settingFooter','settingFont','settingPrimary','settingBackground','settingText','settingCard','settingDensity','settingCardStyle','settingSidebar','settingQuotes','settingAnimations']
    .forEach(id=>on('#'+id,'input',()=>applySettings(readSettings())));

  $$('[data-preset]').forEach(b=>b.addEventListener('click',()=>applyPreset(b.dataset.preset)));
  on('#saveSettings','click',()=>{
    const s=readSettings();
    localStorage.setItem(SETTINGS_KEY,JSON.stringify(s));
    applySettings(s);
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
  showLibrary();
});

bind();
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
