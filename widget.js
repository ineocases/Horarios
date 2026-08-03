import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// REEMPLAZA ESTO CON TU CONFIGURACIÓN EXACTA DE FIREBASE
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TUS_NUMEROS",
  appId: "TU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function renderizarWidgetVisual() {
    const contenedor = document.getElementById('contenedor-visual');
    
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        contenedor.innerHTML = `<div class="estado-vacio">❌ Falta el token de acceso.</div>`;
        return;
    }

    try {
        const widgetSnap = await getDoc(doc(db, "widgets", token));
        
        if (!widgetSnap.exists()) {
            contenedor.innerHTML = `<div class="estado-vacio">❌ Token inválido o expirado.</div>`;
            return;
        }

        const uid = widgetSnap.data().uid;
        const planillaSnap = await getDoc(doc(db, "planilla_estetica", uid));
        
        if (!planillaSnap.exists()) {
            contenedor.innerHTML = `<div class="estado-vacio">📅 No hay datos en tu planilla todavía.</div>`;
            return;
        }

        const datos = planillaSnap.data();
        const tareas = datos.tareas || [];

        if (tareas.length === 0) {
            contenedor.innerHTML = `<div class="estado-vacio">🎉 ¡No hay tareas cargadas por ahora!</div>`;
            return;
        }

        // Generamos tarjetas visuales por cada tarea guardada
        contenedor.innerHTML = tareas.map(t => `
            <div class="tarea-item">
                <span>${t.icono || '📌'}</span>
                <div>
                    <b>${t.col} • ${t.row}</b><br>
                    <span style="color: #555;">${t.nota}</span>
                </div>
            </div>
        `).join('');

    } catch (error) {
        contenedor.innerHTML = `<div class="estado-vacio">⚠️ Error al cargar: ${error.message}</div>`;
    }
}

renderizarWidgetVisual();
