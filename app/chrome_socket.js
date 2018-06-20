const URL = require('url');
const cookieParser = require('cookie-parser');
const CDP = require('chrome-remote-interface');
const spawn = require('child_process').spawn;
const path = require('path');
const beautify = require('js-beautify').html;
const config = require('config');
const url = require('url');
const zlib = require('zlib');
var MyProxy = null;

const socio = function(socket) {
  socket.on('connection', (client) =>{
    //Browser起動
    client.on('browser', (data) =>{
      //process.env.ProgramFiles
      const p = spawn( path.join(process.env["ProgramFiles(x86)"],"\\Google\\Chrome\\Application","chrome.exe"),
       [
         "http://localhost:"+config.listenPort+"/help.html",
          "--load-extension="+path.join(__dirname,'../public/extension/chrome/'),
          "--user-data-dir="+path.join(__dirname,'../chrome_profile'),
          "--remote-debugging-port=9222"
       ], {
        detached: true,
        stdio: ['ignore']
      });
      p.unref();
    });
    //リモートインスタンス取得
    function getRemoteBrowser(){
      return new Promise((resolve,reject)=>{
        CDP({host:"localhost",port: 9222},(browser)=>{
            resolve(browser);
        }).on('error', (err) => {
          reject(err);
        });
      });
    }
    //Proxy設定
    client.on('set_proxy', (data) =>{
      MyProxy = data.proxy ? {host:"localhost",port:data.port} : null;
      getRemoteBrowser().then((brw)=>{
          const {DOM, Network, Page, Runtime, Console} = brw;
          var expre =`
            window.postMessage({id:"mbsd",run:${data.proxy},proxy:"localhost:${data.port}"}, "*");
           `;
           return Runtime.evaluate({expression:expre});
       }).catch((e)=>{
         client.emit('response',{err:e.message});
       });
    });
    //コンテンツ書き換え
    client.on('rewrite', (data) =>{
      data.html
      getRemoteBrowser().then((brw)=>{
         const {DOM, Network, Page, Runtime, Console} = brw;
         return Page.setDocumentContent(data);
       }).catch((e)=>{
         client.emit('response',{err:e.message});
       });
    });

    //JS実行
    client.on('run_js', (data) =>{
      getRemoteBrowser()
      .then((brw)=>{
        const {DOM, Network, Page, Runtime, Console} = brw;
        return Runtime.evaluate({expression: data.js,
                                 returnByValue: true,
                                 includeCommandLineAPI:true,
                                 userGesture:true});
      }).then((ret)=>{
        if(ret.result.type==="object"){
          const msg = ret.result.subtype==="error" ? ret.result.description :
                                                       JSON.stringify(ret.result.value,null,'\t')
          client.emit('js_response',{result: msg});
        }else{
          client.emit('js_response',{result:ret.result.value});
        }
      }).catch((e)=>{
        client.emit('response',{err:e.message});
      });
    });

    //ナビゲート
    client.on('navigate', (data)=>{

        const tmp = data.headers.split("\n\n");
        data.headers = tmp[0].split("\n").reduce((ret,hd)=>{
                                              const key = hd.substr(0,hd.indexOf(':')).replace(/^\s+|\s+$/g, '');
                                              const val = hd.substr(hd.indexOf(':')+1).replace(/^\s+|\s+$/g, '');
                                              if(key!=="") ret[key]=val;
                                              return ret;
                                            },{});
        data.body = tmp.length>1 ? tmp[1] : "";
        getRemoteBrowser().then((browser)=>{
          navigate(browser,data,(ret)=>{
            client.emit('response',ret);
          });
        }).catch((err) => {
          client.emit('response',{err: err.message});
        });
    });




  });
};



