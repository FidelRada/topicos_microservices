var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var cors = require('cors');

const proxy = require('express-http-proxy');
const { verifyToken, addUserHeader } = require('./middleware/auth');
const authRouter = require('./routes/auth');

// Routers de la API
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(cors({
  origin: '*', // Permitir solicitudes desde cualquier origen
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use('/', indexRouter);  // codigo generado por express-generator
app.use('/users', usersRouter);// codigo generado por express-generator


//RUTAS de microservicios
const INSCRIPCION_SERVICE_URL = "http://app:3001"; // Cambiar localhost por el nombre del servicio

const INSCRIPCION_SERVICE_WORKER_MANAGER_URL = "http://app:3001/worker"; // Cambiar localhost por el nombre del servicio

const LOGIN_SERVICE_URL = "http://login:3002"; // Cambiar localhost por el nombre del servicio

app.use('/worker_manager', proxy(INSCRIPCION_SERVICE_URL, {
  // FORZAMOS al proxy a ir a /worker/manager, ignorando la ruta del Gateway.
  pathRewrite: {
    '^/worker_manager': '/worker', // <- Reemplaza el prefijo /worker_manager con /worker
  },
}), (req, res) => {
  console.log('Petición proxy a /worker_manager (PÚBLICA) -> Redirigiendo a http://app:3001/worker/manager');
});
// Rutas proxys para microservicios internos
app.use('/api/inscripcion', verifyToken, addUserHeader, proxy(INSCRIPCION_SERVICE_URL), (req, res) => {
  // Aquí puedes agregar lógica adicional si es necesario
  console.log('Petición proxy a /api/inscripcion');
});

// Esta ruta NO DEBE requerir autenticación previa.
app.use('/api/login', proxy(LOGIN_SERVICE_URL), (req, res) => {
  console.log('Petición proxy a /api/login');
});

app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
