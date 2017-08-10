function BufferLoader(context, urlList, onLoadingComplete, progresscallback, onError) {
  this.context = context;
  this.urlList = urlList;
  this.onLoadingComplete = onLoadingComplete;
  this.onError = onError;
  this.progresscallback = progresscallback;
  this.bufferList = new Array();
  this.loadCount = 0;
  this.percentageLoadedPerFile = [];
}

BufferLoader.prototype.loadBuffer = function(url, index) {
  var loader = this;
  var unitsLoaded = 0;


  // Load buffer asynchronously
  var request = new XMLHttpRequest();
  request.open("GET", url, true);
  request.responseType = "arraybuffer";
  request.onprogress = function (evt) {
    loader.percentageLoadedPerFile[index] = evt.loaded / evt.total;

    var total = 0;
    for (var i = loader.percentageLoadedPerFile.length - 1; i >= 0; i--) {
      total += loader.percentageLoadedPerFile[i];
    };

    var percentage = total/loader.urlList.length;
    if(loader.progresscallback) loader.progresscallback(percentage);
  };

  request.onload = function() {
    // Asynchronously decode the audio file data in request.response
    loader.context.decodeAudioData(
      request.response,
      function(buffer) {
        if (!buffer) {
          if(loader.onError) loader.onError(error);
          return;
        }
        loader.bufferList[index] = buffer;
        if (++loader.loadCount == loader.urlList.length)
          if(loader.onLoadingComplete) loader.onLoadingComplete(loader.bufferList);
      },
      function(error) {
        if(loader.onError) loader.onError(error);
        return;
      }
    );
  }

  request.onerror = function() {
    alert('BufferLoader: XHR error');
  }

  request.send();
}

BufferLoader.prototype.load = function() {
  for (var i = 0; i < this.urlList.length; ++i){
    this.percentageLoadedPerFile.push(0);
    this.loadBuffer(this.urlList[i], i);
  }
}