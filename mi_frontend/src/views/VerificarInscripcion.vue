<template>
    <div class="container py-4">
        <button class="btn btn-lg btn-primary" type="button" @click="verificarInscripcion" :disabled="isLoading">
            <span v-if="isLoading" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
            Verificar Inscripción
        </button>
        <br><br>
        <div v-if="statusMessage.message" class="card text-white mb-3" :class="statusMessage.class"
            style="max-width: 25rem;">
            <div class="card-header fw-bold">{{ statusMessage.header }}</div>
            <div class="card-body">
                <p class="card-text">{{ statusMessage.message }}</p>
                <p v-if="statusMessage.countdown > 0" class="small mt-2">
                    Redireccionando en {{ statusMessage.countdown }} segundos...
                </p>
            </div>
        </div>
    </div>

</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
//import router from '@/router';

const url_inscripcion_task = import.meta.env.VITE_API_INSCRIPCION_TASK_URL;
const url_inscripcion_get_task = import.meta.env.VITE_API_GET_RESULTADO_TAREA_URL;

const router = useRouter();

const authStore = useAuthStore();
// Asegúrate de que tu store exporte inscripcionResponse
const { estudiante, isLoading, userRegistro, inscripcionResponse } = storeToRefs(authStore);

// ESTADO REACTIVO PARA EL MENSAJE DE ESTADO Y REDIRECCIÓN
const statusMessage = ref({
    header: '',
    message: '',
    class: 'bg-primary', // Clase por defecto de Bootstrap
    countdown: 0,
    targetRoute: null // Ruta a la que se debe redireccionar
});

// Función para iniciar la cuenta regresiva y redireccionar
const startRedirect = (targetRoute, delaySeconds = 5) => {
    statusMessage.value.countdown = delaySeconds;
    statusMessage.value.targetRoute = targetRoute;

    let timer = setInterval(() => {
        statusMessage.value.countdown--;
        if (statusMessage.value.countdown <= 0) {
            clearInterval(timer);
            router.push(targetRoute);
        }
    }, 1000);
};

onMounted(async () => {
    console.log("VerificarInscripcion Montado.");
    console.log("Usuario Registro:", authStore.userRegistro);
    console.log("Estudiante:", authStore.estudiante);
    console.log("Inscripcion Resultado:", authStore.inscripcionResponse);
    console.log("isLoading:", authStore.isLoading);

    if (!authStore.isAuthenticated) {
        // Usar isAuthenticated para verificar rápidamente la sesión
        statusMessage.value = {
            header: '⚠️ Sesión Terminada',
            message: 'Por favor, inicie sesión antes de verificar la inscripción.',
            class: 'bg-danger'
        };
        startRedirect('/login');
        return;
    }
    /*
        if (!authStore.userRegistro && !authStore.estudiante) {
            console.log("VerificarInscripcion: Usuario no registrado.");
            // Redirigir a la página de registro o mostrar un mensaje
            statusMessage.value = {
                header: '⚠️ secion terminada',
                message: 'Por favor, incie secion antes de verificar la inscripción.',
                class: 'bg-danger'
            };
            startRedirect('/login');
            return;
        }
            */
    // Aquí podrías desencadenar una verificación automática si hay un resultado de inscripción previo
    if (authStore.inscripcionResponse && authStore.inscripcionResponse.shortId) {
        console.log("Resultado de inscripción previo encontrado, iniciando verificación automática...");
        // Pequeño retraso para que el usuario vea la pantalla
        setTimeout(verificarInscripcion, 500);
    }

});

