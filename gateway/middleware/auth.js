require('dotenv').config(); // Carga las variables de entorno
const jwt = require('jsonwebtoken');

// Obtener la clave secreta de las variables de entorno
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware para verificar si existe un token JWT válido.
 * Si es válido, adjunta el payload decodificado al objeto 'req' (req.user)
 */
const verifyToken = (req, res, next) => {
    // 1. Obtener el Token del header 'Authorization'
    const authHeader = req.headers['authorization'];
    // El token generalmente viene como 'Bearer <token>'
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        // No hay token, denegar acceso.
        return res.status(401).json({ message: 'Acceso denegado. No se proporcionó token.' });
    }

    // 2. Verificar el Token
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // El token no es válido o ha expirado.
            console.error('Error al verificar el token:', err.message);
            return res.status(403).json({ message: 'Token inválido o expirado.' });
        }

        // Token válido: adjuntar el payload del usuario a la solicitud
        req.user = user;
        next(); // Continuar con el siguiente middleware/ruta
    });
};


/**
 * Middleware para añadir la información del usuario (del token) como headers
 * a la solicitud antes de hacer el proxy. Esto permite que el microservicio
 * de destino sepa quién está haciendo la petición.
 */
const addUserHeader = (req, res, next) => {
    // Asumimos que verifyToken se ejecutó y adjuntó el usuario en req.user
    if (req.user) {
        // Ejemplo: Añadir el ID del usuario como un header X-User-ID
        // Asegúrate de que tu JWT tenga un 'id' en el payload.
        if (req.user.id) {
            req.headers['X-User-ID'] = req.user.id;
        }

        // Ejemplo opcional: Si manejas roles, puedes pasarlos
        if (req.user.role) {
            req.headers['X-User-Role'] = req.user.role;
        }
        
        // **IMPORTANTE**: Borrar el header 'Authorization' antes del proxy
        // para evitar que el token viaje innecesariamente.
        delete req.headers['authorization']; 
    }
    next();
};

module.exports = {
    verifyToken,
    addUserHeader
};