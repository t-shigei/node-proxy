

$(function(){

		
	/*初期処理*/
	var val = chrome.extension.getBackgroundPage().Storage.load();
	$(":input[name=run]").prop('checked',val.run ? 'checked' : "");
	if(val.proxy) $(":input[name=proxy]").val(val.proxy);
	if(val.except) $(":input[name=except]").val(val.except);

	
	$(".save").click(function(){
	    var obj = {};
	    obj.run = $(":input[name=run]").prop('checked');
	    obj.proxy = $(":input[name=proxy]").val();
	    obj.except = $(":input[name=except]").val();
		chrome.extension.getBackgroundPage().save_proxy(obj);
		window.close();
	});


});
