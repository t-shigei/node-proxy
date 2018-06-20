
wijmo.grid.FlexGrid.prototype.loadData=function(path,callback){
  var obj = this;
  $.get(path,function(ret){
    obj.itemsSource=ret;
    if(callback) callback(ret);
  });
};
