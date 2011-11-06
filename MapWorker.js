// a Web Worker for filling out the map

// so we can use TileMarshal even though it's defined
// with requirejs
var TileMarshal;
var define = function (inc, r) {
  TileMarshal = r();
};

importScripts('lib/json2.js',
              'lib/underscore.js',
              'TileMarshal.js');

var Tile = function () {};
Tile.prototype.tileOffset = 0;
TileMarshal(Tile);

// so we can get output from the worker
var console = {
  log: function () {
    var message = {
      type:    'log',
      message: _(arguments).toArray()
    };
    postMessage(JSON.stringify(message));
  }
};

// load 'meta map' section tiles
var sections = {
};

// loads the section list into section_list
importScripts('section-list.js');

// loads the car list into car_list
importScripts('car-list.js');

var carMap = [];
var carColorMap = {};

// create a distribution array of all the cars so that we can 
// just pick a random element
_.each(car_list, function (car, count) {
  for (var i = 0; i < count; i++) {
    carMap.push(car.name);
    carColorMap[car.name] = car.colors;
  }
});

// sections set these variables with their data when loaded
var map, roads, sprites, buildings;
_(section_list).each(function (name) {
  map       = null;
  roads     = null;
  sprites   = null;
  buildings = null;

  importScripts('maps/'+name+'.json');

  var section = [];

  // convert the map into objects
  for (var i = 0; i < map.length; i++) {
    var tile = new Tile();
    tile.setFromString(map[i]);
    section[i] = tile;
  }

  sections[name]    = section;

  // save the section metadata on the map Array object
  section.name      = name;
  // these are from the imported script
  section.roads     = roads     || [];
  section.sprites   = sprites   || [];
  section.buildings = buildings || [];
});

// fills a map's blank tiles wth random dirt and scrub
var fillBlankTiles = function (tiles, width) {
  var x, y;
  var total = tiles.length;

  var addCars = Math.random() < 0.5; // 50% chance of cars

  if (!tiles.sprites) {
    tiles.sprites = [];
  }

  for (var i = 0; i < total; i++) {
    var tile = tiles[i];
    if (tile.tileOffset === 0) {
      var test = Math.random()

      if (test > 0.9) {

        tile.tileOffset = Math.floor(Math.random()*2) + 1;
        tile.tileFlip = Math.random() > 0.5;
        tile.tileRotate = 0;

      } else if (test < 0.01) {

        x = (i % width) * 60;
        y = Math.floor(i / width) * 60;
        var tree = {
          clazz: 'Tree',
          type: 'Tree' + (Math.floor(Math.random() * 3) + 1),
          pos: {
            x: x + 30,
            y: y + 30,
            rot: Math.floor(Math.random() * 360)
          }
        };

        tiles.sprites.push(JSON.stringify(tree));

      }

    } else if (tile.isRoad && addCars) {

      if (Math.random() < 0.05) {
        x = (i % width) * 60;
        y = Math.floor(i / width) * 60;
        addCar(x, y, tile, tiles);
      }

    }
  }

  return tiles;
};

var addCar = function (x, y, tile, tiles) {
  var husk = Math.random() > 0.7;

  var rot;
  if (tile.tileOffset === 3) { // road side
    // align with road
    rot = tile.tileRotate * 90;
    if (!tile.flip) {
      rot -= 180;
    }
    // give a little
    rot += 10 - Math.floor(Math.random() * 20);
  } else {
    // random direction
    rot = Math.floor(Math.random() * 360);
  }

  var carType = carMap[Math.floor(Math.random() * carMap.length)];
  var carColorSelection = carColorMap[carType];
  var carColor = carColorSelection[Math.floor(Math.random() * carColorSelection.length)];

  var car = {
    clazz: carType,
    setColor: carColor,
    pos: {
      x: x + Math.random() * 60,
      y: y + Math.random() * 60,
      rot: rot
    },
    health: husk ? -1 : Math.round(Math.random() * 100),
    canSmoke: false // don't smoke until hit
  };

  tiles.sprites.push(JSON.stringify(car));
};

var loadSection = function (config) {
  // fills the map with the given section
  var section = sections[config.sectionName];
  var sectionLength = section.length;
  var mapLength = config.width * config.height;
  var tiles = [];
  for (var i = 0; i < mapLength; i++) {
    tiles[i] = _.clone(section[i % sectionLength]);
  }
  tiles.roads     = section.roads;
  tiles.sprites   = section.sprites;
  tiles.buildings = section.buildings;
  return tiles;
};

var cloneSection = function (section) {
  var tiles = [];
  for (var i = 0; i < section.length; i++) {
    tiles[i] = _.clone(section[i]);
  }
  tiles.roads     = _.clone(section.roads);
  tiles.sprites   = _.clone(section.sprites);
  tiles.buildings = _.clone(section.buildings);
  return tiles;
};

var getRandomSection = function (incomingRoads) {
  var canidates = [];

  for (var name in sections) {
    if (sections.hasOwnProperty(name)) {
      var section = sections[name];

      var match = true;
      for (var dir in section.roads) {
        if (incomingRoads.hasOwnProperty(dir) &&
            (incomingRoads[dir] !== undefined) &&
            (incomingRoads[dir] !== section.roads[dir])) {
          match = false;
          break;
        }
      }

      if (match) {
        canidates.push(section);
      }
    }
  }

  var choice = (canidates.length) ?
    canidates[Math.floor(Math.random() * canidates.length)] :
    sections['blank']; // nothing is better than really nothing

  console.log(choice.name);
  return cloneSection(choice);
};

onmessage = function (e) {
  var config = JSON.parse(e.data);

  var tiles = (config.sectionName) ?
                loadSection(config) :
                getRandomSection(config.roads);

  fillBlankTiles(tiles, config.width);

  var message = {
    type:      'newtiles',
    tiles:     _(tiles).map(function (t) { return t.toString(); }).join(''),
    roads:     tiles.roads,
    sprites:   tiles.sprites,
    buildings: tiles.buildings,
    position:  config.position
  };

  postMessage(JSON.stringify(message));
};