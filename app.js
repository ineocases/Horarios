import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    serverTimestamp
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
let filas = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00'];
let tareas = [];
let clasesDefinidas = []; 
let claseActiva = null;   
let editandoTareaId = null;

const ICONOS = ['🌸', '💼', '📚', '☕', '🏋️', '✨', '💻', '🛒', '❤️', '📌'];
let colSeleccionada = null, rowSeleccionada = null;
let iconoSeleccionado = ICONOS[0];

let auth = null, db = null, usuarioActual = null, modoFormulario = 'login';
const $ = (sel) => document.querySelector(sel);

// Inyectar Estilos Personalizados
const estiloNuevasFunciones = document.createElement('style');
estiloNuevasFunciones.innerHTML = `
  /* Columnas de igual ancho y filas menos altas */
  table { table-layout: fixed !important; width: 100% !important; border-collapse: collapse; }
  th, td { width: auto !important; padding: 4px 6px !important; text-align: center; vertical-align: middle; }
  th { font-size: 14px !important; padding: 8px 4px !important; }
  td { height: 42px !important; }
  .celda-contenido { min-height: 38px !important; display: flex; flex-direction: column; justify-content: center; gap: 3px; padding: 2px !important; }

  /* Tareas compactas */
  .tarea-bloque {
    position: relative !important;
    padding: 6px 8px !important;
    margin: 2px 0 !important;
    font-size: 13px !important;
    border-radius: 8px !important;
    cursor: pointer;
    user-select: none;
    transition: transform 0.15s, box-shadow 0.15s;
  }

  /* Acciones Flotantes (Al presionar en la tarea) */
  .tarea-acciones {
    display: none !important;
    position: absolute !important;
    top: -42px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    background: #ffffff !important;
    border: 1px solid #ffb6c1 !important;
    padding: 4px 8px !important;
    border-radius: 20px !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.18) !important;
    z-index: 9999 !important;
    gap: 6px !important;
    align-items: center !important;
    white-space: nowrap;
  }

  .tarea-bloque.seleccionada .tarea-acciones {
    display: flex !important;
    animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  @keyframes popIn {
    from { opacity: 0; transform: translate(-50%, 5px) scale(0.9); }
    to { opacity: 1; transform: translate(-50%, 0) scale(1); }
  }

  .btn-editar-tarea, .btn-eliminar-tarea {
    border: none !important;
    background: #fff2f4 !important;
    border-radius: 12px !important;
    padding: 4px 8px !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    gap: 3px !important;
    font-size: 12px !important;
    font-weight: bold !important;
    color: #d6336c !important;
  }
  .btn-eliminar-tarea { color: #ff4d6d !important; }
  .btn-editar-tarea:hover, .btn-eliminar-tarea:hover { background: #ffd1dc !important; }

  /* Barra de Clases */
  #barra-clases { display: flex; flex-direction: column; gap: 8px; margin: 12px auto; padding: 12px; background: #FFF2F4; border-radius: 15px; max-width: 900px; border: 2px dashed #ffb6c1; }
  .clases-lista { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: center; }
  .clase-item { padding: 5px 10px; background: white; border: 2px solid #ffb6c1; border-radius: 20px; cursor: pointer; display: flex; align-items: center; gap: 5px; font-size: 13px; transition: 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
  .clase-item:hover { transform: translateY(-2px); }
  .clase-item.activa { background: #ffb6c1; color: white; transform: scale(1.05); border-color: #ff8da1; font-weight: bold; }
  .btn-eliminar-clase { background: none; border: none; color: #ff6b81; cursor: pointer; font-weight: bold; font-size: 13px; padding: 0 2px; }
  .btn-nueva-clase { background: #ffd1dc; border: none; padding: 5px 10px; border-radius: 20px; cursor: pointer; font-weight: bold; color: #d6336c; font-size: 13px; }

  /* Nota iPad */
  .aviso-ipad { font-size: 12px; color: #d6336c; text-align: center; margin-top: 6px; font-weight: bold; }
`;
document.head.appendChild(estiloNuevasFunciones);

