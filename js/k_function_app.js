/*
Ripley's K function clustering algorithm
Simon Kassel
*/

// ---------- Helper functions ---------- //
/*
Convert json points to 2d array
  input:
    - json points
  return:
    - 2d array of x and y coords for all points
*/
function jsonToArray(result) {
  var ptsJSON = JSON.parse(result);

  var pts = [];

  for (var i = 0; i < ptsJSON.length; i++) {
    apt = [];
    apt.push(ptsJSON[i].x);
    apt.push(ptsJSON[i].y);
    pts.push(apt);
  }

  return (pts);
}

/*
Define bounding box from user input points
  input:
    - 2d array of input coordinates
  return:
    - array of coordinates defining bounding box of input points
      format: [xMax, xMin, yMax, yMin]
*/
function defBbox(points) {
  // define bounding box
  xMax = _.max(points, function(points) {
    return points[0];
  })[0];
  xMin = _.min(points, function(points) {
    return points[0];
  })[0];
  yMax = _.max(points, function(points) {
    return points[1];
  })[1];
  yMin = _.min(points, function(points) {
    return points[1];
  })[1];

  var bbox = [xMax, xMin, yMax, yMin];
  return (bbox);
}

/*
find L(d) value for a point pattern (random or observed)
input:
    - 2d array of input coordinates
    - measurement radius (via user input)
    - area of the bounding box (will come from leaflet draw input)
  return:
    - value of L(d)
*/
function findKd(points, radius, area) {

  var neighbors = [];

  //var bbox = defBbox(points);
  var n = points.length;

  for (var i = 0; i < n; i++) {

    var refPoint = points[i];

    var refX = refPoint[0];
    var refY = refPoint[1];

    var refNeighbors = 0;

    var otherPoints = points.slice(0, i).concat(points.slice(i + 1));

    for (var p = 0; p < otherPoints.length; p++) {
      var measureX = otherPoints[p][0];
      var measureY = otherPoints[p][1];
      var dist = math.sqrt(math.square(refX - measureX) + math.square(refY - measureY));
      if (dist <= radius) {
        refNeighbors++;
      }
    }
    neighbors.push(refNeighbors);
  }
  var meanNeighbs = math.mean(neighbors);
  var kd = meanNeighbs / (n / area);
  var ld = math.sqrt(kd / 3.1415) - radius;
  return (ld);
}

/*
develop a random point pattern with the same boundaries and number of points
as the test pattern
input:
    - 2d array of input coordinates
  return:
    - a new, random 2d array of input coordinates
*/
function random(points) {

  var n = points.length;
  var bbox = defBbox(points);

  var randomPts = [];

  for (var i = 0; i < n + 1; i++) {
    var aRandomPoint = [];
    var rp = [];
    rp[0] = Math.floor(Math.random() * (bbox[0] - bbox[1])) + bbox[1];
    rp[1] = Math.floor(Math.random() * (bbox[2] - bbox[3])) + bbox[3];
    randomPts.push(rp);
  }
  return (randomPts);
}

/*
Find confidence interval of L(d) values for expected random patterns
input:
    - 2d array of test pattern points
    - user specified search radius
    - area of bounding box
    - number of folds (random samples to try)
  return:
    - an envelope object with min and max characteristics
*/
function confEnvelopes(points, radius, folds, area) {

  var randomKds = [];

  for (var i = 0; i <= folds; i++) {
    var randomSet = random(points);
    randomKds.push(findKd(randomSet, radius, area));
  }

  var envelope = {};
  envelope.min = _.min(randomKds);
  envelope.max = _.max(randomKds);

  return (envelope);
}

function getConfidenceLevel(folds) {
  return (((folds - 9) / 10) + 90) + "%";
}

function findOutcome(ripleyResults) {
  if (ripleyResults.ld > ripleyResults.highEnv) {
    return ("significantly clustered");
  } else if (ripleyResults.ld < ripleyResults.lowEnv) {
    return ("significantly dispersed");
  } else {
    return ("random");
  }
}

// main
var ripley = function(result, area) {
  var start = Date.now();

  // Temporarily hard-code in some values, will eventually come from user input
  if (typeof area == "undefined") {
    area = 3970707414;
  }

  var radiusMiles = $("#cluster-dist-radius").val();
  console.log(radiusMiles);
  var radius = radiusMiles * 5280;
  console.log("radius is " + radius);
  var folds;

  // number of random samples based on number of points
  // for computation purposes
  if (result.length > 1500) {
    folds = 9;
  } else if (result.length < 500) {
    folds = 99;
  } else {
    folds = math.round(100 - (result.length - 500) / 10);
  }

  // observed L(d) value
  var obsLD = findKd(result, radius, area);

  // confidence envelopes
  var env = confEnvelopes(result, radius, folds, area);
  var finish = Date.now();

  console.log("Observed L(d) = " + (math.round(obsLD * 100) / 100));
  console.log("Computed confidence envelope of " + (math.round(env.min * 100) / 100) + " to " + (math.round(env.max * 100) / 100) + " on " + folds + " folds.");
  console.log("Measured " + result.length + " points in " + (finish - start) + " milliseconds.");

  var ripleyResults = {};
  ripleyResults.ld = obsLD;
  ripleyResults.lowEnv = math.round(env.min * 100) / 100;
  ripleyResults.highEnv = math.round(env.max * 100) / 100;
  ripleyResults.folds = folds;
  ripleyResults.n = result.length;
  ripleyResults.radius = radiusMiles;
  ripleyResults.outcome = findOutcome(ripleyResults);
  ripleyResults.confidenceLevel = getConfidenceLevel(folds);

  return (ripleyResults);
};
