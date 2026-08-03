import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBLzPOb6AbR3-2NqLkG0ETVWXeWY7tY7iI",
  authDomain: "horarios-3f609.firebaseapp.com",
  projectId: "horarios-3f609",
  storageBucket: "horarios-3f609.firebasestorage.app",
  messagingSenderId: "1002586000808",
  appId: "1:1002586000808:web:27004906e10133064c219d",
  measurementId: "G-0VGK0HWR4B"
};

// Columnas (Días) y Filas (Horarios o Secciones)
let columnas = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
let filas = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00'];
let tareas = []; // { id, col, row, nota, icono }

const ICONOS = ['🌸', '💼', '📚', '☕', '🏋️', '✨', '💻', '🛒', '❤️', '📌'];
let colSeleccionada = null, rowSeleccionada = null;
let iconoSeleccionado = ICONOS[0];

let auth = null, db = null, usuarioActual = null, modoFormulario = 'login';
const $ = (sel) => document.querySelector(sel);

document.addEventListener('DOMContentLoaded', () => {
  renderizarTabla();
});

// Inicializar Firebase
try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  onAuthStateChanged(auth, async (user) => {
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
  console.warn("Modo local activo:", error);
  if ($('#banner-error')) $('#banner-error').classList.remove('oculto');
  mostrarPantalla('#pantalla-app'); 
  renderizarTabla();
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
  const btnSub = $('#btn-login-submit');
  if (btnSub) btnSub.disabled = true;
  
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
  } finally {
    if (btnSub) btnSub.disabled = false;
  }
});

$('#btn-logout')?.addEventListener('click', () => {
  if (auth) signOut(auth);
});

// Configurar Filas y Columnas de la Planilla
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
  
  if (!nuevasCols || nuevasCols.length === 0 || !nuevasFilas || nuevasFilas.length === 0) {
    alert("Debes tener al menos 1 columna y 1 fila.");
    return;
  }

  columnas = nuevasCols;
  filas = nuevasFilas;
  tareas = tareas.filter(t => columnas.includes(t.col) && filas.includes(t.row));
  
  $('#modal-config')?.classList.add('oculto');
  renderizarTabla();
  guardarBaseDeDatos();
});

// Renderizar la Tabla / Planilla Estética
function renderizarTabla() {
  const thead = $('#horario-thead');
  if (!thead) return;

  thead.innerHTML = `<tr>
    <th>Horario</th>
    ${columnas.map(col => `<th>${col}</th>`).join('')}
  </tr>`;

  const tbody = $('#horario-tbody');
  if (!tbody) return;

  tbody.innerHTML = filas.map(fila => `
    <tr>
      <td>${fila}</td>
      ${columnas.map(col => {
        const tareasCelda = tareas.filter(t => t.col === col && t.row === fila);
        const html = tareasCelda.map(t => `
          <div class="tarea-bloque">
            <div class="tarea-info">
              <span>${t.icono}</span>
              <span class="tarea-texto">${t.nota}</span>
            </div>
            <button type="button" class="btn-eliminar-tarea solo-editar" data-id="${t.id}">✕</button>
          </div>
        `).join('');
        return `<td data-col="${col}" data-row="${fila}"><div class="celda-contenido">${html}</div></td>`;
      }).join('')}
    </tr>
  `).join('');
}

// Clics en la planilla (Agregar o borrar tarea)
$('#horario-tbody')?.addEventListener('click', (e) => {
  const btnBorrar = e.target.closest('.btn-eliminar-tarea');
  if (btnBorrar) {
    tareas = tareas.filter(t => t.id !== btnBorrar.dataset.id);
    renderizarTabla();
    guardarBaseDeDatos();
    return;
  }
  const celda = e.target.closest('td[data-col]');
  if (celda && !document.body.classList.contains('exportando')) {
    abrirModalTarea(celda.dataset.col, celda.dataset.row);
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
});

$('#btn-guardar-entrada')?.addEventListener('click', () => {
  const nota = $('#input-nota')?.value.trim();
  if (nota) {
    tareas.push({ id: Date.now().toString(), col: colSeleccionada, row: rowSeleccionada, nota, icono: iconoSeleccionado });
    renderizarTabla();
    guardarBaseDeDatos();
    $('#modal-agregar')?.classList.add('oculto');
  } else {
    alert("Escribe una descripción.");
  }
});

// Firestore
async function guardarBaseDeDatos() {
  if (usuarioActual && db) {
    try {
      await setDoc(doc(db, 'planilla_estetica', usuarioActual.uid), { columnas, filas, tareas });
      mostrarNotificacion('Guardado 💖');
    } catch (err) { console.error("Error al guardar:", err); }
  }
}

async function cargarBaseDeDatos(uid) {
  if (!db) return;
  try {
    const snap = await getDoc(doc(db, 'planilla_estetica', uid));
    if (snap.exists()) {
      const data = snap.data();
      if (data.columnas) columnas = data.columnas;
      if (data.filas) filas = data.filas;
      if (data.tareas) tareas = data.tareas;
    }
  } catch (err) { console.error("Error al cargar:", err); }
  renderizarTabla();
}

function mostrarNotificacion(msg) {
  const t = $('#mensaje-guardado');
  if (!t) return;
  t.textContent = msg; 
  t.classList.remove('oculto');
  setTimeout(() => t.classList.add('oculto'), 2000);
}

// Descargar Imagen HD
$('#btn-generar-imagen')?.addEventListener('click', async () => {
  document.body.classList.add('exportando');
  await new Promise(r => setTimeout(r, 150)); 
  try {
    const captureArea = $('#capture-area');
    if (!captureArea) return;
    const canvas = await html2canvas(captureArea, { backgroundColor: '#FFF2F4', scale: 2 });
    if ($('#imagen-generada')) $('#imagen-generada').src = canvas.toDataURL('image/png');
    if ($('#btn-descargar')) $('#btn-descargar').href = canvas.toDataURL('image/png');
    $('#modal-imagen')?.classList.remove('oculto');
  } finally { 
    document.body.classList.remove('exportando'); 
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
