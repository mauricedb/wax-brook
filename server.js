// server.js
// where your node app starts

// init project
var express = require('express');
var app = express();

// we've started you off with Express, 
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.get("/dreams", function (request, response) {
  response.send(dreams);
});

// could also use the POST body instead of query string: http://expressjs.com/en/api.html#req.body
app.post("/dreams", function (request, response) {
  dreams.push(request.query.dream);
  response.sendStatus(200);
});

// Simple in-memory store for now
var dreams = [
  "Find and count some sheep",
  "Climb a really tall mountain",
  "Wash the dishes"
  ];

var rows = {};
var openov = require('./openov');
var openov$ = openov.subscribe()
  .filter(row => row.latitude && row.longitude)
  .do(row => {
    if (row.journeyStopType === 'LAST') {
      delete rows[row.key];
    } else {
      rows[row.key] = row;
    }
  });

var server = require('http').createServer(app);
var io = require('socket.io')(server);

io.on('connection', function(socket){
  var viewport = { 
    northWest: { lat: 0, lng: 0 },
    southEast: { lat: 0, lng: 0 } 
  };

  var subscription = openov$
    .filter(row => row.latitude >= viewport.southEast.lat && row.latitude <= viewport.northWest.lat)
    .filter(row => row.longitude >= viewport.northWest.lng && row.longitude <= viewport.southEast.lng)
    .subscribe(row => socket.emit('openov', row));

  socket.on('event', function(data){
    console.log('event data', data  )
  });

  socket.on('viewport-changed', function(data) {
    console.log('viewport-changed to', data);
    viewport = data;

    for (var key in rows) {
      var row = rows[key];

      if (row.latitude >= viewport.southEast.lat && row.latitude <= viewport.northWest.lat &&
      row.longitude >= viewport.northWest.lng && row.longitude <= viewport.southEast.lng) {
        socket.emit('openov', row)
      }
    }
  });

  socket.on('disconnect', function(){
    subscription.dispose();
    console.log('disconnect')
  });
});


// listen for requests :)
var listener = server.listen(process.env.PORT || 3000, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});