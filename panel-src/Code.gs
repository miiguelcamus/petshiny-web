/**
 * Panel del negocio — reservas, fichas de clientes y automatizaciones.
 * Funciona entero sobre la cuenta de Google del negocio (Calendar, Sheets, Drive, Gmail).
 *
 * Instalación: ver INSTALAR.md
 */

// ============ CONFIGURACIÓN INICIAL (solo se usa la primera vez) ============
var DEFAULTS = {
  negocio: 'Mascota Brillante',
  web: 'https://miiguelcamus.github.io/petshiny-web/',
  telefono: '631 94 38 54',
  direccion: 'C. Auzolan, 24, 31600 Burlada',
  resenas: 'https://search.google.com/local/writereview?placeid=ChIJZwD1Pn5iiSQRhCmAZ23Wtzg',
  tipos: ['perro', 'gato'],
  // 0 = lunes ... 6 = domingo. null = cerrado
  horario: [['09:00','17:00'],['11:00','17:00'],['09:00','17:00'],['09:00','17:00'],['11:00','17:00'],['09:00','17:00'],null],
  intervalo: 30,
  vacaciones: [],          // [{desde:'2026-12-24', hasta:'2026-12-26'}]
  servicios: [
    {n:'Baño y secado (perro)', m:60},
    {n:'Corte de pelo (perro)', m:90},
    {n:'Desenredado de nudos (perro)', m:90},
    {n:'Perro grande o de trabajo', m:120},
    {n:'Baño y secado (gato)', m:60},
    {n:'Desenredado de pelo largo (gato)', m:90},
    {n:'Cepillado y mantenimiento (gato)', m:60}
  ],
  volverSemanas: 7,
  recordatorio: true,
  volver: true,
  pedirResena: true,
  resumenDiario: true,
  txtRecordatorio: '¡Hola {propietario}! Te recordamos la cita de {mascota} mañana {fecha} a las {hora} ({servicio}) en {negocio}, {direccion}. Si no puedes venir, avísanos al {telefono}.',
  txtVolver: '¡Hola {propietario}! Ya han pasado unas semanas desde la última visita de {mascota}. ¿Le damos un poco de brillo? Reserva cuando quieras: {web}',
  txtResena: '¡Gracias por traer a {mascota} a {negocio}! Si quedaste contento, nos ayudas muchísimo dejando una reseña en Google: {resenas}'
};

var CLI_COLS = ['id','creado','mascota','tipo','raza','propietario','telefono','email','pelo','notas','fotoId','ultimaVisita','visitas','avisoVolver'];
var CITA_COLS = ['id','fecha','hora','duracion','servicio','clienteId','mascota','propietario','telefono','email','estado','eventId','recordado','resena','origen','creada'];

