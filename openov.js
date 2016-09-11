var fs = require('fs');
var zmq = require('zmq');
var sock = zmq.socket('sub');
var zlib = require("zlib");
var rx = require('rx');
var Converter = require("csvtojson").Converter;
var camelCase = require('camelcase');
var fetch = require('node-fetch');
var timingPoints = require('./timingPoints.json');
var rd2gps = require('./rd2gps');

var data = {};

function getTimingPoint(code) {
  var tp = timingPoints[code];
  if (!tp) {
    timingPoints[code] = {};

    fetch(`http://v0.ovapi.nl/tpc/${code}`)
        .then(rsp => rsp.json())
        .then(data => {
            timingPoints[code] = data[code].Stop;

            fs.writeFile('./timingPoints.json', JSON.stringify(timingPoints, null, '  '));
    })

    return {};
  }
  return tp;

}

function timingPointName(code) {
  var tp = getTimingPoint(code);

  if (!tp.TimingPointCode) {
    return code;
  }
  return `${code} (${timingPoints[code].TimingPointName})`;
}

function decodeToArray(decoded, cb) {
    var converter = new Converter({
        delimiter: '|',
        noheader: true
    });

    converter.fromString(decoded.toString(), (err, result) => {
        result.shift()
        result.shift()
        var fields = result.shift();

        var keys = Object.keys(fields);

        result.forEach(r => {
            var row = {};
            keys.forEach(k => {
                var value = r[k];
                if (value !== '\\0') {
                    row[camelCase(fields[k])] = value;
                }
            })

            cb(row);                                            
        })
    });
}

function monitorSocket(socket) {
    socket.on('connect', function(fd, ep) {console.log('connect, endpoint:', ep);});
    socket.on('connect_delay', function(fd, ep) {console.log('connect_delay, endpoint:', ep);});
    socket.on('connect_retry', function(fd, ep) {console.log('connect_retry, endpoint:', ep);});
    socket.on('listen', function(fd, ep) {console.log('listen, endpoint:', ep);});
    socket.on('bind_error', function(fd, ep) {console.log('bind_error, endpoint:', ep);});
    socket.on('accept', function(fd, ep) {console.log('accept, endpoint:', ep);});
    socket.on('accept_error', function(fd, ep) {console.log('accept_error, endpoint:', ep);});
    socket.on('close', function(fd, ep) {console.log('close, endpoint:', ep);});
    socket.on('close_error', function(fd, ep) {console.log('close_error, endpoint:', ep);});
    socket.on('disconnect', function(fd, ep) {console.log('disconnect, endpoint:', ep);});

    // Handle monitor error 
    socket.on('monitor_error', function(err) {
        console.log('Error in monitoring: %s, will restart monitoring in 5 seconds', err);
        setTimeout(function() { socket.monitor(500, 0); }, 5000);
    });
    
    // Call monitor, check for events every 500ms and get all available events. 
    console.log('Start monitoring...');
    socket.monitor(500, 0);

}


monitorSocket(sock);

sock.connect('tcp://kv78turbo.openov.nl:7817');

sock.subscribe('/GOVI/KV8passtimes/SGH');

module.exports = {
    subscribe: () => {
        var subject = new rx.Subject();

        // sock.subscribe('/GOVI/KV8passtimes');

        sock.on('message', function(msg, buffer) {
            zlib.gunzip(buffer,  function(err, decoded) {
                subject.onNext(decoded);
            });
        });

        return subject
            .flatMap(decoded => new Promise(resolve => {
                    var rows = [];
                    decodeToArray(decoded, row => rows.push(row));
                    resolve(rows);
                })
            )
            .flatMap(data => data)
            .filter(row => !!row.journeyNumber)
            // .filter(row => row.linePlanningNumber === 3 || row.linePlanningNumber === 4) // Only Randstad Rail
            // .filter(row => row.lineDirection === 1) // Only a single direction
            .filter(row => (row.detectedRdY || row.tripStopStatus === 'ARRIVED')) // Only where we know the location
            .do(row => {
                // var key = `${row.localServiceLevelCode}_${row.linePlanningNumber}_${row.journeyNumber}_${row.fortifyOrderNumber}_${row.lineDirection}`
                var key = row.vehicleNumber;
                row.key = key;
            })
            .do(row => {
                if (row.tripStopStatus === 'ARRIVED') {
                    var tp = getTimingPoint(row.timingPointCode)
                    if (tp.Latitude && tp.Longitude) {
                        row.latitude = tp.Latitude;
                        row.longitude = tp.Longitude;
                    }
                } else if (row.detectedRdX && row.detectedRdY) {
                    var pos = rd2gps.fromRdToWgs([row.detectedRdX, row.detectedRdY])
                    row.latitude = pos[0];
                    row.longitude = pos[1];
                }
            })
            .do(row => {
                var key = row.key;
                
                if (row.journeyStopType === 'LAST') {
                    // End of the line
                    delete data[key];
                } else {
                    var journey = data[key] = data[key] || {};
                    journey[row.userStopOrderNumber] = 
                    `${row['\\LDataOwnerCode']} ${row.tripStopStatus} ${timingPointName(row.timingPointCode)} ${row.expectedArrivalTime} ${row.recordedArrivalTime || 'Not yet there'} ${row.detectedRdX || '?'} ${row.detectedRdY || '?'} ${row.distanceSinceDetectedUserStop}`;
                }

                // console.log('\033[2J');
                // console.log(data);
            });
    }
};
