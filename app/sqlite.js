
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('db.sqlite3');

var sqlite = function(app,http) {
  var socket = require('socket.io')(http, { path: '/sql'});

  socket.on('connection', function(client) {


    client.on('exec', function(data) {
      db.all(data.sql,function(err, rows){
        client.emit('result',{err: err ? err.message : null,
                              token:data.token,
                              sql:data.sql,
                              result:rows});
      });
    });
    client.on('disconnect', function() {
    });
  });

  app.get('/sqlite/', function(req, res){
    var datapath = require("path").join(__dirname,'../db.sqlite3');
    res.render_layout('sql.html',{datapath:datapath});
  });



}

module.exports = sqlite;


/*
var obj = new Object();
obj.select = function(sql,callback){
  db.serialize(function(){
      db.all(sql,function(err, rows){
        if(err) console.log(err);
        callback(rows);
      });
  });
  //db.close();
}
obj.insert = function(sql,param){
  db.serialize(function(){
      db.run(sql, param,function(err) {
        if(err) console.log(err);
      });
  });
  //db.close();
}
obj.update = function(sql,param){
  db.serialize(function(){
      db.run(sql, param,function(err) {
        if(err) console.log(err);
      });
  });
  //db.close();
}

obj.create = function(sql){
  db.serialize(function(){
      db.run(sql,function(err) {
        if(err) console.log(err);
      });
  });
  //db.close();
}
module.exports = obj;
*/
