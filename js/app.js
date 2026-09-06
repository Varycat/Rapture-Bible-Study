import { firebaseConfig } from './firebase-config.js';
import { parseStudyText, parseStudyHTML } from './importer.js';
const __errLog=[];
addEventListener('error',e=>{__errLog.push({t:Date.now(),m:String(e.message||e.type)});if(__errLog.length>30)__errLog.shift()});
addEventListener('unhandledrejection',e=>{__errLog.push({t:Date.now(),m:'Promise: '+String(e.reason?.message||e.reason)});if(__errLog.length>30)__errLog.shift()});
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import {
  getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
let db;
try{db=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})})}
catch{db=getFirestore(app)}

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let user=null, owner=false, studies=[], allowedStudies=[], currentStudy=null, topics=[], verses={}, currentTopic=0;
let baseCatalog=[], favorites=new Set(), libFilter='all', pendingImport=null;

const SETTINGS_KEY='bible-study-v11-settings';
const defaults={title:'Bible Study Library',subtitle:'INTERACTIVE BIBLE STUDIES',heroTitle:'Bible Study Library',heroTagline:'Explore. Compare. Discover. Grow.',footer:'Let the Bible speak, and let us compare scripture with scripture.',font:'system',fontSize:100,primary:'#0c73e6',background:'#f7fafe',text:'#08245b',card:'#ffffff',topbarBg:'#ffffff',tabBg:'#ffffff',tabText:'#081d55',sidebarBg:'#ffffff',sidebarText:'#092762',studyBar:'#9dcfff',studyBarText:'#082068',studyTitleFont:'',studyBarSize:100,panelBg:'#ffffff',panelHead:'#f2f7ff',panelText:'#08245b',panelBorder:'#d6e3f2',panelBw:1,panelRadius:16,panelOpacity:100,panelFs:100,density:'comfortable',cardStyle:'rounded',sidebar:true,quotes:true,animations:true};

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

