// Solmar City — screenshot staging: ?shot=cover|chase|docks|plaza puts the
// game into a fixed, lively state (a set mission step, a wanted level, a
// placed player and camera) so the screenshots are real renders of the game
// in its best moments. No shot param means the normal title screen.

(function () {
  'use strict';

  var SHOTS = {
    cover: {
      label: 'Driving the Comet GT to the garage, one star on the tail',
      warmUp: 60, // short: the cruisers are still closing in, not yet on the bumper
      drive: true, // hold the throttle during warm-up so the car is at speed
      setup: function (world) {
        var gt = world.traffic.parked[0]; // the yellow Comet GT
        world.player.enterCar(gt, world);
        world.player.car.x = 0;
        world.player.car.z = 130;
        world.player.car.heading = Math.PI; // north, straight up road x = 0
        world.player.car.speed = 16;
        world.player.x = 0;
        world.player.z = 130;
        world.player.camYaw = Math.PI;
        world.player.camPitch = 0.3;
        world.missions.setMission(0, 2); // deliver to the garage
        // enterCar already raised one star for the theft; that is the shot.
      },
    },
    chase: {
      label: 'Three-star escape along the beach road',
      warmUp: 260,
      drive: true,
      setup: function (world) {
        var car = world.traffic.parked[2]; // the blue Bayside
        world.player.enterCar(car, world);
        world.player.car.x = -80;
        world.player.car.z = 156; // the beach road, eastbound
        world.player.car.heading = Math.PI / 2;
        world.player.car.speed = 20;
        world.player.x = -80;
        world.player.z = 156;
        world.player.camYaw = Math.PI / 2;
        world.player.camPitch = 0.28;
        world.missions.setMission(2, 2); // escape to the safehouse
        world.missions.missionTimer = 96;
        world.police.addWanted(2); // +1 from the theft = three stars
      },
    },
    docks: {
      label: 'On foot at the docks, grabbing the package',
      warmUp: 110,
      setup: function (world) {
        // Stand back from the marker so the containers, the beacon and the
        // player all fit in the frame.
        world.player.x = 160;
        world.player.z = 40;
        world.player.heading = 0.98;
        world.player.camYaw = 0.98;
        world.player.camPitch = 0.3;
        world.missions.setMission(1, 1); // pick up the package
        world.hud.say('Package is here, between the containers.');
      },
    },
    plaza: {
      label: 'On foot in the city, the Comet GT job ahead',
      warmUp: 110,
      setup: function (world) {
        // Face north up the marina road: the yellow Comet GT waits ahead
        // under its beacon, the city rising behind it.
        world.player.x = 6;
        world.player.z = 118;
        world.player.heading = Math.PI;
        world.player.camYaw = Math.PI;
        world.player.camPitch = 0.3;
        world.missions.setMission(0, 0); // find the Comet GT
      },
    },
  };

  function shotName() {
    try {
      var q = new URLSearchParams(window.location.search);
      var s = q.get('shot');
      return s && SHOTS[s] ? s : null;
    } catch (e) {
      return null;
    }
  }

  function apply(world) {
    var name = shotName();
    if (!name) return null;
    SHOTS[name].setup(world);
    return name;
  }

  function get(name) {
    return SHOTS[name] || null;
  }

  SC.shots = { apply: apply, shotName: shotName, get: get, list: Object.keys(SHOTS) };
})();
