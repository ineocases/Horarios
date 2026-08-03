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

// Estilos visuales integrados
const estiloWidgetExtra = document.createElement('style');
estiloWidgetExtra.innerHTML = `
  .seccion-dia { margin-bottom: 16px; }
  .seccion-dia:last-child { margin-bottom: 0; }
  .titulo-dia { font-size: 13px; font-weight: bold; color: #d6336c; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .dia-libre { background: #faf8f9; border: 2px dashed #ffb6c1; color: #b56576; text-align: center; padding: 12px; border-radius: 12px; font-size: 13px; font-weight: 500; margin-bottom: 8px; }
  .tarea-item { background: #fff2f4; border-left: 4px solid #ff4d6d; padding: 10px 14px; border-radius: 12px; margin-bottom: 8px; display: flex; align-items: center; gap: 10px; font-size: 14px; }
  .estado-vacio { text-align: center; color: #888; font-size: 14px; padding: 20px 0; }
`;
document.head.appendChild(estiloWidgetExtra);

document.addEventListener('DOMContentLoaded', async () => {
    const contenedor = document.getElementById('contenedor-visual');

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        if (contenedor) contenedor.innerHTML = `<div class="estado-vacio">❌ Falta el token en la URL. Volvé a generarlo desde la app.</div>`;
        return;
    }

    try {
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);

        // Buscar el token en Firebase
        const widgetSnap = await getDoc(doc(db, "widgets", token));
        
        if (!widgetSnap.exists()) {
            if (contenedor) contenedor.innerHTML = `<div class="estado-vacio">❌ Token inválido o expirado. Generá uno nuevo en tu app.</div>`;
            return;
        }

        const uid = widgetSnap.data().uid;
        const planillaSnap = await getDoc(doc(db, "planilla_estetica", uid));
        
        if (!planillaSnap.exists()) {
            if (contenedor) contenedor.innerHTML = `<div class="estado-vacio">📅 No hay datos guardados en tu planilla.</div>`;
            return;
        }

        const datos = planillaSnap.data();
        const tareas = datos.tareas || [];
        const filasDefinidas = datos.filas || ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

        const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

        // Función para agrupar horas consecutivas con la misma nota
        function agruparTareasDelDia(tareasDelDia) {
            if (!tareasDelDia || tareasDelDia.length === 0) return [];

            tareasDelDia.sort((a, b) => filasDefinidas.indexOf(a.row) - filasDefinidas.indexOf(b.row));

            const grupos = [];
            let grupoActual = null;

            for (const t of tareasDelDia) {
                const rowIndex = filasDefinidas.indexOf(t.row);

                if (!grupoActual) {
                    grupoActual = {
                        nombre: t.nota,
                        icono: t.icono || '📌',
                        startIndex: rowIndex,
                        endIndex: rowIndex,
                        startRow: t.row,
                        endRow: t.row
                    };
                } else {
                    const esConsecutivo = rowIndex === grupoActual.endIndex + 1;
                    const mismoContenido = grupoActual.nombre === t.nota && grupoActual.icono === (t.icono || '📌');

                    if (esConsecutivo && mismoContenido) {
                        grupoActual.endIndex = rowIndex;
                        grupoActual.endRow = t.row;
                    } else {
                        grupoActual.rango = grupoActual.startRow === grupoActual.endRow 
                            ? grupoActual.startRow 
                            : `${grupoActual.startRow} a ${grupoActual.endRow}`;
                        grupos.push(grupoActual);

                        grupoActual = {
                            nombre: t.nota,
                            icono: t.icono || '📌',
                            startIndex: rowIndex,
                            endIndex: rowIndex,
                            startRow: t.row,
                            endRow: t.row
                        };
                    }
                }
            }
            if (grupoActual) {
                grupoActual.rango = grupoActual.startRow === grupoActual.endRow 
                    ? grupoActual.startRow 
                    : `${grupoActual.startRow} a ${grupoActual.endRow}`;
                grupos.push(grupoActual);
            }
            return grupos;
        }

        // Estructurar datos para toda la semana
        const resultadoSemana = {};
        diasSemana.forEach(dia => {
            resultadoSemana[dia] = agruparTareasDelDia(tareas.filter(t => t.col === dia));
        });

        // 1. Exportar en un tag <script id="datos-json"> para Scriptable
        let elJson = document.getElementById('datos-json');
        if (!elJson) {
            elJson = document.createElement('script');
            elJson.id = 'datos-json';
            elJson.type = 'application/json';
            document.body.appendChild(elJson);
        }
        elJson.textContent = JSON.stringify(resultadoSemana);

        // 2. Renderizado visual HTML estándar
        if (contenedor) {
            let html = '';
            diasSemana.forEach(dia => {
                const grupos = resultadoSemana[dia];
                let contenidoHtml = '';
                if (grupos.length === 0) {
                    contenidoHtml = `<div class="dia-libre">☕ Libre</div>`;
                } else {
                    contenidoHtml = grupos.map(g => `
                        <div class="tarea-item">
                            <span>${g.icono}</span>
                            <div style="flex: 1;">
                                <div style="font-size: 11px; font-weight: bold; color: #d6336c; margin-bottom: 2px;">${g.rango}</div>
                                <div style="color: #333; font-weight: 500;">${g.nombre}</div>
                            </div>
                        </div>
                    `).join('');
                }
                html += `<div class="seccion-dia"><div class="titulo-dia">${dia}</div>${contenidoHtml}</div>`;
            });
            contenedor.innerHTML = html;
        }

    } catch (error) {
        console.error(error);
        if (contenedor) contenedor.innerHTML = `<div class="estado-vacio">⚠️ Error de conexión: ${error.message}</div>`;
    }
});
