// Solmar City — the wanted system and the Solmar PD: black-and-white cruisers
// that spawn at the player's wanted level, chase, ram, and arrest on foot.
// Wanted decays when the player stays out of trouble and out of sight.

(function () {
  'use strict';

  var MAX_WANTED = 5;

  function Police(scene, city, seed) {
    this.scene = scene;
    this.city = city;
    this.rng = SC.makeRng(seed + 211);
    this.wanted = 0;
    this.heat = 0; // 0..1, how "hot" the player is right now
    this.coolTimer = 0;
    this.cars = [];
    this.bustedTimer = 0;
    this.lastCrimeAt = -100;
  }

  Police.prototype.addWanted = function (stars) {
    this.wanted = SC.clamp(this.wanted + stars, 0, MAX_WANTED);
    this.heat = 1;
    this.coolTimer = 0;
    this.lastCrimeAt = SC.now;
  };

  Police.prototype.clearWanted = function () {
    this.wanted = 0;
    this.heat = 0;
    for (var i = 0; i < this.cars.length; i++) this.scene.remove(this.cars[i].mesh);
    this.cars = [];
    this.bustedTimer = 0;
  };

  Police.prototype.spawnCar = function (nearX, nearZ) {
    var rng = this.rng;
    // Spawn on a road a little way off, in a random direction.
    var ang = rng() * Math.PI * 2;
    var dist = 45 + rng() * 25;
    var x = SC.clamp(nearX + Math.sin(ang) * dist, -158, 158);
    var z = SC.clamp(nearZ + Math.cos(ang) * dist, -158, 158);
    // Snap to the nearest road line so cruisers never spawn inside a block.
    var roads = [];
    for (var i = 0; i < 7; i++) roads.push(this.city.roadCoord(i));
    var snap = function (v) {
      var best = roads[0];
      for (var j = 1; j < roads.length; j++) if (Math.abs(roads[j] - v) < Math.abs(best - v)) best = roads[j];
      return best;
    };
    if (Math.abs(x - snap(x)) < Math.abs(z - snap(z))) x = snap(x); else z = snap(z);
    var mesh = SC.buildCarMesh({ color: 0x1a1a1a, police: true });
    // White doors: a thin white band over the body.
    var band = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.3, 2.2),
      new THREE.MeshLambertMaterial({ color: 0xf0f0ea })
    );
    band.position.y = 0.62;
    mesh.add(band);
    this.scene.add(mesh);
    var car = {
      mesh: mesh,
      x: x,
      z: z,
      heading: rng() * Math.PI * 2,
      speed: 0,
      ramCooldown: 0,
      sirenPhase: rng() * 2,
    };
    mesh.position.set(x, 0, z);
    this.cars.push(car);
    return car;
  };

  Police.prototype.nearestNode = function (x, z) {
    var best = null;
    var bestD = Infinity;
    for (var i = 0; i < this.city.nodes.length; i++) {
      var n = this.city.nodes[i];
      var d = SC.dist2(x, z, n.x, n.z);
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  };

  Police.prototype.update = function (dt, player) {
    var now = SC.now;
    // Keep the fleet matched to the wanted level.
    var wantCount = this.wanted === 0 ? 0 : Math.min(this.wanted + 1, 6);
    while (this.cars.length < wantCount) this.spawnCar(player.x, player.z);
    while (this.cars.length > wantCount) {
      var gone = this.cars.pop();
      this.scene.remove(gone.mesh);
    }
    // Cool down: no crime for a while and no police in sight lowers heat.
    if (now - this.lastCrimeAt > 14 && this.cars.length > 0) {
      this.coolTimer += dt;
      if (this.coolTimer > 12) {
        this.wanted = Math.max(0, this.wanted - 1);
        this.coolTimer = 0;
        this.lastCrimeAt = now;
      }
    } else {
      this.coolTimer = 0;
    }

    var nearest = Infinity;
    var anyClose = false;
    for (var i = 0; i < this.cars.length; i++) {
      var car = this.cars[i];
      var dx = player.x - car.x;
      var dz = player.z - car.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < nearest) nearest = dist;
      if (dist < 55) anyClose = true;
      // Far off, chase the intersection nearest the player so cruisers stay
      // on the roads; close in, beeline straight at the player to ram.
      var chaseX = player.x;
      var chaseZ = player.z;
      if (dist > 35) {
        var node = this.nearestNode(player.x, player.z);
        chaseX = node.x;
        chaseZ = node.z;
      }
      var want = Math.atan2(chaseX - car.x, chaseZ - car.z);
      var topSpeed = 13 + this.wanted * 1.6;
      if (player.inCar) topSpeed += 2;
      car.heading = SC.moveTowardAngle(car.heading, want, dt * 2.4);
      // Ram: full speed when lined up, easing off right at contact.
      var align = Math.abs(SC.angleDiff(want, car.heading));
      var target = align < 0.5 ? topSpeed : topSpeed * 0.45;
      if (dist < 6) target = topSpeed * 0.35;
      car.speed = SC.lerp(car.speed, target, dt * 1.2);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      // Flashing light bar: red and blue alternate.
      car.sirenPhase += dt * 9;
      var bar = car.mesh.userData.lightBar;
      var bar2 = car.mesh.userData.lightBar2;
      if (bar && bar2) {
        var on = Math.sin(car.sirenPhase) > 0;
        bar.material.emissive.setHex(on ? 0x2244ff : 0x111111);
        bar2.material.emissive.setHex(on ? 0x111111 : 0xff2222);
      }
      car.ramCooldown -= dt;
    }
    // Arrest: a cruiser sitting on an on-foot player for 2.5 s busts them.
    if (!player.inCar && this.wanted > 0 && nearest < 5) {
      this.bustedTimer += dt;
    } else {
      this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
    }
    this.nearestDist = nearest;
    this.anyClose = anyClose;
    return { busted: this.bustedTimer > 2.5, nearest: nearest, anyClose: anyClose };
  };

  SC.Police = Police;
  SC.MAX_WANTED = MAX_WANTED;
})();
