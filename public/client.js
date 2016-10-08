// client-side js
// run by the browser each time your view template is loaded

// by default, you've got jQuery,
// add other scripts at the bottom of index.html

if (location.protocol === 'http:' && location.hostname !== 'localhost') {
  // Redirect to HTTPS
  location.href = location.href.replace("http://", "https://");
}

$(function() {
  var socket = io();
  var markers = {};

  function sendViewPort(bounds) {

    var oldMarkers = markers;
    markers = {};
    
    socket.emit('viewport-changed', {
      northWest: bounds.getNorthWest(),
      southEast: bounds.getSouthEast()
    });

    for (key in oldMarkers) {
      var marker = oldMarkers[key];
      marker.removeFrom(mymap);
    }
  }

  var mymap = L.map('mapid')
    .setView([52.06, 4.4], 13)
    // .locate({
    //   setView: true,
    //   maxZoom: 15
    // })
    .on('zoomend', e => {
      const bounds = e.target.getBounds();
      console.log('zoomed to ',bounds.getNorthWest(), bounds.getSouthEast())
      sendViewPort(bounds);
    })
    .on('dragend', e => {
      const bounds = e.target.getBounds();
      console.log('dragged to ',bounds.getNorthWest(), bounds.getSouthEast())
      sendViewPort(bounds);
    })
    .on('resize', e => {
      const bounds = e.target.getBounds();
      console.log('resize to ',bounds.getNorthWest(), bounds.getSouthEast())
      sendViewPort(bounds);
    })
  
  L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
      attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
      maxZoom: 18,
      id: 'mapbox.streets',
      accessToken: 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpandmbXliNDBjZWd2M2x6bDk3c2ZtOTkifQ._QA7i5Mpkd_m30IGElHziw'
  }).addTo(mymap);

  socket.on('openov', row => {
    // console.log(row);
    var key = row.key;

    if (row.from && row.from.latitude && row.to && row.to.longitude) {
      // console.log(row)

      var marker = markers[key];
      if (marker) {
        marker.removeFrom(mymap);
      }

      var seconds = (Date.parse(`2016-10-8 ${row.to.expectedArrivalTime}+0200`) - Date.now()) / 1000;

      markers[key] = L.Marker
        .movingMarker([
            [row.from.latitude, row.from.longitude],
            [row.to.latitude, row.to.longitude]
          ], 
          seconds * 1000, {
            autostart: true,
            title: row.label || row.linePlanningNumber
          })
        .addTo(mymap);

    } else if (row.latitude && row.longitude) {

      var marker = markers[key];
      if (marker && row.journeyStopType === 'LAST') {
        marker.setLatLng([row.latitude, row.longitude]);
        delete markers[key];
        setTimeout(() => marker.removeFrom(mymap), 60000);
      } else if (marker) {
        marker.removeFrom(mymap)
        markers[key] = L.marker([row.latitude, row.longitude], {
          title: row.label || row.linePlanningNumber
        }).addTo(mymap);
      } else {
        markers[key] = L.marker([row.latitude, row.longitude], {
          title: row.label || row.linePlanningNumber
        }).addTo(mymap);
      }
    }
  });
});
