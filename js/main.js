/** Notice the use of L.Map here. This is an extension of an organizational strategy we've already discussed. */

// functions
function initialize(){
  app = {
    apikey: "02d8b28e6d04fc76d64411af81f756f9d6fc5fa7",
    map: L.map('map', {
      center: [40.0076376974903, -75.2839618118469],
      zoom: 11
    }),
    geojsonClient: new cartodb.SQL({
      user: 'simonkassel',
      format: 'geojson'
    }),
    drawnItems: new L.FeatureGroup()
  };

  app.map.on('draw:created', function (x) {

    rectangleLayer = x.layer.addTo(app.map); // The Leaflet layer for the shape

    var bbox = x.layer._latlngs;

    var coordsToString = function(coordPair) {
      var coordString = coordPair.lng + " " + coordPair.lat;
      return(coordString);
    };

    var geomString = ", ST_GeomFromEWKT('SRID=4326;POLYGON((";

    findArea(bbox);

    _.each(bbox, function(x){
      geomString = geomString + coordsToString(x) + ", ";
    });

    geomString += coordsToString(bbox[0]) + "))') as bbox WHERE ST_WITHIN(cf.the_geom, bbox)";

    userRectangle = geomString;
  });

  // add draw control
  app.map.addControl(
    new L.Control.Draw({
      position: 'topright',
      edit: {
        featureGroup: app.drawnItems
      },
      draw: {
        polyline: false,
        polygon: false,
        circle: false,
        marker: false,
        rectangle: true,
      }
    })
  );

  $('#time-start').timepicker();
  $('#time-end').timepicker();

  $('#time-start').on('changeTime', function() {
      var start = $('#time-start').text($(this).val());
      times[0] = parseTime(start[0].value);
  });

  $('#time-end').on('changeTime', function() {
      var end = $('#time-end').text($(this).val());
      times[1] = parseTime(end[0].value);
  });
}

function findArea(boundingBox) {
  var xs = _.map(boundingBox, function(i){return(i.lat);});
  var ys = _.map(boundingBox, function(i){return(i.lng);});
  var turfBbox = [_.min(xs), _.min(ys), _.max(xs), _.max(ys)];
  var testObj = turf.bboxPolygon(turfBbox);
  var area = turf.area(testObj) * 10.7639;
  rectangleArea = area;
}

function addTiles(){
  L.tileLayer('http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
    attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: 'abcd',
    minZoom: 0,
    maxZoom: 20,
    ext: 'png'
  }).addTo(app.map);
}

function getArray(points) {
  var pto = points.features;
  ptArray = [];
  for (var i = 0; i < pto.length; i++) {
    apt = [];
    apt.push(pto[i].properties.xcoord);
    apt.push(pto[i].properties.ycoord);
    ptArray.push(apt);
  }
  return(ptArray);
}

function plotPoints(sql) {

  // check for existing points
  if (typeof featureGroup !== 'undefined') {
    app.map.removeLayer(featureGroup);
  }

  if (typeof rectangleLayer !== 'undefined') {
    app.map.removeLayer(rectangleLayer);
  }

  // map filtered points
  app.geojsonClient.execute(sql).done(function(data) {
    featureGroup = L.geoJson(data, {
      pointToLayer: function(feature, latlng) {
        return new L.CircleMarker(latlng, {
          radius: 1,
          fillOpacity: 0.85,
          color: '#7DF9FF'
        });
      },
    });
    app.map.addLayer(featureGroup);
    var ptArray = getArray(data);
    measureClust(ptArray, rectangleArea);
  });
}

function measureClust(ptArray, rectangleArea) {
  var ripleyResults = ripley(ptArray, rectangleArea);
  console.log(ripleyResults.outcome);

  if (ripleyResults.outcome == "random") {
    text = "These " + "<i>" + ripleyResults.n + "</i>" + " collisions appear to be <strong>randomly</strong> distributed <br> at a distance of " + "<i>" + ripleyResults.radius + " miles</i>" + ".";
    $(".result-text").html(text);
  } else {
    text = "These " + "<i>" + ripleyResults.n + "</i>" + " collisions are " + "<strong>" + ripleyResults.outcome + "</strong>" + " at a " + "<br> distance of " + "<i>" + ripleyResults.radius + " miles </i>" + "and a " + "<i>" + ripleyResults.confidenceLevel + "</i>" + " confidence level.";
    $(".result-text").html(text);
  }
}

function parseTime(x) {
  x = x.replace(":", "");
  var pm = x.substr(x.length - 2, x.length);
  var tn = parseInt(x.substr(0, x.length - 2));
  if (pm == "pm") {
    tn += 1200;
  }
  return(tn);
}

function getSql(){

  var month = $(".month").val();
  if (month == "All"){
    month = "> 0";
  } else {
    month = "= " + month;
  }

  var types = "(10";
  for (var i = 0; i < 8; i++) {
    var crashTypeSel = 'type' + i;
    if (document.getElementById(crashTypeSel).checked){
      var sel = "#" + crashTypeSel;
      types = types + ", " + $(sel).val();
    }
  }
  types = types + ")";

  var timeSql;
  if (times[0] < times[1]) {
    timeSql = " AND time_of_day > " + times[0] + " AND time_of_day < " + times[1];
  } else {
    timeSql = " AND (time_of_day > " + times[1] + " OR time_of_day < " + times[0] + ")";
  }


  var query;
  if (typeof userRectangle == "undefined") {
    query = "SELECT * FROM crashes_filtered_2 WHERE crash_month " + month + " AND collision_type IN " + types + timeSql;
  } else {
    query = "SELECT * FROM crashes_filtered_2 as cf" + userRectangle + " AND crash_month " + month + " AND collision_type IN " + types + timeSql;
  }

  console.log(query);
  return(query);
}

function main(){

  // add map tiles
  initialize();
  addTiles();

  $("#run").click(function(){

    plotPoints(getSql());

  });
}

// global variables
var app;
var times = [0, 2400];
var userRectangle;
var rectangleLayer;
var rectangleArea;

// run
main();
