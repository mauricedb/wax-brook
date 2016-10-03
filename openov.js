var fs = require('fs');
var zmq = require('zmq');
var zlib = require("zlib");
var rx = require('rx');
var Converter = require("csvtojson").Converter;
var camelCase = require('camelcase');
var fetch = require('node-fetch');
var timingPoints = require('./timingPoints.json');
var rd2gps = require('./rd2gps');

var data = {};
var vehicles = {};

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
        var temp = result.shift();
        console.log(temp.field8, temp.field3, 'rceived');

        result.shift()
        var fields = result.shift();

        if (fields.field1.startsWith('\\L')) {
            fields.field1 = fields.field1.substr(2);
        }
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
    socket.on('connect', function (fd, ep) {
        console.log('connect, endpoint:', ep);
    });
    socket.on('connect_delay', function (fd, ep) {
        console.log('connect_delay, endpoint:', ep);
    });
    socket.on('connect_retry', function (fd, ep) {
        console.log('connect_retry, endpoint:', ep);
    });
    socket.on('listen', function (fd, ep) {
        console.log('listen, endpoint:', ep);
    });
    socket.on('bind_error', function (fd, ep) {
        console.log('bind_error, endpoint:', ep);
    });
    socket.on('accept', function (fd, ep) {
        console.log('accept, endpoint:', ep);
    });
    socket.on('accept_error', function (fd, ep) {
        console.log('accept_error, endpoint:', ep);
    });
    socket.on('close', function (fd, ep) {
        console.log('close, endpoint:', ep);
    });
    socket.on('close_error', function (fd, ep) {
        console.log('close_error, endpoint:', ep);
    });
    socket.on('disconnect', function (fd, ep) {
        console.log('disconnect, endpoint:', ep);
    });

    // Handle monitor error 
    socket.on('monitor_error', function (err) {
        console.log('Error in monitoring: %s, will restart monitoring in 5 seconds', err);
        setTimeout(function () {
            socket.monitor(1000, 0);
        }, 5000);
    });

    // Call monitor, check for events every 500ms and get all available events. 
    console.log('Start monitoring...');
    socket.monitor(1000, 0);

}


var sock = zmq.socket('sub');
monitorSocket(sock);
sock.connect('tcp://kv78turbo.openov.nl:7817');

sock.subscribe('/GOVI/KV8passtimes/SGH'); // HTM
sock.subscribe('/GOVI/KV8passtimes/Haaglanden');    // Veolia
sock.subscribe('/GOVI/KV8passtimes/ProvZH');        // Arriva


module.exports = {
    subscribe: () => {
        var subject = new rx.Subject();

        // sock.connect('tcp://kv78turbo.openov.nl:7817');

        // sock.subscribe('/GOVI/KV8passtimes/SGH');           // HTM

        sock.unref();
        // Attach the socket to the main event loop. Calling this on already attached sockets is a no-op.
        sock.ref();

        sock.on('message', function (msg, buffer) {
            zlib.gunzip(buffer, function (err, decoded) {
                subject.onNext(decoded);
            });
        });

        return subject
            .flatMap(decoded => new Promise(resolve => {
                var rows = [];
                decodeToArray(decoded, row => rows.push(row));
                resolve(rows);
            }))
            .flatMap(data => data)
            .filter(row => !!row.journeyNumber)
            // .filter(row => row.linePlanningNumber === 3 || row.linePlanningNumber === 4) // Only Randstad Rail
            // .filter(row => row.lineDirection === 1) // Only a single direction
            // .filter(row => row.vehicleNumber === 4037) // Only a single tram
            .do(row => {
                // var key = `${row.localServiceLevelCode}_${row.linePlanningNumber}_${row.journeyNumber}_${row.fortifyOrderNumber}_${row.lineDirection}`
                row.key = row.dataOwnerCode + '_' + row.vehicleNumber;
            })
            .do(row => {
                if (row.detectedRdX && row.detectedRdY) {
                    var pos = rd2gps.fromRdToWgs([row.detectedRdX, row.detectedRdY])
                    row.latitude = pos[0];
                    row.longitude = pos[1];
                } else {
                    var tp = getTimingPoint(row.timingPointCode)
                    if (tp.Latitude && tp.Longitude) {
                        row.latitude = tp.Latitude;
                        row.longitude = tp.Longitude;
                    }
                }
            })

        .do(row => {
                var journey, key = row.key;
                if (row.tripStopStatus === 'ARRIVED' && row.journeyStopType === 'LAST') {
                    // End of the line
                    delete vehicles[key];
                } else {
                    var journey = vehicles[key] = vehicles[key] || {};
                    journey[row.userStopOrderNumber] = row;
                }
            })
            .do(row => {
                var journey, key = row.key;
                var now = new Date().toLocaleTimeString();

                if (row.tripStopStatus === 'ARRIVED' && row.journeyStopType === 'LAST') {
                    // End of the line
                    delete data[key];
                } else {
                    var journey = data[key] = data[key] || {};
                    journey[row.userStopOrderNumber] =
                        `${now} ${row.dataOwnerCode} ${row.tripStopStatus} ${timingPointName(row.timingPointCode)} ${row.expectedArrivalTime} ${row.recordedArrivalTime || 'Not yet there'} ${row.latitude || '?'} ${row.longitude || '?'} ${row.distanceSinceDetectedUserStop}`;
                }

                // console.log('\033[2J');
                // console.log('---------------------------------------');
                // console.log(data);
            })
            .do(row => {
                if (row.tripStopStatus === 'ARRIVED') {
                    row.label = `${row.dataOwnerCode} ${row.linePlanningNumber} (${row.vehicleNumber}) arrived at ${timingPointName(row.timingPointCode)}`;
                } else if (row.tripStopStatus === 'PASSED') {
                    var nextRow = vehicles[row.key][row.userStopOrderNumber + 1];

                    if (nextRow && nextRow.tripStopStatus === 'DRIVING') {
                        row.label = `${row.dataOwnerCode} ${row.linePlanningNumber} (${row.vehicleNumber}) driving from ${timingPointName(row.timingPointCode)} to ${timingPointName(nextRow.timingPointCode)}`;
                    }
                }

            })
            .filter(row => (row.detectedRdX || row.tripStopStatus === 'ARRIVED')) // Only where we know the location
        ;
    }
};