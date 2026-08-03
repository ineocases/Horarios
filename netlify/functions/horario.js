import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBLzPOb6AbR3-2NqLkG0ETVWXeWY7tY7iI",
  authDomain: "horarios-3f609.firebaseapp.com",
  projectId: "horarios-3f609",
  storageBucket: "horarios-3f609.firebasestorage.app",
  messagingSenderId: "1002586000808",
  appId: "1:1002586000808:web:27004906e10133064c219d",
  measurementId: "G-0VGK0HWR4B"
};

export async function handler(event) {
    const token = event.queryStringParameters && event.queryStringParameters.token;
    if (!token) {
        return {
            statusCode: 400,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
            body: "❌ Falta el token en la URL."
        };
    }

    try {
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);

        const widgetSnap = await getDoc(doc(db, "widgets", token));
        if (!widgetSnap.exists()) {
            return {
                statusCode: 404,
                headers: { "Content-Type": "text/plain; charset=utf-8" },
                body: "❌ Token inválido o expirado."
            };
        }

        const uid = widgetSnap.data().uid;
        const planillaSnap = await getDoc(doc(db, "planilla_estetica", uid));
        if (!planillaSnap.exists()) {
            return {
                statusCode: 404,
                headers: { "Content-Type": "text/plain; charset=utf-8" },
                body: "📅 No hay datos en tu planilla."
            };
        }

        const datos = planillaSnap.data();
        const tareas = datos.tareas || [];
        const filasDefinidas = datos.filas || ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00'];

        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const hoyIndex = new Date().getDay();
        const hoyStr = diasSemana[hoyIndex];
        const mananaIndex = (hoyIndex + 1) % 7;
        const mananaStr = diasSemana[mananaIndex];

        function agrupar(tareasDelDia) {
            if (!tareasDelDia || tareasDelDia.length === 0) return [];
            tareasDelDia.sort((a, b) => filasDefinidas.indexOf(a.row) - filasDefinidas.indexOf(b.row));
            const grupos = [];
            let actual = null;

            for (const t of tareasDelDia) {
                const idx = filasDefinidas.indexOf(t.row);
                if (!actual) {
                    actual = { nota: t.nota, icono: t.icono || '📌', start: t.row, end: t.row, endIndex: idx };
                } else {
                    if (idx === actual.endIndex + 1 && actual.nota === t.nota) {
                        actual.end = t.row;
                        actual.endIndex = idx;
                    } else {
                        grupos.push(actual);
                        actual = { nota: t.nota, icono: t.icono || '📌', start: t.row, end: t.row, endIndex: idx };
                    }
                }
            }
            if (actual) grupos.push(actual);
            return grupos;
        }

        const gruposHoy = agrupar(tareas.filter(t => t.col === hoyStr));
        const gruposManana = agrupar(tareas.filter(t => t.col === mananaStr));

        function formatearBloque(etiqueta, nombreDia, grupos) {
            let texto = `${etiqueta} (${nombreDia.toUpperCase()}):\n`;
            if (grupos.length === 0) {
                texto += `• ☕ Día libre\n`;
            } else {
                grupos.forEach(g => {
                    const hora = g.start === g.end ? g.start : `${g.start} a ${g.end}`;
                    texto += `• ${hora} - ${g.icono} ${g.nota}\n`;
                });
            }
            return texto;
        }

        const resultadoFinal = formatearBloque("🔥 HOY", hoyStr, gruposHoy) + 
                               "\n" + 
                               formatearBloque("📅 MAÑANA", mananaStr, gruposManana);

        return {
            statusCode: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
            body: resultadoFinal
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
            body: "⚠️ Error en el servidor: " + error.message
        };
    }
}