function navigate(browser,data,callback){
  //var save_id =null;

  data.url = URL.parse(data.url).href;
  const {DOM, Network, Page, Runtime, Console,Log} = browser;
  const ret = {head:null,body:"",frameId:null,err:null};
  Network.setRequestInterceptionEnabled({enabled: true});
  Network.requestIntercepted()
  .then((param)=>{
    if(param.request.url==data.url){
      //なぜかここでheader書き換えできないので
      //自力で取得
      return getResponse(data).then((res)=>{

                ////????Set Cookieは自分で
                setCookie(Network,res.headers,data.url);
                var head = "HTTP/1.1 "+res.statusCode+" "+res.statusMessage+"\r\n";
                for(var k in res.headers){
                  head+=k+":"+res.headers[k]+"\r\n";
                }
                head+="\r\n";
                ret.head = head;
                return Network.continueInterceptedRequest({
                  interceptionId:param.interceptionId,
                  rawResponse: res.err ? new Buffer("HTTP/1.1 500 Error\r\n\r\n"+res.err).toString("base64") :
                                         new Buffer(head+res.raw).toString('base64'),
                });
              });
    }else{
      return Network.continueInterceptedRequest({interceptionId:intercept.interceptionId});
    }
  }).catch((e)=>{
    callback({err:e.message});
  });;

  //////////////
  //コンテンツ取得 requestIdを保持
  Network.requestWillBeSent((param) => {
    if(param.request.url==data.url){
      ret.requestId = param.requestId;
      ret.frameId = param.frameId;
    }
  });
  //getResponseでとってきてもいいけど  ここでコンテンツ取得 REDIRECT後の結果が入るので画面表示と同一になる
  Network.loadingFinished((param) => {
        if (ret.requestId === param.requestId) {
          Network.getResponseBody({requestId:param.requestId},(st,body)=>{
            if(st){
              ret.err = body ? body.message : "";
            }else{
              ret.body=ret.head+beautify(body ? body.body : "");
            }
            browser.close();
            callback(ret);
           });
        }
  });
  ////////////////////



  Promise.all([
      Network.enable(),
      Page.enable(),
      Console.enable()
  ]).then(() => {
    return Page.navigate({url: data.url});
  //}).then(()=>{
       //return Console.messageAdded(({entry}) => {
      //     console.log(entry);
      // });
     //Page.domContentEventFired();
      //browser.close();
  }).catch((err) => {
      browser.close();
      ret.err=err.message;
      callback(ret);
  });
}

function getResponse(param,callback){
  const urlObj = url.parse(param.url);
  const proto = urlObj.protocol=="http:" || MyProxy ?  require('http') : require('https');

  const options = {
     port: MyProxy ? MyProxy.port : urlObj.port,
     hostname: MyProxy ? MyProxy.host : urlObj.hostname,
     method: MyProxy && proto==="https:" ? "CONNECT" : param.method,
     path: MyProxy ? param.url :  urlObj.path,
     headers: param.headers
   };
   return new Promise((resolve,reject)=>{

     proto.request(options, (res) => {

                  var buf = new Buffer("");
                  var output;
                  if( res.headers['content-encoding'] == 'gzip' ) {
                    var gzip = zlib.createGunzip();
                    res.pipe(gzip);
                    output = gzip;
                  }else if( res.headers['content-encoding'] == 'deflate' ) {
                    var inf = zlib.createInflate();
                    res.pipe(inf);
                    output = inf;
                  } else {
                    output = res;
                  }
                  output.on('data',function(d){
                    buf = Buffer.concat([buf, d]);
                  });
                  output.on('end', function(){
                    resolve({headers:res.headers,
                            statusCode:res.statusCode,
                            statusMessage:res.statusMessage,raw:buf.toString()});
                  });
                  output.on('error', (e) => {
                    reject(e);
                  });
     }).on('error', (e) =>{
       reject(e);
     }).end(param.body);
   });

}

function setCookie(Network,header,url){
  if (header["set-cookie"]) {
      header["set-cookie"].forEach((ck)=>{
              const tmp = ck.split(";");
              var kv = tmp[0].split("=");
              const obj ={name:kv[0],value:kv[1],url:url};
              for(var i=1;i<tmp.length;i++){
                const tmp2 = tmp[i].split("=");
                obj[tmp2[0].trim()]= tmp2.length>1 ? tmp2[1] : true;
              }
              Network.setCookie(obj);
      });
  }
}

module.exports = socio;