// ============ INSTALACIÓN ============
function instalar() {
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('SHEET_ID')) {
    var ss = SpreadsheetApp.create('Panel · ' + DEFAULTS.negocio + ' (datos)');
    var c = ss.getSheets()[0]; c.setName('Clientes'); c.appendRow(CLI_COLS); c.setFrozenRows(1);
    var a = ss.insertSheet('Citas'); a.appendRow(CITA_COLS); a.setFrozenRows(1);
    p.setProperty('SHEET_ID', ss.getId());
  }
  if (!p.getProperty('FOLDER_ID')) {
    p.setProperty('FOLDER_ID', DriveApp.createFolder('Panel · ' + DEFAULTS.negocio + ' (fotos)').getId());
  }
  if (!p.getProperty('CFG')) p.setProperty('CFG', JSON.stringify(DEFAULTS));
  // Tarea diaria a las 9:00
  ScriptApp.getProjectTriggers().forEach(function(t){ if (t.getHandlerFunction() === 'tareaDiaria') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('tareaDiaria').timeBased().everyDays(1).atHour(9).create();
  Logger.log('Instalado. Hoja de datos: ' + SpreadsheetApp.openById(p.getProperty('SHEET_ID')).getUrl());
}

// ============ UTILIDADES ============
function cfg() { return JSON.parse(PropertiesService.getScriptProperties().getProperty('CFG') || JSON.stringify(DEFAULTS)); }
function saveCfg(c) { PropertiesService.getScriptProperties().setProperty('CFG', JSON.stringify(c)); }
function ss() { return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID')); }
function sheet(n) { return ss().getSheetByName(n); }
function tz() { return Session.getScriptTimeZone() || 'Europe/Madrid'; }
function fmt(d, f) { return Utilities.formatDate(d, tz(), f); }
function uid() { return Utilities.getUuid().slice(0, 8); }
function readAll(name, cols) {
  var v = sheet(name).getDataRange().getValues(); v.shift();
  return v.filter(function(r){ return r[0] !== ''; }).map(function(r){
    var o = {}; cols.forEach(function(c, i){ o[c] = r[i] instanceof Date ? fmt(r[i], c === 'hora' ? 'HH:mm' : 'yyyy-MM-dd') : r[i]; }); return o;
  });
}
function rowIndex(name, id) {
  var ids = sheet(name).getRange(2, 1, Math.max(sheet(name).getLastRow() - 1, 1), 1).getDisplayValues();
  for (var i = 0; i < ids.length; i++) if (ids[i][0] == id) return i + 2;
  return -1;
}
function writeRow(name, cols, o) {
  var sh = sheet(name), row = cols.map(function(c){ return o[c] === undefined ? '' : o[c]; });
  var r = rowIndex(name, o.id);
  // Guardar fecha y hora como texto para que no las convierta Sheets
  if (r > 0) sh.getRange(r, 1, 1, cols.length).setNumberFormat('@').setValues([row]);
  else { sh.appendRow(row); sh.getRange(sh.getLastRow(), 1, 1, cols.length).setNumberFormat('@'); sh.getRange(sh.getLastRow(), 1, 1, cols.length).setValues([row]); }
}
function fill(t, o) { return String(t).replace(/\{(\w+)\}/g, function(_, k){ return o[k] != null ? o[k] : ''; }); }
function normTel(t) { return String(t || '').replace(/\D/g, '').replace(/^34(?=\d{9}$)/, ''); }
function mins(t) { var p = String(t).split(':'); return +p[0] * 60 + +p[1]; }
function hhmm(m) { return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + m % 60).slice(-2); }
function dateAt(dstr, hm) { var p = dstr.split('-'), m = mins(hm); return new Date(+p[0], +p[1] - 1, +p[2], Math.floor(m / 60), m % 60); }
function esPropietario() {
  var a = Session.getActiveUser().getEmail(), e = Session.getEffectiveUser().getEmail();
  return !!a && a === e;
}
function soloPropietario() { if (!esPropietario()) throw new Error('No autorizado'); }

// ============ WEB: API pública + panel ============
function doGet(e) {
  var api = e && e.parameter && e.parameter.api;
  if (api === 'config') return json(publicCfg());
  if (api === 'slots') return json({ slots: huecos(e.parameter.fecha, +e.parameter.dur || 60) });
  if (!esPropietario()) return HtmlService.createHtmlOutput('<p style="font-family:sans-serif;padding:40px">Esta zona es privada.</p>');
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Panel · ' + cfg().negocio)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.api === 'reservar') return json(reservar(body));
    return json({ ok: false, error: 'Acción no válida' });
  } catch (err) { return json({ ok: false, error: String(err.message || err) }); }
}
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function publicCfg() { var c = cfg(); return { negocio: c.negocio, horario: c.horario, servicios: c.servicios, intervalo: c.intervalo, vacaciones: c.vacaciones }; }

