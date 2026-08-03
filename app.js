import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    serverTimestamp,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBLzPOb6AbR3-2NqLkG0ETVWXeWY7tY7iI",
  authDomain: "horarios-3f609.firebaseapp.com",
  projectId: "horarios-3f609",
  storageBucket: "horarios-3f609.firebasestorage.app",
  messagingSenderId: "1002586000808",
  appId: "1:1002586000808:web:27004906e10133064c219d",
  measurementId: "G-0VGK0HWR4B"
};

let columnas = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
let filas = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
let tareas = [];
let clasesDefinidas = []; 
let claseActiva = null;   
let editandoTareaId = null;

const ICONOS = ['🌸', '💼', '📚', '☕', '🏋️', '✨', '💻', '🛒', '❤️', '📌'];
const COLORES = ['#FFE8EC', '#D8F3DC', '#E0AAFF', '#FFDDD2', '#CAF0F8', '#FFF3B0'];

let colSeleccionada = null, rowSeleccionada = null;
let iconoSeleccionado = ICONOS[0];
let colorSeleccionado = COLORES[0];

let auth = null, db = null, usuarioActual = null, modoFormulario = 'login';
const $ = (sel) => document.querySelector(sel);

const estiloNuevasFunciones = document.createElement('style');
estiloNuevasFunciones.innerHTML = `
  table { table-layout: fixed !important; width: 100% !important; border-collapse: collapse; }
  th, td { width: auto !important; padding: 4px 6px !important; text-align: center; vertical-align: middle; }
  th { font-size: 14px !important; padding: 8px 4px !important; }
  td { height: 42px !important; }
  .celda-contenido { min-height: 38px !important; display: flex; flex-direction: column; justify-content: center; gap: 3px; padding: 2px !important; }

  .tarea-bloque { position: relative !important; padding: 6px 8px !important; margin: 2px 0 !important; font-size: 13px !important; border-radius: 8px !important; cursor: pointer; user-select: none; transition: transform 0.15s, box-shadow 0.15s; }
  .tarea-acciones { display: none !important; position: absolute !important; top: -42px !important; left: 50% !important; transform: translateX(-50%) !important; background: #ffffff !important; border: 1px solid #ffb6c1 !important; padding: 4px 8px !important; border-radius: 20px !important; box-shadow: 0 4px 12px rgba(0,0,0,0.18) !important; z-index: 9999 !important; gap: 6px !important; align-items: center !important; white-space: nowrap; }
  .tarea-bloque.seleccionada .tarea-acciones { display: flex !important; }

  .btn-editar-tarea, .btn-eliminar-tarea { border: none !important; background: #fff2f4 !important; border-radius: 12px !important; padding: 4px 8px !important; cursor: pointer !important; display: flex !important; align-items: center !important; gap: 3px !important; font-size: 12px !important; font-weight: bold !important; color: #d6336c !important; }
  .btn-eliminar-tarea { color: #ff4d6d !important; }

  #barra-clases { display: flex; flex-direction: column; gap: 8px; margin: 12px auto; padding: 12px; background: #FFF2F4; border-radius: 15px; max-width: 900px; border: 2px dashed #ffb6c1; }
  .clases-lista { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: center; }
  .clase-item { padding: 5px 10px; background: white; border: 2px solid #ffb6c1; border-radius: 20px; cursor: pointer; display: flex; align-items: center; gap: 5px; font-size: 13px; transition: 0.2s; }
  .clase-item.activa { background: #ffb6c1; color: white; transform: scale(1.05); }
  .btn-eliminar-clase { background: none; border: none; color: #ff6b81; cursor: pointer; font-weight: bold; }
  .btn-nueva-clase { background: #ffd1dc; border: none; padding: 5px 10px; border-radius: 20px; cursor: pointer; font-weight: bold; color: #d6336c; font-size: 13px; }
`;
document.head.appendChild(estiloNuevasFunciones);

