/******************
node-forgeは遅すぎて使えない
pemはOpensslのラッパーなのでいまいちだけど
早いので使う
*******************************/
const fs = require('fs');
const pem = require('pem');
const path = require('path');
const windows = require('os').type().toString().match('Windows') !== null;
const openssl_bin = path.join(__dirname,'../../win/openssl/openssl.exe');
const openssl_conf = path.join(__dirname,'../../win/openssl/openssl.cfg');
const key_path = path.join(__dirname,"../../keypair/");

pem.config({
  pathOpenSSL: openssl_bin
});


const sig ={
  country:"JP",
  state:"Tokyo",
  locality:"Akasaka",
  organization:"MBSD",
  organizationUnit:"PS",
  emailAddress :"proxy@d.mbsd.jp",
};
const x509 ={
  serviceKey:fs.readFileSync('proxy.key'),
  serviceKeyPassword:"mbsd",
  serviceCertificate :fs.readFileSync('proxy.crt'),
  selfSigned:true,
  days:3650
};




var Obj = {cache:{}};

Obj.getSerial=function(){
  const seri = Math.floor((1 + Math.random()) * 0x100);
  const obj = Object.values(Obj.cache).find((d)=>d.serial===seri);
  return obj ? Obj.getSerial() : seri
}


Obj.save=function(common_name,key){
  const fold = path.join(__dirname,"../../keypair/",common_name);
  if(!fs.existsSync(fold))fs.mkdirSync(fold);
  fs.writeFile(path.join(fold,"cert"),JSON.stringify({key:key.key,cert:key.cert}),(e)=>{});
  //fs.writeFileSync(path.join(fold,'cert.crt'),key.cert);
  //fs.writeFileSync(path.join(fold,'cert.key'),key.key);
  Obj.cache[common_name] = key;
}



Obj.create=function(common_name){
  return new Promise((resolve,reject)=>{
        sig.commonName = common_name;
        sig.altNames=[common_name];
        pem.createCSR(sig, (err,signing_request)=>{
                    if(err){reject(err)}
                    else{
                      const tmp509 = Object.assign({}, x509);
                      tmp509.serial=Obj.getSerial();
                      tmp509.csr = signing_request.csr
                      tmp509.config = signing_request.config
                      tmp509.clientKey = signing_request.clientKey
                      pem.createCertificate(tmp509, function(err, keys){
                          if(err){reject(err)}
                          else{
                            Obj.save(common_name,{ca: x509.serviceCertificate,
                                                  key : keys.clientKey,
                                                  passphrase : x509.serviceKeyPassword,
                                                  cert : keys.certificate});
                            resolve(keys.certificate);
                          }
                      });
                    }
           });
   });
}


Obj.key_pair=function(common_name){
  const key = Obj.cache[common_name];
  if(key) return Promise.resolve(key);
  const c_path = path.join(key_path,common_name,'cert');
  if(fs.existsSync(c_path)){
    const tmp = JSON.parse(fs.readFileSync(c_path));
    Obj.cache[common_name] = {ca: x509.serviceCertificate,key : tmp.key,
                              passphrase : x509.serviceKeyPassword,cert : tmp.cert}
  }else{
    Obj.cache[common_name] = Obj.create(common_name);
  }
  return Promise.resolve(Obj.cache[common_name]);
};

module.exports = Obj;

//起動時にロード