// ============ RESERVAS ============
function enVacaciones(dstr, c) { return (c.vacaciones || []).some(function(v){ return dstr >= v.desde && dstr <= (v.hasta || v.desde); }); }
function huecos(dstr, dur) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dstr || '')) return [];
  var c = cfg(), d = dateAt(dstr, '00:00'), dow = (d.getDay() + 6) % 7, h = c.horario[dow];
  if (!h || enVacaciones(dstr, c)) return [];
  var start = dateAt(dstr, h[0]), end = dateAt(dstr, h[1]);
  var busy = CalendarApp.getDefaultCalendar().getEvents(start, end).filter(function(ev){ return !ev.isAllDayEvent() || true; })
    .map(function(ev){ return ev.isAllDayEvent() ? [start.getTime(), end.getTime()] : [ev.getStartTime().getTime(), ev.getEndTime().getTime()]; });
  var now = Date.now() + 30 * 60000, out = [];
  for (var m = mins(h[0]); m + dur <= mins(h[1]); m += (c.intervalo || 30)) {
    var s = dateAt(dstr, hhmm(m)).getTime(), f = s + dur * 60000;
    if (s < now) continue;
    var libre = !busy.some(function(b){ return s < b[1] && f > b[0]; });
    if (libre) out.push(hhmm(m));
  }
  return out;
}
function reservar(b) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var c = cfg(), srv = c.servicios.filter(function(s){ return s.n === b.servicio; })[0];
    if (!srv) return { ok: false, error: 'Servicio no válido' };
    if (!b.mascota || !b.propietario || !b.telefono) return { ok: false, error: 'Faltan datos' };
    if (huecos(b.fecha, srv.m).indexOf(b.hora) < 0) return { ok: false, error: 'Ese hueco ya no está libre. Elige otro.' };
    var cli = guardarClienteInterno({
      mascota: b.mascota, tipo: b.tipo, raza: b.raza, propietario: b.propietario, telefono: b.telefono,
      email: b.email, pelo: b.pelo, notas: b.notas, fotoBase64: b.foto
    }, true);
    var ini = dateAt(b.fecha, b.hora), fin = new Date(ini.getTime() + srv.m * 60000);
    var desc = [
      'Mascota: ' + b.mascota + (b.raza ? ' (' + b.raza + ')' : '') + ' · ' + (b.tipo || ''),
      'Propietario: ' + b.propietario + ' · Tel: ' + b.telefono + (b.email ? ' · ' + b.email : ''),
      'Pelo: ' + (b.pelo || '-'), b.notas ? 'Notas: ' + b.notas : '', 'Reservado desde la web'
    ].filter(String).join('\n');
    var ev = CalendarApp.getDefaultCalendar().createEvent(srv.n + ' · ' + b.mascota, ini, fin, { description: desc });
    var cita = {
      id: uid(), fecha: b.fecha, hora: b.hora, duracion: srv.m, servicio: srv.n, clienteId: cli.id, mascota: b.mascota,
      propietario: b.propietario, telefono: b.telefono, email: b.email || '', estado: 'reservada', eventId: ev.getId(),
      recordado: '', resena: '', origen: 'web', creada: fmt(new Date(), 'yyyy-MM-dd HH:mm')
    };
    writeRow('Citas', CITA_COLS, cita);
    if (b.email) try {
      MailApp.sendEmail(b.email, 'Cita confirmada · ' + c.negocio,
        fill('¡Hola {propietario}! Tu cita para {mascota} está confirmada: {fecha} a las {hora} ({servicio}).\n\n{negocio}\n{direccion}\nTel.: {telefono}',
          { propietario: b.propietario, mascota: b.mascota, fecha: fmt(ini, 'dd/MM/yyyy'), hora: b.hora, servicio: srv.n, negocio: c.negocio, direccion: c.direccion, telefono: c.telefono }),
        { name: c.negocio });
    } catch (e) {}
    return { ok: true, cita: { fecha: b.fecha, hora: b.hora, servicio: srv.n, duracion: srv.m } };
  } finally { lock.releaseLock(); }
}

// ============ CLIENTES ============
function guardarClienteInterno(o, desdeReserva) {
  var lista = readAll('Clientes', CLI_COLS), ex = null, tel = normTel(o.telefono);
  if (o.id) ex = lista.filter(function(x){ return x.id == o.id; })[0];
  if (!ex && desdeReserva && tel) ex = lista.filter(function(x){ return normTel(x.telefono) === tel && String(x.mascota).toLowerCase() === String(o.mascota).toLowerCase(); })[0];
  var cli = ex || { id: uid(), creado: fmt(new Date(), 'yyyy-MM-dd'), visitas: 0, ultimaVisita: '', avisoVolver: '', fotoId: '' };
  ['mascota','tipo','raza','propietario','telefono','email','pelo','notas'].forEach(function(k){
    if (o[k] !== undefined && (o[k] !== '' || !desdeReserva)) cli[k] = o[k];
  });
  if (o.fotoBase64) {
    var m = String(o.fotoBase64).match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
    if (m) {
      var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], (cli.mascota || 'foto') + '-' + cli.id);
      var f = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('FOLDER_ID')).createFile(blob);
      if (cli.fotoId) try { DriveApp.getFileById(cli.fotoId).setTrashed(true); } catch (e) {}
      cli.fotoId = f.getId();
    }
  }
  writeRow('Clientes', CLI_COLS, cli);
  return cli;
}

