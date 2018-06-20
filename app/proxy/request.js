const path = require('path');
const url = require('url');
const fs = require("fs");
//const uuid = require("./uuid");
const events = require('events');
const db = require('../model/log');
const config = require('config');

const exclude_host = ".*"+config.excludeHost.join(".*|.*");
const exclude_ext =".*\\."+config.excludeExt.join("|.*\\.");


module.exports = {
  block:false,
  wait_stack:{},
  reg_ext: new RegExp(exclude_ext, "i"),
  reg_host: new RegExp(exclude_host, "i"),
  setExclude(obj){
    this.reg_ext=new RegExp(obj.excludeExt, "i");
    this.reg_host = new RegExp(obj.excludeHost, "i");
  },
  intercept: function(req_socket,res_socket,pre_callback,post_callback){
         const self=this;
         const obj = requestToObj(req_socket);
         //return sendRequest(obj,res_socket);
         //RegExpにgオプションはつけないこと
         //つける場合はregexp.lastIndex = 0で初期化する
         if(this.reg_ext.test(obj.pathname) || this.reg_host.test(obj.host) ||
            (obj.req_headers["accept"] && obj.req_headers["accept"].startsWith("image"))
          ){
            return sendRequest(obj,res_socket);
         }

        //request
        return getRequestBody(obj,req_socket)
              .then((obj)=>db.save(obj))
              .then((rec)=>{
                   var wait=new WaitRequest(rec,res_socket,post_callback);
                   if(self.block){
                     pre_callback(rec);
                     self.wait_stack[rec._id] = wait;
                     return null;
                   }else{
                     wait.send();
                   }
               })
               .catch(function(err){
                  console.log("intercept err "+err.stack);
                });
      }

};


function requestToObj(req){
  const urlObj = url.parse(req.full_url);
  return {state:0,
            start: db.getDateTime(),//yyyy/mm/dd hh:mi:ss
            url:req.full_url,
            host: urlObj.hostname ,
            protocol: urlObj.protocol,
            version:req.httpVersion,
            port: urlObj.port || (urlObj.protocol=="https:" ? 443 : 80),
            path: urlObj.path,
            pathname: urlObj.pathname,
            method: req.method,
            req_headers: req.headers,
            req_body: ""};
}

function getRequestBody(obj,soc){
  return new Promise(function(resolve,reject){
    var buf = new Buffer([]);
      //request
      soc.on('data',function(d){
               buf = Buffer.concat([buf, d]);
            });
      soc.on('end', function(){
               obj.req_body=buf.toString('base64');
               resolve(obj);
            });
      soc.on('error', function(e) {
        reject(e);
      });
  });
}




//本物のサーバへ送信
function sendRequest(rec,res_socket){
  return new Promise((resolve,reject)=>{
        var buf=new Buffer(0);
        //var proto = rec.protocol=="https:" ? (rec.version=="2.0" ? require('http2') : require('https')) : require('http');
        var proto = rec.protocol=="https:" ?  require('https') : require('http');
        var head = Object.assign({}, rec.req_headers);
        delete head["host"];
        delete head["accept-encoding"];//tlsの実装　bug????
        var options = {
           port: rec.port,
           hostname: rec.host,
           method: rec.method,
           path: rec.path,
           headers: head
         };
         var start=new Date().getTime();
        var send_req = proto.request(options, (res) => {

                     res.on('data',function(d){
                       buf = Buffer.concat([buf, d]);
                     });
                     res.on('end', function(){
                       if(!rec.res_byte) rec.res_byte = buf.length;
                       returnResponse(res_socket,{ code:rec.res_code,
                                                   headers:rec.res_headers,
                                                   body:buf,
                                                   url:rec.url
                                                 });
                       if(rec.res_log && buf.length>0 && rec._id){
                         fs.writeFile(path.join(__dirname,"../../data",rec._id),buf,(err)=>{});
                       }
                       resolve(rec);
                     });
                     res.on('error', (e) => {
                       returnResponse(res_socket,{ code:500,
                                                   headers:{"Content-Type": "text/plain"},
                                                   body:e.stack});
                       resolve(rec);
                     });
                     rec.res_code=res.statusCode;
                     rec.res_headers=res.headers;
                     rec.content_type=res.headers["content-type"];
                     rec.res_log = !(rec.content_type
                                    && rec.content_type.startsWith("image"));
                     rec.state=1;
                     rec.latency=new Date().getTime()-start;
                     if(res.headers["content-length"]) rec.res_byte= res.headers["content-length"];

        });

        send_req.on('error', (e) =>{
          rec.state=9;
          returnResponse(res_socket,{ code:500,
                                      headers:{"Content-Type": "text/plain"},
                                      body:e.stack});
          resolve(rec);
        });
        send_req.end(rec.req_body.length>0 ? Buffer.from(rec.req_body, 'base64') : "");
  });
}


//クライアントへ返信
function returnResponse(response,option){
  try{
    if(response.headersSent) return;
    //headerを取っ払って接続元にresposeを戻す
    var reject_header=["connection","transfer-encoding","keep-alive"];

    for(var i=0;i<reject_header.length;i++){
      if(option.headers[reject_header[i]])  delete option.headers[reject_header[i]];
    }

    response.writeHead(option.code,option.headers);
    response.end(option.body);

  }catch(e){
    console.log("Response Error Url:"+e.message+":"+option.url+"\n");
  }

}


//Wait本体
var WaitRequest = function(rec,res,callback){
     this.rec=rec;
     this.response=res;
     this.callback=callback;
};

//本物のサーバへ送信
WaitRequest.prototype.send =function(){
  return sendRequest(this.rec,this.response)
  .then((ret)=> db.save(ret))
  .then((obj)=>{
    this.callback(obj);
  });
}