document.addEventListener('DOMContentLoaded', () => {
  cargarDatosLocales(); 
  crearBarraClasesHTML();
  renderizarTabla();
  inicializarFirebaseSeguro();
  configurarEventosAuth();
});

function crearBarraClasesHTML() {
  const contenedorTabla = $('.table-responsive') || $('#horario-thead')?.parentElement;
  if (contenedorTabla && !$('#barra-clases')) {
    const barra = document.createElement('div');
    barra.id = 'barra-clases';
    contenedorTabla.parentNode.insertBefore(barra, contenedorTabla);
  }
  renderizarBarraClases();
}

function renderizarBarraClases() {
  const barra = $('#barra-clases');
  if (!barra) return;
  barra.innerHTML = `
    <div style="font-size: 13px; color: #666; font-weight: bold; text-align: center;">🎨 Tus Clases Rápidas (Selecciona una y toca el horario):</div>
    <div class="clases-lista">
      ${clasesDefinidas.map(c => `
        <div class="clase-item ${claseActiva && claseActiva.id === c.id ? 'activa' : ''}" data-id="${c.id}" style="border-left: 6px solid ${c.color || '#ffb6c1'}">
          <span>${c.icono}</span> ${c.nombre}
          <button class="btn-eliminar-clase solo-editar" data-id="${c.id}">✕</button>
        </div>
      `).join('')}
      <button class="btn-nueva-clase solo-editar" id="btn-crear-clase">+ Nueva Clase</button>
    </div>
  `;
}

document.addEventListener('click', (e) => {
  if (e.target.closest('#btn-crear-clase')) {
    const nombre = prompt("Nombre de la clase (Ej: Inglés):");
    if (nombre) {
      const icono = prompt("Emoji para la clase (Ej: 📚, 💼, 🎓):") || '✨';
      const color = COLORES[Math.floor(Math.random() * COLORES.length)];
      clasesDefinidas.push({ id: Date.now().toString(), nombre, icono, color });
      renderizarBarraClases();
      guardarDatos();
    }
    return;
  }

  const btnEliminarClase = e.target.closest('.btn-eliminar-clase');
  if (btnEliminarClase) {
    e.stopPropagation();
    if (confirm("¿Borrar clase rápida?")) {
      clasesDefinidas = clasesDefinidas.filter(c => c.id !== btnEliminarClase.dataset.id);
      if (claseActiva && claseActiva.id === btnEliminarClase.dataset.id) claseActiva = null;
      renderizarBarraClases();
      guardarDatos();
    }
    return;
  }

  const itemClase = e.target.closest('.clase-item');
  if (itemClase) {
    const claseId = itemClase.dataset.id;
    claseActiva = (claseActiva && claseActiva.id === claseId) ? null : clasesDefinidas.find(c => c.id === claseId);
    renderizarBarraClases();
    return;
  }

  if (!e.target.closest('.tarea-bloque')) {
    document.querySelectorAll('.tarea-bloque.seleccionada').forEach(el => el.classList.remove('seleccionada'));
  }
});

function inicializarFirebaseSeguro() {
  let firebaseRespondió = false;
  setTimeout(() => { if (!firebaseRespondió) mostrarPantalla('#pantalla-login'); }, 2000);

  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    onAuthStateChanged(auth, async (user) => {
      firebaseRespondió = true;
      if (user) {
        usuarioActual = user;
        if ($('#usuario-email')) $('#usuario-email').textContent = user.email;
        if ($('#btn-logout')) $('#btn-logout').classList.remove('oculto');
        mostrarPantalla('#pantalla-app');
        await cargarBaseDeDatos(user.uid);
      } else {
        usuarioActual = null;
        mostrarPantalla('#pantalla-login');
      }
    });
  } catch (error) {
    const errBox = $('#login-error');
    if (errBox) { errBox.textContent = "Error: " + error.message; errBox.classList.remove('oculto'); }
  }
}

