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

// Inyectar estilos limpios para las secciones y el diseño de "Día libre"
const estiloWidgetExtra = document.createElement('style');
estiloWidgetExtra.innerHTML = `
  .seccion-dia { margin-bottom: 16px; }
  .seccion-dia:last-child { margin-bottom: 0; }
  .titulo-dia { font-size: 13px; font-weight: bold; color: #d6336c; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .dia-libre { background: #faf8f9; border: 2px dashed #ffb6c1; color: #b56576; text-align: center; padding: 12px; border-radius: 12px; font-size: 13px; font-weight: 500; margin-bottom: 8px; }
  .tarea-item { background: #fff2f4; border-left: 4px solid #ff4d6d; padding: 10px 14px; border-radius: 12px; margin-bottom: 8px; display: flex; align-items: center; gap: 10px; font-size: 14px; }
`;
document.head.appendChild(estiloWidgetExtra);

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
        const filasDefinidas = datos.filas || ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00'];

        // Calcular qué día es HOY y MAÑANA
        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const hoyIndex = new Date().getDay();
        const hoyStr = diasSemana[hoyIndex];
        
        const mananaIndex = (hoyIndex + 1) % 7;
        const mananaStr = diasSemana[mananaIndex];

        // Función para agrupar tareas consecutivas con la misma nota
        function agruparTareasDelDia(tareasDelDia) {
            if (!tareasDelDia || tareasDelDia.length === 0) return [];

            // Ordenar según el orden real de las filas de la tabla
            tareasDelDia.sort((a, b) => filasDefinidas.indexOf(a.row) - filasDefinidas.indexOf(b.row));

            const grupos = [];
            let grupoActual = null;

            for (const t of tareasDelDia) {
                const rowIndex = filasDefinidas.indexOf(t.row);

                if (!grupoActual) {
                    grupoActual = {
                        nota: t.nota,
                        icono: t.icono,
                        startIndex: rowIndex,
                        endIndex: rowIndex,
                        startRow: t.row,
                        endRow: t.row
                    };
                } else {
                    const esConsecutivo = rowIndex === grupoActual.endIndex + 1;
                    const mismoContenido = grupoActual.nota === t.nota && grupoActual.icono === t.icono;

                    if (esConsecutivo && mismoContenido) {
                        grupoActual.endIndex = rowIndex;
                        grupoActual.endRow = t.row;
                    } else {
                        grupos.push(grupoActual);
                        grupoActual = {
                            nota: t.nota,
                            icono: t.icono,
                            startIndex: rowIndex,
                            endIndex: rowIndex,
                            startRow: t.row,
                            endRow: t.row
                        };
                    }
                }
            }
            if (grupoActual) grupos.push(grupoActual);
            return grupos;
        }

        const gruposHoy = agruparTareasDelDia(tareas.filter(t => t.col === hoyStr));
        const gruposManana = agruparTareasDelDia(tareas.filter(t => t.col === mananaStr));

        // HTML para renderizar cada bloque de día
        function renderizarBloque(nombreDia, etiqueta, grupos) {
            let contenidoHtml = '';
            
            if (grupos.length === 0) {
                contenidoHtml = `<div class="dia-libre">☕ Día libre</div>`;
            } else {
                contenidoHtml = grupos.map(g => {
                    const rangoHorario = g.startRow === g.endRow 
                        ? g.startRow 
                        : `${g.startRow} a ${g.endRow}`;

                    return `
                        <div class="tarea-item">
                            <span>${g.icono || '📌'}</span>
                            <div style="flex: 1;">
                                <div style="font-size: 11px; font-weight: bold; color: #d6336c; margin-bottom: 2px;">
                                    ${rangoHorario}
                                </div>
                                <div style="color: #333; font-weight: 500;">${g.nota}</div>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            return `
                <div class="seccion-dia">
                    <div class="titulo-dia">${etiqueta} (${nombreDia})</div>
                    ${contenidoHtml}
                </div>
            `;
        }

        contenedor.innerHTML = renderizarBloque(hoyStr, '🔥 HOY', gruposHoy) + 
                               renderizarBloque(mananaStr, '📅 MAÑANA', gruposManana);

    } catch (error) {
        contenedor.innerHTML = `<div class="estado-vacio">⚠️ Error al cargar: ${error.message}</div>`;
    }
}

renderizarWidgetVisual();
