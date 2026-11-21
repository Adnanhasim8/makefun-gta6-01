// Solmar City — the player: Marco Solis, a getaway driver. On foot he runs
// the sidewalks; in a car he drives it. Steal parked cars with E, punch with
// F, and mind the wanted level: the city notices both.

(function () {
  'use strict';

  var WALK_SPEED = 6;
  var SPRINT_SPEED = 9.5;
  var CAR_ACCEL = 15;
  var CAR_BRAKE = 26;
  var CAR_MAX = 27;
  var CAR_REVERSE_MAX = 9;

  function buildPlayerMesh() {
    var group = new THREE.Group();
    var jacket = new THREE.MeshLambertMaterial({ color: 0xe86a2e });
    var jeans = new THREE.MeshLambertMaterial({ color: 0x2e3a5a });
    var skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.05, 8), jacket);
    body.position.y = 0.95;
    group.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
    head.position.y = 1.72;
    group.add(head);
    var cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10),
      new THREE.MeshLambertMaterial({ color: 0x222226 })
    );
    cap.position.y = 1.92;
    group.add(cap);
    var legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.3), jeans);
    legs.position.y = 0.25;
    group.add(legs);
    group.traverse(function (m) { if (m.isMesh) m.castShadow = true; });
    return group;
  }

  function Player(scene, spawn) {
    this.scene = scene;
    this.mesh = buildPlayerMesh();
    scene.add(this.mesh);
    this.x = spawn.x;
    this.z = spawn.z;
    this.heading = spawn.heading;
    this.health = 100;
    this.money = 0;
    this.inCar = false;
    this.car = null; // the driven car: { mesh, x, z, heading, speed, steer, name, sports }
    this.speed = 0; // on-foot speed, or the car's speed while driving
    this.walkBob = 0;
    this.punchCooldown = 0;
    this.stealCooldown = 0;
    this.crimeCooldown = 0;
    this.camYaw = spawn.heading;
    this.camPitch = 0.32;
    this.camDist = 9;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  Player.prototype.nearestParkedCar = function (parked, maxDist) {
    var best = null;
    var bestD = maxDist * maxDist;
    for (var i = 0; i < parked.length; i++) {
      var c = parked[i];
      if (c.taken) continue;
      var d = SC.dist2(this.x, this.z, c.x, c.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  };

  Player.prototype.enterCar = function (parkedCar, world) {
    parkedCar.taken = true;
    this.inCar = true;
    this.car = {
      mesh: parkedCar.mesh,
      x: parkedCar.x,
      z: parkedCar.z,
      heading: parkedCar.heading,
      speed: 0,
      steer: 0,
      name: parkedCar.name,
      sports: !!parkedCar.sports,
      parkedRef: parkedCar,
    };
    this.mesh.visible = false;
    this.speed = 0;
    SC.audio.door();
    world.onCrime('steal', 1);
    world.hud.say('You took the ' + parkedCar.name + '. The owner called it in — the cops are coming.');
  };

  Player.prototype.exitCar = function (world) {
    if (!this.car) return;
    var c = this.car;
    // Step out to the left of the car.
    var lx = c.x + Math.cos(c.heading) * 2.2;
    var lz = c.z - Math.sin(c.heading) * 2.2;
    this.x = lx;
    this.z = lz;
    this.heading = c.heading;
    this.inCar = false;
    this.car = null;
    this.speed = 0;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // The car stays where it was left and can be stolen again.
    c.parkedRef.taken = false;
    c.parkedRef.x = c.x;
    c.parkedRef.z = c.z;
    c.parkedRef.heading = c.heading;
    SC.audio.door();
    world.hud.say('Out of the car.');
  };

  Player.prototype.tryPunch = function (world) {
    if (this.punchCooldown > 0 || this.inCar) return;
    this.punchCooldown = 0.45;
    SC.audio.punch();
    // Hit the nearest pedestrian (or cop car bumper) in front of the player.
    var fx = this.x + Math.sin(this.heading) * 1.6;
    var fz = this.z + Math.cos(this.heading) * 1.6;
    var hit = false;
    for (var i = 0; i < world.peds.peds.length; i++) {
      var ped = world.peds.peds[i];
      if (ped.down > 0) continue;
      if (SC.dist2(fx, fz, ped.x, ped.z) < 4.5) {
        world.peds.knockDown(ped);
        hit = true;
        break;
      }
    }
    if (hit) {
      world.onCrime('assault', 1);
      world.hud.say('You decked a pedestrian. Someone called the cops.');
    }
  };

  Player.prototype.damage = function (amount) {
    this.health = SC.clamp(this.health - amount, 0, 100);
  };

  Player.prototype.update = function (dt, input, world) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.stealCooldown = Math.max(0, this.stealCooldown - dt);
    this.crimeCooldown = Math.max(0, this.crimeCooldown - dt);
    if (this.health < 100 && this.crimeCooldown <= 0) {
      this.health = Math.min(100, this.health + dt * 1.2); // slow recovery out of trouble
    }

    if (input.enter && this.stealCooldown <= 0) {
      this.stealCooldown = 0.5;
      if (this.inCar) {
        this.exitCar(world);
      } else {
        var near = this.nearestParkedCar(world.traffic.parked, 4.5);
        if (near) this.enterCar(near, world);
        else world.hud.say('No car close enough to take. Look for a parked car.');
      }
    }
    if (input.punch) this.tryPunch(world);

    if (this.inCar) this.updateDriving(dt, input, world);
    else this.updateOnFoot(dt, input, world);

    this.updateCamera(dt, input);
  };

  Player.prototype.updateOnFoot = function (dt, input, world) {
    var fwdX = Math.sin(this.camYaw);
    var fwdZ = Math.cos(this.camYaw);
    var rightX = Math.cos(this.camYaw);
    var rightZ = -Math.sin(this.camYaw);
    var mx = 0;
    var mz = 0;
    if (input.forward) { mx += fwdX; mz += fwdZ; }
    if (input.back) { mx -= fwdX; mz -= fwdZ; }
    if (input.left) { mx -= rightX; mz -= rightZ; }
    if (input.right) { mx += rightX; mz += rightZ; }
    var len = Math.sqrt(mx * mx + mz * mz);
    var targetSpeed = 0;
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      targetSpeed = input.sprint ? SPRINT_SPEED : WALK_SPEED;
      var wantHeading = Math.atan2(mx, mz);
      this.heading = SC.moveTowardAngle(this.heading, wantHeading, dt * 10);
    }
    this.speed = SC.lerp(this.speed, targetSpeed, dt * 8);
    this.x += mx * this.speed * dt;
    this.z += mz * this.speed * dt;
    // Collisions: buildings, parked cars, traffic cars.
    for (var i = 0; i < world.city.colliders.length; i++) {
      SC.pushOutOfBox(this, 0.6, world.city.colliders[i]);
    }
    this.x = SC.clamp(this.x, -205, 205);
    this.z = SC.clamp(this.z, -205, 245);
    this.walkBob += dt * this.speed * 1.6;
    this.mesh.position.set(this.x, Math.abs(Math.sin(this.walkBob)) * 0.05, this.z);
    this.mesh.rotation.y = this.heading;
  };

  Player.prototype.updateDriving = function (dt, input, world) {
    var c = this.car;
    var maxSpeed = c.sports ? CAR_MAX + 7 : CAR_MAX;
    var accel = 0;
    if (input.forward) accel = CAR_ACCEL;
    if (input.back) {
      accel = c.speed > 0.5 ? -CAR_BRAKE : -CAR_ACCEL * 0.6;
    }
    c.speed += accel * dt;
    // Drag and rolling resistance.
    c.speed -= c.speed * 0.35 * dt;
    if (input.handbrake) {
      c.speed -= c.speed * 2.2 * dt;
    }
    if (!input.forward && !input.back) {
      c.speed -= c.speed * 0.5 * dt;
      if (Math.abs(c.speed) < 0.15) c.speed = 0;
    }
    c.speed = SC.clamp(c.speed, -CAR_REVERSE_MAX, maxSpeed);
    // Steering: less at speed, more with the handbrake.
    var steerTarget = 0;
    if (input.left) steerTarget = 1;
    if (input.right) steerTarget = -1;
    var steerMax = 0.55 * (1 - Math.min(0.6, Math.abs(c.speed) / maxSpeed * 0.6));
    if (input.handbrake) steerMax *= 1.5;
    c.steer = SC.lerp(c.steer, steerTarget * steerMax, dt * 6);
    c.heading += c.steer * c.speed * 0.085 * dt;
    var nx = c.x + Math.sin(c.heading) * c.speed * dt;
    var nz = c.z + Math.cos(c.heading) * c.speed * dt;

    // Collisions with buildings.
    var probe = { x: nx, z: nz };
    var hitBuilding = false;
    for (var i = 0; i < world.city.colliders.length; i++) {
      if (SC.pushOutOfBox(probe, 1.7, world.city.colliders[i])) hitBuilding = true;
    }
    nx = probe.x;
    nz = probe.z;
    // Collisions with traffic and parked cars (circle vs circle).
    var impact = 0;
    var cars = world.traffic.cars;
    for (var j = 0; j < cars.length; j++) {
      var tc = cars[j];
      var d2 = SC.dist2(nx, nz, tc.x, tc.z);
      if (d2 < 4.4 * 4.4) {
        var d = Math.sqrt(d2) || 0.01;
        var push = (4.4 - d) / 2;
        var ux = (nx - tc.x) / d;
        var uz = (nz - tc.z) / d;
        nx += ux * push;
        nz += uz * push;
        tc.x -= ux * push;
        tc.z -= uz * push;
        impact = Math.max(impact, Math.abs(c.speed) * 0.5);
        c.speed *= 0.6;
      }
    }
    for (var k = 0; k < world.traffic.parked.length; k++) {
      var pc = world.traffic.parked[k];
      if (pc.taken) continue;
      var d3 = SC.dist2(nx, nz, pc.x, pc.z);
      if (d3 < 4.4 * 4.4) {
        var dd = Math.sqrt(d3) || 0.01;
        var push2 = 4.4 - dd;
        nx += ((nx - pc.x) / dd) * push2;
        nz += ((nz - pc.z) / dd) * push2;
        impact = Math.max(impact, Math.abs(c.speed) * 0.5);
        c.speed *= 0.55;
      }
    }
    // Pedestrians: hitting one knocks them down and draws the law.
    for (var m = 0; m < world.peds.peds.length; m++) {
      var ped = world.peds.peds[m];
      if (ped.down > 0) continue;
      if (SC.dist2(nx, nz, ped.x, ped.z) < 2.6 * 2.6) {
        world.peds.knockDown(ped);
        if (this.crimeCooldown <= 0) {
          this.crimeCooldown = 4;
          world.onCrime('hitPed', 1);
          world.hud.say('You hit a pedestrian! Wanted level up.');
        }
        c.speed *= 0.85;
      }
    }
    // Police cars: ramming slows both and hurts.
    for (var n = 0; n < world.police.cars.length; n++) {
      var poc = world.police.cars[n];
      var d4 = SC.dist2(nx, nz, poc.x, poc.z);
      if (d4 < 4.6 * 4.6) {
        var d5 = Math.sqrt(d4) || 0.01;
        var push3 = (4.6 - d5) / 2;
        nx += ((nx - poc.x) / d5) * push3;
        nz += ((nz - poc.z) / d5) * push3;
        poc.x -= ((nx - poc.x) / d5) * push3;
        poc.z -= ((nz - poc.z) / d5) * push3;
        if (poc.ramCooldown <= 0) {
          poc.ramCooldown = 1;
          impact = Math.max(impact, 6);
        }
        c.speed *= 0.7;
      }
    }
    if (hitBuilding && Math.abs(c.speed) > 9) {
      impact = Math.max(impact, Math.abs(c.speed) * 0.7);
      c.speed *= 0.45;
    } else if (hitBuilding) {
      c.speed *= 0.7;
    }
    if (impact > 3) {
      SC.audio.crash(impact);
      this.damage(impact * 0.9);
      world.hud.flashDamage();
    }
    c.x = SC.clamp(nx, -205, 205);
    c.z = SC.clamp(nz, -205, 245);
    this.x = c.x;
    this.z = c.z;
    this.speed = c.speed;
    this.heading = c.heading;
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
    SC.audio.engine(Math.abs(c.speed) / maxSpeed, true);
  };

  Player.prototype.updateCamera = function (dt, input) {
    // Mouse drag orbits; the wheel zooms.
    this.camYaw -= input.lookDX * 0.005;
    this.camPitch = SC.clamp(this.camPitch + input.lookDY * 0.004, 0.08, 1.1);
    this.camDist = SC.clamp(this.camDist + input.zoom * 0.5, 6, 15);
    input.lookDX = 0;
    input.lookDY = 0;
    input.zoom = 0;
  };

  // Where the camera should be this frame, and what it looks at.
  Player.prototype.cameraPose = function () {
    var dist = this.inCar ? this.camDist + 2 : this.camDist;
    var height = this.inCar ? 3.6 : 2.6;
    var cx = this.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist;
    var cz = this.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist;
    var cy = height + Math.sin(this.camPitch) * dist;
    var lookX = this.x + Math.sin(this.camYaw) * 4;
    var lookZ = this.z + Math.cos(this.camYaw) * 4;
    return { x: cx, y: cy, z: cz, lookX: lookX, lookY: 1.2, lookZ: lookZ };
  };

  SC.Player = Player;
})();
