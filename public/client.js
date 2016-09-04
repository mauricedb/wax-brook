// client-side js
// run by the browser each time your view template is loaded

// by default, you've got jQuery,
// add other scripts at the bottom of index.html

$(function() {
  var socket = io();

  var mymap = L.map('mapid')
    // .setView([52.06, 4.4], 13)
    .locate({
      setView: true,
      maxZoom: 15
    })
    .on('zoomend', e => {
      const bounds = e.target.getBounds();
      console.log('zoomed to ',bounds.getNorthWest(), bounds.getSouthEast())
    })
    .on('dragend', e => {
      const bounds = e.target.getBounds();
      console.log('dragged to ',bounds.getNorthWest(), bounds.getSouthEast())
    })
    .on('resize', e => {
      const bounds = e.target.getBounds();
      console.log('resize to ',bounds.getNorthWest(), bounds.getSouthEast())
    })
  
  L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
      attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
      maxZoom: 18,
      id: 'mapbox.streets',
      accessToken: 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpandmbXliNDBjZWd2M2x6bDk3c2ZtOTkifQ._QA7i5Mpkd_m30IGElHziw'
  }).addTo(mymap);

  var markers = {};
  socket.on('openov', row => {
    console.log(row);

    if (row.latitude && row.longitude) {
      // var key = `${row.localServiceLevelCode}_${row.linePlanningNumber}_${row.journeyNumber}_${row.fortifyOrderNumber}_${row.lineDirection}`
      var key = row.vehicleNumber;

      var marker = markers[key];
      if (marker && row.journeyStopType === 'LAST') {
        marker.setLatLng([row.latitude, row.longitude]);
        delete markers[key];
        setTimeout(() => marker.removeFrom(mymap), 60000);
      } else if (marker) {
        marker.setLatLng([row.latitude, row.longitude]);
      } else {
        markers[key] = L.marker([row.latitude, row.longitude], {
          title: row.linePlanningNumber
        }).addTo(mymap);
      }
      
    }
  });
});