document.addEventListener('DOMContentLoaded', () => {
  cargarDatosLocales(); 
  crearBarraClasesHTML();
  renderizarTabla();
  inicializarFirebaseSeguro();
});

// --- BARRA DE CLASES RÁPIDAS ---
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
        <div class="clase-item ${claseActiva && claseActiva.id === c.id ? 'activa' : ''}" data-id="${c.id}">
          <span>${c.icono}</span> ${c.nombre}
          <button class="btn-eliminar-clase solo-editar" data-id="${c.id}">✕</button>
        </div>
      `).join('')}
      <button class="btn-nueva-clase solo-editar" id="btn-crear-clase">+ Nueva Clase</button>
    </div>
  `;
}

// Eventos de la barra de clases
document.addEventListener('click', (e) => {
  if (e.target.closest('#btn-crear-clase')) {
    const nombre = prompt("Nombre de la clase (Ej: Estudiante):");
    if (nombre) {
      const icono = prompt("Emoji para la clase (Ej: 📚, 💼, 🎓):") || '✨';
      clasesDefinidas.push({ id: Date.now().toString(), nombre, icono });
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

  // Deseleccionar flotante al hacer clic fuera
  if (!e.target.closest('.tarea-bloque')) {
    document.querySelectorAll('.tarea-bloque.seleccionada').forEach(el => el.classList.remove('seleccionada'));
  }
});

function inicializarFirebaseSeguro() {
  let firebaseRespondió = false;
  setTimeout(() => {
    if (!firebaseRespondió) mostrarPantalla('#pantalla-login');
  }, 2000);

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
    mostrarPantalla('#pantalla-login');
  }
}

// Autenticación
$('#tab-login')?.addEventListener('click', () => cambiarTab('login'));
$('#tab-registro')?.addEventListener('click', () => cambiarTab('registro'));

function cambiarTab(modo) {
  modoFormulario = modo;
  $('#tab-login')?.classList.toggle('activo', modo === 'login');
  $('#tab-registro')?.classList.toggle('activo', modo === 'registro');
  const btnSub = $('#btn-login-submit');
  if (btnSub) btnSub.textContent = modo === 'login' ? 'Ingresar' : 'Crear cuenta';
  $('#login-error')?.classList.add('oculto');
}

$('#form-login')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  $('#login-error')?.classList.add('oculto');
  
  try {
    if (modoFormulario === 'login') {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
    }
  } catch (err) {
    const mensajes = { 'auth/invalid-credential': 'Datos incorrectos.', 'auth/email-already-in-use': 'El correo ya existe.', 'auth/weak-password': 'Mínimo 6 caracteres.' };
    const errBox = $('#login-error');
    if (errBox) {
      errBox.textContent = mensajes[err.code] || 'Error de conexión.';
      errBox.classList.remove('oculto');
    }
  }
});

$('#btn-logout')?.addEventListener('click', () => {
  if (auth) signOut(auth);
});

// Configurar Filas y Columnas
$('#btn-abrir-config')?.addEventListener('click', () => {
  if ($('#input-cols')) $('#input-cols').value = columnas.join(', ');
  if ($('#input-rows')) $('#input-rows').value = filas.join(', ');
  $('#modal-config')?.classList.remove('oculto');
});

$('#btn-cancelar-config')?.addEventListener('click', () => {
  $('#modal-config')?.classList.add('oculto');
});

$('#btn-guardar-config')?.addEventListener('click', () => {
  const nuevasCols = $('#input-cols')?.value.split(',').map(s => s.trim()).filter(Boolean);
  const nuevasFilas = $('#input-rows')?.value.split(',').map(s => s.trim()).filter(Boolean);
  
  if (nuevasCols && nuevasCols.length > 0) columnas = nuevasCols;
  if (nuevasFilas && nuevasFilas.length > 0) filas = nuevasFilas;

  tareas = tareas.filter(t => columnas.includes(t.col) && filas.includes(t.row));
  
  $('#modal-config')?.classList.add('oculto');
  renderizarTabla();
  guardarDatos();
});

