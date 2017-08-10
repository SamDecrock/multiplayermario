
var AudioUtils = {
    clone: function (inBuffer, audiocontext) {
        var outBuffer = audiocontext.createBuffer(
            inBuffer.numberOfChannels,
            inBuffer.length,
            inBuffer.sampleRate
        );

        for (var i = 0, c = inBuffer.numberOfChannels; i < c; ++i) {
            var od = outBuffer.getChannelData(i),
                id = inBuffer.getChannelData(i);
            od.set(id, 0);
        }

        return outBuffer;
    },

    reverse: function (buffer) {
        for (var i = 0, c = buffer.numberOfChannels; i < c; ++i) {
            var d = buffer.getChannelData(i);
            Array.prototype.reverse.call(d);
        }
    },

    invert: function (buffer) {
        for (var i = 0, c = buffer.numberOfChannels; i < c; ++i) {
            var d = buffer.getChannelData(i),
                l = buffer.length;
            while (l--) d[l] = -d[l];
        }
    },

    zero: function (buffer) {
        for (var i = 0, c = buffer.numberOfChannels; i < c; ++i) {
            var d = buffer.getChannelData(i),
                l = buffer.length;
            while (l--) d[l] = 0;
        }
    },

    noise: function (buffer) {
        for (var i = 0, c = buffer.numberOfChannels; i < c; ++i) {
            var d = buffer.getChannelData(i),
                l = buffer.length;
            while (l--) d[l] = (Math.random() * 2) - 1;
        }
    },

    fadeout: function(gainNode, duration, callback){
        $({someValue: gainNode.gain.value}).animate({someValue: 0}, {
            duration: duration,
            step: function() {
                gainNode.gain.value = this.someValue;
            },
            complete: function () {
                if(callback) callback();
            }
        });
    },

    fadein: function(gainNode, duration, callback){
        $({someValue: gainNode.gain.value}).animate({someValue: 1}, {
            duration: duration,
            step: function() {
                gainNode.gain.value = this.someValue;
            },
            complete: function () {
                if(callback) callback();
            }
        });
    }
}
