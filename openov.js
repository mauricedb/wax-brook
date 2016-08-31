var fs = require('fs');
var zmq = require('zmq');
var sock = zmq.socket('sub');
var zlib = require("zlib");
var rx = require('rx');
var Converter = require("csvtojson").Converter;
const camelCase = require('camelcase');
var fetch = require('node-fetch');

var data = {};

var timingPoints = {}
fs.access('timingPoints.json', fs.F_OK, err => {
  if (!err) {
    timingPoints = JSON.parse(fs.readFileSync('timingPoints.json'));
  }
})

function timingPointName(code) {
  var tp = timingPoints[code];
  if (!tp) {

  fetch(`http://v0.ovapi.nl/tpc/${code}`)
    .then(rsp => rsp.json())
    .then(data => {
      timingPoints[code] = data[code].Stop;

      fs.writeFile('timingPoints.json', JSON.stringify(timingPoints));
    })

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

module.exports = {
    start: () => {
        var subject = new rx.Subject();

        sock.connect('tcp://kv78turbo.openov.nl:7817');

        sock.subscribe('/GOVI/KV8passtimes/SGH');
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
            .filter(row => row.linePlanningNumber === 3) // Only Randstad Rail 3
            .filter(row => row.lineDirection === 1) // Only a single direction
            .filter(row => (row.detectedRdY || row.tripStopStatus === 'ARRIVED')) // Only where we know the location
            .do(row => {
                var key = `${row.localServiceLevelCode}_${row.linePlanningNumber}_${row.journeyNumber}_${row.fortifyOrderNumber}_${row.lineDirection}`
                var journey = data[key] = data[key] || {};
                journey[row.userStopOrderNumber] = 
                `${row['\\LDataOwnerCode']} ${row.tripStopStatus} ${timingPointName(row.timingPointCode)} ${row.expectedArrivalTime} ${row.recordedArrivalTime || 'Not yet there'} ${row.detectedRdX || '?'} ${row.detectedRdY || '?'} ${row.distanceSinceDetectedUserStop}`;

                console.log('\033[2J');
                console.log(data);
            });
    }
};
