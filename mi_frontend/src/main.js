import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import piniaPluginPersistedState from 'pinia-plugin-persistedstate';
import { useAuthStore } from './stores/auth';

import 'bootswatch/dist/lux/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min';

const app = createApp(App)
const pinia = createPinia();

// 1. Instalar Pinia y el Plugin de Persistencia
pinia.use(piniaPluginPersistedState);
app.use(pinia);
app.use(router);

// 2. Esperar que el Router esté listo y Pinia Persist haya cargado el token.
router.isReady().then(() => {
    const store = useAuthStore();

    // Si la sesión existe (token cargado por persistencia) y los datos no han sido cargados:
    if (store.isAuthenticated && !store.estudiante) {
        console.log("Token persistente detectado. Rehidratando datos del estudiante...");

        // Cargar los datos protegidos
        store.fetchStudentData()
            .then(() => {
                console.log("Datos rehidratados exitosamente.");
            })
            .catch(error => {
                // Manejo de token expirado o inválido (401)
                const errorMessage = error.message || '';
                if (errorMessage.includes("401") || errorMessage.includes("expirada") || errorMessage.includes("autorizada")) {
                    console.warn("Token expirado o inválido. Cerrando sesión...");
                    store.logout();
                    router.push('/login');
                } else {
                    console.error("Error al rehidratar datos:", error);
                }
            });
    }

    // 3. Montar la aplicación SOLO después de que el check de sesión haya ocurrido.
    app.mount('#app');
});

/*

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import piniaPluginPersistedState from 'pinia-plugin-persistedstate'; // ¡Asegúrate de tenerlo importado!
import { useAuthStore } from './stores/auth'; // Importa el store

import 'bootswatch/dist/lux/bootstrap.min.css';

import 'bootstrap/dist/js/bootstrap.bundle.min';

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
*/