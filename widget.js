import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// REEMPLAZA ESTO CON TU CONFIGURACIÓN EXACTA
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

async function cargarDatosWidget() {
    const output = document.getElementById('json-output');
    
    // 1. Obtener el token de la URL (ej: widget.html?token=1234-abcd)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        output.textContent = JSON.stringify({ error: "Falta el token" });
        return;
    }

    try {
        // 2. Buscar a qué usuario le pertenece este token
        const widgetSnap = await getDoc(doc(db, "widgets", token));
        
        if (!widgetSnap.exists()) {
            output.textContent = JSON.stringify({ error: "Token inválido o expirado" });
            return;
        }

        const uid = widgetSnap.data().uid;

        // 3. Buscar los horarios de ese usuario
        const planillaSnap = await getDoc(doc(db, "planilla_estetica", uid));
        
        if (!planillaSnap.exists()) {
            output.textContent = JSON.stringify({ error: "No hay horarios guardados" });
            return;
        }

        const datosHorario = planillaSnap.data();

        // 4. Imprimir los datos en formato JSON puro
        // El Atajo de iPad leerá este texto directamente
        output.textContent = JSON.stringify(datosHorario, null, 2);

    } catch (error) {
        output.textContent = JSON.stringify({ error: error.message });
    }
}

// Ejecutar al cargar la página
cargarDatosWidget();
