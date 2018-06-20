
var Storage={
  load: function() {
      var str = localStorage.getItem("webcrawler");
      return JSON.parse(str);
  },
  save: function(obj) {
      var str = JSON.stringify(obj);
      localStorage.setItem("webcrawler", str);
  }
};

$(function(){

var crawl_server="172.16.65.110";

  //初期処理
  var val= Storage.load();
  if(val){
    if(val.run){
      $(":input[name=run]").prop('checked','checked');
      self.port.emit("proxy",  val.proxy);
    }
    $(":input[name=proxy]").val(val.proxy);
  }


  $('.proxy').autocomplete({
    source: function(param, result){

      $.get("http://"+crawl_server+"/tool/run_list", function(ret){
         var tmp=[];
         $.each(ret,function(){
          tmp.push({ label: this.project_name+"["+this.run_by+"] port="+this.proxy_port, value: crawl_server +':'+this.proxy_port });

         });
         result(tmp);
      });

    },
    minLength: 0
  }).focus(function() {
          $(this).autocomplete("search", "");
  });

  $(".save").click(function(){
    var val= Storage.load();
    var check = $(":input[name=run]").is(':checked');
    var proxy = $(":input[name=proxy]").val();
    Storage.save({ run: check,  proxy: proxy});
    self.port.emit("proxy",  check ? proxy : "");
    return false;
  });


});
