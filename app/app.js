const express = require('express');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const app = express();
const server = require('http').Server(app);
const config = require('config');
//const logger = require('morgan');
//app.use(logger('log'));

app.set('view engine','ejs');
app.set('views',path.join(__dirname,'views'));
app.engine('html', ejs.renderFile);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
//static
app.use(express.static('public'));

app.use("/proxy.crt",express.static('proxy.crt'));

process.on('unhandledRejection', function (err, p) {
    console.log(p);
    console.log("Promiseのcatch忘れエラーです\nunhandledRejection:"+err.message);
    console.log(err.stack);
});

process.on('uncaughtException', function (err) {
  console.log("致命的なエラーです(uncaughtException):"+err.message);
  console.log(err.stack);
});


//WebSocket
const socket = require('socket.io')(server, { path: '/exec'});
require('./proxy_socket')(socket);

//前回の中断リクエストをクリア
require('./model/log').clearStatus();
/*Top画面*/
app.get('/', function(req, res){
  res.render('layout.html',{contents : 'proxy.html'});
});

app.get('/chrome', function(req, res){
  res.render('layout.html',{contents : 'chrome.html'});
});
require('./chrome_socket')(socket);



/*Sqlite画面*/
//app.use('/project', require('./sqlite'));


/// catch 404 and forward to error handler
app.use((req, res, next) =>
          res.type('txt').status(404).send('Page not Found') );
/// 500 error
app.use((err, req, res, next) =>{
  if (res.headersSent) {
    return next(err);
  }
  res.type('txt').status(500).send(err.message+"\n"+err.stack);
});

server.listen(config.listenPort);