function configurarEventosAuth() {
  $('#tab-login')?.addEventListener('click', () => {
    modoFormulario = 'login';
    $('#tab-login').classList.add('activo');
    $('#tab-registro').classList.remove('activo');
    $('#btn-login-submit').textContent = 'Ingresar';
  });
  $('#tab-registro')?.addEventListener('click', () => {
    modoFormulario = 'registro';
    $('#tab-registro').classList.add('activo');
    $('#tab-login').classList.remove('activo');
    $('#btn-login-submit').textContent = 'Crear Cuenta';
  });
  $('#form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#login-email')?.value.trim();
    const password = $('#login-password')?.value;
    const errBox = $('#login-error');
    if (errBox) errBox.classList.add('oculto');

    try {
      if (modoFormulario === 'login') await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      if (errBox) { errBox.textContent = "Error: " + err.message; errBox.classList.remove('oculto'); }
    }
  });
  $('#btn-logout')?.addEventListener('click', () => signOut(auth));
}

$('#btn-abrir-config')?.addEventListener('click', () => {
  if ($('#input-cols')) $('#input-cols').value = columnas.join(', ');
  if ($('#input-rows')) $('#input-rows').value = filas.join(', ');
  $('#modal-config')?.classList.remove('oculto');
});

$('#btn-cancelar-config')?.addEventListener('click', () => $('#modal-config')?.classList.add('oculto'));

$('#btn-guardar-config')?.addEventListener('click', () => {
  const nuevasCols = $('#input-cols')?.value.split(',').map(s => s.trim()).filter(Boolean);
  const nuevasFilas = $('#input-rows')?.value.split(',').map(s => s.trim()).filter(Boolean);
  if (nuevasCols?.length > 0) columnas = nuevasCols;
  if (nuevasFilas?.length > 0) filas = nuevasFilas;
  tareas = tareas.filter(t => columnas.includes(t.col) && filas.includes(t.row));
  $('#modal-config')?.classList.add('oculto');
  renderizarTabla();
  guardarDatos();
});

function renderizarTabla() {
  if (!columnas.length) columnas = ['Lunes', 'Martes', 'Miércoles'];
  if (!filas.length) filas = ['08:00', '09:00', '10:00'];

  const thead = $('#horario-thead');
  if (thead) thead.innerHTML = `<tr><th>Horario</th>${columnas.map(col => `<th>${col}</th>`).join('')}</tr>`;

  const tbody = $('#horario-tbody');
  if (tbody) {
    tbody.innerHTML = filas.map(fila => `
      <tr>
        <td>${fila}</td>
        ${columnas.map(col => {
          const tareasCelda = tareas.filter(t => t.col === col && t.row === fila);
          const html = tareasCelda.map(t => `
            <div class="tarea-bloque" data-id="${t.id}" style="background-color: ${t.color || '#FFE8EC'};">
              <div class="tarea-info">
                <span>${t.icono}</span>
                <span class="tarea-texto">${t.nota}</span>
              </div>
              <div class="tarea-acciones">
                <button type="button" class="btn-editar-tarea solo-editar" data-id="${t.id}">✎ Editar</button>
                <button type="button" class="btn-eliminar-tarea solo-editar" data-id="${t.id}">✕ Eliminar</button>
              </div>
            </div>
          `).join('');
          return `<td data-col="${col}" data-row="${fila}"><div class="celda-contenido">${html}</div></td>`;
        }).join('')}
      </tr>
    `).join('');
  }
}

