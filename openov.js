var zmq = require('zmq');
var sock = zmq.socket('sub');
var zlib = require("zlib");
var rx = require('rx');
var Converter = require("csvtojson").Converter;
const camelCase = require('camelcase');

var data = {};

function timingPointName(tp) {
    return tp;
}

function decodeToArray(decoded, cb) {

    var converter = new Converter({
        delimiter: '|',
        noheader: true
    });

    converter.fromString(decoded.toString(), function(err, result) {
        //your code here 
        result.shift()
        result.shift()
        var fields = result.shift()
        var rr3 = result.filter(row => row.field1 === 'HTM' && row.field3 === 3)

        //  console.log(result[1].field4)
        if (rr3.length) {
            var keys = Object.keys(fields)

            rr3.map(r => {
                var row = {};
                keys.forEach(k => {
                    var value = r[k];
                    if (value !== '\\0') {
                        row[camelCase(fields[k])] = value;
                    }

                    var key = `${row.localServiceLevelCode}_${row.linePlanningNumber}_${row.journeyNumber}_${row.fortifyOrderNumber}_${row.lineDirection}`
                    if (row.journeyNumber) {

                        if (row.lineDirection && row.userStopOrderNumber && (row.detectedRdY || row.tripStopStatus === 'ARRIVED') && row.lineDirection === 1) {
                            var d = data[key] = data[key] || {};
                            d[row.userStopOrderNumber] = 
                            `${row['\\LDataOwnerCode']} ${row.tripStopStatus} ${timingPointName(row.timingPointCode)} ${row.expectedArrivalTime} ${row.recordedArrivalTime || 'Not yet there'} ${row.detectedRdX || '?'} ${row.detectedRdY || '?'} ${row.distanceSinceDetectedUserStop}`;

                            cb(row);                                            
                            console.log(data);
                        }
                    }
                })
            })
        }
    });

}

module.exports = {
    start: () => {
        var subject = new rx.Subject();

        sock.connect('tcp://kv78turbo.openov.nl:7817');

        sock.subscribe('/GOVI/KV8passtimes/SGH');
        // sock.subscribe('/GOVI/KV8passtimes');

        sock.on('message', function(msg, buffer) {
        // if (msg.toString().indexOf('HT') !== -1) 
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
            .flatMap(data => data);
    }
};