// ---- Funciones llamadas desde el panel (solo propietario) ----
function panelDatos() {
  soloPropietario();
  var clientes = readAll('Clientes', CLI_COLS), citas = readAll('Citas', CITA_COLS);
  return { cfg: cfg(), clientes: clientes, citas: citas, hoy: fmt(new Date(), 'yyyy-MM-dd'), sheetUrl: ss().getUrl() };
}
function panelGuardarCliente(o) { soloPropietario(); return guardarClienteInterno(o, false); }
function panelBorrarCliente(id) {
  soloPropietario();
  var r = rowIndex('Clientes', id); if (r > 0) sheet('Clientes').deleteRow(r);
  return true;
}
function panelFoto(id) {
  soloPropietario();
  try { var b = DriveApp.getFileById(id).getThumbnail() || DriveApp.getFileById(id).getBlob();
    return 'data:' + (b.getContentType() || 'image/png') + ';base64,' + Utilities.base64Encode(b.getBytes()); } catch (e) { return ''; }
}
function panelNuevaCita(o) {
  soloPropietario();
  var c = cfg(), srv = c.servicios.filter(function(s){ return s.n === o.servicio; })[0] || { n: o.servicio, m: +o.duracion || 60 };
  var cli = readAll('Clientes', CLI_COLS).filter(function(x){ return x.id == o.clienteId; })[0];
  if (!cli) throw new Error('Cliente no encontrado');
  var ini = dateAt(o.fecha, o.hora), fin = new Date(ini.getTime() + srv.m * 60000);
  var ev = CalendarApp.getDefaultCalendar().createEvent(srv.n + ' · ' + cli.mascota, ini, fin,
    { description: 'Propietario: ' + cli.propietario + ' · Tel: ' + cli.telefono + (o.nota ? '\nNota: ' + o.nota : '') });
  var cita = { id: uid(), fecha: o.fecha, hora: o.hora, duracion: srv.m, servicio: srv.n, clienteId: cli.id, mascota: cli.mascota,
    propietario: cli.propietario, telefono: cli.telefono, email: cli.email, estado: 'reservada', eventId: ev.getId(), recordado: '', resena: '', origen: 'panel', creada: fmt(new Date(), 'yyyy-MM-dd HH:mm') };
  writeRow('Citas', CITA_COLS, cita);
  return cita;
}
function panelEstadoCita(id, estado, nota) {
  soloPropietario();
  var cita = readAll('Citas', CITA_COLS).filter(function(x){ return x.id == id; })[0]; if (!cita) return false;
  cita.estado = estado;
  if (estado === 'cancelada' && cita.eventId) try { CalendarApp.getDefaultCalendar().getEventById(cita.eventId).deleteEvent(); } catch (e) {}
  writeRow('Citas', CITA_COLS, cita);
  if (estado === 'hecha') {
    var cli = readAll('Clientes', CLI_COLS).filter(function(x){ return x.id == cita.clienteId; })[0];
    if (cli) {
      cli.visitas = (+cli.visitas || 0) + 1; cli.ultimaVisita = cita.fecha; cli.avisoVolver = '';
      if (nota) cli.notas = (cli.notas ? cli.notas + '\n' : '') + cita.fecha + ': ' + nota;
      writeRow('Clientes', CLI_COLS, cli);
    }
  }
  return true;
}
function panelGuardarAjustes(c) { soloPropietario(); var cur = cfg(); Object.keys(c).forEach(function(k){ cur[k] = c[k]; }); saveCfg(cur); return cur; }
function panelProbarTarea() { soloPropietario(); return tareaDiaria(); }