// Renderizar la Tabla
function renderizarTabla() {
  if (!columnas || columnas.length === 0) columnas = ['Lunes', 'Martes', 'Miércoles'];
  if (!filas || filas.length === 0) filas = ['08:00', '09:00', '10:00'];

  const thead = $('#horario-thead');
  if (thead) {
    thead.innerHTML = `<tr>
      <th>Horario</th>
      ${columnas.map(col => `<th>${col}</th>`).join('')}
    </tr>`;
  }

  const tbody = $('#horario-tbody');
  if (tbody) {
    tbody.innerHTML = filas.map(fila => `
      <tr>
        <td>${fila}</td>
        ${columnas.map(col => {
          const tareasCelda = tareas.filter(t => t.col === col && t.row === fila);
          const html = tareasCelda.map(t => `
            <div class="tarea-bloque" data-id="${t.id}">
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

// Interacciones con la Tabla
$('#horario-tbody')?.addEventListener('click', (e) => {
  if (document.body.classList.contains('exportando')) return;

  // 1. Borrar tarea desde flotante
  const btnBorrar = e.target.closest('.btn-eliminar-tarea');
  if (btnBorrar) {
    e.stopPropagation();
    tareas = tareas.filter(t => t.id !== btnBorrar.dataset.id);
    renderizarTabla();
    guardarDatos();
    return;
  }

  // 2. Editar tarea desde flotante
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
      construirIconos();
      $('#modal-agregar')?.classList.remove('oculto');
    }
    return;
  }

  // 3. Tocar un bloque de tarea (Abre menú flotante)
  const bloqueTarea = e.target.closest('.tarea-bloque');
  if (bloqueTarea) {
    e.stopPropagation();
    const yaSeleccionada = bloqueTarea.classList.contains('seleccionada');
    document.querySelectorAll('.tarea-bloque.seleccionada').forEach(el => el.classList.remove('seleccionada'));
    if (!yaSeleccionada) {
      bloqueTarea.classList.add('seleccionada');
    }
    return;
  }

  // 4. Tocar celda vacía (Sello o Modal)
  const celda = e.target.closest('td[data-col]');
  if (celda) {
    document.querySelectorAll('.tarea-bloque.seleccionada').forEach(el => el.classList.remove('seleccionada'));
    if (claseActiva) {
      tareas.push({ 
        id: Date.now().toString(), 
        col: celda.dataset.col, 
        row: celda.dataset.row, 
        nota: claseActiva.nombre, 
        icono: claseActiva.icono 
      });
      renderizarTabla();
      guardarDatos();
    } else {
      abrirModalTarea(celda.dataset.col, celda.dataset.row);
    }
  }
});

// Modal de Tareas
function construirIconos() {
  const selector = $('#selector-iconos');
  if (!selector) return;
  selector.innerHTML = ICONOS.map(ic => `<div class="icono-opcion ${ic === iconoSeleccionado ? 'seleccionado' : ''}" data-icono="${ic}">${ic}</div>`).join('');
}

$('#selector-iconos')?.addEventListener('click', (e) => {
  const target = e.target.closest('.icono-opcion');
  if (target && target.dataset.icono) {
    iconoSeleccionado = target.dataset.icono;
    construirIconos();
  }
});

function abrirModalTarea(col, row) {
  editandoTareaId = null;
  colSeleccionada = col; 
  rowSeleccionada = row;
  if ($('#modal-titulo')) $('#modal-titulo').textContent = `${col} • ${row}`;
  if ($('#input-nota')) $('#input-nota').value = '';
  iconoSeleccionado = ICONOS[0];
  construirIconos();
  $('#modal-agregar')?.classList.remove('oculto');
  setTimeout(() => $('#input-nota')?.focus(), 100);
}

$('#btn-cancelar-modal')?.addEventListener('click', () => {
  $('#modal-agregar')?.classList.add('oculto');
  editandoTareaId = null;
});

$('#btn-guardar-entrada')?.addEventListener('click', () => {
  const nota = $('#input-nota')?.value.trim();
  if (nota) {
    if (editandoTareaId) {
      const index = tareas.findIndex(t => t.id === editandoTareaId);
      if (index !== -1) {
        tareas[index].nota = nota;
        tareas[index].icono = iconoSeleccionado;
      }
    } else {
      tareas.push({ id: Date.now().toString(), col: colSeleccionada, row: rowSeleccionada, nota, icono: iconoSeleccionado });
    }
    
    renderizarTabla();
    guardarDatos();
    $('#modal-agregar')?.classList.add('oculto');
    editandoTareaId = null;
  } else {
    alert("Escribe una descripción.");
  }
});

// Guardar Datos
async function guardarDatos() {
  localStorage.setItem('miPlanillaEstetica', JSON.stringify({ columnas, filas, tareas, clasesDefinidas }));

  if (usuarioActual && db) {
    try {
      await setDoc(doc(db, 'planilla_estetica', usuarioActual.uid), { columnas, filas, tareas, clasesDefinidas });
      mostrarNotificacion('Guardado 💖');
    } catch (err) { 
      mostrarNotificacion('Guardado Local 📁');
    }
  } else {
    mostrarNotificacion('Guardado Local 📁');
  }
}

// Cargar Datos
function cargarDatosLocales() {
  const datosLocales = JSON.parse(localStorage.getItem('miPlanillaEstetica'));
  if (datosLocales) {
    if (datosLocales.columnas?.length > 0) columnas = datosLocales.columnas;
    if (datosLocales.filas?.length > 0) filas = datosLocales.filas;
    if (datosLocales.tareas) tareas = datosLocales.tareas;
    if (datosLocales.clasesDefinidas) clasesDefinidas = datosLocales.clasesDefinidas;
  }
}

async function cargarBaseDeDatos(uid) {
  if (!db) return;
  try {
    const snap = await getDoc(doc(db, 'planilla_estetica', uid));
    if (snap.exists()) {
      const data = snap.data();
      if (data.columnas?.length > 0) columnas = data.columnas;
      if (data.filas?.length > 0) filas = data.filas;
      if (data.tareas) tareas = data.tareas;
      if (data.clasesDefinidas) clasesDefinidas = data.clasesDefinidas;
      
      localStorage.setItem('miPlanillaEstetica', JSON.stringify({ columnas, filas, tareas, clasesDefinidas }));
    }
  } catch (err) {}
  renderizarTabla();
  renderizarBarraClases();
}

function mostrarNotificacion(msg) {
  const t = $('#mensaje-guardado');
  if (!t) return;
  t.textContent = msg; 
  t.classList.remove('oculto');
  setTimeout(() => t.classList.add('oculto'), 2000);
}

// --- DESCARGAR IMAGEN HD (COMPATIBLE CON IPAD / IOS) ---
$('#btn-generar-imagen')?.addEventListener('click', async () => {
  document.body.classList.add('exportando');
  document.querySelectorAll('.tarea-bloque.seleccionada').forEach(el => el.classList.remove('seleccionada'));
  if ($('#barra-clases')) $('#barra-clases').style.display = 'none';

  await new Promise(r => setTimeout(r, 150)); 
  try {
    const captureArea = $('#capture-area');
    if (!captureArea) return;

    const canvas = await html2canvas(captureArea, { backgroundColor: '#FFF2F4', scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    const imgGen = $('#imagen-generada');
    if (imgGen) imgGen.src = imgData;

    const btnDescargar = $('#btn-descargar');
    if (btnDescargar) {
      btnDescargar.href = imgData;
      btnDescargar.download = 'Mi_Planilla_Semanal.png';
      
      // Adaptación especial para iPad / Safari
      btnDescargar.onclick = (e) => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        if (isIOS) {
          const win = window.open('');
          if (win) {
            win.document.write(`<img src="${imgData}" style="max-width:100%;height:auto;" /><br><p style="font-family:sans-serif;text-align:center;color:#d6336c;"><b>Mantén presionada la imagen para guardarla en Fotos.</b></p>`);
          }
        }
      };
    }

    // Agregar aviso en el modal para usuarios de iPad
    let avisoPad = $('.aviso-ipad');
    if (!avisoPad && $('#modal-imagen')) {
      avisoPad = document.createElement('div');
      avisoPad.className = 'aviso-ipad';
      avisoPad.textContent = '📱 En iPad / iPhone: Si el botón de descargar no inicia la descarga, mantén presionada la imagen de arriba y elige "Guardar en Fotos".';
      $('#modal-imagen').querySelector('.modal-contenido')?.appendChild(avisoPad);
    }

    $('#modal-imagen')?.classList.remove('oculto');
  } finally { 
    document.body.classList.remove('exportando'); 
    if ($('#barra-clases')) $('#barra-clases').style.display = 'flex';
  }
});

$('#btn-cerrar-imagen')?.addEventListener('click', () => {
  $('#modal-imagen')?.classList.add('oculto');
});

function mostrarPantalla(id) {
  ['#pantalla-carga', '#pantalla-login', '#pantalla-app'].forEach(s => {
    const el = $(s);
    if (el) el.classList.add('oculto');
  });
  const target = $(id);
  if (target) target.classList.remove('oculto');
}
// ==========================
// INSTALAR WIDGET Y TUTORIAL
// ==========================

async function instalarWidget() {
  if (!usuarioActual) {
    alert("Debes iniciar sesión.");
    return;
  }

  try {
    let token;
    
    // 1. Buscamos en Firebase si este usuario YA TIENE un token creado
    const q = query(collection(db, "widgets"), where("uid", "==", usuarioActual.uid));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // OPCIÓN A: Ya existe. Reutilizamos su token único.
      token = querySnapshot.docs[0].id;
    } else {
      // OPCIÓN B: Es su primera vez. Le creamos un token nuevo.
      token = (typeof crypto !== 'undefined' && crypto.randomUUID) 
              ? crypto.randomUUID() 
              : Date.now().toString(36) + Math.random().toString(36).substring(2);
              
      const widgetRef = doc(db, "widgets", token);
      await setDoc(widgetRef, {
        uid: usuarioActual.uid,
        activo: true,
        // Usamos serverTimestamp() de nuevo para que Netlify NO tire "Error de servidor"
        creado: serverTimestamp() 
      });
    }
    
    // 2. Armamos la URL con su token único
    const urlNetlify = `https://friendly-melba-0783ef.netlify.app/.netlify/functions/horario?token=${token}`;
    
    // 3. Mostramos la URL en la ventana emergente
    const inputUrl = document.querySelector("#widget-url");
    if (inputUrl) inputUrl.value = urlNetlify;
    
    const modalWidget = document.querySelector("#modal-widget");
    if (modalWidget) modalWidget.classList.remove("oculto");

  } catch (e) {
    console.error("Error al gestionar el widget:", e);
    alert("Error al conectar con la base de datos. Revisa la consola.");
  }
}
// ------------------------------------
// Eventos del Modal del Widget
// ------------------------------------
const btnCerrarWidget = document.querySelector("#btn-cerrar-widget");
if (btnCerrarWidget) {
  btnCerrarWidget.addEventListener("click", () => {
    document.querySelector("#modal-widget").classList.add("oculto");
  });
}

const btnCopiarUrl = document.querySelector("#btn-copiar-url");
if (btnCopiarUrl) {
  btnCopiarUrl.addEventListener("click", () => {
    const inputUrl = document.querySelector("#widget-url");
    if (inputUrl && inputUrl.value) {
      // Intenta copiar al portapapeles de forma segura
      navigator.clipboard.writeText(inputUrl.value).then(() => {
        const textoOriginal = btnCopiarUrl.textContent;
        btnCopiarUrl.textContent = "¡Copiado!";
        btnCopiarUrl.style.background = "#E87A90";
        btnCopiarUrl.style.color = "white";
        
        setTimeout(() => {
          btnCopiarUrl.textContent = textoOriginal;
          btnCopiarUrl.style.background = "";
          btnCopiarUrl.style.color = "";
        }, 2000);
      }).catch(err => {
        alert("Tu navegador no permite copiar automáticamente. Por favor, selecciona el enlace y cópialo manualmente.");
      });
    }
  });
}
