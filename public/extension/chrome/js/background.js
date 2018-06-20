/*��������*/
chrome.browserAction.setBadgeText({ text: "off" });
chrome.browserAction.setBadgeBackgroundColor({ color: "blue" });
 /*
    var config = {
       mode: "fixed_servers",
       rules: {
         singleProxy: {
           host: "localhost",
           port: "8888"
         },
         bypassList: []
       }
     };
     chrome.proxy.settings.set({value: config, scope: 'regular'},function() {});
 */
var Storage={
		  load: function() {
		      var str = localStorage.getItem("proxy_setting");
		      if(!str) str = '{"proxy":"localhost:8888","except":"*"}';
		      return JSON.parse(str);
		  },
		  save: function(data) {
		      var tmp = this.load();
		      tmp.run = data.run;
		      if(data.proxy) tmp.proxy = data.proxy;
		      if(data.except) tmp.except = data.except;
		      localStorage.setItem("proxy_setting", JSON.stringify(tmp));
		  }
		};
var proxy_switch ={
  on:function(proxy,except){
    var config = {
       mode: "pac_script",
       pacScript: {
         data: "function FindProxyForURL(url, host) {\n" +
               " var target = ["+ "'" + except.join("','") + "'"+"];\n" +
               " for (var i = 0;  i < target.length; i++){\n" +
               "     if(shExpMatch(host,target[i])) return 'PROXY "+proxy+"';\n" +
               " };\n" +
               " return 'DIRECT';\n" +
               "}"
       }
     };
     chrome.proxy.settings.set({value: config, scope: 'regular'}, function() {});
     chrome.browserAction.setBadgeText({ text: "on" });
		 chrome.browserAction.setBadgeBackgroundColor({ color: "red" });
  },
  off:function(){
    var config = {mode: "direct"};
    chrome.proxy.settings.set({value: config, scope: 'regular'}, function() {});
    chrome.browserAction.setBadgeText({ text: "off" });
		chrome.browserAction.setBadgeBackgroundColor({ color: "blue" });
  }
};

function save_proxy(data){
	Storage.save(data);
	if(data.run){
		var target = (data.except) ? data.except.split("\n") : ["*"];
		proxy_switch.on(data.proxy,target);
	}else{
		proxy_switch.off();
	}
}


 chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
     save_proxy(request);
 });
