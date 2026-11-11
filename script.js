(function(){
 var root=document.documentElement,body=document.body;
 var top=document.querySelector('.top');
 function onScroll(){top.classList.toggle('sc',window.scrollY>8)}
 window.addEventListener('scroll',onScroll,{passive:true});onScroll();

 var burger=document.querySelector('.burger'),mm=document.querySelector('.mmenu');
 burger.addEventListener('click',function(){var o=!root.classList.contains('menu-open');root.classList.toggle('menu-open',o);burger.setAttribute('aria-expanded',o);mm.setAttribute('aria-hidden',!o);body.style.overflow=o?'hidden':''});

 document.querySelectorAll('a[href*=".html"]').forEach(function(a){a.addEventListener('click',function(e){
  if(e.metaKey||e.ctrlKey||a.target==='_blank')return;e.preventDefault();body.classList.add('leaving');var h=a.getAttribute('href');setTimeout(function(){location.href=h},200)})});
 window.addEventListener('pageshow',function(){body.classList.remove('leaving')});

 var io='IntersectionObserver' in window?new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{rootMargin:'0px 0px -40px 0px'}):null;
 document.querySelectorAll('.rv').forEach(function(e){io?io.observe(e):e.classList.add('in')});

 var H=window.PS_HOURS||[];
 function mins(t){var p=t.split(':');return +p[0]*60+ +p[1]}
 function openState(){var n=new Date(),d=(n.getDay()+6)%7,h=H[d],m=n.getHours()*60+n.getMinutes();
  var o=h&&h[0]&&m>=mins(h[0])&&m<mins(h[1]);
  document.querySelectorAll('[data-open]').forEach(function(e){e.textContent=o?'Abierto ahora · hasta las '+h[1]:'Cerrado ahora · reserva tu cita';e.classList.toggle('is-open',!!o)});
  document.querySelectorAll('.hours li[data-d="'+n.getDay()+'"]').forEach(function(l){l.classList.add('today')})}
 openState();setInterval(openState,60000);

 // service tabs
 document.querySelectorAll('.tb').forEach(function(b){b.addEventListener('click',function(){
  document.querySelectorAll('.tb').forEach(function(x){x.classList.toggle('on',x===b);x.setAttribute('aria-selected',x===b)});
  document.querySelectorAll('.pane').forEach(function(p){p.classList.toggle('on',p.dataset.p===b.dataset.t)});
  document.querySelectorAll('.pane.on .rv').forEach(function(e){e.classList.add('in')})})});
 document.querySelectorAll('.ask').forEach(function(b){b.addEventListener('click',function(){body.classList.add('leaving');setTimeout(function(){location.href='reservar.html?s='+encodeURIComponent(b.dataset.s)},200)})});

 // contact form -> WhatsApp
 var f=document.querySelector('.wform');
 if(f){f.addEventListener('submit',function(e){e.preventDefault();
  var a=f.querySelector('[name=a]:checked').value,p=f.querySelector('[name=p]:checked').value,t=f.querySelector('[name=t]:checked').value;
  var msg='¡Hola! '+(f.n.value.trim()?'Soy '+f.n.value.trim()+'. ':'')+'Quería pedir cita para mi '+a+(f.r.value.trim()?' ('+f.r.value.trim()+')':'')+': '+f.s.value+'. Tiene el pelo '+p+'. Me viene mejor '+t+'.';
  if(f.m.value.trim())msg+='\n'+f.m.value.trim();
  window.open(window.PS_WA+'?text='+encodeURIComponent(msg),'_blank','noopener')})}

 // ---------- shared storage (demo) ----------
 function load(){try{return JSON.parse(localStorage.getItem('ps_fichas')||'[]')}catch(e){return mem}}
 function save(l){mem=l;try{localStorage.setItem('ps_fichas',JSON.stringify(l))}catch(e){}}
 var mem=[];
 function esc(s){return String(s||'').replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
 var DN=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],MN=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
 function fdate(d){return DN[d.getDay()]+' '+d.getDate()+' '+MN[d.getMonth()]}

 // ---------- booking demo ----------
 var bk=document.querySelector('.bkc');
 if(bk){
  var st={s:null,dur:0,d:null,t:null,photo:null};
  var q=new URLSearchParams(location.search).get('s');
  var sbtn=bk.querySelectorAll('.svc button');
  function pickS(b){sbtn.forEach(function(x){x.classList.toggle('on',x===b)});st.s=b.dataset.s;st.dur=+b.dataset.m;st.t=null;renderSlots();sum()}
  sbtn.forEach(function(b){b.addEventListener('click',function(){pickS(b)})});
  var days=bk.querySelector('.days'),slots=bk.querySelector('.slots');
  var base=new Date();base.setHours(0,0,0,0);
  for(var i=0;i<14;i++){(function(i){var d=new Date(base);d.setDate(base.getDate()+i);var h=H[(d.getDay()+6)%7];
   var b=document.createElement('button');b.type='button';b.innerHTML='<small>'+DN[d.getDay()]+'</small><b>'+d.getDate()+'</b><small>'+MN[d.getMonth()]+'</small>';
   if(!h||!h[0])b.disabled=true;
   b.addEventListener('click',function(){days.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b)});st.d=d;st.t=null;renderSlots();sum()});
   days.appendChild(b)})(i)}
  function seed(n){var x=Math.sin(n)*10000;return x-Math.floor(x)}
  var API=window.PS_API||'';
  function ymd(d){return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}
  function slotBtn(t){var b=document.createElement('button');b.type='button';b.textContent=t;
   b.addEventListener('click',function(){slots.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b)});st.t=t;sum()});return b}
  function renderSlots(){slots.innerHTML='';
   if(API&&st.d&&st.s){var req=ymd(st.d)+st.dur;slots.innerHTML='<p class="empty">Buscando huecos libres…</p>';
    fetch(API+'?api=slots&fecha='+ymd(st.d)+'&dur='+st.dur).then(function(r){return r.json()}).then(function(j){
     if(req!==ymd(st.d)+st.dur)return;slots.innerHTML='';(j.slots||[]).forEach(function(t){slots.appendChild(slotBtn(t))});
     if(!(j.slots||[]).length)slots.innerHTML='<p class="empty">No quedan huecos este día. Prueba otro.</p>'})
    .catch(function(){slots.innerHTML='<p class="empty">No se han podido cargar los huecos. Inténtalo de nuevo o escríbenos por WhatsApp.</p>'});return}
   if(!st.d){slots.innerHTML='<p class="empty">Elige un día para ver los huecos libres.</p>';return}
   if(!st.s){slots.innerHTML='<p class="empty">Elige primero un servicio.</p>';return}
   var h=H[(st.d.getDay()+6)%7],a=mins(h[0]),z=mins(h[1]),now=new Date(),key=st.d.getDate()*7+st.d.getMonth();
   for(var m=a;m+st.dur<=z;m+=30){(function(m){var b=document.createElement('button');b.type='button';
    var t=Math.floor(m/60)+':'+('0'+m%60).slice(-2);b.textContent=t;
    var past=st.d.toDateString()===now.toDateString()&&m<=now.getHours()*60+now.getMinutes();
    var busy=past||seed(key*100+m)<.38;
    if(busy){b.classList.add('busy');b.disabled=true;b.setAttribute('aria-label',t+' ocupado')}
    else b.addEventListener('click',function(){slots.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b)});st.t=t;sum()});
    slots.appendChild(b)})(m)}
   if(!slots.querySelector('button:not(.busy)'))slots.innerHTML='<p class="empty">No quedan huecos este día. Prueba otro.</p>'}
  renderSlots();
  var fm=bk.querySelector('.bdata'),cbtn=document.querySelector('.sum .btn');
  var up=fm.querySelector('input[type=file]'),pv=fm.querySelector('.pv');
  up.addEventListener('change',function(){var fl=up.files[0];if(!fl)return;var r=new FileReader();r.onload=function(){var img=new Image();img.onload=function(){var k=Math.min(1,1000/Math.max(img.width,img.height)),cv=document.createElement('canvas');cv.width=img.width*k;cv.height=img.height*k;cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);st.photo=cv.toDataURL('image/jpeg',.82);pv.innerHTML='<img alt="Foto de la mascota" src="'+st.photo+'">'};img.src=r.result};r.readAsDataURL(fl)});
  fm.addEventListener('input',sum);fm.addEventListener('change',sum);
  function sum(){
   var S=document.querySelector('.sum');
   S.querySelector('[data-v=s]').textContent=st.s||'—';
   S.querySelector('[data-v=d]').textContent=st.d?fdate(st.d)+(st.t?' · '+st.t:''):'—';
   var pn=fm.pn.value.trim();S.querySelector('[data-v=p]').textContent=pn?pn+' ('+fm.querySelector('[name=ta]:checked').value+')':'—';
   cbtn.disabled=!(st.s&&st.d&&st.t&&pn&&fm.on.value.trim()&&fm.ph.value.trim())}
  sum();
  if(q){var m=[].slice.call(sbtn).reverse().find(function(b){return q.toLowerCase().indexOf(b.dataset.k)>-1});if(m)pickS(m)}
  function done(pet){document.querySelector('.bflow').style.display='none';
   var ok=document.querySelector('.okbox');ok.classList.add('on');
   ok.querySelector('[data-v=ev]').textContent=st.s+' · '+pet;
   ok.querySelector('[data-v=evd]').textContent=fdate(st.d)+' · '+st.t+' ('+st.dur+' min)';
   if(API){var a=ok.querySelector('a[href^="clientes"]');if(a)a.remove();var g=ok.querySelector('.gcal small');var p=ok.querySelector('.lead');if(p)p.textContent='Te hemos guardado el hueco. Si dejaste tu email, te llegará la confirmación y un recordatorio el día antes.'}
   window.scrollTo({top:0,behavior:'smooth'})}
  cbtn.addEventListener('click',function(){
   if(API){cbtn.disabled=true;var lbl=cbtn.innerHTML;cbtn.textContent='Reservando…';
    var body={api:'reservar',servicio:st.s,fecha:ymd(st.d),hora:st.t,tipo:fm.querySelector('[name=ta]:checked').value,mascota:fm.pn.value.trim(),raza:fm.rz.value.trim(),propietario:fm.on.value.trim(),telefono:fm.ph.value.trim(),email:fm.em?fm.em.value.trim():'',pelo:fm.querySelector('[name=pe]:checked').value,notas:fm.nt.value.trim(),foto:st.photo||''};
    fetch(API,{method:'POST',body:JSON.stringify(body)}).then(function(r){return r.json()}).then(function(j){
     if(j.ok)done(body.mascota);else{alert(j.error||'No se ha podido reservar');cbtn.innerHTML=lbl;cbtn.disabled=false;st.t=null;renderSlots();sum()}})
    .catch(function(){alert('No se ha podido conectar. Inténtalo de nuevo o escríbenos por WhatsApp.');cbtn.innerHTML=lbl;cbtn.disabled=false});return}
   var tipo=fm.querySelector('[name=ta]:checked').value;
   var fic={id:Date.now(),pet:fm.pn.value.trim(),tipo:tipo,raza:fm.rz.value.trim(),owner:fm.on.value.trim(),tel:fm.ph.value.trim(),pelo:fm.querySelector('[name=pe]:checked').value,notas:fm.nt.value.trim(),photo:st.photo,visits:[{d:fdate(st.d)+' · '+st.t,s:st.s,n:'Reserva online'}]};
   var l=load();l.unshift(fic);save(l);
   document.querySelector('.bflow').style.display='none';
   var ok=document.querySelector('.okbox');ok.classList.add('on');
   ok.querySelector('[data-v=ev]').textContent=st.s+' · '+fic.pet;
   ok.querySelector('[data-v=evd]').textContent=fdate(st.d)+' · '+st.t+' ('+st.dur+' min)';
   window.scrollTo({top:0,behavior:'smooth'})});
 }

 // ---------- client folder demo ----------
 var cg=document.querySelector('.cgrid');
 if(cg){
  var EX={id:1,ex:true,pet:'Ejemplo: Luna',tipo:'gato',raza:'Maine Coon',owner:'Nombre del propietario',tel:'600 000 000',pelo:'con muchos nudos',notas:'Ficha de ejemplo para la demostración. Aquí irían las notas: carácter, sensibilidades, cómo se porta en el secado…',photo:null,visits:[{d:'Ejemplo',s:'Desenredado de pelo largo',n:'Sin sedación. Muy tranquila con el cepillado suave.'}]};
  function all(){return load().concat([EX])}
  var srch=document.querySelector('.search');
  function card(c){var icon=c.tipo==='gato'?window.PS_ICO.cat:window.PS_ICO.paw;
   return '<button class="pc" data-id="'+c.id+'"><div class="pph">'+(c.photo?'<img alt="" src="'+c.photo+'">':icon)+(c.ex?'<span class="tagx">Ejemplo</span>':'')+'</div><div class="pcb"><h3>'+esc(c.pet)+'</h3><p>'+esc(c.raza||c.tipo)+' · '+esc(c.owner)+'</p><div class="pills"><span>'+esc(c.tipo)+'</span><span>Pelo '+esc(c.pelo)+'</span><span>'+c.visits.length+' visita'+(c.visits.length>1?'s':'')+'</span></div></div></button>'}
  function render(){var q=(srch.value||'').toLowerCase();var l=all().filter(function(c){return !q||(c.pet+' '+c.owner+' '+c.raza).toLowerCase().indexOf(q)>-1});
   cg.innerHTML='<button class="pc newc" data-new>'+window.PS_ICO.plus+'<span>Nueva ficha</span></button>'+l.map(card).join('');
   cg.querySelectorAll('.pc[data-id]').forEach(function(b){b.addEventListener('click',function(){openF(+b.dataset.id)})});}
  srch.addEventListener('input',render);
  var md=document.querySelector('.modal'),mb=md.querySelector('.mcontent');
  function openM(){md.classList.add('on');body.style.overflow='hidden'}
  function closeM(){md.classList.remove('on');body.style.overflow=''}
  md.addEventListener('click',function(e){if(e.target===md||e.target.classList.contains('mx'))closeM()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeM()});
  function openF(id){var c=all().filter(function(x){return x.id===id})[0];if(!c)return;var icon=c.tipo==='gato'?window.PS_ICO.cat:window.PS_ICO.paw;
   mb.innerHTML='<div class="fh"><div class="pph">'+(c.photo?'<img alt="" src="'+c.photo+'">':icon)+(c.ex?'<span class="tagx">Ejemplo</span>':'')+'</div><div class="fbody"><h2>'+esc(c.pet)+'</h2><p class="own">'+esc(c.raza||'')+' · '+esc(c.tipo)+'</p><p>'+esc(c.notas||'Sin notas todavía.')+'</p></div></div>'+
   '<dl class="kv"><div><dt>Propietario</dt><dd>'+esc(c.owner)+'</dd></div><div><dt>Teléfono</dt><dd>'+esc(c.tel)+'</dd></div><div><dt>Estado del pelo</dt><dd>'+esc(c.pelo)+'</dd></div><div><dt>Visitas</dt><dd>'+c.visits.length+'</dd></div></dl>'+
   '<div class="hist"><h3>Historial</h3><ul>'+c.visits.map(function(v){return '<li><b>'+esc(v.d)+'</b><span>'+esc(v.s)+(v.n?' — '+esc(v.n):'')+'</span></li>'}).join('')+'</ul></div>';openM()}
  // new ficha form
  var nf=document.querySelector('#nueva');
  var photo=null;
  cg.addEventListener('click',function(e){if(e.target.closest('[data-new]')){mb.innerHTML='';mb.appendChild(nf.content.cloneNode(true));bindNew();openM()}});
  function bindNew(){var f=mb.querySelector('form'),up=f.querySelector('input[type=file]'),pv=f.querySelector('.pv');photo=null;
   up.addEventListener('change',function(){var fl=up.files[0];if(!fl)return;var r=new FileReader();r.onload=function(){photo=r.result;pv.innerHTML='<img alt="" src="'+r.result+'">'};r.readAsDataURL(fl)});
   f.addEventListener('submit',function(e){e.preventDefault();if(!f.pn.value.trim())return f.pn.focus();
    var l=load();l.unshift({id:Date.now(),pet:f.pn.value.trim(),tipo:f.querySelector('[name=ta]:checked').value,raza:f.rz.value.trim(),owner:f.on.value.trim()||'—',tel:f.ph.value.trim()||'—',pelo:f.querySelector('[name=pe]:checked').value,notas:f.nt.value.trim(),photo:photo,visits:[{d:'Ficha creada',s:'Alta en la peluquería',n:''}]});save(l);closeM();render()})}
  render();
 }
})();
