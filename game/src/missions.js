// Solmar City — the story: three jobs for fixer Vera, in order. Each mission
// is a chain of steps with a 3D beacon marking the target, a briefing, a
// payout, and (for the last one) a clock. Finish all three to beat the game.

(function () {
  'use strict';

  var MISSION_DEFS = [
    {
      id: 'hot-wheels',
      title: '1 — Hot Wheels',
      briefing: 'Vera needs a Comet GT, yellow, parked by the marina road. Take it — quietly or not — and bring it to the City Garage up north. The owner will call it in, so expect company.',
      payout: 500,
      steps: [
        { kind: 'reach', text: 'Find the yellow Comet GT parked near the marina road', target: { x: 6, z: 104 }, radius: 6 },
        { kind: 'steal', text: 'Steal the Comet GT (press E beside it)', target: { x: 6, z: 104 }, radius: 5, carName: 'Comet GT' },
        { kind: 'deliverCar', text: 'Deliver the Comet GT to the City Garage', target: { x: 130, z: -130 }, radius: 13 },
      ],
    },
    {
      id: 'the-pickup',
      title: '2 — The Pickup',
      briefing: 'A package is waiting at the docks, east side, between the containers. Grab it on foot and bring it back to Café Vera. The dock crew tipped off the cops — two stars the moment you touch it.',
      payout: 800,
      steps: [
        { kind: 'reach', text: 'Drive to the docks on the east side', target: { x: 178, z: 52 }, radius: 10 },
        { kind: 'pickup', text: 'Get out and grab the package (stand on the marker)', target: { x: 178, z: 52 }, radius: 4, hold: 1.5 },
        { kind: 'reach', text: 'Bring the package back to Café Vera', target: { x: -26, z: 78 }, radius: 11 },
      ],
    },
    {
      id: 'the-big-score',
      title: '3 — The Big Score',
      briefing: 'Solmar Jewelers, downtown. Walk up to the counter and stand there to clean it out. Three stars the second the alarm trips. Lose the cops and reach the safehouse in two minutes.',
      payout: 1500,
      steps: [
        { kind: 'reach', text: 'Get to Solmar Jewelers downtown', target: { x: 26, z: -26 }, radius: 11 },
        { kind: 'rob', text: 'Stand at the counter to clean out the jewelers', target: { x: 26, z: -16 }, radius: 4.5, hold: 3 },
        { kind: 'escape', text: 'Escape to the safehouse — lose the cops!', target: { x: -130, z: -130 }, radius: 12, time: 120 },
      ],
    },
  ];

  function Missions(scene, world) {
    this.scene = scene;
    this.world = world;
    this.index = 0; // which mission is active
    this.step = 0;
    this.holdTimer = 0;
    this.missionTimer = 0;
    this.finished = false;
    this.allDone = false;
    // The beacon: a column of light and a ring at the current target.
    var geo = new THREE.CylinderGeometry(2.2, 2.2, 30, 16, 1, true);
    this.beacon = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0xffd21f, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false,
    }));
    this.beacon.position.y = 15;
    scene.add(this.beacon);
    var ringGeo = new THREE.TorusGeometry(3, 0.25, 8, 32);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd21f }));
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 0.3;
    scene.add(this.ring);
    this.updateBeacon();
  }

  Missions.prototype.current = function () {
    return MISSION_DEFS[this.index] || null;
  };

  Missions.prototype.currentStep = function () {
    var m = this.current();
    return m ? m.steps[this.step] : null;
  };

  Missions.prototype.objectiveText = function () {
    if (this.allDone) return 'All jobs done — Solmar is yours. Free roam!';
    var m = this.current();
    if (!m) return '';
    var s = this.currentStep();
    return m.title + ' — ' + (s ? s.text : '');
  };

  Missions.prototype.target = function () {
    var s = this.currentStep();
    return s ? s.target : null;
  };

  Missions.prototype.updateBeacon = function () {
    var t = this.target();
    var visible = !!t && !this.allDone;
    this.beacon.visible = visible;
    this.ring.visible = visible;
    if (t) {
      this.beacon.position.x = t.x;
      this.beacon.position.z = t.z;
      this.ring.position.x = t.x;
      this.ring.position.z = t.z;
    }
  };

  Missions.prototype.advance = function () {
    var m = this.current();
    this.step++;
    this.holdTimer = 0;
    if (this.step >= m.steps.length) {
      // Mission complete: pay out and open the next one.
      this.world.player.money += m.payout;
      SC.audio.missionDone();
      SC.audio.cash();
      this.world.hud.bigMessage(m.title + ' complete!', '+' + SC.formatMoney(m.payout) + ' — ' + (this.index + 1 < MISSION_DEFS.length ? 'Vera has another job.' : 'That was the last job.'));
      this.world.hud.say(m.title + ' complete. ' + SC.formatMoney(m.payout) + ' earned.');
      this.index++;
      this.step = 0;
      if (this.index >= MISSION_DEFS.length) {
        this.allDone = true;
        this.world.hud.bigMessage('SOLMAR IS YOURS', 'All three jobs done. Free roam the city.');
      } else {
        var next = this.current();
        this.world.hud.bigMessage(next.title, next.briefing);
      }
    }
    this.updateBeacon();
  };

  Missions.prototype.fail = function (reason) {
    SC.audio.missionFail();
    this.world.hud.bigMessage('JOB FAILED', reason);
    this.step = 0;
    this.holdTimer = 0;
    this.missionTimer = 0;
    this.updateBeacon();
  };

  Missions.prototype.update = function (dt, input) {
    if (this.allDone) return;
    var m = this.current();
    var s = this.currentStep();
    if (!m || !s) return;
    var p = this.world.player;
    var dx = p.x - s.target.x;
    var dz = p.z - s.target.z;
    var dist = Math.sqrt(dx * dx + dz * dz);

    // The escape timer only runs on the escape step.
    if (s.kind === 'escape') {
      if (this.missionTimer <= 0) this.missionTimer = s.time;
      this.missionTimer -= dt;
      this.world.hud.setTimer(this.missionTimer);
      if (this.missionTimer <= 0) {
        this.fail('The safehouse window closed. Vera will call again — try the job over.');
        return;
      }
    } else {
      this.world.hud.setTimer(0);
    }

    var near = dist < s.radius;
    if (s.kind === 'reach' || s.kind === 'deliverCar') {
      if (near && (s.kind === 'reach' || p.inCar)) this.advance();
      return;
    }
    if (s.kind === 'steal') {
      if (p.inCar && p.car && p.car.name === s.carName) this.advance();
      return;
    }
    if (s.kind === 'pickup' || s.kind === 'rob') {
      if (near && !p.inCar) {
        this.holdTimer += dt;
        this.world.hud.setProgress(this.holdTimer / s.hold, s.kind === 'rob' ? 'Cleaning out the jewelers…' : 'Grabbing the package…');
        if (this.holdTimer >= s.hold) {
          if (s.kind === 'pickup') {
            SC.audio.pickup();
            this.world.police.addWanted(2);
            this.world.hud.say('Package grabbed. Two stars — the docks called it in!');
          } else {
            SC.audio.cash();
            this.world.police.addWanted(3);
            this.world.hud.say('Alarm tripped! Three stars — get to the safehouse!');
          }
          this.advance();
        }
      } else {
        this.holdTimer = 0;
        this.world.hud.setProgress(0, '');
      }
      return;
    }
    if (s.kind === 'escape') {
      if (near) this.advance();
      return;
    }
  };

  // Jump the story to a mission (used by screenshots and the save file).
  Missions.prototype.setMission = function (index, step) {
    this.index = SC.clamp(index, 0, MISSION_DEFS.length - 1);
    this.step = step || 0;
    this.holdTimer = 0;
    this.missionTimer = 0;
    this.allDone = this.index >= MISSION_DEFS.length;
    this.updateBeacon();
  };

  SC.Missions = Missions;
  SC.MISSION_DEFS = MISSION_DEFS;
})();