/* ===== v28: Bilingual interface (English / Español) ===== */
const LANG_KEY='bible-study-lang';
let lang=localStorage.getItem(LANG_KEY)||'en';
const I18N={
en:{
 home:'Home',about:'About',settings:'Settings',signOut:'Sign Out',
 authPrivate:'This library is private. Sign in with the email and password provided by the owner.',
 emailL:'Email',passwordL:'Password',signIn:'Sign In',signingIn:'Signing in…',signInFail:'Sign in failed. Check the email and password.',
 studiesTitle:'📖 Studies',studyIndexTitle:'📖 Study Index',searchPh:'Search studies or topics...',
 allStudies:'All Studies',browseAll:'Browse all Bible studies',
 featured:'★ Featured Studies',viewAll:'▦ View All Studies →',
 heroDesc:'A collection of interactive Bible studies with clear explanations,<br>Bible references, and different perspectives.',
 aboutLibH:'📖 About This Library',
 aboutLibP:'This library provides interactive Bible studies to help you explore important topics, compare interpretations, and study the Scriptures for yourself. Each study includes a complete index, key verses, detailed explanations, and side-by-side comparisons.',
 quickLinks:'🔗 Quick Links',howUse:'How to Use This Library',faq:'Frequently Asked Questions',suggest:'Suggest a New Study',share:'Share This Project',
 noStudiesH:'No studies unlocked yet',noStudiesP:'Ask the owner to give you access to your first study.',openStudyBtn:'Open Study →',
 studyIndexLabel:'Study Index',editStudy:'✎ Edit Study',addTopic:'＋ Add Topic',
 markStudy:'✓ Mark Study Complete',studyDone:'✓ Study Completed',markTopic:'✓ Mark Topic Complete',topicDone:'✓ Topic Completed',
 prev:'← Previous',next:'Next →',readFull:'📖 Read Full Passage',editTopic:'✎ Edit Topic',
 preH:'Christian Pre-Tribulation<br>Interpretation',sdaH:'Seventh-day Adventist<br>Interpretation',bibleH:'Bible-First Observation',
 teach:'📖 Their Teachings <span>→</span>',support:'📖 Bible Support <span>→</span>',
 whatBible:'📖 What the Bible Says <span>→</span>',keyObs:'⌕ Key Observations <span>→</span>',
 takeaways:'📖 Key Takeaways',related:'🔗 Related Topics',
 preTeachT:'Christian Pre-Tribulation — Their Teachings',preSupT:'Christian Pre-Tribulation — Bible Support',
 sdaTeachT:'Seventh-day Adventist — Their Teachings',sdaSupT:'Seventh-day Adventist — Bible Support',
 aboutT:'About This Library',aboutB:'<p>This is a private progressive Bible Study Library. The owner decides which study each reader can access.</p>',
 howT:'How to Use This Library',howB:'<p>Select a study, choose a topic from its Study Index, read the comparison, open the Bible passages, and mark topics complete as you progress.</p>',
 faqT:'Frequently Asked Questions',faqB:'<p><b>Can readers see every study?</b> No. The owner controls access in Settings.<br><br><b>Can readers edit studies?</b> No. Editing controls are owner-only.</p>',
 suggestT:'Suggest a New Study',suggestB:'<p>Use the Owner Study Editor to add a new topic now. Additional complete studies can also be added as private Firestore seed files.</p>',
 shareT:'Share This Project',shareB:'<p>The web app link was copied to your clipboard.</p>',
 studyNotReady:'Study Not Ready',studyCompletedT:'Study Completed',
 studyCompletedB:'<p>Your completion has been saved. The owner can now see that you finished this study and may unlock the next one for you.</p>',
 readFullT:'Read Full Passage',openTopicFirst:'<p>Open a topic first.</p>',keyObsT:'Key Observations',verseMissing:'Verse text not added yet.',
 notesT:'📝 My Notes',notesFor:'Notes for',generalNotes:'General notes',
 notesPh:'Write your personal notes here. They save automatically to your account.',
 saving:'Saving…',saved:'Saved ✓',saveFail:'Could not save: ',
 searchT:'🔍 Search',gSearchPh:'Search studies, topics, verses, Bible...',
 typeMore:'Type at least 2 letters. Searches your studies, topics, study verses',typeMoreBible:' and the loaded Bible version',
 noResults:'No results.',
 bibleT:'📖 Bible',chooseVersion:'Choose version…',noVersions:'No versions installed yet',
 chooseToRead:'<p>Choose a Bible version above to start reading.</p>',
 noVersionsMsg:'<p>No Bible versions installed yet. The owner can install them in Settings → 📖 Bible Versions.</p>',
 loadingVersion:'<p>Loading version…</p>',bibleSearchPh:'Search this Bible version...',noBibleResults:'<p>No results in this version.</p>',
 setEyebrow:'CUSTOMIZE YOUR LIBRARY',setT:'Settings',setIntro:'Change the appearance of the app. Owner controls for reader access are below.',
 secTitles:'📝 Titles & Text',secFont:'🔤 Font & Size',secColors:'🎨 Colors',secLayout:'🖼 Layout & Display',
 secBanners:'🖼 Study Banners & Icons',secBibles:'📖 Bible Versions',secAccess:'🔐 Reader Access & Progress',
 secPanels:'🪟 Floating Windows',secNav:'🧭 Navigation Links',
 saveSettings:'Save Settings',resetAppearance:'Reset Appearance',languageL:'Language',
 appTitle:'App title',subtitleL:'Subtitle',heroTitleL:'Home hero title',heroTagL:'Home hero tagline',footerL:'Footer message',
 heroPhotoL:'Hero background photo',heroUploadL:'Or upload a photo from this device',removeHeroPhoto:'Remove hero photo',
 adjustPhoto:'Adjust the photo',moveLR:'Move left / right',moveUD:'Move up / down',zoomL:'Zoom',brightnessL:'Brightness',contrastL:'Contrast',colorIntensityL:'Color intensity',
 previewBtn:'👁 Preview',resetAdj:'Reset adjustments',backToSettings:'⚙ Back to Settings',
 fontFamilyL:'Font family',fontSizeL:'Font size',spacingL:'Content spacing',cardShapeL:'Card shape',
 studyTitleFontL:'Study title font',studyBarSizeL:'Study banner & title size',
 primaryL:'Primary',backgroundL:'Background',textL:'Text',cardsL:'Cards',topBarL:'Top bar',tabBtnL:'Tab buttons',tabTextL:'Tab text',
 sidebarL:'Sidebar',sidebarTextL:'Sidebar text',studyBannerL:'Study banner',bannerTitleL:'Banner title',
 showSidebar:'Show sidebar on large screens',showQuotes:'Show Scripture quote areas',useAnimations:'Use subtle animations',
 headerL:'Header',borderL:'Border',borderThL:'Border thickness',cornerL:'Corner roundness',opacityL:'Opacity',
 addLink:'＋ Add link',labelL:'Label',iconL:'Icon',actionL:'Opens',actStudy:'A study',actPanel:'A floating window',actUrl:'A web link',
 panelNotes:'Notes panel',panelSearch:'Search panel',panelBible:'Bible panel',
 upBtn:'↑',downBtn:'↓',dupBtn:'⧉ Duplicate',delBtn:'✕ Delete',
 saveStudyBtn:'Save Study',saveTopicBtn:'Save Topic',moveUpBtn:'↑ Move Up',moveDownBtn:'↓ Move Down',deleteTopicBtn:'Delete Topic',
 secImport:'📥 Import a Bible Study',secDiag:'🩺 Performance & Diagnostics',
 fltAll:'All',fltEn:'English',fltEs:'Español',fltFav:'★ Favorites',fltDrafts:'Drafts',draftL:'DRAFT',
 pasteL:'Paste the study text',importFileL:'Or choose a file (TXT, HTML, DOCX, PDF)',importUrlL:'Or import from a web page',
 analyzeBtn:'🔎 Analyze',importUrlBtn:'Fetch page',saveDraftBtn:'💾 Save as Draft',importPrevT:'Import Preview',
 topicsWord:'topics',versesWord:'Bible references found',langWord:'Detected language',importedOk:'The study was saved as a DRAFT. Open it from the library (Drafts filter), edit its topics, then set it to Published in ✎ Edit Study.',
 corsFail:'That page could not be downloaded (the site blocks direct access). Open the page, copy the text, and paste it above instead.',
 statusL:'Status',draftOpt:'Draft (only you see it)',publishedOpt:'Published (visible to allowed readers)',languageStudyL:'Study language',deleteStudy:'🗑 Delete Study',
 delStudyConfirm:'Delete this study and all its topics permanently? This cannot be undone.',
 runDiag:'▶ Run diagnostics',diagFixCache:'🧹 Clear app cache & update',diagFixBible:'🧹 Clear Bible device cache',
 sectionTplL:'Insert a ready-made section title',
 favAdd:'Add to favorites',favDel:'Remove from favorites'
},
es:{
 home:'Inicio',about:'Acerca',settings:'Ajustes',signOut:'Salir',
 authPrivate:'Esta biblioteca es privada. Inicia sesión con el correo y la contraseña proporcionados por el propietario.',
 emailL:'Correo',passwordL:'Contraseña',signIn:'Iniciar Sesión',signingIn:'Iniciando sesión…',signInFail:'No se pudo iniciar sesión. Verifica el correo y la contraseña.',
 studiesTitle:'📖 Estudios',studyIndexTitle:'📖 Índice del Estudio',searchPh:'Buscar estudios o temas...',
 allStudies:'Todos los Estudios',browseAll:'Ver todos los estudios bíblicos',
 featured:'★ Estudios Destacados',viewAll:'▦ Ver Todos los Estudios →',
 heroDesc:'Una colección de estudios bíblicos interactivos con explicaciones claras,<br>referencias bíblicas y diferentes perspectivas.',
 aboutLibH:'📖 Acerca de esta Biblioteca',
 aboutLibP:'Esta biblioteca ofrece estudios bíblicos interactivos para ayudarte a explorar temas importantes, comparar interpretaciones y estudiar las Escrituras por ti mismo. Cada estudio incluye un índice completo, versículos clave, explicaciones detalladas y comparaciones lado a lado.',
 quickLinks:'🔗 Enlaces Rápidos',howUse:'Cómo Usar esta Biblioteca',faq:'Preguntas Frecuentes',suggest:'Sugerir un Nuevo Estudio',share:'Compartir este Proyecto',
 noStudiesH:'Aún no hay estudios desbloqueados',noStudiesP:'Pide al propietario acceso a tu primer estudio.',openStudyBtn:'Abrir Estudio →',
 studyIndexLabel:'Índice del Estudio',editStudy:'✎ Editar Estudio',addTopic:'＋ Añadir Tema',
 markStudy:'✓ Marcar Estudio Completado',studyDone:'✓ Estudio Completado',markTopic:'✓ Marcar Tema Completado',topicDone:'✓ Tema Completado',
 prev:'← Anterior',next:'Siguiente →',readFull:'📖 Leer Pasaje Completo',editTopic:'✎ Editar Tema',
 preH:'Interpretación Cristiana<br>Pre-Tribulación',sdaH:'Interpretación<br>Adventista del Séptimo Día',bibleH:'Observación Bíblica Directa',
 teach:'📖 Sus Enseñanzas <span>→</span>',support:'📖 Apoyo Bíblico <span>→</span>',
 whatBible:'📖 Lo que Dice la Biblia <span>→</span>',keyObs:'⌕ Observaciones Clave <span>→</span>',
 takeaways:'📖 Puntos Clave',related:'🔗 Temas Relacionados',
 preTeachT:'Cristiana Pre-Tribulación — Sus Enseñanzas',preSupT:'Cristiana Pre-Tribulación — Apoyo Bíblico',
 sdaTeachT:'Adventista del Séptimo Día — Sus Enseñanzas',sdaSupT:'Adventista del Séptimo Día — Apoyo Bíblico',
 aboutT:'Acerca de esta Biblioteca',aboutB:'<p>Esta es una Biblioteca privada de Estudios Bíblicos progresivos. El propietario decide qué estudio puede ver cada lector.</p>',
 howT:'Cómo Usar esta Biblioteca',howB:'<p>Selecciona un estudio, elige un tema en su Índice, lee la comparación, abre los pasajes bíblicos y marca los temas completados según avances.</p>',
 faqT:'Preguntas Frecuentes',faqB:'<p><b>¿Los lectores pueden ver todos los estudios?</b> No. El propietario controla el acceso en Ajustes.<br><br><b>¿Los lectores pueden editar estudios?</b> No. Los controles de edición son solo del propietario.</p>',
 suggestT:'Sugerir un Nuevo Estudio',suggestB:'<p>Usa el Editor de Estudios del propietario para añadir un nuevo tema. También se pueden agregar estudios completos como archivos privados de Firestore.</p>',
 shareT:'Compartir este Proyecto',shareB:'<p>El enlace de la aplicación se copió al portapapeles.</p>',
 studyNotReady:'Estudio No Disponible',studyCompletedT:'Estudio Completado',
 studyCompletedB:'<p>Tu progreso fue guardado. El propietario ahora puede ver que terminaste este estudio y podrá desbloquear el siguiente.</p>',
 readFullT:'Leer Pasaje Completo',openTopicFirst:'<p>Primero abre un tema.</p>',keyObsT:'Observaciones Clave',verseMissing:'El texto del versículo aún no ha sido añadido.',
 notesT:'📝 Mis Notas',notesFor:'Notas para',generalNotes:'Notas generales',
 notesPh:'Escribe aquí tus notas personales. Se guardan automáticamente en tu cuenta.',
 saving:'Guardando…',saved:'Guardado ✓',saveFail:'No se pudo guardar: ',
 searchT:'🔍 Buscar',gSearchPh:'Buscar estudios, temas, versículos, Biblia...',
 typeMore:'Escribe al menos 2 letras. Busca en tus estudios, temas y versículos',typeMoreBible:' y en la versión de la Biblia cargada',
 noResults:'Sin resultados.',
 bibleT:'📖 Biblia',chooseVersion:'Elegir versión…',noVersions:'No hay versiones instaladas',
 chooseToRead:'<p>Elige una versión de la Biblia arriba para comenzar a leer.</p>',
 noVersionsMsg:'<p>Aún no hay versiones de la Biblia instaladas. El propietario puede instalarlas en Ajustes → 📖 Versiones de la Biblia.</p>',
 loadingVersion:'<p>Cargando versión…</p>',bibleSearchPh:'Buscar en esta versión de la Biblia...',noBibleResults:'<p>Sin resultados en esta versión.</p>',
 setEyebrow:'PERSONALIZA TU BIBLIOTECA',setT:'Ajustes',setIntro:'Cambia la apariencia de la aplicación. Los controles del propietario están más abajo.',
 secTitles:'📝 Títulos y Texto',secFont:'🔤 Fuente y Tamaño',secColors:'🎨 Colores',secLayout:'🖼 Diseño y Pantalla',
 secBanners:'🖼 Portadas e Iconos de Estudios',secBibles:'📖 Versiones de la Biblia',secAccess:'🔐 Acceso y Progreso de Lectores',
 secPanels:'🪟 Ventanas Flotantes',secNav:'🧭 Enlaces de Navegación',
 saveSettings:'Guardar Ajustes',resetAppearance:'Restablecer Apariencia',languageL:'Idioma',
 appTitle:'Título de la app',subtitleL:'Subtítulo',heroTitleL:'Título de portada',heroTagL:'Lema de portada',footerL:'Mensaje de pie de página',
 heroPhotoL:'Foto de fondo de la portada',heroUploadL:'O sube una foto desde este dispositivo',removeHeroPhoto:'Quitar foto de portada',
 adjustPhoto:'Ajustar la foto',moveLR:'Mover izquierda / derecha',moveUD:'Mover arriba / abajo',zoomL:'Zoom',brightnessL:'Brillo',contrastL:'Contraste',colorIntensityL:'Intensidad de color',
 previewBtn:'👁 Vista Previa',resetAdj:'Restablecer ajustes',backToSettings:'⚙ Volver a Ajustes',
 fontFamilyL:'Tipo de letra',fontSizeL:'Tamaño de letra',spacingL:'Espaciado del contenido',cardShapeL:'Forma de tarjetas',
 studyTitleFontL:'Fuente del título de estudio',studyBarSizeL:'Tamaño de portada y título',
 primaryL:'Primario',backgroundL:'Fondo',textL:'Texto',cardsL:'Tarjetas',topBarL:'Barra superior',tabBtnL:'Botones de pestañas',tabTextL:'Texto de pestañas',
 sidebarL:'Barra lateral',sidebarTextL:'Texto barra lateral',studyBannerL:'Portada de estudio',bannerTitleL:'Título de portada',
 showSidebar:'Mostrar barra lateral en pantallas grandes',showQuotes:'Mostrar citas bíblicas decorativas',useAnimations:'Usar animaciones sutiles',
 headerL:'Encabezado',borderL:'Borde',borderThL:'Grosor del borde',cornerL:'Redondez de esquinas',opacityL:'Opacidad',
 addLink:'＋ Añadir enlace',labelL:'Etiqueta',iconL:'Icono',actionL:'Abre',actStudy:'Un estudio',actPanel:'Una ventana flotante',actUrl:'Un enlace web',
 panelNotes:'Ventana de Notas',panelSearch:'Ventana de Búsqueda',panelBible:'Ventana de Biblia',
 upBtn:'↑',downBtn:'↓',dupBtn:'⧉ Duplicar',delBtn:'✕ Eliminar',
 saveStudyBtn:'Guardar Estudio',saveTopicBtn:'Guardar Tema',moveUpBtn:'↑ Subir',moveDownBtn:'↓ Bajar',deleteTopicBtn:'Eliminar Tema',
 secImport:'📥 Importar un Estudio Bíblico',secDiag:'🩺 Rendimiento y Diagnóstico',
 fltAll:'Todos',fltEn:'English',fltEs:'Español',fltFav:'★ Favoritos',fltDrafts:'Borradores',draftL:'BORRADOR',
 pasteL:'Pega el texto del estudio',importFileL:'O elige un archivo (TXT, HTML, DOCX, PDF)',importUrlL:'O importa desde una página web',
 analyzeBtn:'🔎 Analizar',importUrlBtn:'Descargar página',saveDraftBtn:'💾 Guardar como Borrador',importPrevT:'Vista Previa de Importación',
 topicsWord:'temas',versesWord:'referencias bíblicas encontradas',langWord:'Idioma detectado',importedOk:'El estudio se guardó como BORRADOR. Ábrelo desde la biblioteca (filtro Borradores), edita sus temas y cámbialo a Publicado en ✎ Editar Estudio.',
 corsFail:'No se pudo descargar esa página (el sitio bloquea el acceso directo). Abre la página, copia el texto y pégalo arriba.',
 statusL:'Estado',draftOpt:'Borrador (solo tú lo ves)',publishedOpt:'Publicado (visible para lectores autorizados)',languageStudyL:'Idioma del estudio',deleteStudy:'🗑 Eliminar Estudio',
 delStudyConfirm:'¿Eliminar este estudio y todos sus temas permanentemente? Esto no se puede deshacer.',
 runDiag:'▶ Ejecutar diagnóstico',diagFixCache:'🧹 Limpiar caché y actualizar',diagFixBible:'🧹 Limpiar caché de Biblia del dispositivo',
 sectionTplL:'Insertar un título de sección predefinido',
 favAdd:'Añadir a favoritos',favDel:'Quitar de favoritos'
}
};
function t(k){return (I18N[lang]&&I18N[lang][k])??I18N.en[k]??k}
const I18N_MAP=[
 ['#homeBtn span','home'],['#aboutBtn span','about'],['#settingsBtn span','settings'],['#signOutBtn span','signOut'],
 ['.authCard p','authPrivate'],['label:has(#loginEmail)','emailL','label'],['label:has(#loginPassword)','passwordL','label'],['#loginForm button[type=submit]','signIn'],
 ['#search','searchPh','ph'],
 ['.featureHeader h2','featured'],['#viewAllBtn','viewAll'],['.heroCopy p','heroDesc','html'],
 ['.libraryBottom article:first-child h2','aboutLibH'],['.libraryBottom article:first-child p','aboutLibP'],
 ['.libraryBottom article:last-child h2','quickLinks'],['#howBtn','howUse'],['#faqBtn','faq'],['#suggestBtn','suggest'],['#shareBtn','share'],
 ['.studyIndexLabel','studyIndexLabel'],['#editStudyBtn','editStudy'],['#addTopicBtn','addTopic'],
 ['#prevBtn','prev'],['#nextBtn','next'],['#readFull','readFull'],['#editTopicBtn','editTopic'],
 ['.viewCard.pre h2','preH','html'],['.viewCard.sda h2','sdaH','html'],['.viewCard.bible h2','bibleH','html'],
 ['[data-action="preTeach"]','teach','html'],['[data-action="sdaTeach"]','teach','html'],
 ['[data-action="preSupport"]','support','html'],['[data-action="sdaSupport"]','support','html'],
 ['#whatBible','whatBible','html'],['#keyObs','keyObs','html'],
 ['.takeaways h2','takeaways'],['.related h2','related'],
 ['#notesPanel h3','notesT'],['#searchPanel h3','searchT'],['#biblePanel h3','bibleT'],
 ['#notesText','notesPh','ph'],['#globalSearch','gSearchPh','ph'],['#bibleSearch','bibleSearchPh','ph'],
 ['.panelSelectRow','notesFor','label'],
 ['#settingsDialog .settingsEyebrow','setEyebrow'],['.settingsHead h2','setT'],['.settingsHead > div > p','setIntro'],
 ['section:has(#settingTitle) h3','secTitles'],['section:has(#settingFont) h3','secFont'],
 ['section:has(#settingPrimary) h3','secColors'],['section:has(#settingSidebar) h3','secLayout'],
 ['#studyBannerSection h3','secBanners'],['#bibleAdminSection h3','secBibles'],['#ownerAccessSection h3','secAccess'],
 ['#panelSection h3','secPanels'],['#navSection h3','secNav'],['#importSection h3','secImport'],['#diagSection h3','secDiag'],
 ['label:has(#importPaste)','pasteL','label'],['label:has(#importFile)','importFileL','label'],['label:has(#importUrl)','importUrlL','label'],
 ['#analyzeImport','analyzeBtn'],['#importUrlBtn','importUrlBtn'],['#runDiagBtn','runDiag'],
 ['label:has(#editStudyStatus)','statusL','label'],['label:has(#editStudyLang)','languageStudyL','label'],['#deleteStudyBtn','deleteStudy'],
 ['label:has(#sectionTemplate)','sectionTplL','label'],
 ['#saveSettings','saveSettings'],['#resetSettings','resetAppearance'],
 ['label:has(#settingTitle)','appTitle','label'],['label:has(#settingSubtitle)','subtitleL','label'],
 ['label:has(#settingHeroTitle)','heroTitleL','label'],['label:has(#settingHeroTagline)','heroTagL','label'],
 ['label:has(#settingFooter)','footerL','label'],
 ['label:has(#settingHeroImage)','heroPhotoL','label'],['label:has(#settingHeroImageFile)','heroUploadL','label'],
 ['#clearHeroImage','removeHeroPhoto'],['#heroAdjust > b','adjustPhoto'],
 ['label:has(#heroPosX)','moveLR','label'],['label:has(#heroPosY)','moveUD','label'],['label:has(#heroZoom)','zoomL','label'],
 ['label:has(#heroBright)','brightnessL','label'],['label:has(#heroContrast)','contrastL','label'],['label:has(#heroSat)','colorIntensityL','label'],
 ['#heroPreviewBtn','previewBtn'],['#heroResetAdj','resetAdj'],['#backToSettings','backToSettings'],
 ['label:has(#settingFont)','fontFamilyL','label'],['label:has(#settingFontSize)','fontSizeL','label'],
 ['label:has(#settingDensity)','spacingL','label'],['label:has(#settingCardStyle)','cardShapeL','label'],
 ['label:has(#settingStudyTitleFont)','studyTitleFontL','label'],['label:has(#settingStudyBarSize)','studyBarSizeL','label'],
 ['label:has(#settingPrimary)','primaryL','label'],['label:has(#settingBackground)','backgroundL','label'],
 ['label:has(#settingText)','textL','label'],['label:has(#settingCard)','cardsL','label'],
 ['label:has(#settingTopbarBg)','topBarL','label'],['label:has(#settingTabBg)','tabBtnL','label'],['label:has(#settingTabText)','tabTextL','label'],
 ['label:has(#settingSidebarBg)','sidebarL','label'],['label:has(#settingSidebarText)','sidebarTextL','label'],
 ['label:has(#settingStudyBar)','studyBannerL','label'],['label:has(#settingStudyBarText)','bannerTitleL','label'],
 ['label:has(#settingSidebar)','showSidebar','labelAfter'],['label:has(#settingQuotes)','showQuotes','labelAfter'],['label:has(#settingAnimations)','useAnimations','labelAfter'],
 ['label:has(#settingPanelBg)','backgroundL','label'],['label:has(#settingPanelHead)','headerL','label'],
 ['label:has(#settingPanelText)','textL','label'],['label:has(#settingPanelBorder)','borderL','label'],
 ['label:has(#settingPanelBw)','borderThL','label'],['label:has(#settingPanelRadius)','cornerL','label'],
 ['label:has(#settingPanelOpacity)','opacityL','label'],['label:has(#settingPanelFs)','fontSizeL','label'],
 ['label:has(#langSelSettings)','languageL','label'],
 ['#addNavLink','addLink'],
 ['#saveStudyEdit','saveStudyBtn'],['#saveTopicEdit','saveTopicBtn'],
 ['#moveTopicUp','moveUpBtn'],['#moveTopicDown','moveDownBtn'],['#deleteTopicBtn','deleteTopicBtn']
];
function setFirstTextNode(el,txt,after){
  const nodes=[...el.childNodes].filter(n=>n.nodeType===3);
  const pick=after?nodes.find(n=>n.previousSibling):(nodes.find(n=>n.nodeValue.trim())||nodes[0]);
  if(pick)pick.nodeValue=(after?' ':'')+txt+(after?'':'\n');
}
function applyLang(){
  document.documentElement.lang=lang;
  const sel1=$('#langSel');if(sel1)sel1.value=lang;
  const sel2=$('#langSelSettings');if(sel2)sel2.value=lang;
  I18N_MAP.forEach(([selq,key,mode])=>{
    let el=null;try{el=document.querySelector(selq)}catch{}
    if(!el)return;
    if(mode==='html')el.innerHTML=t(key);
    else if(mode==='ph')el.placeholder=t(key);
    else if(mode==='label')setFirstTextNode(el,t(key));
    else if(mode==='labelAfter')setFirstTextNode(el,t(key),true);
    else el.textContent=t(key);
  });
  if(studies.length&&!$('#libraryView').hidden){renderLibrary();if(!currentStudy)renderSidebar($('#search')?.value||'')}
  if(currentStudy&&!$('#studyView').hidden)renderTopicIndex();
  refreshProgressUI();
  refreshNotesScope();
  if($('#biblePanel')&&!bibleData)renderBibleReader();
  const gs=$('#globalSearch');if(gs&&gs.value)searchRun(gs.value);
}
function setLang(v){lang=(v==='es')?'es':'en';localStorage.setItem(LANG_KEY,lang);applyLang()}

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
  r.setProperty('--panel-bg',s.panelBg);
  r.setProperty('--panel-head',s.panelHead);
  r.setProperty('--panel-text',s.panelText);
  r.setProperty('--panel-border',s.panelBorder);
  r.setProperty('--panel-bw',(s.panelBw??1)+'px');
  r.setProperty('--panel-radius',(s.panelRadius??16)+'px');
  r.setProperty('--panel-opacity',String(s.panelOpacity??100));
  r.setProperty('--panel-fs',String((s.panelFs||100)/100));
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
  const mt=$('#heroMiniTitle');if(mt)mt.textContent=s.heroTitle||s.title;
  const mg=$('#heroMiniTag');if(mg)mg.textContent=s.heroTagline;
  applyPhotos();
  if(studies.length&&!$('#libraryView').hidden){renderLibrary();if(!currentStudy)renderSidebar($('#search')?.value||'')}
  document.title=s.title;
}
let heroImageValue=null, bannersDraft=null;
let branding={hero:'',heroAdj:null,banners:{},icons:{},navLinks:[],catalog:[]};
let navDraft=null;
function effNavLinks(){return navDraft===null?branding.navLinks:navDraft}
let iconsDraft=null;
function effIcons(){return iconsDraft===null?branding.icons:iconsDraft}
function iconHTML(id,fallback){
  const v=effIcons()[id]||fallback||'📖';
  return (String(v).startsWith('data:')||String(v).startsWith('http'))?`<img class="iconImg" src="${v}" alt="" loading="lazy">`:v;
}
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
  const ns=$('#navSection');if(ns)ns.hidden=!owner;
  const isec=$('#importSection');if(isec)isec.hidden=!owner;
  const dsec=$('#diagSection');if(dsec)dsec.hidden=!owner;
  navDraft=effNavLinks().map(x=>({...x}));
  renderNavLinksEditor();
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
    bw.innerHTML=list.length?list.map(st=>`<div class="bannerRow"><b>${iconHTML(st.id,st.icon)} ${esc(st.title)}</b><div class="iconRow"><label>Icon <input type="text" data-banner-icon="${st.id}" value="${String(iconsDraft[st.id]||st.icon||'').startsWith('data:')?'':esc(iconsDraft[st.id]||st.icon||'')}" placeholder="📖 emoji or image link"></label><label class="bannerUpload">⬆ Icon file<input type="file" accept="image/*" data-icon-file="${st.id}" hidden></label></div><input type="url" placeholder="https://... photo link" data-banner-url="${st.id}" value="${bannersDraft[st.id]&&!String(bannersDraft[st.id]).startsWith('data:')?esc(bannersDraft[st.id]):''}"><div class="bannerRowBtns"><label class="bannerUpload">⬆ Upload<input type="file" accept="image/*" data-banner-file="${st.id}" hidden></label><button type="button" data-banner-clear="${st.id}">Remove</button></div></div>`).join(''):'<p class="smallHelp">No studies are visible yet.</p>';
    $$('[data-banner-icon]').forEach(i=>i.addEventListener('input',()=>{
      const v=i.value.trim(),id=i.dataset.bannerIcon,cat=studies.find(x=>x.id===id);
      if(v&&v!==(cat?.icon||''))iconsDraft[id]=v;else delete iconsDraft[id];
      applySettings(readSettings());
    }));
    $$('[data-icon-file]').forEach(f=>f.addEventListener('change',async()=>{
      try{
        const d=await fileToCompressedDataURL(f.files[0],128,18000,30000);
        if(d){
          iconsDraft[f.dataset.iconFile]=d;
          const t=bw.querySelector(`[data-banner-icon="${f.dataset.iconFile}"]`);if(t)t.value='';
          applySettings(readSettings());
        }
      }catch(e){openDialog('Study Icon',`<p>${e.message}</p>`)}
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
  $('#settingPanelBg').value=s.panelBg;
  $('#settingPanelHead').value=s.panelHead;
  $('#settingPanelText').value=s.panelText;
  $('#settingPanelBorder').value=s.panelBorder;
  $('#settingPanelBw').value=s.panelBw;$('#panelBwOut').value=s.panelBw+'px';
  $('#settingPanelRadius').value=s.panelRadius;$('#panelRadiusOut').value=s.panelRadius+'px';
  $('#settingPanelOpacity').value=s.panelOpacity;$('#panelOpacityOut').value=s.panelOpacity+'%';
  $('#settingPanelFs').value=s.panelFs;$('#panelFsOut').value=s.panelFs+'%';
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
  panelBg:$('#settingPanelBg').value,
  panelHead:$('#settingPanelHead').value,
  panelText:$('#settingPanelText').value,
  panelBorder:$('#settingPanelBorder').value,
  panelBw:+$('#settingPanelBw').value,
  panelRadius:+$('#settingPanelRadius').value,
  panelOpacity:+$('#settingPanelOpacity').value,
  panelFs:+$('#settingPanelFs').value,
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
  return snap.exists()?snap.data():{completedStudies:[],completedTopics:{},favorites:[]};
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
  openDialog(t('studyCompletedT'),t('studyCompletedB'));
}
async function refreshProgressUI(){
  if(!user||!currentStudy)return;
  const p=await progressDoc(); const topicDone=new Set((p.completedTopics||{})[currentStudy.id]||[]);
  const studyDone=new Set(p.completedStudies||[]);
  const btn=$('#completeTopicBtn'); if(btn)btn.textContent=topicDone.has(topics[currentTopic]?.id)?t('topicDone'):t('markTopic');
  const sbtn=$('#completeStudyBtn'); if(sbtn)sbtn.textContent=studyDone.has(currentStudy.id)?t('studyDone'):t('markStudy');
}

function showLibrary(){$('#libraryView').hidden=false;$('#studyView').hidden=true;$('#topicView').hidden=true;currentStudy=null;renderLibrary();renderSidebar();refreshNotesScope();closeSide();scrollTo(0,0)}
function showStudy(){$('#libraryView').hidden=true;$('#studyView').hidden=false;$('#topicView').hidden=true;renderTopicIndex();refreshNotesScope();closeSide();scrollTo(0,0)}
function showTopic(){$('#libraryView').hidden=true;$('#studyView').hidden=true;$('#topicView').hidden=false;renderTopic();closeSide();scrollTo(0,0)}
function closeSide(){$('#sidebar').classList.remove('open')}

function mergeCatalog(){
  const extra=(branding.catalog||[]).filter(c=>!baseCatalog.some(b=>b.id===c.id));
  studies=[...baseCatalog,...extra];
}
function visibleStudies(){
  const pool=studies.filter(s=>!s.draft||owner);
  return owner?pool:pool.filter(s=>allowedStudies.includes(s.id));
}
function renderLibrary(){
  const fw=$('#libFilters');
  if(fw){
    const chips=[['all','fltAll'],['en','fltEn'],['es','fltEs'],['fav','fltFav']];
    if(owner)chips.push(['drafts','fltDrafts']);
    fw.innerHTML=chips.map(([v,k])=>`<button class="libChip${libFilter===v?' active':''}" data-chip="${v}">${t(k)}</button>`).join('');
    $$('[data-chip]').forEach(b=>b.onclick=()=>{libFilter=b.dataset.chip;renderLibrary()});
  }
  let list=visibleStudies();
  if(libFilter==='en'||libFilter==='es')list=list.filter(s=>(s.language||'en')===libFilter);
  else if(libFilter==='fav')list=list.filter(s=>favorites.has(s.id));
  else if(libFilter==='drafts')list=list.filter(s=>s.draft);
  $('#featuredStudies').innerHTML=list.length?list.map((s,i)=>`<article class="studyCard ${i===0?'primary':''}"><div class="studyThumb${effBanners()[s.id]?' hasPhoto':''}"${effBanners()[s.id]?` style="--card-photo:url('${effBanners()[s.id]}')"`:''}><span class="thumbIcon">${iconHTML(s.id,s.icon)}</span>${s.draft?`<span class="draftBadge">${t('draftL')}</span>`:''}</div><div class="cardBody"><div class="titleRow"><h3 class="thumbTitle">${s.title}</h3><button class="favBtn" data-fav="${s.id}" title="${favorites.has(s.id)?t('favDel'):t('favAdd')}" aria-label="${favorites.has(s.id)?t('favDel'):t('favAdd')}">${favorites.has(s.id)?'★':'☆'}</button></div><div class="sub">${s.subtitle||''}</div><p>${s.description||''}</p><button data-study="${s.id}">${t('openStudyBtn')}</button></div></article>`).join(''):`<article class="studyCard"><div class="cardBody"><h3>${t('noStudiesH')}</h3><p>${t('noStudiesP')}</p></div></article>`;
  $$('[data-study]').forEach(b=>b.onclick=()=>openStudy(b.dataset.study));
  $$('[data-fav]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleFavorite(b.dataset.fav)});
}
async function toggleFavorite(id){
  if(!user)return;
  if(favorites.has(id))favorites.delete(id);else favorites.add(id);
  renderLibrary();
  try{await setDoc(doc(db,'progress',ekey(user.email)),{favorites:[...favorites]},{merge:true})}catch{}
}
function renderSidebar(q=''){
  const list=visibleStudies().filter(s=>(s.title+' '+(s.subtitle||'')).toLowerCase().includes(q.toLowerCase()));
  $('#sideTitle').textContent=t('studiesTitle');
  $('#sideNav').innerHTML=
    `<button id="navAllStudies" class="navItem active"><span class="navIcon">▦</span><span class="navText">${t('allStudies')}<small>${t('browseAll')}</small></span></button>`
    +list.map(s=>`<button class="navItem" data-study="${s.id}"><span class="navIcon">${iconHTML(s.id,s.icon)}</span><span class="navText">${s.title}<small>${s.subtitle||''}</small></span></button>`).join('');
  $('#sideNav').innerHTML+=effNavLinks().map((L,i)=>`<button class="navItem" data-navlink="${i}"><span class="navIcon">${navIconHTML(L.icon)}</span><span class="navText">${esc(L.label||'Link')}${L.sub?`<small>${esc(L.sub)}</small>`:''}</span></button>`).join('');
  $$('#sideNav [data-study]').forEach(b=>b.onclick=()=>openStudy(b.dataset.study));
  $$('#sideNav [data-navlink]').forEach(b=>b.onclick=()=>runNavLink(effNavLinks()[+b.dataset.navlink]));
  const all=$('#navAllStudies'); if(all)all.onclick=showLibrary;
}
function navIconHTML(v){
  v=v||'🔗';
  return (String(v).startsWith('data:')||String(v).startsWith('http'))?`<img class="iconImg" src="${v}" alt="" loading="lazy">`:v;
}
function runNavLink(L){
  if(!L)return;
  if(L.action==='study')openStudy(L.value);
  else if(L.action==='panel')openPanel(L.value||'notesPanel');
  else if(L.action==='url'&&L.value)window.open(L.value,'_blank','noopener');
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
  try{const sdata=await loadStudyContent(id);Object.assign(currentStudy,sdata)}catch(e){openDialog(t('studyNotReady'),`<p>${e.message}</p>`);return}
  $('#studyTitle').textContent=currentStudy.title;$('#studyDescription').textContent=currentStudy.description||'';$('#studyCrumb').textContent=currentStudy.title;$('#crumbStudy').textContent=currentStudy.title;
  $('#studyVideos').innerHTML=videoGrid(currentStudy.videos);
  applyStudyHeaderBanner();
  showStudy();
}
function renderTopicIndex(q=''){
  const m=topics.filter(t=>(t.title+' '+(t.subtitle||'')+' '+(t.verses||[]).join(' ')).toLowerCase().includes(q.toLowerCase()));
  $('#sideTitle').textContent=t('studyIndexTitle');
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
  if(kind==='preTeach'){title=I18N[lang].preTeachT;html=`<p>${t.pretrib?.teaching||''}</p>`+videoGrid(t.pretrib?.videos)}
  if(kind==='preSupport'){title=I18N[lang].preSupT;html=supportHTML(t.pretrib?.support)}
  if(kind==='sdaTeach'){title=I18N[lang].sdaTeachT;html=`<p>${t.adventist?.teaching||''}</p>`+videoGrid(t.adventist?.videos)}
  if(kind==='sdaSupport'){title=I18N[lang].sdaSupT;html=supportHTML(t.adventist?.support)}
  openDialog(title,html)
}
function openDialog(title,html){$('#dialogTitle').textContent=title;$('#dialogBody').innerHTML=html;$$('#dialogBody [data-ref]').forEach(b=>b.onclick=()=>showVerse(b.dataset.ref));$('#dialog').showModal()}
function showVerse(ref){openDialog(ref,`<p style="font-family:Georgia,serif;font-size:19px;line-height:1.6">${verses[ref]||t('verseMissing')}</p>`)}

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
  const row=$('#customStudyRow');
  if(row){
    row.hidden=!currentStudy.custom;
    if(currentStudy.custom){
      $('#editStudyStatus').value=currentStudy.draft?'draft':'published';
      $('#editStudyLang').value=currentStudy.language||'en';
    }
  }
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
  if(currentStudy.custom){
    patch.draft=$('#editStudyStatus').value==='draft';
    patch.language=$('#editStudyLang').value;
  }
  await setDoc(doc(db,'studies',currentStudy.id),patch,{merge:true});
  Object.assign(currentStudy,patch);
  const cat=studies.find(s=>s.id===currentStudy.id); if(cat)Object.assign(cat,patch);
  if(currentStudy.custom){
    const items=(branding.catalog||[]).map(x=>x.id===currentStudy.id?{...x,title:patch.title,subtitle:patch.subtitle,description:patch.description,draft:patch.draft,language:patch.language}:x);
    await setDoc(doc(db,'branding','catalog'),{items,updatedAt:new Date().toISOString()});
    branding.catalog=items;
    mergeCatalog();
  }
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
      ?`<option value="">${t('chooseVersion')}</option>`+installedBibles.map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('')
      :`<option value="">${t('noVersions')}</option>`;
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
  const content=$('#bibleContent');if(content)content.innerHTML=t('loadingVersion');
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
    if(content)content.innerHTML=installedBibles.length?t('chooseToRead'):t('noVersionsMsg');
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
    :t('noBibleResults');
  $$('.bibleJump').forEach(x=>x.onclick=()=>{bibleBook=+x.dataset.b;bibleChapter=+x.dataset.c;$('#bibleSearch').value='';renderBibleReader()});
}

/* ===== v20: Personal notes (saved to Firestore, private per user) ===== */
let notesData={}, notesTimer=null;
function notesScopeKey(){return $('#notesScope')?.value||'general'}
function refreshNotesScope(){
  const sel=$('#notesScope');if(!sel)return;
  const cur=sel.value;
  sel.innerHTML=`<option value="general">${t('generalNotes')}</option>`+(currentStudy?`<option value="${currentStudy.id}">${esc(currentStudy.title)}</option>`:'');
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
  $('#notesStatus').textContent=t('saving');
  clearTimeout(notesTimer);
  notesTimer=setTimeout(async()=>{
    try{
      await setDoc(doc(db,'notes',ekey(user.email)),{text:notesData,updatedAt:new Date().toISOString()},{merge:true});
      $('#notesStatus').textContent=t('saved');
    }catch(e){$('#notesStatus').textContent=t('saveFail')+e.message}
  },800);
}

/* ===== v20: Global search across studies, topics, verses and Bible ===== */
function searchRun(q){
  const box=$('#searchResults');if(!box)return;
  q=q.trim().toLowerCase();
  if(q.length<2){box.innerHTML='<small>'+t('typeMore')+(bibleData?t('typeMoreBible'):'')+'.</small>';return}
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
  box.innerHTML=out.length?out.slice(0,80).map((r,i)=>`<button data-sres="${i}"><b>${esc(r.label)}</b><small>${esc(r.small)}</small></button>`).join(''):'<small>'+t('noResults')+'</small>';
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
  const mini=$('#heroMiniPhoto'),miniWrap=$('#heroMiniPreview');
  if(mini&&miniWrap){
    if(h){
      const a=effHeroAdj();
      miniWrap.classList.add('hasPhoto');
      mini.style.backgroundImage=`url("${h}")`;
      mini.style.backgroundPosition=`${a.posX}% ${a.posY}%`;
      mini.style.transform=`scale(${(a.zoom||100)/100})`;
      mini.style.transformOrigin=`${a.posX}% ${a.posY}%`;
      mini.style.filter=`brightness(${(a.bright||100)/100}) contrast(${(a.contrast||100)/100}) saturate(${(a.sat||100)/100})`;
    }else{miniWrap.classList.remove('hasPhoto');mini.style.backgroundImage=''}
  }
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
    const b={hero:'',heroAdj:null,banners:{},icons:{},navLinks:[],catalog:[]};
    snap.docs.forEach(d=>{const x=d.data();if(d.id==='hero'){b.hero=x.src||'';b.heroAdj=x.adj||null}else if(d.id==='navlinks'){b.navLinks=x.items||[]}else if(d.id==='catalog'){b.catalog=x.items||[]}else if(d.id.startsWith('banner-')){const id=d.id.slice(7);if(x.src)b.banners[id]=x.src;if(x.icon)b.icons[id]=x.icon}});
    branding=b;
  }catch(e){console.warn('Branding not loaded:',e.message)}
  mergeCatalog();
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
  const nav=navDraft===null?branding.navLinks:navDraft;
  if(nav.length)batch.set(doc(db,'branding','navlinks'),{items:nav,updatedAt:now});
  else batch.delete(doc(db,'branding','navlinks'));
  await batch.commit();
  branding={...branding,hero,heroAdj:{...adj},banners:{...banners},icons:{...icons},navLinks:nav.map(x=>({...x}))};
}

function renderNavLinksEditor(){
  const wrap=$('#navLinksList');if(!wrap)return;
  const links=navDraft||[];
  wrap.innerHTML=links.map((L,i)=>`
    <div class="navEditRow" data-nav-i="${i}">
      <div class="navEditFields">
        <label>${t('iconL')}<input type="text" data-nav-icon="${i}" value="${String(L.icon||'').startsWith('data:')?'':esc(L.icon||'')}" placeholder="🔗 emoji or image link"></label>
        <label>${t('labelL')}<input type="text" data-nav-label="${i}" value="${esc(L.label||'')}"></label>
        <label>${t('actionL')}
          <select data-nav-action="${i}">
            <option value="study"${L.action==='study'?' selected':''}>${t('actStudy')}</option>
            <option value="panel"${L.action==='panel'?' selected':''}>${t('actPanel')}</option>
            <option value="url"${L.action==='url'?' selected':''}>${t('actUrl')}</option>
          </select>
        </label>
        <label>→ ${L.action==='url'?'URL':''}
          ${L.action==='study'
            ?`<select data-nav-value="${i}">${studies.map(st=>`<option value="${st.id}"${L.value===st.id?' selected':''}>${esc(st.title)}</option>`).join('')}</select>`
            :L.action==='panel'
            ?`<select data-nav-value="${i}"><option value="notesPanel"${L.value==='notesPanel'?' selected':''}>${t('panelNotes')}</option><option value="searchPanel"${L.value==='searchPanel'?' selected':''}>${t('panelSearch')}</option><option value="biblePanel"${L.value==='biblePanel'?' selected':''}>${t('panelBible')}</option></select>`
            :`<input type="url" data-nav-value="${i}" value="${esc(L.value||'')}" placeholder="https://...">`}
        </label>
      </div>
      <div class="navEditBtns">
        <button type="button" data-nav-up="${i}" ${i===0?'disabled':''}>${t('upBtn')}</button>
        <button type="button" data-nav-down="${i}" ${i===links.length-1?'disabled':''}>${t('downBtn')}</button>
        <button type="button" data-nav-dup="${i}">${t('dupBtn')}</button>
        <button type="button" data-nav-del="${i}">${t('delBtn')}</button>
      </div>
    </div>`).join('');
  const refresh=()=>{renderNavLinksEditor();if(!currentStudy)renderSidebar($('#search')?.value||'')};
  $$('[data-nav-icon]').forEach(el=>el.addEventListener('input',()=>{navDraft[+el.dataset.navIcon].icon=el.value.trim();if(!currentStudy)renderSidebar($('#search')?.value||'')}));
  $$('[data-nav-label]').forEach(el=>el.addEventListener('input',()=>{navDraft[+el.dataset.navLabel].label=el.value;if(!currentStudy)renderSidebar($('#search')?.value||'')}));
  $$('[data-nav-action]').forEach(el=>el.addEventListener('change',()=>{const L=navDraft[+el.dataset.navAction];L.action=el.value;L.value=el.value==='study'?(studies[0]?.id||''):el.value==='panel'?'notesPanel':'';refresh()}));
  $$('[data-nav-value]').forEach(el=>{
    const ev=el.tagName==='SELECT'?'change':'input';
    el.addEventListener(ev,()=>{navDraft[+el.dataset.navValue].value=el.value.trim();if(!currentStudy)renderSidebar($('#search')?.value||'')});
  });
  $$('[data-nav-up]').forEach(el=>el.onclick=()=>{const i=+el.dataset.navUp;[navDraft[i-1],navDraft[i]]=[navDraft[i],navDraft[i-1]];refresh()});
  $$('[data-nav-down]').forEach(el=>el.onclick=()=>{const i=+el.dataset.navDown;[navDraft[i+1],navDraft[i]]=[navDraft[i],navDraft[i+1]];refresh()});
  $$('[data-nav-dup]').forEach(el=>el.onclick=()=>{const i=+el.dataset.navDup;navDraft.splice(i+1,0,{...navDraft[i]});refresh()});
  $$('[data-nav-del]').forEach(el=>el.onclick=()=>{navDraft.splice(+el.dataset.navDel,1);refresh()});
}

/* ===== v29: Study import (paste / TXT / HTML / DOCX / PDF / URL) ===== */
function loadScript(src){return new Promise((res,rej)=>{if(document.querySelector(`script[src="${src}"]`))return res();const el=document.createElement('script');el.src=src;el.onload=res;el.onerror=()=>rej(new Error('Could not load '+src));document.head.appendChild(el)})}
function importStatus(msg){const el=$('#importStatus');if(el)el.textContent=msg}
async function parseImportFile(file){
  const name=file.name, ext=name.split('.').pop().toLowerCase();
  if(ext==='txt'||ext==='md')return parseStudyText(await file.text(),name.replace(/\.\w+$/,''));
  if(ext==='html'||ext==='htm')return parseStudyHTML(await file.text(),name.replace(/\.\w+$/,''));
  if(ext==='docx'){
    importStatus('Loading DOCX reader…');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js');
    const r=await window.mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()});
    return parseStudyHTML(r.value,name.replace(/\.\w+$/,''));
  }
  if(ext==='pdf'){
    importStatus('Loading PDF reader…');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
    let text='';
    for(let i=1;i<=Math.min(pdf.numPages,80);i++){
      const pg=await pdf.getPage(i);
      const tc=await pg.getTextContent();
      text+=tc.items.map(x=>x.str).join(' ')+'\n\n';
      importStatus(`Reading PDF… page ${i}/${pdf.numPages}`);
    }
    return parseStudyText(text,name.replace(/\.\w+$/,''));
  }
  throw new Error('Unsupported file type: .'+ext);
}
function showImportPreview(parsed,source){
  pendingImport=parsed;
  importStatus('');
  const html=`
    <p><b>${esc(parsed.title)}</b><br><small>${esc(source)}</small></p>
    <p>${parsed.topics.length} ${t('topicsWord')} · ${parsed.topics.reduce((n,x)=>n+x.verses.length,0)} ${t('versesWord')} · ${t('langWord')}: ${parsed.language==='es'?'Español':'English'}</p>
    <ol>${parsed.topics.slice(0,25).map(x=>`<li><b>${esc(x.title)}</b>${x.verses.length?`<br><small>${esc(x.verses.join(', '))}</small>`:''}</li>`).join('')}${parsed.topics.length>25?'<li>…</li>':''}</ol>
    <p><button id="saveImportDraft" class="primarySettingBtn">${t('saveDraftBtn')}</button></p>`;
  openDialog(t('importPrevT'),html);
  const b=$('#saveImportDraft');
  if(b)b.onclick=()=>saveImportDraft().catch(e=>openDialog(t('importPrevT'),`<p>${esc(e.message)}</p>`));
}
async function saveImportDraft(){
  if(!owner||!pendingImport)return;
  const p=pendingImport, id='custom-'+Date.now();
  const batch=writeBatch(db);
  const now=new Date().toISOString();
  batch.set(doc(db,'studies',id),{title:p.title,subtitle:'',description:(p.topics[0]?.content||'').slice(0,160),icon:'📄',custom:true,draft:true,language:p.language,createdAt:now});
  p.topics.slice(0,60).forEach((tp,i)=>{
    batch.set(doc(db,'studies',id,'topics','t'+String(i+1).padStart(2,'0')),{
      order:i+1,title:tp.title||('Topic '+(i+1)),subtitle:'',verses:tp.verses||[],
      pretrib:{summary:'',teaching:'',support:[]},adventist:{summary:'',teaching:'',support:[]},
      bible_first:'',takeaways:[],notes:'',image:{src:'',caption:'',position:'top'},
      style:{fontSize:100,textColor:'#08245b',background:'#ffffff'},
      extraSections:tp.content?[{title:'',content:tp.content}]:[]
    });
  });
  const entry={id,title:p.title,subtitle:'',description:(p.topics[0]?.content||'').slice(0,160),icon:'📄',custom:true,draft:true,language:p.language};
  const items=[...(branding.catalog||[]).filter(x=>x.id!==id),entry];
  batch.set(doc(db,'branding','catalog'),{items,updatedAt:now});
  await batch.commit();
  branding.catalog=items;
  mergeCatalog();
  pendingImport=null;
  renderLibrary();renderSidebar();
  openDialog(t('importPrevT'),`<p>${t('importedOk')}</p>`);
}
async function deleteCustomStudy(){
  if(!owner||!currentStudy?.custom)return;
  if(!confirm(t('delStudyConfirm')))return;
  const id=currentStudy.id;
  const tSnap=await getDocs(collection(db,'studies',id,'topics'));
  const vSnap=await getDocs(collection(db,'studies',id,'verses'));
  const docs=[...tSnap.docs,...vSnap.docs];
  for(let i=0;i<docs.length;i+=400){
    const batch=writeBatch(db);
    docs.slice(i,i+400).forEach(d=>batch.delete(d.ref));
    await batch.commit();
  }
  const items=(branding.catalog||[]).filter(x=>x.id!==id);
  const batch=writeBatch(db);
  batch.delete(doc(db,'studies',id));
  batch.set(doc(db,'branding','catalog'),{items,updatedAt:new Date().toISOString()});
  await batch.commit();
  branding.catalog=items;
  mergeCatalog();
  $('#editorDialog').close();
  showLibrary();
}

