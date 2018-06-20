
const fs = require('fs');
const url = require('url');
const net = require('net');
const events = require('events');
const request = require('./request');
const Sslserver = require('./https_server');



const Proxy = function(){
  this.port="";
  var self = this;
  this.PreRequest=function(rec){
      self.emit('PreRequest',rec);
   };
  this.PostResponse=function(rec){
     self.emit('PostResponse',rec);
  };
  //https server
  this.ssl_server = new Sslserver(this.PreRequest,this.PostResponse);

};
Proxy.prototype = new events.EventEmitter();


Proxy.prototype.start=function(port){
   this.port=port;
   var self = this;
   if(!this.server){
     this.ssl_server.start();
     this.server = require('http').createServer(function(req,res){
                     req.full_url=req.url;
                     request.intercept(req,res,self.PreRequest,self.PostResponse);
                   }).listen(port);
     this.sslTransfer(this.server);
   }
}
Proxy.prototype.isActive=function(){
  return this.server ? true: false;
}

Proxy.prototype.stop=function(){
  if(this.server){
    this.server.close();
    this.server=null;
    this.ssl_server.stop();
  }
}


Proxy.prototype.sslTransfer=function(server){
    //https転送 Connectメソッド
    const self = this;
    server.on('connect', function onCliConn(req, res, head) {

        const sslsock = net.connect(self.ssl_server.port, ()=>{
            res.write('HTTP/1.0 200 Connection established\r\n\r\n');
            sslsock.write(head);
            res.pipe(sslsock);
            sslsock.pipe(res);
        });
        res.on("error",(e)=>{
          //虫
          //console.log("tran res:"+e.stack)
        });
        sslsock.on("error",(e)=>console.log("tran sock:"+e.stack));
    });
}

Proxy.prototype.waitRequest = function(){
  　const ret=[];
  　for(var i=0;i<request.wait_stack.length;i++) ret.push(request.wait_stack[i]);
  　//Object.values()だとエラーが発生する場合があるので使わない
    return ret;
}

Proxy.prototype.resume = function(){
    for(var key in request.wait_stack) {
      request.wait_stack[key].send();
      delete request.wait_stack[key];
    }
}
Proxy.prototype.block = function(b){
  if(b=== undefined){
    return request.block;
  }else{
    request.block=b;
  }
}

module.exports = Proxy;
