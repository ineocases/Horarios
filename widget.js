import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBLzPOb6AbR3-2NqLkG0ETVWXeWY7tY7iI",
  authDomain: "horarios-3f609.firebaseapp.com",
  projectId: "horarios-3f609",
  storageBucket: "horarios-3f609.firebasestorage.app",
  messagingSenderId: "1002586000808",
  appId: "1:1002586000808:web:27004906e10133064c219d",
  measurementId: "G-0VGK0HWR4B"
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
            contenedor.innerHTML = `<div class="estado-vacio">📅 No hay datos en tu planilla.</div>`;
            return;
        }

        const datos = planillaSnap.data();
        const tareas = datos.tareas || [];

        // Calcular dinámicamente qué día es HOY y MAÑANA en texto (ej: "Lunes", "Martes"...)
        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const hoyIndex = new Date().getDay();
        const hoyStr = diasSemana[hoyIndex];
        
        const mananaIndex = (hoyIndex + 1) % 7;
        const mananaStr = diasSemana[mananaIndex];

        // Filtrar exclusivamente las tareas que coincidan con HOY o MAÑANA
        const tareasRelevantes = tareas.filter(t => t.col === hoyStr || t.col === mananaStr);

        if (tareasRelevantes.length === 0) {
            contenedor.innerHTML = `<div class="estado-vacio">🎉 ¡Nada agendado para Hoy (${hoyStr}) ni Mañana (${mananaStr})!</div>`;
            return;
        }

        // Dibujar las tarjetas indicando si es HOY o MAÑANA
        contenedor.innerHTML = tareasRelevantes.map(t => {
            const esHoy = t.col === hoyStr;
            const etiqueta = esHoy ? '🔥 HOY' : '📅 MAÑANA';
            const colorBorde = esHoy ? '#ff4d6d' : '#ffa8b6';
            
            return `
                <div class="tarea-item" style="border-left: 4px solid ${colorBorde};">
                    <span>${t.icono || '📌'}</span>
                    <div style="flex: 1;">
                        <div style="font-size: 11px; font-weight: bold; color: #d6336c; margin-bottom: 2px;">
                            ${etiqueta} (${t.col} • ${t.row})
                        </div>
                        <div style="color: #333; font-weight: 500;">${t.nota}</div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        contenedor.innerHTML = `<div class="estado-vacio">⚠️ Error al cargar: ${error.message}</div>`;
    }
}

renderizarWidgetVisual();
