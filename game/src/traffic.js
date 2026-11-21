// Solmar City — vehicles and people: the car mesh factory, the traffic cars
// that loop the road grid, and the pedestrians who stroll the sidewalks and
// run when trouble comes close.

(function () {
  'use strict';

  var CAR_COLORS = [0xc23b2e, 0x2e6ac2, 0xe8b13c, 0x3a3a3a, 0xe8e4da, 0x4a8a5a, 0x7a4a9a, 0xd86a2e, 0x2a9a8a, 0x8a8a8a];

  // A low-poly car from boxes: body, cabin, wheels, lights. `opts` picks the
  // colour, whether it is a taxi/police/sports variant, and its scale.
  function buildCarMesh(opts) {
    opts = opts || {};
    var color = opts.color !== undefined ? opts.color : 0xc23b2e;
    var group = new THREE.Group();
    var bodyMat = new THREE.MeshLambertMaterial({ color: color });
    var darkMat = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.2), bodyMat);
    body.position.y = 0.55;
    group.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), darkMat);
    cabin.position.set(0, 1.1, -0.2);
    group.add(cabin);
    var wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
    var wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
    var wheelPos = [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]];
    for (var i = 0; i < 4; i++) {
      var wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wheelPos[i][0], 0.36, wheelPos[i][1]);
      group.add(wheel);
    }
    var lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x554400 });
    var tailMat = new THREE.MeshLambertMaterial({ color: 0xd21f1f, emissive: 0x330000 });
    var hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    hl.position.set(-0.6, 0.62, 2.12);
    group.add(hl);
    var hr = hl.clone();
    hr.position.x = 0.6;
    group.add(hr);
    var tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.1), tailMat);
    tl.position.set(-0.6, 0.62, -2.12);
    group.add(tl);
    var tr = tl.clone();
    tr.position.x = 0.6;
    group.add(tr);
    if (opts.taxi) {
      var sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.22, 0.4),
        new THREE.MeshLambertMaterial({ color: 0xffd21f, emissive: 0x443300 })
      );
      sign.position.set(0, 1.5, -0.2);
      group.add(sign);
    }
    if (opts.police) {
      var bar = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.16, 0.4),
        new THREE.MeshLambertMaterial({ color: 0x2244cc, emissive: 0x2244cc, emissiveIntensity: 0.7 })
      );
      bar.position.set(0, 1.45, -0.2);
      group.add(bar);
      var bar2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.16, 0.42),
        new THREE.MeshLambertMaterial({ color: 0xcc2222, emissive: 0xcc2222, emissiveIntensity: 0.7 })
      );
      bar2.position.set(0, 1.45, -0.2);
      group.add(bar2);
      group.userData.lightBar = bar;
      group.userData.lightBar2 = bar2;
    }
    if (opts.sports) {
      var spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.3), darkMat);
      spoiler.position.set(0, 1.0, -2.0);
      group.add(spoiler);
    }
    group.traverse(function (m) { if (m.isMesh) m.castShadow = true; });
    return group;
  }

  // One pedestrian: a capsule body, head, and a shirt colour. Walks with a
  // little bob; falls flat when knocked over and gets back up.
  function buildPedMesh(rng) {
    var group = new THREE.Group();
    var shirt = new THREE.MeshLambertMaterial({ color: SC.pick(rng, [0xe86a5a, 0x3a8ac9, 0xe8b13c, 0x4a8a5a, 0x8a6ac9, 0xe8e4da, 0x2e2e2e]) });
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.1, 8), shirt);
    body.position.y = 0.95;
    group.add(body);
    var head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 10, 8),
      new THREE.MeshLambertMaterial({ color: SC.pick(rng, [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0]) })
    );
    head.position.y = 1.75;
    group.add(head);
    var legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x2e3440 })
    );
    legs.position.y = 0.25;
    group.add(legs);
    group.traverse(function (m) { if (m.isMesh) m.castShadow = true; });
    return group;
  }

  // ---- traffic cars -------------------------------------------------------

  function Traffic(scene, city, seed) {
    this.scene = scene;
    this.city = city;
    this.rng = SC.makeRng(seed + 77);
    this.cars = [];
    this.parked = []; // stealable parked cars: { mesh, x, z, heading, color, name, taken }
    this.spawnParkedCars();
    for (var i = 0; i < 14; i++) this.spawnCar(true);
  }

  Traffic.prototype.nearestNode = function (x, z) {
    var best = null;
    var bestD = Infinity;
    for (var i = 0; i < this.city.nodes.length; i++) {
      var n = this.city.nodes[i];
      var d = SC.dist2(x, z, n.x, n.z);
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  };

  Traffic.prototype.randomNode = function () {
    return this.city.nodes[Math.floor(this.rng() * this.city.nodes.length)];
  };

  Traffic.prototype.spawnCar = function (anywhere) {
    var rng = this.rng;
    var node = anywhere ? this.randomNode() : this.nearestNode(0, 0);
    var mesh = buildCarMesh({ color: CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)], taxi: rng() < 0.14 });
    this.scene.add(mesh);
    var car = {
      mesh: mesh,
      x: node.x + SC.range(rng, -4, 4),
      z: node.z + SC.range(rng, -4, 4),
      heading: rng() * Math.PI * 2,
      speed: SC.range(rng, 6, 10),
      target: this.randomNode(),
      stuck: 0,
    };
    mesh.position.set(car.x, 0, car.z);
    mesh.rotation.y = car.heading;
    this.cars.push(car);
    return car;
  };

  // Parked, stealable cars at fixed scenic spots, one of them the yellow
  // sports car mission 1 needs.
  Traffic.prototype.spawnParkedCars = function () {
    var spots = [
      { x: 6, z: 104, heading: Math.PI / 2, color: 0xffd21f, sports: true, name: 'Comet GT' },
      { x: -58, z: 84, heading: 0, color: 0xc23b2e, name: 'Vulcano' },
      { x: 58, z: -58, heading: Math.PI, color: 0x2e6ac2, name: 'Bayside' },
      { x: -110, z: -46, heading: -Math.PI / 2, color: 0xe8e4da, name: 'Sunrunner' },
      { x: 110, z: 110, heading: Math.PI / 2, color: 0x4a8a5a, name: 'Palm GT' },
      { x: -6, z: -110, heading: 0, color: 0x7a4a9a, taxi: true, name: 'Cab' },
    ];
    for (var i = 0; i < spots.length; i++) {
      var s = spots[i];
      var mesh = buildCarMesh({ color: s.color, sports: !!s.sports, taxi: !!s.taxi });
      mesh.position.set(s.x, 0, s.z);
      mesh.rotation.y = s.heading;
      this.scene.add(mesh);
      this.parked.push({ mesh: mesh, x: s.x, z: s.z, heading: s.heading, color: s.color, name: s.name, sports: !!s.sports, taken: false });
    }
  };

  Traffic.prototype.update = function (dt, playerPos, playerSpeed) {
    for (var i = 0; i < this.cars.length; i++) {
      var car = this.cars[i];
      var dx = car.target.x - car.x;
      var dz = car.target.z - car.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 4) {
        car.target = this.randomNode();
        continue;
      }
      var want = Math.atan2(dx, dz);
      car.heading = SC.moveTowardAngle(car.heading, want, dt * 1.6);
      // Slow down when the player is right ahead, or near a turn.
      var slow = 1;
      if (playerPos) {
        var pd = SC.dist2(car.x, car.z, playerPos.x, playerPos.z);
        if (pd < 100) slow = 0.45;
      }
      var turnSlow = 1 - Math.min(0.5, Math.abs(SC.angleDiff(want, car.heading)) * 0.6);
      var speed = car.speed * slow * turnSlow;
      car.x += Math.sin(car.heading) * speed * dt;
      car.z += Math.cos(car.heading) * speed * dt;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      // Keep inside the city: if a car wanders past the edge, retarget it.
      if (Math.abs(car.x) > 170 || Math.abs(car.z) > 170) {
        car.target = this.randomNode();
        car.x = SC.clamp(car.x, -160, 160);
        car.z = SC.clamp(car.z, -160, 160);
      }
    }
  };

  // ---- pedestrians --------------------------------------------------------

  function Pedestrians(scene, city, seed) {
    this.scene = scene;
    this.city = city;
    this.rng = SC.makeRng(seed + 131);
    this.peds = [];
    for (var i = 0; i < 26; i++) this.spawn(true);
  }

  Pedestrians.prototype.randomSidewalkPoint = function () {
    var rng = this.rng;
    var bx = Math.floor(rng() * 6);
    var bz = Math.floor(rng() * 6);
    var cx = this.city.blockCenter(bx);
    var cz = this.city.blockCenter(bz);
    // A point on the sidewalk ring around a block.
    var side = Math.floor(rng() * 4);
    var t = SC.range(rng, -20, 20);
    if (side === 0) return { x: cx + t, z: cz - 23 };
    if (side === 1) return { x: cx + t, z: cz + 23 };
    if (side === 2) return { x: cx - 23, z: cz + t };
    return { x: cx + 23, z: cz + t };
  };

  Pedestrians.prototype.spawn = function (anywhere) {
    var rng = this.rng;
    var p = anywhere ? this.randomSidewalkPoint() : this.randomSidewalkPoint();
    var mesh = buildPedMesh(rng);
    this.scene.add(mesh);
    var ped = {
      mesh: mesh,
      x: p.x,
      z: p.z,
      heading: rng() * Math.PI * 2,
      speed: SC.range(rng, 1.2, 2.2),
      target: this.randomSidewalkPoint(),
      bob: rng() * 10,
      down: 0, // >0 while knocked down
      flee: 0, // >0 while running from danger
    };
    mesh.position.set(ped.x, 0, ped.z);
    this.peds.push(ped);
    return ped;
  };

  Pedestrians.prototype.knockDown = function (ped) {
    if (ped.down > 0) return;
    ped.down = 2.5;
    ped.mesh.rotation.x = Math.PI / 2 - 0.15;
    ped.mesh.position.y = 0.35;
  };

  Pedestrians.prototype.update = function (dt, dangerPos, dangerRadius) {
    for (var i = 0; i < this.peds.length; i++) {
      var ped = this.peds[i];
      if (ped.down > 0) {
        ped.down -= dt;
        if (ped.down <= 0) {
          ped.mesh.rotation.x = 0;
          ped.mesh.position.y = 0;
          ped.target = this.randomSidewalkPoint();
        }
        continue;
      }
      var dx = ped.target.x - ped.x;
      var dz = ped.target.z - ped.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 2) {
        ped.target = this.randomSidewalkPoint();
        continue;
      }
      var want = Math.atan2(dx, dz);
      var speed = ped.speed;
      if (dangerPos && SC.dist2(ped.x, ped.z, dangerPos.x, dangerPos.z) < dangerRadius * dangerRadius) {
        // Flee: run away from the danger.
        var fx = ped.x - dangerPos.x;
        var fz = ped.z - dangerPos.z;
        var fl = Math.sqrt(fx * fx + fz * fz) || 1;
        want = Math.atan2(fx / fl, fz / fl);
        speed = 5.5;
        ped.flee = 1;
      }
      ped.heading = SC.moveTowardAngle(ped.heading, want, dt * 4);
      ped.x += Math.sin(ped.heading) * speed * dt;
      ped.z += Math.cos(ped.heading) * speed * dt;
      ped.bob += dt * (speed > 3 ? 14 : 8);
      ped.mesh.position.set(ped.x, Math.abs(Math.sin(ped.bob)) * 0.06, ped.z);
      ped.mesh.rotation.y = ped.heading;
    }
  };

  SC.buildCarMesh = buildCarMesh;
  SC.Traffic = Traffic;
  SC.Pedestrians = Pedestrians;
})();
