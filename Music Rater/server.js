const express = require('express')
const { engine } = require('express-handlebars')
const session = require('express-session')
const path = require('path')
const favicon = require('serve-favicon')
const logger = require('morgan')
const routes = require('./routes') 

const app = express()
const PORT = process.env.PORT || 3000

// View engine setup
app.engine('hbs', engine({ extname: '.hbs' }))
app.set('view engine', 'hbs')
app.set('views', path.join(__dirname, 'views'))


// Middleware
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))
app.use(logger('dev'))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// Session Setup
app.use(session({
  secret: 'secret',  
  resave: false,              
  saveUninitialized: true,   
  cookie: { secure: false }   
}));

// Routes
app.get('/', (request, response) => {
  if (request.session && request.session.user) {
    return response.redirect('/home')
  }
  response.render('login')
});

app.get('/signup', (request, response) => {
  if (request.session && request.session.user) {
    return response.redirect('/home')
  }
  response.render('signup')
});

app.get('/login', (request, response) => {
  if (request.session && request.session.user) {
    return response.redirect('/home')
  }
  response.render('login')
});

app.get('/home', routes.authenticate, (request, response) => {
  const isAdmin = request.session.user && request.session.user.role === 'admin';

  response.render('home', {
    user: request.session.user,
    isAdmin: isAdmin
  });
});

app.post('/login', routes.loginUser)
app.post('/signup', routes.signupUser)
app.post('/submitReview', routes.submitReview)
app.get('/search', routes.authenticate, routes.searchSong)
app.get('/song/:id', routes.authenticate, routes.songPage)
app.get('/admin/users', routes.viewUsers)


// 404 page
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found' })
})

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

