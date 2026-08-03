// Importaciones oficiales de Firebase (Versión 10.8.0)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Tus credenciales exactas
const firebaseConfig = {
  apiKey: "AIzaSyBLzPOb6AbR3-2NqLkG0ETVWXeWY7tY7iI",
  authDomain: "horarios-3f609.firebaseapp.com",
  projectId: "horarios-3f609",
  storageBucket: "horarios-3f609.firebasestorage.app",
  messagingSenderId: "1002586000808",
  appId: "1:1002586000808:web:27004906e10133064c219d",
  measurementId: "G-0VGK0HWR4B"
};

// Variables Globales
const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
const HORAS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00']; // Puedes agregar más horas aquí
const ICONOS = ['📚', '💼', '🏋️', '☕', '😴', '✨', '🛒', '💻', '❤️', '📌'];

let horario = { lunes: [], martes: [], miercoles: [], jueves: [], viernes: [] };
let diaSeleccionado = null, horaSeleccionada = null, iconoSeleccionado = ICONOS[0];
let auth, db, usuarioActual = null, modoFormulario = 'login';

const $ = (sel) => document.querySelector(sel);

// Inicializar Firebase con manejo de errores
try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      usuarioActual = user;
      $('#usuario-email').textContent = user.email;
      $('#btn-logout').classList.remove('oculto');
      mostrarPantalla('#pantalla-app');
      await cargarBaseDeDatos(user.uid);
    } else {
      usuarioActual = null;
      mostrarPantalla('#pantalla-login');
    }
  });
} catch (error) {
  console.error("Error al cargar Firebase:", error);
  // Si esto salta, estás abriendo el archivo como file:// en lugar de localhost
  $('#banner-error').classList.remove('oculto');
  mostrarPantalla('#pantalla-app'); 
  renderizarTabla();
}

// Lógica de Autenticación
$('#tab-login').addEventListener('click', () => cambiarTab('login'));
$('#tab-registro').addEventListener('click', () => cambiarTab('registro'));

function cambiarTab(modo) {
  modoFormulario = modo;
  $('#tab-login').classList.toggle('activo', modo === 'login');
  $('#tab-registro').classList.toggle('activo', modo === 'registro');
  $('#btn-login-submit').textContent = modo === 'login' ? 'Ingresar' : 'Crear cuenta';
  $('#login-error').classList.add('oculto');
}

$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  $('#login-error').classList.add('oculto');
  $('#btn-login-submit').disabled = true;
  
  try {
    if (modoFormulario === 'login') {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
    }
  } catch (err) {
    const mensajes = { 
      'auth/invalid-credential': 'Las credenciales son incorrectas.', 
      'auth/email-already-in-use': 'Este correo ya tiene una cuenta.', 
      'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.' 
    };
    $('#login-error').textContent = mensajes[err.code] || 'Error de conexión. Revisa la consola.';
    $('#login-error').classList.remove('oculto');
  } finally {
    $('#btn-login-submit').disabled = false;
  }
});

$('#btn-logout').addEventListener('click', () => signOut(auth));

// Renderizar la Tabla (Como la imagen)
function renderizarTabla() {
  const tbody = $('#horario-tbody');
  tbody.innerHTML = HORAS.map(hora => `
    <tr>
      <td>${hora}</td>
      ${DIAS.map(dia => {
        const tareas = horario[dia].filter(t => t.hora === hora);
        const html = tareas.map(t => `
          <div class="tarea">
            <span>${t.icono}</span>
            <span class="tarea-texto">${t.nota}</span>
            <button class="btn-eliminar solo-editar" data-dia="${dia}" data-id="${t.id}">✕</button>
          </div>
        `).join('');
        return `<td data-dia="${dia}" data-hora="${hora}"><div class="celda-contenido">${html}</div></td>`;
      }).join('')}
    </tr>
  `).join('');
}

// Clics en la tabla (Agregar o borrar)
$('#horario-tbody').addEventListener('click', (e) => {
  const btnBorrar = e.target.closest('.btn-eliminar');
  if (btnBorrar) {
    horario[btnBorrar.dataset.dia] = horario[btnBorrar.dataset.dia].filter(t => t.id !== btnBorrar.dataset.id);
    renderizarTabla();
    guardarBaseDeDatos();
    return;
  }
  const celda = e.target.closest('td[data-dia]');
  if (celda && !document.body.classList.contains('exportando')) {
    abrirModal(celda.dataset.dia, celda.dataset.hora);
  }
});

// Modal de tareas
function construirIconos() {
  $('#selector-iconos').innerHTML = ICONOS.map(ic => `<div class="icono-opcion ${ic === iconoSeleccionado ? 'seleccionado' : ''}" data-icono="${ic}">${ic}</div>`).join('');
}

$('#selector-iconos').addEventListener('click', (e) => {
  if (e.target.dataset.icono) {
    iconoSeleccionado = e.target.dataset.icono;
    construirIconos();
  }
});

function abrirModal(dia, hora) {
  diaSeleccionado = dia; horaSeleccionada = hora;
  $('#modal-titulo').textContent = `Agendar el ${dia} a las ${hora}`;
  $('#input-nota').value = '';
  iconoSeleccionado = ICONOS[0];
  construirIconos();
  $('#modal-agregar').classList.remove('oculto');
  setTimeout(() => $('#input-nota').focus(), 100);
}

$('#btn-cancelar-modal').addEventListener('click', () => $('#modal-agregar').classList.add('oculto'));

$('#btn-guardar-entrada').addEventListener('click', () => {
  const nota = $('#input-nota').value.trim();
  if (nota) {
    horario[diaSeleccionado].push({ id: Date.now().toString(), hora: horaSeleccionada, nota, icono: iconoSeleccionado });
    renderizarTabla();
    guardarBaseDeDatos();
    $('#modal-agregar').classList.add('oculto');
  }
});

// Base de datos Firestore
async function guardarBaseDeDatos() {
  if (usuarioActual && db) {
    try {
      await setDoc(doc(db, 'horarios', usuarioActual.uid), { dias: horario });
      mostrarNotificacion('Guardado en la nube ✓');
    } catch (err) { console.error("Error guardando:", err); }
  }
}

async function cargarBaseDeDatos(uid) {
  try {
    const snap = await getDoc(doc(db, 'horarios', uid));
    if (snap.exists()) horario = { ...horario, ...snap.data().dias };
  } catch (err) { console.error("Error leyendo:", err); }
  renderizarTabla();
}

function mostrarNotificacion(msg) {
  const t = $('#mensaje-guardado');
  t.textContent = msg; t.classList.remove('oculto');
  setTimeout(() => t.classList.add('oculto'), 2000);
}

// Descargar Imagen
$('#btn-generar-imagen').addEventListener('click', async () => {
  document.body.classList.add('exportando');
  await new Promise(r => setTimeout(r, 100)); 
  try {
    const canvas = await html2canvas($('#capture-area'), { backgroundColor: '#FAF8F6', scale: 2 });
    $('#imagen-generada').src = canvas.toDataURL('image/png');
    $('#btn-descargar').href = canvas.toDataURL('image/png');
    $('#modal-imagen').classList.remove('oculto');
  } finally { document.body.classList.remove('exportando'); }
});
$('#btn-cerrar-imagen').addEventListener('click', () => $('#modal-imagen').classList.add('oculto'));

function mostrarPantalla(id) {
  ['#pantalla-carga', '#pantalla-login', '#pantalla-app'].forEach(s => $(s).classList.add('oculto'));
  $(id).classList.remove('oculto');
}
