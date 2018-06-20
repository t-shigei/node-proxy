const Datastore = require('nedb');
const Valid = new require('jsonschema').Validator;
const path = require('path');

const db_path = path.join(__dirname,'../../data/log.db');
const store = new Datastore({ filename: db_path, autoload: true });
const validator = new Valid();
validator.attributes.notnull = function(instance, schema, options, ctx) {
  const data = (typeof instance=='boolean') ? instance.toString() : instance ;
  if(!data || data===""){
    return ctx.propertyPath+'は必須項目です';
  }
}


const Db = function(){};

Db.schema =
{
  type:"object",
  properties: {
    //uuid: { type: "string",notnull:true},
    state: { type: "integer",notnull:true },//wait=0 finish=1 err=9
    start: { type: "string",notnull:true },//yyyy/mm/dd hh:mi:ss
    host: { type: "string",notnull:true },
    protocol: { type: "string",notnull:true},
    version: { type: "string",notnull:true},
    port: { type: "string",notnull:true},
    path: { type: "string",notnull:true},
    pathname: { type: "string",notnull:true},
    method: { type: "string",notnull:true},
    req_headers: { type: "object"},
    req_body:{ type: "string"},
    res_code:{ type: "string"},//response
    res_headers:{ type: "object"},//response
    content_type:{ type: "string"},//response
    res_byte:{ type: "integer"},//response
    res_log:{ type: "boolean"},//log file
    latency:{ type: "integer"}
  },
};

Db.findAll=function(){
  return new Promise((res,rej)=> store.find({},(err,docs)=> {
    return err ? rej(err) : res(docs);
  }));
};

Db.findById=function(id){
  return new Promise((res,rej)=> store.findOne({_id:id},(err,doc)=> {
    return err ? rej(err) : res(doc);
  }));
};

Db.remove=function(where){
  return new Promise((res,rej)=> store.remove(where,{ multi: true },(err,num)=> {
    return err ? rej(err) : res(num);
  }));
};
Db.clearStatus=function(){
  return new Promise((res,rej)=> store.update({state:0},{$set:{state:9}},{ multi: true },(err,num)=> {
    return err ? rej(err) : res(num);
  }));
};
Db.save=function(doc){
  const ret = validator.validate(doc, this.schema);
  if(ret.valid) return Promise.reject(ret.errors);

  return new Promise((res,rej)=> store.update({_id:doc._id},doc,
                   { multi:false, upsert: true,returnUpdatedDocs:true },(err, numAffected, affectedDocuments, upsert)=> {
    return err ? rej(err) : res(affectedDocuments);
  }));
};

Db.getDateTime = function() {
  const date = new Date();
  const y = date.getFullYear();
  const m = ('0' + (date.getMonth() + 1)).slice(-2);
  const d = ('0' + date.getDate()).slice(-2);
  const h = ('0' + date.getHours()).slice(-2);
  const mi = ('0' + date.getMinutes()).slice(-2);
  const s = ('0' + date.getSeconds()).slice(-2);
  return `${y}/${m}/${d} ${h}:${mi}:${s}`;
};


module.exports =Db;
