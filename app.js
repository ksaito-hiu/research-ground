const express = require('express');
const session = require('express-session');
const config = require('./config.json');
const auth = require('./auth');
const files_app = require('./files_app');

const app = express();

app.set('view engine','ejs');
app.set('views','./views');

app.use(session({
    secret: 'some secret string',
    resave: false,
    saveUninitialized: false,
    httpOnly: true,
    secure: true,
    cookie: { maxAge: 30*60*1000 }
}));

app.use('/auth',auth);

app.use('/files',files_app);

app.get('/', (req, res) => {
    let str;
    if (!!req.session && !!req.session.webid) {
        str = `You are logged in as ${req.session.webid}.`;
    } else {
        str = 'You are not logged in.';
    }
    res.render('index.ejs',{msg:str});
});

const server = app.listen(config.server.port,()=>{console.log(`research-ground started. port=${config.server.port}.`)});
