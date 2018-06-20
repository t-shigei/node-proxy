const fs = require('fs');
const tls = require('tls');
const path = require('path');
const pem = require('./keypair');
const request = require('./request');
const windows = require('os').type().toString().match('Windows') !== null;




process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

//winのnamed　pipeはなぜかエラー
//var sslserver_port = windows ? "\\\\.\\pipe\\mbsd_proxy" : "/var/run/mbsd_proxy.sock";
const sslserver_port = windows ? "0" : "/var/run/mbsd_proxy.sock";

if(!windows){
  try{fs.unlinkSync(sslserver_port)}catch(e){}
}

const Obj = function(req_callback,res_callback){
  this.req_callback = req_callback;
  this.res_callback = res_callback;
};

Obj.prototype.start = function(){
  const self = this;
  const options = {
      SNICallback: function (domain, cb) {
          pem.key_pair(domain).then(function(keys){
            var ctx = tls.createSecureContext(keys);
            cb(null, ctx);
          }).catch((e)=>{
            console.log(domain+":"+e.message);
          });
        },
          key: fs.readFileSync("proxy.key"),
          cert: fs.readFileSync("proxy.crt"),
          ca: fs.readFileSync("proxy.crt"),
          passphrase:"mbsd"
      };
     this.server = require('https').createServer(options,(req,res)=>{
       req.on("error",(e)=>console.log("http2 req error:"+e.stack));
       res.on("error",(e)=>console.log("http2 res error:"+e.stack));
                         req.full_url = "https://" + req.headers.host+req.url;
                         request.intercept(req,res,self.req_callback,self.res_callback);
                      }
     ).listen(sslserver_port);
     this.port = this.server.address().port;
     this.server.on("error",(e)=>console.log("http2 server error:"+e.stack));
}
Obj.prototype.stop = function(){
  this.server.close();
}

module.exports = Obj;
