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

let columnas = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
let filas = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00'];
let tareas = [];
let clasesDefinidas = []; // Aquí se guardan tus clases rápidas
let claseActiva = null;   // Saber qué "sello" está seleccionado
let editandoTareaId = null; // Para saber si editamos o creamos

const ICONOS = ['🌸', '💼', '📚', '☕', '🏋️', '✨', '💻', '🛒', '❤️', '📌'];
let colSeleccionada = null, rowSeleccionada = null;
let iconoSeleccionado = ICONOS[0];

let auth = null, db = null, usuarioActual = null, modoFormulario = 'login';
const $ = (sel) => document.querySelector(sel);

// Inyectar CSS Dinámico para las nuevas funciones (No necesitas tocar tu style.css)
const estiloNuevasFunciones = document.createElement('style');
estiloNuevasFunciones.innerHTML = `
  #barra-clases { display: flex; flex-direction: column; gap: 10px; margin: 15px auto; padding: 15px; background: #FFF2F4; border-radius: 15px; max-width: 900px; border: 2px dashed #ffb6c1; }
  .clases-lista { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .clase-item { padding: 6px 12px; background: white; border: 2px solid #ffb6c1; border-radius: 20px; cursor: pointer; display: flex; align-items: center; gap: 5px; font-size: 14px; transition: 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
  .clase-item:hover { transform: translateY(-2px); }
  .clase-item.activa { background: #ffb6c1; color: white; transform: scale(1.05); border-color: #ff8da1; font-weight: bold; }
  .btn-eliminar-clase { background: none; border: none; color: #ff6b81; cursor: pointer; font-weight: bold; font-size: 14px; padding: 0 2px; }
  .btn-nueva-clase { background: #ffd1dc; border: none; padding: 6px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; color: #d6336c; font-size: 14px; }
  .tarea-acciones { display: flex; gap: 4px; position: absolute; top: 4px; right: 4px; }
  .btn-editar-tarea, .btn-eliminar-tarea { border: none; background: rgba(255,255,255,0.9); border-radius: 50%; width: 22px; height: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #555; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .btn-editar-tarea:hover { background: #ffd1dc; color: #d6336c; }
  .tarea-bloque { position: relative; padding-right: 45px !important; }
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
  const contenedorTabla = $('.table-responsive') || $('#horario-thead').parentElement;
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
    <div style="font-size: 14px; color: #666; font-weight: bold; text-align: center;">🎨 Tus Clases Rápidas (Selecciona una y haz clic en el horario para agregarla al instante):</div>
    <div class="clases-lista" style="justify-content: center;">
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
    const nombre = prompt("Nombre de tu clase/actividad (Ej: Estudiar):");
    if (nombre) {
      const icono = prompt("Pega un emoji para representarla (Ej: 📚, 💼, 🏋️):") || '✨';
      clasesDefinidas.push({ id: Date.now().toString(), nombre, icono });
      renderizarBarraClases();
      guardarDatos();
    }
  }

  const btnEliminarClase = e.target.closest('.btn-eliminar-clase');
  if (btnEliminarClase) {
    e.stopPropagation(); // Evita que se seleccione la clase
    if (confirm("¿Borrar este acceso rápido?")) {
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
    // Si ya estaba activa, la deselecciona. Si no, la selecciona.
    if (claseActiva && claseActiva.id === claseId) {
      claseActiva = null;
    } else {
      claseActiva = clasesDefinidas.find(c => c.id === claseId);
    }
    renderizarBarraClases();
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
    console.warn("Modo local activo:", error);
    mostrarPantalla('#pantalla-login');
  }
}

// Autenticación (se mantiene igual)
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
            <div class="tarea-bloque">
              <div class="tarea-info">
                <span>${t.icono}</span>
                <span class="tarea-texto">${t.nota}</span>
              </div>
              <div class="tarea-acciones">
                <button type="button" class="btn-editar-tarea solo-editar" data-id="${t.id}">✎</button>
                <button type="button" class="btn-eliminar-tarea solo-editar" data-id="${t.id}">✕</button>
              </div>
            </div>
          `).join('');
          return `<td data-col="${col}" data-row="${fila}"><div class="celda-contenido">${html}</div></td>`;
        }).join('')}
      </tr>
    `).join('');
  }
}

// Interacciones con la Tabla (Click, Sello, Editar, Borrar)
$('#horario-tbody')?.addEventListener('click', (e) => {
  if (document.body.classList.contains('exportando')) return;

  // 1. Borrar tarea
  const btnBorrar = e.target.closest('.btn-eliminar-tarea');
  if (btnBorrar) {
    tareas = tareas.filter(t => t.id !== btnBorrar.dataset.id);
    renderizarTabla();
    guardarDatos();
    return;
  }

  // 2. Editar tarea
  const btnEditar = e.target.closest('.btn-editar-tarea');
  if (btnEditar) {
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

  // 3. Clic en la celda (Sello o Modal Libre)
  const celda = e.target.closest('td[data-col]');
  if (celda && !e.target.closest('.tarea-bloque')) {
    if (claseActiva) {
      // Modo Sello: Agrega instantáneamente
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
      // Modo Normal: Abre el modal vacío
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
  editandoTareaId = null; // Reiniciamos para saber que es una nueva
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
      // Editar existente
      const index = tareas.findIndex(t => t.id === editandoTareaId);
      if (index !== -1) {
        tareas[index].nota = nota;
        tareas[index].icono = iconoSeleccionado;
      }
    } else {
      // Crear nueva
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

// Guardar Datos (Local y Nube - Ahora incluye clasesDefinidas)
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
  renderizarBarraClases(); // Actualizamos la barra al cargar de internet
}

function mostrarNotificacion(msg) {
  const t = $('#mensaje-guardado');
  if (!t) return;
  t.textContent = msg; 
  t.classList.remove('oculto');
  setTimeout(() => t.classList.add('oculto'), 2000);
}

// Descargar Imagen HD (oculta automáticamente los botones antes de tomar la foto)
$('#btn-generar-imagen')?.addEventListener('click', async () => {
  document.body.classList.add('exportando');
  if ($('#barra-clases')) $('#barra-clases').style.display = 'none'; // Oculta la barra de clases para la foto
  
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
    if ($('#barra-clases')) $('#barra-clases').style.display = 'flex'; // Vuelve a mostrarla
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
