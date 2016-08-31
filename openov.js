var zmq = require('zmq');
var sock = zmq.socket('sub');
var zlib = require("zlib");
var rx = require('rx');
var Converter = require("csvtojson").Converter;

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
                            row[fields[k]] = value;
                        }

                        var key = `${row.LocalServiceLevelCode}_${row.LinePlanningNumber}_${row.JourneyNumber}_${row.FortifyOrderNumber}_${row.LineDirection}`
                        if (row.JourneyNumber) {
                        // var journey = data[row.JourneyNumber] = data[row.JourneyNumber] || {};

                        if (row.LineDirection && row.UserStopOrderNumber && (row.Detected_RD_Y || row.TripStopStatus === 'ARRIVED') && row.LineDirection === 1) {
                            // var d = journey[row.LineDirection] = journey[row.LineDirection] || {};

                            //  ${timingPointName(row.TimingPointCode)} ${userStop(row.UserStopCode)}
                            var d = data[key] = data[key] || {};
                            d[row.UserStopOrderNumber] = 
                            `${row['\\LDataOwnerCode']} ${row.TripStopStatus} ${timingPointName(row.TimingPointCode)} ${row.ExpectedArrivalTime} ${row.RecordedArrivalTime || 'Not yet there'} ${row.Detected_RD_X || '?'} ${row.Detected_RD_Y || '?'} ${row.DistanceSinceDetectedUserStop}`;

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
