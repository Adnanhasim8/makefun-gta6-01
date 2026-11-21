// Solmar City — the city itself: a sun-soaked coastal grid, built once from a
// fixed seed so every load (and every screenshot) shows the same streets.
// Ground is one big painted canvas texture; buildings are boxes with painted
// facades; palms, lamps, the beach, the pier and the docks finish the scene.

(function () {
  'use strict';

  var ROAD_W = 12;
  var PITCH = 52; // road centre to road centre
  var ROAD_COUNT = 7; // roads each way, at -156 .. 156
  var HALF = 162; // outer road centre + half road width
  var BLOCK = 40; // building block size

  function roadCoord(i) {
    return -156 + i * PITCH;
  }

  function blockCenter(i) {
    return -130 + i * PITCH;
  }

  // Painted facade: a canvas of lit windows on a warm wall, reused per building.
  function facadeTexture(rng, tint) {
    var c = document.createElement('canvas');
    c.width = 128;
    c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = tint;
    g.fillRect(0, 0, 128, 256);
    var cols = 4 + Math.floor(rng() * 3);
    var rows = 6 + Math.floor(rng() * 5);
    for (var r = 0; r < rows; r++) {
      for (var col = 0; col < cols; col++) {
        var lit = rng() < 0.22;
        g.fillStyle = lit ? '#ffd98a' : (rng() < 0.5 ? '#2e3a4a' : '#42506a');
        g.fillRect(8 + col * ((128 - 16) / cols) + 2, 12 + r * ((256 - 24) / rows) + 3,
          (128 - 16) / cols - 5, (256 - 24) / rows - 7);
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, 0, 128, 10);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // A painted sign board with text, used for the named landmarks.
  function signTexture(text, bg, fg) {
    var c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, 512, 128);
    g.strokeStyle = fg;
    g.lineWidth = 6;
    g.strokeRect(8, 8, 496, 112);
    g.fillStyle = fg;
    g.font = 'bold 64px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 256, 68);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // The whole ground in one 2048 canvas: sand, sidewalks, asphalt, lane dashes,
  // crosswalks, the park lawn and the lot colours, mapped over [-190, 190].
  function groundTexture(rng) {
    var S = 2048;
    var span = 380;
    var px = S / span;
    function X(x) { return (x + 190) * px; }
    function Z(z) { return (z + 190) * px; }
    var c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    var g = c.getContext('2d');
    // Base: warm sand (shows at the beach and the outer edges).
    g.fillStyle = '#e6cf9e';
    g.fillRect(0, 0, S, S);
    // City slab: pale sidewalk concrete.
    g.fillStyle = '#c7bdaa';
    g.fillRect(X(-168), Z(-168), 336 * px, 336 * px);
    // Block interiors: slightly varied lot colours.
    for (var bx = 0; bx < 6; bx++) {
      for (var bz = 0; bz < 6; bz++) {
        var cx = blockCenter(bx);
        var cz = blockCenter(bz);
        var shade = 150 + Math.floor(rng() * 30);
        g.fillStyle = 'rgb(' + shade + ',' + (shade - 8) + ',' + (shade - 30) + ')';
        g.fillRect(X(cx - BLOCK / 2), Z(cz - BLOCK / 2), BLOCK * px, BLOCK * px);
      }
    }
    // Park lawn (block 3,3) and the plaza (block 0,5).
    g.fillStyle = '#6fae5e';
    g.fillRect(X(26 - BLOCK / 2), Z(26 - BLOCK / 2), BLOCK * px, BLOCK * px);
    g.fillStyle = '#b5a88f';
    g.fillRect(X(-130 - BLOCK / 2), Z(130 - BLOCK / 2), BLOCK * px, BLOCK * px);
    // Roads: asphalt strips.
    g.fillStyle = '#3c3c44';
    for (var i = 0; i < ROAD_COUNT; i++) {
      var rc = roadCoord(i);
      g.fillRect(X(-168), Z(rc - ROAD_W / 2), 336 * px, ROAD_W * px);
      g.fillRect(X(rc - ROAD_W / 2), Z(-168), ROAD_W * px, 336 * px);
    }
    // Centre dashes (warm yellow) and edge lines.
    g.fillStyle = '#d8b13c';
    for (var j = 0; j < ROAD_COUNT; j++) {
      var r2 = roadCoord(j);
      for (var d = -168; d < 168; d += 10) {
        g.fillRect(X(d), Z(r2 - 0.4), 5 * px, 0.8 * px);
        g.fillRect(X(r2 - 0.4), Z(d), 0.8 * px, 5 * px);
      }
    }
    // Crosswalks at every intersection.
    g.fillStyle = 'rgba(240,240,230,0.85)';
    for (var a = 0; a < ROAD_COUNT; a++) {
      for (var b = 0; b < ROAD_COUNT; b++) {
        var x = roadCoord(a);
        var z = roadCoord(b);
        for (var s = -4; s <= 4; s += 2) {
          g.fillRect(X(x + s - 0.7), Z(z - ROAD_W / 2 + 1), 1.4 * px, 2.4 * px);
          g.fillRect(X(x + s - 0.7), Z(z + ROAD_W / 2 - 3.4), 1.4 * px, 2.4 * px);
          g.fillRect(X(x - ROAD_W / 2 + 1), Z(z + s - 0.7), 2.4 * px, 1.4 * px);
          g.fillRect(X(x + ROAD_W / 2 - 3.4), Z(z + s - 0.7), 2.4 * px, 1.4 * px);
        }
      }
    }
    // Docks apron (east) and the beach edge (south).
    g.fillStyle = '#9a938a';
    g.fillRect(X(168), Z(26), 22 * px, 104 * px);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  function makePalm(rng) {
    var group = new THREE.Group();
    var trunkH = 5 + rng() * 2;
    var trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.3, trunkH, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a6a4a })
    );
    trunk.position.y = trunkH / 2;
    trunk.rotation.z = (rng() - 0.5) * 0.2;
    group.add(trunk);
    var leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e });
    for (var i = 0; i < 6; i++) {
      var leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.2, 4), leafMat);
      var ang = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(ang) * 1.1, trunkH + 0.3, Math.sin(ang) * 1.1);
      leaf.rotation.z = Math.cos(ang) * 1.1;
      leaf.rotation.x = -Math.sin(ang) * 1.1;
      group.add(leaf);
    }
    var nuts = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x6b4a2a })
    );
    nuts.position.y = trunkH + 0.2;
    group.add(nuts);
    return group;
  }

  function makeLamp() {
    var group = new THREE.Group();
    var pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 6.5, 6),
      new THREE.MeshLambertMaterial({ color: 0x2c2c30 })
    );
    pole.position.y = 3.25;
    group.add(pole);
    var arm = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.12, 0.12),
      new THREE.MeshLambertMaterial({ color: 0x2c2c30 })
    );
    arm.position.set(0.7, 6.4, 0);
    group.add(arm);
    var bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x554411 })
    );
    bulb.position.set(1.45, 6.3, 0);
    group.add(bulb);
    return group;
  }

  function makeTrafficLight() {
    var group = new THREE.Group();
    var pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 5.5, 6),
      new THREE.MeshLambertMaterial({ color: 0x222226 })
    );
    pole.position.y = 2.75;
    group.add(pole);
    var box = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 1.5, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1c })
    );
    box.position.y = 5.2;
    group.add(box);
    var colors = [0xff3b30, 0xffcc00, 0x34c759];
    for (var i = 0; i < 3; i++) {
      var lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 6),
        new THREE.MeshLambertMaterial({ color: colors[i], emissive: colors[i], emissiveIntensity: 0.6 })
      );
      lamp.position.set(0, 5.65 - i * 0.45, 0.26);
      group.add(lamp);
    }
    return group;
  }

  // One building: a box with a painted facade, a dark roof slab and rooftop kit.
  function makeBuilding(rng, x, z, w, d, h, facadeTex, tint) {
    var group = new THREE.Group();
    var mat = new THREE.MeshLambertMaterial({ map: facadeTex, color: tint });
    var body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    body.position.y = h / 2;
    group.add(body);
    var roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.4, 0.6, d + 0.4),
      new THREE.MeshLambertMaterial({ color: 0x4a4038 })
    );
    roof.position.y = h + 0.3;
    group.add(roof);
    if (h > 20 && rng() < 0.8) {
      var ac = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 1.2, 2.5),
        new THREE.MeshLambertMaterial({ color: 0x8a8a86 })
      );
      ac.position.set((rng() - 0.5) * (w - 4), h + 1.2, (rng() - 0.5) * (d - 4));
      group.add(ac);
    }
    group.position.set(x, 0, z);
    return group;
  }

  function build(scene, seed) {
    var rng = SC.makeRng(seed);
    var colliders = []; // { minX, maxX, minZ, maxZ }
    var palette = ['#e8d8b0', '#d9a066', '#c97e5a', '#e6b8a0', '#b8c4c0', '#d9c48f', '#c9b18a', '#e0a878'];
    var facades = [
      facadeTexture(rng, '#f2e2c4'),
      facadeTexture(rng, '#e8c9a0'),
      facadeTexture(rng, '#d9b48a'),
      facadeTexture(rng, '#cbb59a'),
    ];

    // Ground.
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(380, 380),
      new THREE.MeshLambertMaterial({ map: groundTexture(rng) })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Ocean (south) and the sand strip are part of the ground texture's base;
    // the water plane sits just past the beach with a warm sunset tint.
    var ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 130),
      new THREE.MeshLambertMaterial({ color: 0x2e7f9e, transparent: true, opacity: 0.94 })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, -0.15, 255);
    scene.add(ocean);

    // Pier planks out into the water at x = 0.
    var pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a44 });
    for (var p = 0; p < 14; p++) {
      var plank = new THREE.Mesh(new THREE.BoxGeometry(10, 0.25, 2.4), pierMat);
      plank.position.set(0, 0.35, 196 + p * 2.6);
      scene.add(plank);
    }
    var pierEnd = new THREE.Mesh(new THREE.BoxGeometry(16, 0.3, 10), pierMat);
    pierEnd.position.set(0, 0.35, 234);
    scene.add(pierEnd);

    // Landmark blocks: park (3,3), plaza (0,5), cafe (2,4), jewelers (3,2),
    // garage (5,0), safehouse (0,0). Every other block gets 1-4 buildings.
    var landmarkBlocks = { '3,3': 'park', '0,5': 'plaza', '2,4': 'cafe', '3,2': 'jewelers', '5,0': 'garage', '0,0': 'safehouse' };

    for (var bx = 0; bx < 6; bx++) {
      for (var bz = 0; bz < 6; bz++) {
        var key = bx + ',' + bz;
        var cx = blockCenter(bx);
        var cz = blockCenter(bz);
        var kind = landmarkBlocks[key];
        if (kind === 'park') {
          // Lawn, paths and palms.
          for (var t = 0; t < 12; t++) {
            var palm = makePalm(rng);
            palm.position.set(cx + SC.range(rng, -16, 16), 0, cz + SC.range(rng, -16, 16));
            scene.add(palm);
          }
          var pond = new THREE.Mesh(
            new THREE.CircleGeometry(6, 24),
            new THREE.MeshLambertMaterial({ color: 0x4a90b8 })
          );
          pond.rotation.x = -Math.PI / 2;
          pond.position.set(cx + 6, 0.06, cz - 4);
          scene.add(pond);
          continue;
        }
        if (kind === 'plaza') {
          for (var u = 0; u < 8; u++) {
            var palm2 = makePalm(rng);
            palm2.position.set(cx + SC.range(rng, -16, 16), 0, cz + SC.range(rng, -16, 16));
            scene.add(palm2);
          }
          continue;
        }
        if (kind === 'cafe' || kind === 'jewelers' || kind === 'garage' || kind === 'safehouse') {
          var h = kind === 'garage' ? 7 : 9;
          var tint = kind === 'cafe' ? 0xf2d8a0 : kind === 'jewelers' ? 0xdfe8ea : kind === 'garage' ? 0xc9a06a : 0xe8c9b0;
          var b = makeBuilding(rng, cx, cz, 26, 16, h, SC.pick(rng, facades), tint);
          scene.add(b);
          colliders.push({ minX: cx - 13, maxX: cx + 13, minZ: cz - 8, maxZ: cz + 8 });
          var label = kind === 'cafe' ? 'CAFE VERA' : kind === 'jewelers' ? 'SOLMAR JEWELERS' : kind === 'garage' ? 'CITY GARAGE' : 'SAFEHOUSE';
          var bg = kind === 'cafe' ? '#7a3b2e' : kind === 'jewelers' ? '#1f3a5f' : kind === 'garage' ? '#3a3a3a' : '#2e5f3a';
          var sign = new THREE.Mesh(
            new THREE.PlaneGeometry(20, 5),
            new THREE.MeshBasicMaterial({ map: signTexture(label, bg, '#ffe9a8') })
          );
          sign.position.set(cx, h - 1.5, cz - 8.2);
          sign.rotation.y = Math.PI;
          scene.add(sign);
          continue;
        }
        // Ordinary block: split into 1-4 lots.
        var lots = SC.intRange(rng, 1, 4);
        for (var l = 0; l < lots; l++) {
          var w = SC.range(rng, 10, 18);
          var d = SC.range(rng, 10, 18);
          var bh = SC.range(rng, 8, 42);
          if (rng() < 0.12) bh = SC.range(rng, 42, 60); // a tower now and then
          var lx = cx + SC.range(rng, -(BLOCK / 2 - w / 2 - 1), BLOCK / 2 - w / 2 - 1);
          var lz = cz + SC.range(rng, -(BLOCK / 2 - d / 2 - 1), BLOCK / 2 - d / 2 - 1);
          var nb = makeBuilding(rng, lx, lz, w, d, bh, SC.pick(rng, facades), SC.pick(rng, palette));
          scene.add(nb);
          colliders.push({ minX: lx - w / 2, maxX: lx + w / 2, minZ: lz - d / 2, maxZ: lz + d / 2 });
        }
      }
    }

    // Miramar hotel tower on the beachfront (south-west), the city postcard.
    var hotel = makeBuilding(rng, -104, 150, 30, 18, 52, facades[0], 0xf2e2c4);
    scene.add(hotel);
    colliders.push({ minX: -119, maxX: -89, minZ: 141, maxZ: 159 });
    var hotelSign = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 6),
      new THREE.MeshBasicMaterial({ map: signTexture('HOTEL MIRAMAR', '#2e5f6a', '#ffe9a8') })
    );
    hotelSign.position.set(-104, 46, 140.8);
    hotelSign.rotation.y = Math.PI;
    scene.add(hotelSign);

    // Docks: shipping containers east of the city.
    var containerColors = [0xb8502e, 0x2e6a8a, 0x6a8a2e, 0xc9a13c, 0x7a4a8a];
    for (var ci = 0; ci < 10; ci++) {
      var cw = 12, ch = 2.6, cd = 2.6;
      var cx2 = 176 + (ci % 2) * 8;
      var cz2 = -20 + Math.floor(ci / 2) * 14;
      var cont = new THREE.Mesh(
        new THREE.BoxGeometry(cw, ch, cd),
        new THREE.MeshLambertMaterial({ color: containerColors[ci % containerColors.length] })
      );
      cont.position.set(cx2, ch / 2 + (ci % 3 === 0 ? ch : 0), cz2);
      cont.rotation.y = (ci % 2) * 0.12;
      scene.add(cont);
      colliders.push({ minX: cx2 - 6, maxX: cx2 + 6, minZ: cz2 - 2, maxZ: cz2 + 2 });
    }

    // Street lamps along the roads and traffic lights at every other corner.
    for (var ri = 0; ri < ROAD_COUNT; ri++) {
      var rc = roadCoord(ri);
      for (var along = -150; along <= 150; along += 52) {
        var lamp = makeLamp();
        lamp.position.set(rc + 7, 0, along + 10);
        scene.add(lamp);
        var lamp2 = makeLamp();
        lamp2.position.set(along + 10, 0, rc + 7);
        lamp2.rotation.y = Math.PI / 2;
        scene.add(lamp2);
      }
    }
    for (var ti = 0; ti < ROAD_COUNT; ti += 2) {
      for (var tj = 0; tj < ROAD_COUNT; tj += 2) {
        var tl = makeTrafficLight();
        tl.position.set(roadCoord(ti) + 7, 0, roadCoord(tj) + 7);
        scene.add(tl);
      }
    }

    // Beach palms and umbrellas along the sand.
    for (var bi = 0; bi < 10; bi++) {
      var bp = makePalm(rng);
      bp.position.set(-160 + bi * 34 + SC.range(rng, -6, 6), 0, 176 + SC.range(rng, -3, 3));
      scene.add(bp);
      var um = new THREE.Group();
      var pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6),
        new THREE.MeshLambertMaterial({ color: 0xd8d0c0 })
      );
      pole.position.y = 1.2;
      um.add(pole);
      var shade = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 1, 8),
        new THREE.MeshLambertMaterial({ color: bi % 2 ? 0xe86a5a : 0x3a8ac9 })
      );
      shade.position.y = 2.6;
      um.add(shade);
      um.position.set(-150 + bi * 34, 0, 184);
      scene.add(um);
    }

    // Road graph: intersections, for traffic and police routing.
    var nodes = [];
    for (var ni = 0; ni < ROAD_COUNT; ni++) {
      for (var nj = 0; nj < ROAD_COUNT; nj++) {
        nodes.push({ x: roadCoord(ni), z: roadCoord(nj) });
      }
    }

    return {
      colliders: colliders,
      nodes: nodes,
      bounds: HALF + 40,
      landmarks: {
        cafe: { x: -26, z: 78 },
        jewelers: { x: 26, z: -26 },
        garage: { x: 130, z: -130 },
        safehouse: { x: -130, z: -130 },
        docks: { x: 178, z: 52 },
        park: { x: 26, z: 26 },
        beach: { x: -104, z: 180 },
      },
      spawn: { x: -26, z: 96, heading: Math.PI },
      roadCoord: roadCoord,
      blockCenter: blockCenter,
    };
  }

  SC.city = { build: build, ROAD_W: ROAD_W, PITCH: PITCH };
})();
