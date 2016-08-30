var zmq = require('zmq');
var sock = zmq.socket('sub');
var zlib = require("zlib");
var rx = require('rx');

module.exports = {
    start: () => {
        var subject = new rx.Subject();

        sock.connect('tcp://kv78turbo.openov.nl:7817');

        sock.subscribe('/GOVI/KV8passtimes/SGH');
        // sock.subscribe('/GOVI/KV8passtimes');

        sock.on('message', function(msg, buffer) {
        // if (msg.toString().indexOf('HT') !== -1) 
            zlib.gunzip(buffer,  function(err, decoded) {
                // console.log(decoded.toString());
                subject.onNext(decoded);
            });
        });

        return subject;
    }
};
