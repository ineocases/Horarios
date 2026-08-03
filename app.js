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

let columnas = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
let tareas = [];

const ICONOS = ['🌸', '💼', '📚', '☕', '🏋️', '✨', '💻', '🛒', '❤️', '📌'];
let colSeleccionada = null;
let iconoSeleccionado = ICONOS[0];

let auth = null, db = null, usuarioActual = null, modoFormulario = 'login';
const $ = (sel) => document.querySelector(sel);

// Renderizar la interfaz inmediatamente para que nunca aparezca en blanco
document.addEventListener('DOMContentLoaded', () => {
  renderizarPlanner();
});

// Inicializar Firebase de forma segura
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
  console.warn("Aviso de Firebase (Modo local activo):", error);
  if ($('#banner-error')) $('#banner-error').classList.remove('oculto');
  mostrarPantalla('#pantalla-app'); 
  renderizarPlanner();
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

// Configurar Días / Columnas
$('#btn-abrir-config')?.addEventListener('click', () => {
  const inputCols = $('#input-cols');
  if (inputCols) inputCols.value = columnas.join(', ');
  $('#modal-config')?.classList.remove('oculto');
});

$('#btn-cancelar-config')?.addEventListener('click', () => {
  $('#modal-config')?.classList.add('oculto');
});

$('#btn-guardar-config')?.addEventListener('click', () => {
  const inputCols = $('#input-cols');
  if (!inputCols) return;
  const nuevas = inputCols.value.split(',').map(s => s.trim()).filter(Boolean);
  if (nuevas.length === 0) {
    alert("Agrega al menos un día.");
    return;
  }
  columnas = nuevas;
  tareas = tareas.filter(t => columnas.includes(t.col));
  $('#modal-config')?.classList.add('oculto');
  renderizarPlanner();
  guardarBaseDeDatos();
});

// Renderizar el Planner Estético por Tarjetas
function renderizarPlanner() {
  const grid = $('#planner-grid');
  if (!grid) return;

  grid.innerHTML = columnas.map(col => {
    const tareasCol = tareas.filter(t => t.col === col);
    
    const contenidoTareas = tareasCol.length > 0 ? tareasCol.map(t => `
      <div class="bloque-tarea">
        <div class="tarea-info-izq">
          <span class="tarea-icono-box">${t.icono}</span>
          <div class="tarea-detalles">
            ${t.hora ? `<span class="tarea-hora">${t.hora}</span>` : ''}
            <span class="tarea-texto">${t.nota}</span>
          </div>
        </div>
        <button type="button" class="btn-eliminar-tarea solo-editar" data-id="${t.id}">✕</button>
      </div>
    `).join('') : `<div class="sin-planes">Sin planes todavía 🌸</div>`;

    return `
      <div class="dia-tarjeta" data-col="${col}">
        <div class="dia-header">
          <span>${col}</span>
          <button type="button" class="btn-agregar-en-dia solo-editar" data-col="${col}" title="Añadir">+</button>
        </div>
        <div class="dia-cuerpo">
          ${contenidoTareas}
        </div>
      </div>
    `;
  }).join('');
}

// Interacciones en el Planner (Agregar / Borrar)
$('#planner-grid')?.addEventListener('click', (e) => {
  const btnBorrar = e.target.closest('.btn-eliminar-tarea');
  if (btnBorrar) {
    tareas = tareas.filter(t => t.id !== btnBorrar.dataset.id);
    renderizarPlanner();
    guardarBaseDeDatos();
    return;
  }

  const btnMas = e.target.closest('.btn-agregar-en-dia');
  if (btnMas) {
    abrirModalTarea(btnMas.dataset.col);
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

function abrirModalTarea(col) {
  colSeleccionada = col;
  const titulo = $('#modal-titulo');
  if (titulo) titulo.textContent = `Nuevo en ${col}`;
  if ($('#input-hora')) $('#input-hora').value = '';
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
  const hora = $('#input-hora')?.value.trim();
  if (nota) {
    tareas.push({ id: Date.now().toString(), col: colSeleccionada, hora, nota, icono: iconoSeleccionado });
    renderizarPlanner();
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
      await setDoc(doc(db, 'planner_estetico', usuarioActual.uid), { columnas, tareas });
      mostrarNotificacion('Guardado 💖');
    } catch (err) { console.error("Error al guardar:", err); }
  }
}

async function cargarBaseDeDatos(uid) {
  if (!db) return;
  try {
    const snap = await getDoc(doc(db, 'planner_estetico', uid));
    if (snap.exists()) {
      const data = snap.data();
      if (data.columnas) columnas = data.columnas;
      if (data.tareas) tareas = data.tareas;
    }
  } catch (err) { console.error("Error al cargar:", err); }
  renderizarPlanner();
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