$('#horario-tbody')?.addEventListener('click', (e) => {
  if (document.body.classList.contains('exportando')) return;

  const btnBorrar = e.target.closest('.btn-eliminar-tarea');
  if (btnBorrar) {
    e.stopPropagation();
    tareas = tareas.filter(t => t.id !== btnBorrar.dataset.id);
    renderizarTabla();
    guardarDatos();
    return;
  }

  const btnEditar = e.target.closest('.btn-editar-tarea');
  if (btnEditar) {
    e.stopPropagation();
    const id = btnEditar.dataset.id;
    const tarea = tareas.find(t => t.id === id);
    if (tarea) {
      editandoTareaId = id;
      colSeleccionada = tarea.col;
      rowSeleccionada = tarea.row;
      if ($('#modal-titulo')) $('#modal-titulo').textContent = `Editar: ${tarea.col} • ${tarea.row}`;
      if ($('#input-nota')) $('#input-nota').value = tarea.nota;
      iconoSeleccionado = tarea.icono || ICONOS[0];
      colorSeleccionado = tarea.color || COLORES[0];
      construirIconos();
      construirColores();
      $('#modal-agregar')?.classList.remove('oculto');
    }
    return;
  }

  const bloqueTarea = e.target.closest('.tarea-bloque');
  if (bloqueTarea) {
    e.stopPropagation();
    const yaSeleccionada = bloqueTarea.classList.contains('seleccionada');
    document.querySelectorAll('.tarea-bloque.seleccionada').forEach(el => el.classList.remove('seleccionada'));
    if (!yaSeleccionada) bloqueTarea.classList.add('seleccionada');
    return;
  }

  const celda = e.target.closest('td[data-col]');
  if (celda) {
    document.querySelectorAll('.tarea-bloque.seleccionada').forEach(el => el.classList.remove('seleccionada'));
    if (claseActiva) {
      tareas.push({ 
        id: Date.now().toString(), col: celda.dataset.col, row: celda.dataset.row, 
        nota: claseActiva.nombre, icono: claseActiva.icono, color: claseActiva.color || COLORES[0]
      });
      renderizarTabla();
      guardarDatos();
    } else {
      abrirModalTarea(celda.dataset.col, celda.dataset.row);
    }
  }
});

function construirIconos() {
  const selector = $('#selector-iconos');
  if (selector) selector.innerHTML = ICONOS.map(ic => `<div class="icono-opcion ${ic === iconoSeleccionado ? 'seleccionado' : ''}" data-icono="${ic}">${ic}</div>`).join('');
}
function construirColores() {
  const selector = $('#selector-colores');
  if (selector) selector.innerHTML = COLORES.map(c => `<div class="color-opcion ${c === colorSeleccionado ? 'seleccionado' : ''}" data-color="${c}" style="background-color: ${c};"></div>`).join('');
}

$('#selector-iconos')?.addEventListener('click', (e) => {
  if (e.target.closest('.icono-opcion')?.dataset.icono) { iconoSeleccionado = e.target.closest('.icono-opcion').dataset.icono; construirIconos(); }
});
$('#selector-colores')?.addEventListener('click', (e) => {
  if (e.target.closest('.color-opcion')?.dataset.color) { colorSeleccionado = e.target.closest('.color-opcion').dataset.color; construirColores(); }
});

function abrirModalTarea(col, row) {
  editandoTareaId = null;
  colSeleccionada = col; rowSeleccionada = row;
  if ($('#modal-titulo')) $('#modal-titulo').textContent = `${col} • ${row}`;
  if ($('#input-nota')) $('#input-nota').value = '';
  iconoSeleccionado = ICONOS[0]; colorSeleccionado = COLORES[0];
  construirIconos(); construirColores();
  $('#modal-agregar')?.classList.remove('oculto');
}

$('#btn-cancelar-modal')?.addEventListener('click', () => $('#modal-agregar')?.classList.add('oculto'));

$('#btn-guardar-entrada')?.addEventListener('click', () => {
  const nota = $('#input-nota')?.value.trim();
  if (nota) {
    if (editandoTareaId) {
      const index = tareas.findIndex(t => t.id === editandoTareaId);
      if (index !== -1) { tareas[index].nota = nota; tareas[index].icono = iconoSeleccionado; tareas[index].color = colorSeleccionado; }
    } else { tareas.push({ id: Date.now().toString(), col: colSeleccionada, row: rowSeleccionada, nota, icono: iconoSeleccionado, color: colorSeleccionado }); }
    renderizarTabla();
    guardarDatos();
    $('#modal-agregar')?.classList.add('oculto');
  }
});

