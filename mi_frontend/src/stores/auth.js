import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { jwtDecode } from 'jwt-decode';

const VITE_API_INSCRIPCION_TASK_URL = import.meta.env.VITE_API_INSCRIPCION_TASK_URL;

const VITE_API_LOGIN_URL = import.meta.env.VITE_API_LOGIN_URL;

// URL base de tu backend
const API_BASE_URL = VITE_API_INSCRIPCION_TASK_URL //'http://localhost:3000/api/inscripcion/tasks';

// ----------------------------------------------------
// FUNCIÓN AUXILIAR CON AUTORIZACIÓN (FETCH)
// ----------------------------------------------------

async function authFetch(url, options = {}) {
    const token = localStorage.getItem('user_token'); // Obtiene el token del almacenamiento

    if (!token) {
        throw new Error("No autenticado. Token no encontrado.");
    }

    // Configura los headers de la solicitud, añadiendo el Authorization
    const authHeaders = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
    };

    if (options.body && !authHeaders['Content-Type']) {
        authHeaders['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, { ...options, headers: authHeaders });

    // Si el token expiró o es inválido, forzamos el logout (401/403)
    if (response.status === 401 || response.status === 403) {
        // En un entorno real, forzaríamos el logout aquí y la redirección
        // useAuthStore().logout(); 
        throw new Error("Sesión expirada o no autorizada. Por favor, inicie sesión nuevamente.");
    }

    return response;
}

// ----------------------------------------------------
// FUNCIÓN AUXILIAR PARA EL POLLING
// ----------------------------------------------------

// Espera un resultado cada 2 segundos hasta que la tarea se complete.
async function pollTaskStatus(shortId, maxRetries = 3) {
    // Intervalo de espera para el estado de la tarea (2 segundos)
    const POLLING_INTERVAL = 2000;
    // Retraso para reintentos de error 5xx (500ms)
    const RETRY_DELAY = 500;

    let retries = 0; // Contador de reintentos para errores 5xx

    // Promesa que se resuelve cuando la tarea está 'completed'
    return new Promise((resolve, reject) => {
        const checkStatus = async () => {
            try {
                // GET: /api/inscripcion/tasks/gettask/{shortId}
                console.log(`${API_BASE_URL}/gettask/${shortId}`);
                //const response = await fetch(`${API_BASE_URL}/gettask/${shortId}`);
                const response = await authFetch(`${API_BASE_URL}/gettask/${shortId}`);
                console.log("[POLLING] Respuesta recibida para tarea:", shortId, response);

                // --- Lógica de Reintento para errores 5xx (Servidor) ---
                if (!response.ok) {
                    // Si el estado es 5xx (e.g., 500) y aún quedan reintentos
                    if (response.status >= 500 && retries < maxRetries) {
                        retries++;
                        console.warn(`[POLLING] Error 5xx (${response.statusText}). Reintento ${retries}/${maxRetries} en ${RETRY_DELAY}ms...`);

                        // Espera el RETRY_DELAY antes de reintentar la consulta
                        setTimeout(checkStatus, RETRY_DELAY);
                        return; // Salimos de esta ejecución, la siguiente vendrá con el setTimeout
                    } else {
                        // Si es otro tipo de error (e.g., 404, 403) o se agotaron los reintentos
                        throw new Error(`Error HTTP al consultar tarea: ${response.statusText}`);
                    }
                }

                // Si la respuesta es exitosa (200), reiniciamos el contador de reintentos 5xx
                retries = 0;
                const data = await response.json();

                // Si el trabajo se completó
                if (data.job && data.job.state === 'completed') {
                    if (data.job.returnvalue && data.job.returnvalue.success) {
                        // Resuelve la promesa con el objeto 'estudiante' completo
                        resolve(data.job.returnvalue.estudiante);
                    } else {
                        reject(new Error("Tarea completada, pero la respuesta no fue exitosa."));
                    }
                } else if (data.job && data.job.state === 'failed') {
                    // Si el trabajo falló
                    reject(new Error(`La tarea falló: ${data.job.failedReason || 'Razón desconocida'}`));
                } else {
                    // Si no está completado, reintenta después del intervalo de polling normal
                    console.log(`[POLLING] Tarea ${shortId} en estado: ${data.job ? data.job.state : 'waiting'}. Reintentando en 2s...`);
                    setTimeout(checkStatus, POLLING_INTERVAL);
                }
            } catch (error) {
                console.error("[POLLING ERROR]", error);
                reject(error);
            }
        };
        // Inicia la primera verificación
        checkStatus();
    });
}
// ----------------------------------------------------
// STORE PRINCIPAL (PINIA)
// ----------------------------------------------------

export const useAuthStore = defineStore('auth', () => {
    // Estado: guardará la data completa del backend
    const estudiante = ref(null);
    // Estado: guarda el registro ingresado en el login
    const userRegistro = ref(null);
    // Estado: indicador de carga para mostrar al usuario que espere
    const isLoading = ref(false);

    const userPayload = ref(null); // Guardará el contenido decodificado del JWT
    const authToken = ref(null); // Almacenará el token

    // COMPUTED: estado de autenticación simple
    const isAuthenticated = computed(() => !!authToken.value);

    //para guardar la respuesta json de la inscripción
    const inscripcionResponse = ref(null);

    // ACCIÓN: Login
    const login = async (registro, ci) => {
        isLoading.value = true;
        try {
            console.log(`[AUTH STORE] Intentando login con registro: ${registro}`);

            // 1. Petición al Gateway para obtener el token
            const response = await fetch(VITE_API_LOGIN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ registro, ci }) // Usa las credenciales nuevas
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Credenciales inválidas.');
            }

            const data = await response.json();

            // 2. Almacenar el token y decodificar el payload
            authToken.value = data.token;
            localStorage.setItem('user_token', data.token); // Almacenamiento persistente

            userPayload.value = jwtDecode(data.token); // Extraer ID, Registro, Rol, etc.

            userRegistro.value = registro; // Guardar el registro para futuras consultas

            console.log('Login exitoso. Payload:', userPayload.value);

            // Iniciar la carga de datos del estudiante inmediatamente después del login exitoso
            await fetchStudentData();

            return true;
        } catch (error) {
            console.error("Error en el login:", error.message);
            // Limpiar estados en caso de fallo
            logout();
            throw error; // Propagar el error al componente para mostrar el mensaje
        } finally {
            isLoading.value = false;
        }
    };

    // ACCIÓN: Logout
    const logout = () => {
        authToken.value = null;
        userPayload.value = null;
        estudiante.value = null;
        localStorage.removeItem('user_token');
        // Redirigir al usuario (debería hacerse en el componente)
    };

    // Acción que realiza la consulta al backend (POST + GET/Polling)
    const fetchStudentData = async () => {
        if (!userRegistro.value) {
            console.error("ERROR FATAL: No hay registro de usuario para la consulta.");
            return;
        }

        isLoading.value = true;
        try {
            // --- PASO 1: POST para crear la tarea ---
            const postPayload = {
                "task": "get_estudiante_with_maestro_oferta",
                "data": { "registro": userPayload.value.registro },
                "callback": "http://localhost:5000/callback" // Aunque no lo usemos, es parte del flujo
            };

            console.log(postPayload)

            console.log(`[AUTH STORE] 1. Enviando POST a ${API_BASE_URL} con registro: ${userPayload.value.registro}`); // <-- LOG CLAVE

            /*const postResponse = await fetch(API_BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(postPayload)
            });*/
            const postResponse = await authFetch(API_BASE_URL, {
                method: 'POST',
                body: JSON.stringify(postPayload) // authFetch ya maneja Content-Type si hay body
            });

            if (!postResponse.ok) {
                const errorText = await postResponse.text();
                console.error(`[AUTH STORE] Error HTTP: ${postResponse.status}`, errorText); // <-- LOG CLAVE DE ERROR
                throw new Error(`Error al iniciar tarea. Código HTTP: ${postResponse.status}.`);
            }

            const postData = await postResponse.json();
            const shortId = postData.shortId;

            // --- PASO 2: Polling para esperar la respuesta ---
            console.log(`[AUTH STORE] 2. Tarea POST exitosa. shortId: ${shortId}. Iniciando Polling.`); // <-- LOG CLAVE
            const completeStudentData = await pollTaskStatus(shortId);

            // Actualizar el estado con la data COMPLETA recibida del backend
            estudiante.value = completeStudentData;

            console.log("Datos del estudiante cargados exitosamente.");

        } catch (error) {
            console.error("Error en la carga de datos del estudiante:", error.message);
            estudiante.value = null;
        } finally {
            isLoading.value = false;
        }
    };

    const setBoletaInscrita = (boletaData) => {
        if (estudiante.value) {
            // 1. Asignar la boleta inscrita
            estudiante.value.BoletaInscrita = boletaData;

            // 2. Eliminar la oferta académica para evitar que se muestre en otra vista
            // Asumiendo que 'maestroOferta' es el nombre de la propiedad
            if (estudiante.value.maestroOferta) {
                estudiante.value.maestroOferta = []; // o null
            }
        }
    };

    return {
        estudiante,
        userPayload,
        authToken,
        isAuthenticated,
        userRegistro,
        isLoading,
        login,
        logout,
        fetchStudentData,
        inscripcionResponse,
        setBoletaInscrita
    };
},
    {
        persist: {
            paths: ['authToken', 'userPayload'], // Solo persistir el token y el payload para mantener la sesión
            storage: localStorage,
        }
    }
);