// Solmar City — the HUD: health, cash, wanted stars, the minimap, mission
// text, the message feed, and every screen (start, pause, wasted, busted).
// All DOM, built here, so index.html stays a thin shell.

(function () {
  'use strict';

  function el(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function Hud(world) {
    this.world = world;
    this.root = el('div', 'hud', document.body);

    // Top-left: health + cash.
    var tl = el('div', 'hud-tl', this.root);
    var healthWrap = el('div', 'health-wrap', tl);
    el('span', 'hud-label', healthWrap).textContent = 'HEALTH';
    this.healthBar = el('div', 'health-bar', healthWrap);
    this.healthFill = el('div', 'health-fill', this.healthBar);
    var cashWrap = el('div', 'cash-wrap', tl);
    el('span', 'hud-label', cashWrap).textContent = 'CASH';
    this.cash = el('span', 'cash', cashWrap);
    this.cash.textContent = '$0';

    // Top-right: wanted stars.
    var tr = el('div', 'hud-tr', this.root);
    this.stars = el('div', 'stars', tr);
    this.stars.textContent = '☆☆☆☆☆';
    var wantedLabel = el('div', 'wanted-label', tr);
    wantedLabel.textContent = 'WANTED';

    // Top-centre: mission objective + timer.
    var tc = el('div', 'hud-tc', this.root);
    this.objective = el('div', 'objective', tc);
    this.timer = el('div', 'timer', tc);
    this.timer.style.display = 'none';

    // Bottom-left: minimap.
    var bl = el('div', 'hud-bl', this.root);
    this.map = el('canvas', 'minimap', bl);
    this.map.width = 190;
    this.map.height = 190;
    var mapLabel = el('div', 'map-label', bl);
    mapLabel.textContent = 'SOLMAR CITY';

    // Bottom-right: speed + car.
    var br = el('div', 'hud-br', this.root);
    this.speed = el('div', 'speed', br);
    this.speed.textContent = '';
    this.carName = el('div', 'car-name', br);

    // Bottom-centre: hold progress bar.
    var bc = el('div', 'hud-bc', this.root);
    this.progressWrap = el('div', 'progress-wrap', bc);
    this.progressWrap.style.display = 'none';
    this.progressLabel = el('div', 'progress-label', this.progressWrap);
    this.progressBar = el('div', 'progress-bar', this.progressWrap);
    this.progressFill = el('div', 'progress-fill', this.progressBar);

    // Message feed, above the minimap.
    this.feed = el('div', 'feed', this.root);

    // Big centre message.
    this.big = el('div', 'big-message', this.root);
    this.bigTitle = el('div', 'big-title', this.big);
    this.bigSub = el('div', 'big-sub', this.big);
    this.big.style.display = 'none';
    this.bigTimer = 0;

    // Damage flash.
    this.flash = el('div', 'damage-flash', this.root);

    // Controls hint.
    var hint = el('div', 'hint', this.root);
    hint.textContent = 'WASD move / drive · Mouse drag camera · E enter car · F punch · Shift sprint · Space handbrake · P pause · M mute';

    // Mute button.
    this.muteBtn = el('button', 'mute-btn', this.root);
    this.muteBtn.textContent = '🔊 Sound on';
    var self = this;
    this.muteBtn.addEventListener('click', function () {
      var m = SC.audio.setMuted(!SC.audio.isMuted());
      self.muteBtn.textContent = m ? '🔇 Muted' : '🔊 Sound on';
    });

    // Overlays: start, pause, end.
    this.overlay = el('div', 'overlay', document.body);
    this.overlayInner = el('div', 'overlay-inner', this.overlay);
  }

  Hud.prototype.say = function (text) {
    var line = el('div', 'feed-line', this.feed);
    line.textContent = text;
    while (this.feed.children.length > 4) this.feed.removeChild(this.feed.firstChild);
    setTimeout(function () {
      if (line.parentNode) line.style.opacity = '0.35';
    }, 6000);
  };

  Hud.prototype.bigMessage = function (title, sub) {
    this.bigTitle.textContent = title;
    this.bigSub.textContent = sub || '';
    this.big.style.display = 'block';
    this.bigTimer = 4.5;
  };

  Hud.prototype.setTimer = function (seconds) {
    if (seconds > 0) {
      this.timer.style.display = 'block';
      this.timer.textContent = '⏱ ' + SC.formatTime(seconds);
    } else {
      this.timer.style.display = 'none';
    }
  };

  Hud.prototype.setProgress = function (frac, label) {
    if (frac > 0 && label) {
      this.progressWrap.style.display = 'block';
      this.progressLabel.textContent = label;
      this.progressFill.style.width = Math.round(SC.clamp(frac, 0, 1) * 100) + '%';
    } else {
      this.progressWrap.style.display = 'none';
    }
  };

  Hud.prototype.flashDamage = function () {
    var self = this;
    this.flash.style.opacity = '0.55';
    setTimeout(function () { self.flash.style.opacity = '0'; }, 180);
  };

  Hud.prototype.update = function (dt) {
    var w = this.world;
    var p = w.player;
    this.healthFill.style.width = Math.round(p.health) + '%';
    this.healthFill.style.background = p.health > 50 ? '#4caf50' : p.health > 25 ? '#ff9800' : '#f44336';
    this.cash.textContent = SC.formatMoney(p.money);
    var stars = '';
    for (var i = 0; i < 5; i++) stars += i < w.police.wanted ? '★' : '☆';
    this.stars.textContent = stars;
    this.stars.style.color = w.police.wanted > 0 ? '#ffd21f' : 'rgba(255,255,255,0.55)';
    this.objective.textContent = w.missions.objectiveText();
    if (p.inCar && p.car) {
      this.speed.textContent = Math.round(Math.abs(p.speed) * 3.6) + ' km/h';
      this.carName.textContent = p.car.name;
    } else {
      this.speed.textContent = '';
      this.carName.textContent = p.inCar ? '' : 'On foot';
    }
    if (this.bigTimer > 0) {
      this.bigTimer -= dt;
      if (this.bigTimer <= 0) this.big.style.display = 'none';
    }
    this.drawMinimap();
  };

  Hud.prototype.drawMinimap = function () {
    var w = this.world;
    var g = this.map.getContext('2d');
    var S = 190;
    var span = 470; // world units across the map
    function mx(x) { return (x + 215) / span * S; }
    function mz(z) { return (z + 215) / span * S; }
    g.clearRect(0, 0, S, S);
    g.fillStyle = 'rgba(20, 24, 32, 0.88)';
    g.fillRect(0, 0, S, S);
    // Ocean strip at the bottom.
    g.fillStyle = '#2e7f9e';
    g.fillRect(0, mz(168), S, S - mz(168));
    // Park.
    g.fillStyle = '#3f7a3a';
    g.fillRect(mx(6), mz(6), 40 / span * S, 40 / span * S);
    // Roads.
    g.strokeStyle = '#8a8a92';
    g.lineWidth = 2;
    for (var i = 0; i < 7; i++) {
      var rc = w.city.roadCoord(i);
      g.beginPath(); g.moveTo(mx(-168), mz(rc)); g.lineTo(mx(168), mz(rc)); g.stroke();
      g.beginPath(); g.moveTo(mx(rc), mz(-168)); g.lineTo(mx(rc), mz(168)); g.stroke();
    }
    // Buildings.
    g.fillStyle = '#5a5a62';
    var cols = w.city.colliders;
    for (var j = 0; j < cols.length; j++) {
      var c = cols[j];
      g.fillRect(mx(c.minX), mz(c.minZ), (c.maxX - c.minX) / span * S, (c.maxZ - c.minZ) / span * S);
    }
    // Traffic dots.
    g.fillStyle = '#bbbbbb';
    for (var t = 0; t < w.traffic.cars.length; t++) {
      g.fillRect(mx(w.traffic.cars[t].x) - 1, mz(w.traffic.cars[t].z) - 1, 2, 2);
    }
    // Police dots.
    g.fillStyle = '#3a86ff';
    for (var q = 0; q < w.police.cars.length; q++) {
      g.beginPath();
      g.arc(mx(w.police.cars[q].x), mz(w.police.cars[q].z), 3, 0, Math.PI * 2);
      g.fill();
    }
    // Mission target: pulsing yellow ring.
    var target = w.missions.target();
    if (target && !w.missions.allDone) {
      var pulse = 4 + Math.sin(SC.now * 5) * 1.5;
      g.strokeStyle = '#ffd21f';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(mx(target.x), mz(target.z), pulse, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#ffd21f';
      g.beginPath();
      g.arc(mx(target.x), mz(target.z), 2.5, 0, Math.PI * 2);
      g.fill();
    }
    // Player arrow.
    var p = w.player;
    g.save();
    g.translate(mx(p.x), mz(p.z));
    g.rotate(Math.PI - p.heading);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -6);
    g.lineTo(4.5, 5);
    g.lineTo(-4.5, 5);
    g.closePath();
    g.fill();
    g.restore();
  };

  // ---- screens ------------------------------------------------------------

  Hud.prototype.showStart = function (hasSave, onStart, onContinue) {
    var self = this;
    this.overlay.style.display = 'flex';
    this.overlayInner.innerHTML = '';
    var title = el('h1', 'game-title', this.overlayInner);
    title.textContent = 'SOLMAR CITY';
    var sub = el('div', 'game-sub', this.overlayInner);
    sub.textContent = 'A sun-soaked open-world crime story';
    var story = el('p', 'game-story', this.overlayInner);
    story.textContent = 'Marco Solis is back in Solmar City with empty pockets and a fast reputation. ' +
      'Vera, the fixer at Café Vera, has three jobs that pay real money — if the Solmar PD doesn\'t catch him first. ' +
      'Steal cars, outrun the law, and take the city job by job.';
    var controls = el('div', 'game-controls', this.overlayInner);
    controls.innerHTML = '<b>Controls</b> — WASD move / drive · Mouse drag to look · E get in / out of a car · ' +
      'F punch · Shift sprint · Space handbrake · P pause · M mute<br>' +
      '<b>Jobs</b> — follow the yellow beacon. Steal the Comet GT, grab the docks package, hit the jewelers.';
    var startBtn = el('button', 'big-btn', this.overlayInner);
    startBtn.textContent = '▶  Start a new game';
    startBtn.addEventListener('click', function () { SC.audio.click(); onStart(); });
    if (hasSave) {
      var contBtn = el('button', 'big-btn secondary', this.overlayInner);
      contBtn.textContent = '↻  Continue saved game';
      contBtn.addEventListener('click', function () { SC.audio.click(); onContinue(); });
    }
    var foot = el('div', 'game-foot', this.overlayInner);
    foot.textContent = 'An original game. Solmar City, its people and its story are invented — no real city, no licensed cars, no borrowed names.';
  };

  Hud.prototype.showPause = function (onResume, onRestart, onQuit) {
    this.overlay.style.display = 'flex';
    this.overlayInner.innerHTML = '';
    var title = el('h1', 'game-title small', this.overlayInner);
    title.textContent = 'PAUSED';
    var resume = el('button', 'big-btn', this.overlayInner);
    resume.textContent = '▶  Resume';
    resume.addEventListener('click', function () { SC.audio.click(); onResume(); });
    var restart = el('button', 'big-btn secondary', this.overlayInner);
    restart.textContent = '↻  Restart the story';
    restart.addEventListener('click', function () { SC.audio.click(); onRestart(); });
    var quit = el('button', 'big-btn secondary', this.overlayInner);
    quit.textContent = '⌂  Back to title';
    quit.addEventListener('click', function () { SC.audio.click(); onQuit(); });
    var foot = el('div', 'game-foot', this.overlayInner);
    foot.textContent = 'Progress saves automatically after each job.';
  };

  Hud.prototype.showEnd = function (kind, onRetry, onTitle) {
    this.overlay.style.display = 'flex';
    this.overlayInner.innerHTML = '';
    var title = el('h1', 'game-title ' + (kind === 'wasted' ? 'red' : 'blue'), this.overlayInner);
    title.textContent = kind === 'wasted' ? 'WASTED' : 'BUSTED';
    var sub = el('div', 'game-sub', this.overlayInner);
    sub.textContent = kind === 'wasted'
      ? 'Marco didn\'t make it. Solmar City keeps his money — and his story.'
      : 'The Solmar PD finally caught up with Marco. The jobs will wait.';
    var retry = el('button', 'big-btn', this.overlayInner);
    retry.textContent = '↻  Try again (keep your cash)';
    retry.addEventListener('click', function () { SC.audio.click(); onRetry(); });
    var titleBtn = el('button', 'big-btn secondary', this.overlayInner);
    titleBtn.textContent = '⌂  Back to title';
    titleBtn.addEventListener('click', function () { SC.audio.click(); onTitle(); });
  };

  Hud.prototype.hideOverlay = function () {
    this.overlay.style.display = 'none';
    this.overlayInner.innerHTML = '';
  };

  SC.Hud = Hud;
})();