async function guardarDatos() {
  localStorage.setItem('miPlanillaEstetica', JSON.stringify({ columnas, filas, tareas, clasesDefinidas }));
  if (usuarioActual && db) {
    try { await setDoc(doc(db, 'planilla_estetica', usuarioActual.uid), { columnas, filas, tareas, clasesDefinidas }); mostrarNotificacion('Guardado 💖');
    } catch (err) { mostrarNotificacion('Guardado Local 📁'); }
  } else { mostrarNotificacion('Guardado Local 📁'); }
}

function cargarDatosLocales() {
  const d = JSON.parse(localStorage.getItem('miPlanillaEstetica'));
  if (d) {
    if (d.columnas?.length) columnas = d.columnas; if (d.filas?.length) filas = d.filas;
    if (d.tareas) tareas = d.tareas; if (d.clasesDefinidas) clasesDefinidas = d.clasesDefinidas;
  }
}

async function cargarBaseDeDatos(uid) {
  if (!db) return;
  try {
    const snap = await getDoc(doc(db, 'planilla_estetica', uid));
    if (snap.exists()) {
      const data = snap.data();
      if (data.columnas?.length) columnas = data.columnas; if (data.filas?.length) filas = data.filas;
      if (data.tareas) tareas = data.tareas; if (data.clasesDefinidas) clasesDefinidas = data.clasesDefinidas;
    }
  } catch (err) {}
  renderizarTabla(); renderizarBarraClases();
}

function mostrarNotificacion(msg) {
  const t = $('#mensaje-guardado');
  if (!t) return;
  t.textContent = msg; t.classList.remove('oculto');
  setTimeout(() => t.classList.add('oculto'), 2000);
}

