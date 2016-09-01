// client-side js
// run by the browser each time your view template is loaded

// by default, you've got jQuery,
// add other scripts at the bottom of index.html

$(function() {
  var socket = io();

  var mymap = L.map('mapid')
    .setView([52.06, 4.4], 13)
    // .locate({
    //   setView: true, 
    //   maxZoom: 13
    // })
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

  
  socket.on('openov', data => console.log(data));
});
