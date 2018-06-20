var data = require("sdk/self").data;

var panel = require("sdk/panel").Panel({
     width: 400,
     height: 150,
     contentURL: data.url("setting.html"),
     contentScriptFile:[data.url("js/jquery.js"), data.url("js/jquery-ui.min.js"),data.url("js/setting.js")]
});

var service = require("sdk/preferences/service");

var crawl_server="172.16.65.110";

var proxy_switch ={
  on:function(proxy){
    var pacScript= "data:text/javascript,function FindProxyForURL(url, host) {\n" +
               "  if (host != '"+crawl_server+"')\n" +
               "    return 'PROXY "+proxy+"';\n" +
               "  return 'DIRECT';\n" +
               "}";
     service.set("network.proxy.type", 2);
     service.set("network.proxy.autoconfig_url", pacScript);
     button.badge =  "on";
  },
  off:function(){
    service.set("network.proxy.type", 0);
    button.badge =  "off";
  }
};


var button = require("sdk/ui").ActionButton({
    id: "web-crawl",
    label: "Crawler",
    icon: "./icons/icon16.png",
    onClick: function(){
       panel.show({position: button});
    },
    badge: "off",
    badgeColor: "#FF0000"
  });



  panel.port.on("proxy", function (message) {

    if (message !== "") {
       proxy_switch.on(message);
    }else{
       proxy_switch.off();
    }
    panel.hide();
  });