/* ===== v29: Honest diagnostics ===== */
async function runDiagnostics(){
  const out=$('#diagResults');if(!out)return;
  out.innerHTML='<p>…</p>';
  const rows=[];
  const add=(sev,msg,fix)=>rows.push({sev,msg,fix});
  add(navigator.onLine?'ok':'warn',navigator.onLine?'Network: online':'Network: OFFLINE — Firestore is serving cached data');
  const swOK=!!navigator.serviceWorker?.controller;
  add(swOK?'ok':'warn',swOK?'Service worker active (instant loading enabled)':'Service worker not controlling this page yet — reload once');
  try{
    const keys=await caches.keys();
    add('ok','App cache: '+(keys.join(', ')||'none'));
  }catch{add('warn','Cache API unavailable')}
  try{
    const est=await navigator.storage.estimate();
    add('ok',`Device storage used by this app: ${(est.usage/1048576).toFixed(1)} MB of ${(est.quota/1048576/1024).toFixed(1)} GB available`);
  }catch{}
  try{
    const dbs=await indexedDB.databases();
    add(dbs.some(d=>String(d.name).includes('firestore'))?'ok':'warn',
        dbs.some(d=>String(d.name).includes('firestore'))?'Firestore offline cache: active (fast repeat loads)':'Firestore offline cache: not yet created (first sign-in creates it)');
    add('ok','Bible device cache: '+(dbs.some(d=>d.name==='bible-study-cache')?'present':'empty'));
  }catch{}
  const heroKB=branding.hero?Math.round(branding.hero.length/1024):0;
  if(heroKB)add(heroKB>450?'warn':'ok',`Hero photo: ${heroKB} KB${heroKB>450?' — large; consider re-uploading a smaller photo':''}`);
  Object.entries(branding.banners||{}).forEach(([id,src])=>{
    const kb=Math.round(String(src).length/1024);
    if(kb>260)add('warn',`Banner "${id}": ${kb} KB — large; consider a smaller photo`);
  });
  add('ok',`Studies in library: ${studies.length} (${(branding.catalog||[]).length} imported/custom)`);
  if(__errLog.length)add('warn',`JavaScript errors this session: ${__errLog.length} — latest: ${esc(__errLog[__errLog.length-1].m).slice(0,140)}`);
  else add('ok','JavaScript errors this session: none');
  out.innerHTML=rows.map(r=>`<div class="diagRow ${r.sev}">${r.sev==='ok'?'✅':'⚠️'} ${r.msg}</div>`).join('')
    +`<div class="diagFixes"><button id="diagClearCache" class="secondarySettingBtn">${t('diagFixCache')}</button><button id="diagClearBible" class="secondarySettingBtn">${t('diagFixBible')}</button></div>`;
  const c1=$('#diagClearCache');
  if(c1)c1.onclick=async()=>{
    try{
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.unregister()));
      const keys=await caches.keys();
      await Promise.all(keys.map(k=>caches.delete(k)));
    }catch{}
    location.reload();
  };
  const c2=$('#diagClearBible');
  if(c2)c2.onclick=()=>{try{indexedDB.deleteDatabase('bible-study-cache');bibleData=null;bibleId='';c2.textContent='✓'}catch{}};
}