$('#btn-generar-imagen')?.addEventListener('click', async () => {
  document.body.classList.add('exportando');
  await new Promise(r => setTimeout(r, 150)); 
  try {
    const canvas = await html2canvas($('#capture-area'), { backgroundColor: '#FFF2F4', scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    if ($('#imagen-generada')) $('#imagen-generada').src = imgData;
    if ($('#btn-descargar')) $('#btn-descargar').href = imgData;
    $('#modal-imagen')?.classList.remove('oculto');
  } finally { document.body.classList.remove('exportando'); }
});

$('#btn-cerrar-imagen')?.addEventListener('click', () => $('#modal-imagen')?.classList.add('oculto'));

function mostrarPantalla(id) {
  ['#pantalla-carga', '#pantalla-login', '#pantalla-app'].forEach(s => $(s)?.classList.add('oculto'));
  $(id)?.classList.remove('oculto');
}

// ==========================================
// GENERACIÓN DE CÓDIGO DE WIDGETS
// ==========================================

$("#btn-instalar-widget")?.addEventListener("click", () => instalarWidget('v1'));
$("#btn-instalar-widget-2")?.addEventListener("click", () => instalarWidget('v2'));

async function obtenerTokenWidget() {
  if (!usuarioActual) { alert("Debes iniciar sesión para generar tu widget."); return null; }
  const q = query(collection(db, "widgets"), where("uid", "==", usuarioActual.uid));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) return querySnapshot.docs[0].id;

  const token = Date.now().toString(36) + Math.random().toString(36).substring(2);
  await setDoc(doc(db, "widgets", token), { uid: usuarioActual.uid, activo: true, creado: serverTimestamp() });
  return token;
}

async function instalarWidget(tipo) {
  const token = await obtenerTokenWidget();
  if (!token) return;
  const urlNetlify = `https://friendly-melba-0783ef.netlify.app/.netlify/functions/horario?token=${token}`;
  
  let codigoScriptable = "";

  if (tipo === 'v1') {
    codigoScriptable = `const url = "${urlNetlify}";
const req = new Request(url);
const res = await req.loadString();
let widget = new ListWidget();
widget.backgroundColor = Color.dynamic(new Color("#FFFFFF", 0.9), new Color("#1C1C1E", 0.9));
let header = widget.addText("✨ Tu Horario");
header.font = Font.boldSystemFont(14);
header.textColor = Color.dynamic(new Color("#000000", 0.85), new Color("#FFFFFF", 0.95));
widget.addSpacer(8);
let contenido = widget.addText(res);
contenido.font = Font.systemFont(12);
contenido.textColor = Color.dynamic(new Color("#000000", 0.7), new Color("#FFFFFF", 0.8));
if (config.runsInWidget) { Script.setWidget(widget); } else { widget.presentSmall(); }
Script.complete();`;
  } else {
    // Widget 2: ADAPTATIVO A MODO PERSONALIZADO Y SISTEMA TINTED DE APPLE
    codigoScriptable = `const url = "${urlNetlify}";
const req = new Request(url);
const res = await req.loadString();

let widget = new ListWidget();
// Fondos dinámicos con opacidad para que el modo Personalizado de iOS/iPadOS no dibuje bloques blancos opacos
widget.backgroundColor = Color.dynamic(new Color("#FFFFFF", 0.85), new Color("#1C1C1E", 0.85));
widget.setPadding(10, 8, 10, 8);

// Título principal
let titleStack = widget.addStack();
titleStack.addSpacer();
let title = titleStack.addText("🌸 Mi Planilla Semanal 🌸");
title.font = Font.boldSystemFont(13);
title.textColor = Color.dynamic(new Color("#000000", 0.85), new Color("#FFFFFF", 0.95));
titleStack.addSpacer();
widget.addSpacer(8);

let mainStack = widget.addStack();
mainStack.layoutHorizontally();
mainStack.spacing = 4;

let dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
let schedule = {};
for (let d of dias) schedule[d] = [];

let diasMapa = {
  "domingo": "Domingo", "lunes": "Lunes", "martes": "Martes", 
  "miércoles": "Miércoles", "miercoles": "Miércoles", 
  "jueves": "Jueves", "viernes": "Viernes", "sábado": "Sábado", "sabado": "Sábado"
};

let lines = res.split("\\n");
let currentDay = "Lunes";

for (let line of lines) {
  let l = line.trim();
  if (!l) continue;
  let lLower = l.toLowerCase();

  let matchedDayKey = Object.keys(diasMapa).find(k => lLower.startsWith(k) || lLower.includes(k));
  if (matchedDayKey) {
    currentDay = diasMapa[matchedDayKey];
    let lClean = l.replace(/[^a-záéíóúñ]/gi, '').toLowerCase();
    if (lClean === matchedDayKey) continue;
  }

  if (lLower.includes("tu horario") || lLower.includes("mi semana") || lLower.startsWith("---") || lLower.startsWith("hoy") || lLower.startsWith("mañana")) continue;

  if (schedule[currentDay]) {
    schedule[currentDay].push(l);
  }
}

function sumarUnaHora(horaStr) {
  if (!horaStr) return "";
  let p = horaStr.split(":");
  if (p.length < 2) return horaStr;
  let h = parseInt(p[0], 10) + 1;
  return (h < 10 ? "0" + h : h) + ":" + p[1];
}

function agrupar(tareas) {
  let parsed = [];
  for (let t of tareas) {
    let match = t.match(/(\\d{1,2}:\\d{2})\\s*[-:]*\\s*(.*)/);
    if (match) parsed.push({ t: match[1], n: match[2].trim() });
    else parsed.push({ t: "", n: t.trim() });
  }
  
  if (parsed.length === 0) return [];
  let grouped = [];
  let cur = { s: parsed[0].t, e: parsed[0].t, n: parsed[0].n };
  
  for (let i = 1; i < parsed.length; i++) {
    if (parsed[i].n === cur.n && parsed[i].n !== "") {
      cur.e = parsed[i].t;
    } else {
      grouped.push(cur);
      cur = { s: parsed[i].t, e: parsed[i].t, n: parsed[i].n };
    }
  }
  grouped.push(cur);

  return grouped.map(g => {
    let rangoHora = "";
    if (g.s) {
      let horaFin = sumarUnaHora(g.e);
      rangoHora = g.s + " a " + horaFin;
    }
    return { rango: rangoHora, nombre: g.n };
  });
}

for (let d of dias) {
  let col = mainStack.addStack();
  col.layoutVertically();
  
  let headerStack = col.addStack();
  headerStack.backgroundColor = Color.dynamic(new Color("#000000", 0.08), new Color("#FFFFFF", 0.15));
  headerStack.setPadding(3, 1, 3, 1);
  headerStack.cornerRadius = 5;
  headerStack.addSpacer();
  let headerText = headerStack.addText(d.substring(0,3).toUpperCase());
  headerText.font = Font.boldSystemFont(9);
  headerText.textColor = Color.dynamic(new Color("#000000", 0.85), new Color("#FFFFFF", 0.95));
  headerStack.addSpacer();
  col.addSpacer(4);
  
  let tareasAgrupadas = agrupar(schedule[d]);
  
  if (tareasAgrupadas.length === 0) {
    let emptyStack = col.addStack();
    emptyStack.addSpacer();
    let empty = emptyStack.addText("-");
    empty.font = Font.systemFont(9);
    empty.textColor = Color.dynamic(new Color("#000000", 0.3), new Color("#FFFFFF", 0.3));
    emptyStack.addSpacer();
  } else {
    for (let task of tareasAgrupadas) {
      if (!task.nombre) continue;
      
      let tStack = col.addStack();
      tStack.layoutVertically();
      tStack.backgroundColor = Color.dynamic(new Color("#000000", 0.05), new Color("#FFFFFF", 0.1));
      tStack.setPadding(4, 3, 4, 3);
      tStack.cornerRadius = 6;
      tStack.borderColor = Color.dynamic(new Color("#000000", 0.12), new Color("#FFFFFF", 0.2));
      tStack.borderWidth = 1;
      
      let tName = tStack.addText(task.nombre);
      tName.font = Font.boldSystemFont(8);
      tName.textColor = Color.dynamic(new Color("#000000", 0.9), new Color("#FFFFFF", 0.95));
      tName.lineLimit = 2;
      tName.minimumScaleFactor = 0.7;
      
      if (task.rango) {
        tStack.addSpacer(2);
        let tTime = tStack.addText(task.rango);
        tTime.font = Font.systemFont(7);
        tTime.textColor = Color.dynamic(new Color("#000000", 0.7), new Color("#FFFFFF", 0.8));
      }
      col.addSpacer(3);
    }
  }
}

if (config.runsInWidget) { Script.setWidget(widget); } else { widget.presentMedium(); }
Script.complete();`;
  }

  const btnCopiar = $("#btn-copiar-url");
  if (btnCopiar) btnCopiar.dataset.codigo = codigoScriptable;
  if ($("#titulo-modal-widget")) {
    $("#titulo-modal-widget").textContent = tipo === 'v1' ? "✨ Widget 1 (Compacto)" : "🎨 Widget 2 (Plantilla Canva)";
  }
  
  $("#modal-widget")?.classList.remove("oculto");
}

$("#btn-cerrar-widget")?.addEventListener("click", () => $("#modal-widget")?.classList.add("oculto"));

$("#btn-copiar-url")?.addEventListener("click", async (e) => {
  const btn = e.target;
  const codigo = btn.dataset.codigo;
  if (!codigo) return;
  
  try {
    await navigator.clipboard.writeText(codigo);
    const textoOriginal = btn.textContent;
    btn.textContent = "¡Código Copiado! ✨";
    btn.style.background = "#E87A90";
    setTimeout(() => {
      btn.textContent = textoOriginal;
      btn.style.background = "";
    }, 2500);
  } catch (error) {
    alert("No se pudo copiar el código automáticamente.");
  }
});
