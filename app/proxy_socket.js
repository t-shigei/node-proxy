const zlib = require('zlib');
const fs = require('fs');
const iconv = require('iconv-lite');
const path = require('path');
const db = require('./model/log');
const Proxy = require('./proxy/proxy');

const proxy = new Proxy();


const socio = function(socket) {


  socket.on('connection', (client) =>{

    function sendState(){
      client.emit('state',{block:proxy.block(),
                           port:proxy.port,
                           isActive:proxy.isActive()});
    }

    function sendAll(){
      db.findAll().then((docs)=>{
        client.emit('data',docs.map((d)=>{
                              if(d["port"]!=80 && d["port"]!=443) d["host"] +=":"+d["port"]
                              delete d["req_body"];
                              delete d["req_headers"];
                              delete d["res_headers"];
                              return d;
                          })
                   );
      });
    }



    client.on('init', (d)=>{
      const st = state_save({});
      if(st.active){
        proxy.start(st.port);
        proxy.block(st.block);
      }
      sendState();
      sendAll();
    });

    client.on('start', (d)=>{
      state_save({port: d.port,block: d.block,active: true});
      proxy.start(d.port);
      proxy.block(d.block);
      sendState();
    });

    client.on('stop', (message)=>{
      //前回の中断リクエストをクリア
      state_save({active: false});
      db.clearStatus();
      proxy.stop();
      sendState();
    });



    client.on('resume', (message)=> {
      proxy.resume();
    });

    client.on('block', (flag) =>{
      proxy.block(flag);
    });
    client.on('clear', () =>{
      db.findAll().then((docs)=>{
        docs.forEach((d)=>{
          fs.unlink(path.join(__dirname,"../data",d._id),(err)=>{});
        });
      });

      db.remove({state:{$ne:0}}).then(()=>{
        sendAll();
      });
    });




    client.on("response",(id)=>{

      const log=path.join(__dirname,'../data',id);
      db.findById(id).then((doc)=>{
            const gzip = doc.res_headers && doc.res_headers['content-encoding']==="gzip";
            return getLog(log,gzip).then((data)=>{
                       return {doc:doc,data:data};
                     });
        })
        .then((ret)=>{
          const obj ={req:"",res:""};
          for(var k in ret.doc.req_headers){
            obj.req+=k+":"+ret.doc.req_headers[k]+"\n";
          };
          obj.req += "\n\n" + Buffer.from(ret.doc.req_body, 'base64').toString();

          if(ret.doc.res_headers){
            for(var k in ret.doc.res_headers){
              obj.res+=k+":"+ret.doc.res_headers[k]+"\n";
            };
            obj.res += "\n\n" + encLog(ret.data,ret.doc.res_headers);

            if(obj.res.length>100000)  obj.res = obj.res.slice(0,100000)+"\n\n!!!!!!以下のコンテンツは長ったらしいのでカット!!!!\n\n";
          }

          client.emit('response',obj);
        }).catch((e)=>console.log(e.stack));
    });

    proxy.on("PreRequest",(rec)=>{
      client.emit('update',rec);
    });

    proxy.on("PostResponse",(rec)=>{
      client.emit('update',rec);
    });

    client.on('disconnect', () => {
    });

    function encLog(log,headers){
      const ctype = headers['content-type'];
      const tmp = ctype || log.toString();
      const mch = tmp.match(/charset=(.*?)["'\s]/im);
      return iconv.decode(log, mch ? mch[1] : "utf8");

    }


    function getLog(log,gzip){
      return new Promise((resolve,reject)=>{
        if(!fs.existsSync(log)) return resolve("");
        var buf = fs.readFileSync(log);
        if(gzip){
          zlib.gunzip(buf,(err, binary)=>{
             resolve(err ? err.message : binary);
           });
        }else{
          resolve(buf);
        }
      });
    }

    function state_save(obj){
      const p = path.join(__dirname,"status.json");
      var tmp = {port:"8888",block: false,active: false};
      if(fs.existsSync(p)){
        tmp = JSON.parse(fs.readFileSync(p));
        Object.assign(tmp, obj);
      }else{
        Object.assign(tmp,obj);
      }
      fs.writeFileSync(p,JSON.stringify(tmp));
      return tmp;
    }


  });
};

module.exports = socio;