// FUNCIÓN DE AYUDA PARA REALIZAR PETICIONES CON AUTORIZACIÓN
const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('user_token');

    if (!token) {
        // Si el token no está, lanzamos un error que será capturado abajo
        throw new Error("No autenticado. Token no encontrado.");
    }

    const authHeaders = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
    };

    // Aseguramos Content-Type si es necesario
    if (!authHeaders['Content-Type']) {
        authHeaders['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, { ...options, headers: authHeaders });

    // Manejo explícito de error 401/403
    if (response.status === 401 || response.status === 403) {
        authStore.logout();
        router.push('/login');
        // Lanzamos un error especial para detener el flujo
        throw new Error("Sesión expirada o no autorizada. Redireccionando al login.");
    }

    return response;
};

// Función que se ejecuta al hacer click
const verificarInscripcion = async () => {
    // 1. Limpiar mensaje anterior al iniciar una nueva verificación
    statusMessage.value = { header: '', message: '', class: 'bg-primary', countdown: 0, targetRoute: null };

    // 2. Verificaciones de Datos

    const estudiante = authStore.estudiante.estudiante;
    //console.log(estudiante)

    if (!authStore.isAuthenticated) {
        statusMessage.value = {
            header: '⚠️ Error de Sesión',
            message: 'No autenticado. Vuelve a iniciar sesión.',
            class: 'bg-danger'
        };
        startRedirect('/login');
        return;
    }
    
    const shortId = authStore.inscripcionResponse.shortId;
    const studentId = authStore.estudiante.id;

    if (!shortId) {
        statusMessage.value = {
            header: '⚠️ Sin Inscripción Previa',
            message: 'No hay una inscripción previa para verificar. Redireccionando a Inscripción.',
            class: 'bg-warning'
        };
        startRedirect('/inscripcion'); // La ruta correcta es /inscripcion
        return;
    }
    /*
    if (!estudiante || !estudiante.id) {
        statusMessage.value = {
            header: '⚠️ Error de Sesión',
            message: 'Los datos del estudiante no han sido cargados. Vuelve a Home o inicia sesión.',
            class: 'bg-danger'
        };
        return;
    }

    // Usar la propiedad 'inscripcionResponse' del store
    if (!authStore.inscripcionResponse || !authStore.inscripcionResponse.shortId) {
        statusMessage.value = {
            header: '⚠️ Sin Inscripción Previa',
            message: 'No hay una inscripción previa para verificar. Redireccionando a Inscripción en 5 segundos.',
            class: 'bg-warning'
        };
        startRedirect('/inscripcionMateria');
        return;
    }
*/
    // 3. Preparar la Petición

    // Mostrar estado de carga (Info)
    statusMessage.value = {
        header: '⏳ Verificando Estado',
        message: `Consultando estado de la tarea #${shortId} para el estudiante ${studentId}.`,
        class: 'bg-info'
    };

    try {
        const urlStatus = `${url_inscripcion_task}/${shortId}`; // Usar la URL de la variable de entorno
        console.log(`[VERIFICAR] 1. Consultando estado: ${urlStatus}`);

        const statusTask = await authFetch(urlStatus, {
            method: 'GET',
            // headers: { 'Content-Type': 'application/json' },
        });

        if (!statusTask.ok) {
            const errorText = await statusTask.text();
            throw new Error(`Error al consultar el estado de la tarea: ${errorText}`);
        }

        const statusTaskJson = await statusTask.json();
        const estado = statusTaskJson.estado;

        console.log('Respuesta de estado de la tarea:', estado);

        // 4. Lógica de Estados y Redirección
        if (estado == "waiting" || estado == "active") {

            console.log('Respuesta de estado de la tarea: esperando');
            statusMessage.value = {
                header: '⏳ En Proceso',
                message: `La inscripción está siendo procesada (Estado: ${estado}). Se recomienda esperar unos minutos.`,
                class: 'bg-warning'
            };
            startRedirect('/home');
        } else if (estado == "completed") {

            console.log('Respuesta de estado de la tarea: completada');

            const resultUrl = `${url_inscripcion_get_task}/${shortId}`;
            console.log("[VERIFICAR] 2. Obteniendo resultado final:", resultUrl);

            const resultResponse = await authFetch(resultUrl, {
                method: 'GET',
                // headers: { 'Content-Type': 'application/json' },
            });

            if (!resultResponse.ok) {
                // Si falla la obtención del resultado, asumimos que no hay datos para actualizar
                console.error("No se pudo obtener el resultado detallado, procediendo a redirección.");
                statusMessage.value = {
                    header: '⚠️ Datos Incompletos',
                    message: 'La tarea finalizó, pero no se pudo obtener el resultado. Intente más tarde.',
                    class: 'bg-warning'
                };
            } else {
                const resultJson = await resultResponse.json();

                // Asegúrate de que la ruta sea correcta: job -> returnvalue -> result -> BoletaInscrita
                const boletaData = resultJson?.job?.returnvalue?.result?.BoletaInscrita;

                if (boletaData) {
                    // 🚀 PASO 2: Actualizar el store llamando a la acción
                    // Esta acción debe existir en tu useAuthStore
                    authStore.setBoletaInscrita(boletaData);
                    console.log('✅ Store de estudiante actualizado con nueva BoletaInscrita.');
                }
            }

            statusMessage.value = {
                header: '✅ Éxito',
                message: 'La inscripción ha sido procesada con éxito. Redireccionando a su Boleta.',
                class: 'bg-success'
            };
            // Opcional: Limpiar el resultado temporal después del éxito

            startRedirect('/Boleta');
        } else if (estado == "failed") {

            console.log('Respuesta de estado de la tarea: fallida');
            statusMessage.value = {
                header: '❌ Fallo',
                message: `La tarea de inscripción falló. Razón: ${statusTaskJson.job.failedReason || 'Desconocida'}`,
                class: 'bg-danger'
            };
        } else {

            console.log('Respuesta de estado de la tarea: desconocida');
            statusMessage.value = {
                header: '❓ Estado Desconocido',
                message: `El estado retornado (${estado}) no es reconocido. Consulte con administración.`,
                class: 'bg-secondary'
            };
        }

    } catch (error) {
        console.error('Error durante la verificación:', error);
        statusMessage.value = {
            header: '❌ Error de Conexión',
            message: 'No se pudo conectar con el servidor de tareas para verificar el estado.',
            class: 'bg-danger'
        };
    }
};

</script>