// ============ TAREA DIARIA (9:00) ============
function tareaDiaria() {
  var c = cfg(), hoy = fmt(new Date(), 'yyyy-MM-dd');
  var man = new Date(); man.setDate(man.getDate() + 1); var manana = fmt(man, 'yyyy-MM-dd');
  var ay = new Date(); ay.setDate(ay.getDate() - 1); var ayer = fmt(ay, 'yyyy-MM-dd');
  var citas = readAll('Citas', CITA_COLS), clientes = readAll('Clientes', CLI_COLS);
  var log = { recordatorios: 0, resenas: 0, volver: 0, whatsapp: [] };
  var base = { negocio: c.negocio, direccion: c.direccion, telefono: c.telefono, web: c.web, resenas: c.resenas };

  // Las citas pasadas que siguen "reservada" se dan por hechas
  citas.forEach(function(ci){
    if (ci.estado === 'reservada' && ci.fecha < hoy) panelEstadoCitaInterno(ci, 'hecha');
  });
  citas = readAll('Citas', CITA_COLS); clientes = readAll('Clientes', CLI_COLS);

  citas.forEach(function(ci){
    var d = Object.assign({}, base, ci, { fecha: ci.fecha.split('-').reverse().join('/') });
    if (c.recordatorio && ci.fecha === manana && ci.estado === 'reservada' && !ci.recordado) {
      var txt = fill(c.txtRecordatorio, d);
      if (ci.email) { try { MailApp.sendEmail(ci.email, 'Recordatorio de tu cita · ' + c.negocio, txt, { name: c.negocio }); log.recordatorios++; } catch (e) {} }
      log.whatsapp.push({ tipo: 'Recordatorio', quien: ci.propietario + ' (' + ci.mascota + ')', tel: ci.telefono, txt: txt });
      ci.recordado = hoy; writeRow('Citas', CITA_COLS, ci);
    }
    if (c.pedirResena && ci.fecha === ayer && ci.estado === 'hecha' && !ci.resena) {
      var tr = fill(c.txtResena, d);
      if (ci.email) { try { MailApp.sendEmail(ci.email, '¡Gracias por tu visita! · ' + c.negocio, tr, { name: c.negocio }); log.resenas++; } catch (e) {} }
      log.whatsapp.push({ tipo: 'Pedir reseña', quien: ci.propietario + ' (' + ci.mascota + ')', tel: ci.telefono, txt: tr });
      ci.resena = hoy; writeRow('Citas', CITA_COLS, ci);
    }
  });

  if (c.volver) {
    var limite = new Date(); limite.setDate(limite.getDate() - 7 * (c.volverSemanas || 7)); var lim = fmt(limite, 'yyyy-MM-dd');
    var futuras = {}; citas.forEach(function(ci){ if (ci.fecha >= hoy && ci.estado === 'reservada') futuras[ci.clienteId] = 1; });
    clientes.forEach(function(cl){
      if (cl.ultimaVisita && cl.ultimaVisita <= lim && !cl.avisoVolver && !futuras[cl.id]) {
        var tv = fill(c.txtVolver, Object.assign({}, base, cl));
        if (cl.email) { try { MailApp.sendEmail(cl.email, '¿Le damos un poco de brillo a ' + cl.mascota + '? · ' + c.negocio, tv, { name: c.negocio }); log.volver++; } catch (e) {} }
        log.whatsapp.push({ tipo: 'Te toca volver', quien: cl.propietario + ' (' + cl.mascota + ')', tel: cl.telefono, txt: tv });
        cl.avisoVolver = hoy; writeRow('Clientes', CLI_COLS, cl);
      }
    });
  }

  if (c.resumenDiario) {
    var hoyCitas = citas.filter(function(ci){ return ci.fecha === hoy && ci.estado === 'reservada'; }).sort(function(a, b){ return a.hora < b.hora ? -1 : 1; });
    var html = '<div style="font-family:Arial,sans-serif;max-width:560px"><h2 style="margin:0 0 10px">Buenos días ☀️</h2>' +
      '<h3>Citas de hoy (' + hoyCitas.length + ')</h3>' +
      (hoyCitas.length ? hoyCitas.map(function(ci){ return '<p style="margin:6px 0"><b>' + ci.hora + '</b> · ' + ci.servicio + ' · ' + ci.mascota + ' (' + ci.propietario + ', ' + ci.telefono + ')</p>'; }).join('') : '<p>No hay citas.</p>');
    if (log.whatsapp.length) {
      html += '<h3>Mensajes para enviar por WhatsApp</h3><p style="color:#666">Pulsa cada botón: se abre WhatsApp con el mensaje escrito, solo tienes que darle a enviar.</p>' +
        log.whatsapp.map(function(w){
          var tel = normTel(w.tel); tel = tel.length === 9 ? '34' + tel : tel;
          return '<p style="margin:10px 0"><b>' + w.tipo + '</b> · ' + w.quien + '<br><a style="display:inline-block;margin-top:4px;background:#25d366;color:#fff;padding:8px 14px;border-radius:20px;text-decoration:none" href="https://wa.me/' + tel + '?text=' + encodeURIComponent(w.txt) + '">Enviar por WhatsApp</a></p>';
        }).join('');
    }
    html += '</div>';
    if (hoyCitas.length || log.whatsapp.length)
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Resumen de hoy · ' + c.negocio, 'Abre este correo en formato HTML.', { htmlBody: html, name: 'Panel ' + c.negocio });
  }
  return log;
}
function panelEstadoCitaInterno(cita, estado) {
  cita.estado = estado; writeRow('Citas', CITA_COLS, cita);
  if (estado === 'hecha') {
    var cli = readAll('Clientes', CLI_COLS).filter(function(x){ return x.id == cita.clienteId; })[0];
    if (cli) { cli.visitas = (+cli.visitas || 0) + 1; cli.ultimaVisita = cita.fecha; cli.avisoVolver = ''; writeRow('Clientes', CLI_COLS, cli); }
  }
}
function include(f) { return HtmlService.createHtmlOutputFromFile(f).getContent(); }