function bind(){
  const on=(sel,event,fn)=>{
    const el=$(sel);
    if(el) el.addEventListener(event,fn);
  };

  on('#loginForm','submit',async e=>{
    e.preventDefault();
    const msg=$('#loginMessage'); if(msg)msg.textContent=t('signingIn');
    try{
      await signInWithEmailAndPassword(auth,$('#loginEmail').value.trim(),$('#loginPassword').value);
      if(msg)msg.textContent='';
    }catch{
      if(msg)msg.textContent=t('signInFail');
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
    if(!t){openDialog(I18N[lang].readFullT,I18N[lang].openTopicFirst);return}
    openDialog(I18N[lang].readFullT,(t.verses||[]).map(r=>`<div class="supportItem"><button data-ref="${r}">📖 ${r}</button><p>${verses[r]||''}</p></div>`).join(''));
  };
  on('#readFull','click',readPassage);
  on('#whatBible','click',readPassage);
  on('#keyObs','click',()=>openDialog(t('keyObsT'),`<p>${topics[currentTopic]?.bible_first||''}</p>`+videoGrid(topics[currentTopic]?.bible_videos)));
  on('#closeDialog','click',()=>$('#dialog')?.close());

  on('#aboutBtn','click',()=>openDialog(t('aboutT'),t('aboutB')));
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
  [['settingPanelBw','panelBwOut','px'],['settingPanelRadius','panelRadiusOut','px'],['settingPanelOpacity','panelOpacityOut','%'],['settingPanelFs','panelFsOut','%']].forEach(([id,out,u])=>{
    on('#'+id,'input',e=>{const o=$('#'+out);if(o)o.value=e.target.value+u;applySettings(readSettings())});
  });
  on('#langSel','change',e=>setLang(e.target.value));
  on('#langSelSettings','change',e=>setLang(e.target.value));
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
  ['settingTitle','settingSubtitle','settingHeroTitle','settingHeroTagline','settingFooter','settingFont','settingPrimary','settingBackground','settingText','settingCard','settingTopbarBg','settingTabBg','settingTabText','settingSidebarBg','settingSidebarText','settingStudyBar','settingStudyBarText','settingStudyTitleFont','settingPanelBg','settingPanelHead','settingPanelText','settingPanelBorder','settingDensity','settingCardStyle','settingSidebar','settingQuotes','settingAnimations']
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
  on('#howBtn','click',()=>openDialog(t('howT'),t('howB')));
  on('#faqBtn','click',()=>openDialog(t('faqT'),t('faqB')));
  on('#suggestBtn','click',()=>openDialog(t('suggestT'),t('suggestB')));
  on('#shareBtn','click',async()=>{
    const url=location.href;
    try{
      if(navigator.share) await navigator.share({title:document.title,url});
      else {await navigator.clipboard.writeText(url);openDialog(t('shareT'),t('shareB'))}
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

  on('#analyzeImport','click',()=>{
    const raw=$('#importPaste').value.trim();
    if(!raw){importStatus('—');return}
    const parsed=/<\/?(p|h[1-6]|div|li|br)\b/i.test(raw)?parseStudyHTML(raw,''):parseStudyText(raw,'');
    showImportPreview(parsed,'Pasted text');
  });
  on('#importFile','change',e=>{
    const f=e.target.files[0];if(!f)return;
    importStatus('Reading '+f.name+'…');
    parseImportFile(f).then(p=>showImportPreview(p,f.name)).catch(err=>importStatus('⚠ '+err.message));
  });
  on('#importUrlBtn','click',async()=>{
    const url=$('#importUrl').value.trim();if(!url)return;
    importStatus('Fetching…');
    try{
      const res=await fetch(url);
      if(!res.ok)throw new Error('HTTP '+res.status);
      showImportPreview(parseStudyHTML(await res.text(),url),url);
    }catch{importStatus('⚠ '+t('corsFail'))}
  });
  on('#runDiagBtn','click',()=>runDiagnostics());
  on('#deleteStudyBtn','click',()=>deleteCustomStudy().catch(e=>openDialog('Delete',`<p>${esc(e.message)}</p>`)));
  on('#sectionTemplate','change',e=>{
    if(e.target.value){$('#editExtraTitle').value=e.target.value;e.target.value=''}
  });

  on('#addNavLink','click',()=>{
    if(navDraft===null)navDraft=effNavLinks().map(x=>({...x}));
    navDraft.push({icon:'🔗',label:lang==='es'?'Nuevo enlace':'New link',action:'url',value:''});
    renderNavLinksEditor();
    if(!currentStudy)renderSidebar($('#search')?.value||'');
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
    baseCatalog=await loadStudyCatalog();
    studies=[...baseCatalog];
    allowedStudies=await loadPermissions();
    try{favorites=new Set((await progressDoc()).favorites||[])}catch{favorites=new Set()}
  }catch(e){
    console.error('Startup data error:',e);
    try{ baseCatalog=await loadStudyCatalog(); studies=[...baseCatalog]; }catch{}
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
applyLang();
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
