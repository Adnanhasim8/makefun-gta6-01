// Solmar City — shared helpers: seeded random, math and small geometry tools.
// Every other module reads from the single SC namespace this file creates.

var SC = SC || {};

(function () {
  'use strict';

  // mulberry32: a tiny deterministic generator so the city, traffic and
  // screenshots look the same on every load for a given seed.
  function makeRng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, list) {
    return list[Math.floor(rng() * list.length)];
  }

  function range(rng, min, max) {
    return min + rng() * (max - min);
  }

  function intRange(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Shortest signed difference between two headings, in radians.
  function angleDiff(a, b) {
    var d = (a - b) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function moveTowardAngle(a, target, maxStep) {
    var d = angleDiff(target, a);
    if (d > maxStep) return a + maxStep;
    if (d < -maxStep) return a - maxStep;
    return target;
  }

  function dist2(ax, az, bx, bz) {
    var dx = ax - bx;
    var dz = az - bz;
    return dx * dx + dz * dz;
  }

  // Circle vs axis-aligned box: push the circle out and report the hit.
  // box = { minX, maxX, minZ, maxZ }, pos = { x, z }, r = radius.
  function pushOutOfBox(pos, r, box) {
    var cx = clamp(pos.x, box.minX, box.maxX);
    var cz = clamp(pos.z, box.minZ, box.maxZ);
    var dx = pos.x - cx;
    var dz = pos.z - cz;
    var d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return false;
    if (d2 > 0.000001) {
      var d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * r;
      pos.z = cz + (dz / d) * r;
    } else {
      // Centre inside the box: shove out along the smallest penetration.
      var left = pos.x - box.minX;
      var right = box.maxX - pos.x;
      var top = pos.z - box.minZ;
      var bottom = box.maxZ - pos.z;
      var m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = box.minX - r;
      else if (m === right) pos.x = box.maxX + r;
      else if (m === top) pos.z = box.minZ - r;
      else pos.z = box.maxZ + r;
    }
    return true;
  }

  function formatMoney(n) {
    return '$' + Math.floor(n).toLocaleString('en-US');
  }

  function formatTime(seconds) {
    var s = Math.max(0, Math.ceil(seconds));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  SC.makeRng = makeRng;
  SC.pick = pick;
  SC.range = range;
  SC.intRange = intRange;
  SC.clamp = clamp;
  SC.lerp = lerp;
  SC.angleDiff = angleDiff;
  SC.moveTowardAngle = moveTowardAngle;
  SC.dist2 = dist2;
  SC.pushOutOfBox = pushOutOfBox;
  SC.formatMoney = formatMoney;
  SC.formatTime = formatTime;
})();
