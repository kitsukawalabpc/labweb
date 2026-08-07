/* =========================================================
   3D Neural Network background  (Three.js r128)
   Refined palette: steel-blue base, cyan firing.
   Exposes window.NCIL for the UI layer (app.js).
   ========================================================= */
(function () {
  const sectionByNode = {
    0: "hero", 1: "about", 2: "research", 3: "results",
    4: "members", 5: "daily", 6: "access", 7: "others",
  };
  const topics = ["木津川研", "研究室紹介", "研究内容", "研究成果", "メンバー", "日常", "アクセス", "その他"];

  let isPanelOpen = false;
  let time = 0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 560;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  document.getElementById("network-container").appendChild(renderer.domElement);

  const group = new THREE.Group();
  scene.add(group);

  const nodes = [];
  const nodeObjects = [];
  const nodePositions = [];
  const nodeInitial = [];
  const nodeLabels = [];
  const links = [];
  const linkObjects = [];
  const pulses = [];

  // colors
  const BASE_COLOR = 0x2c5d8f, BASE_EMIS = 0x123150;
  const TOP_COLOR = 0x1c4368, TOP_EMIS = 0x0c2236;
  const FIRE_COLOR = 0x8fe0ff, FIRE_EMIS = 0x58c8ee;

  function makeLabel(i, text) {
    const el = document.createElement("div");
    el.className = "node-label";
    el.textContent = text;
    document.getElementById("network-container").appendChild(el);
    nodeLabels.push(el);
    return el;
  }

  // build nodes on a sphere
  for (let i = 0; i < topics.length; i++) {
    const radius = 248;
    const phi = Math.acos(-1 + (2 * i) / topics.length);
    const theta = Math.sqrt(topics.length * Math.PI) * phi;
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    nodes.push({
      id: i, label: topics[i], x, y, z,
      radius: Math.random() * 7 + 12,
      phase: Math.random() * Math.PI * 2,
      amp: Math.random() * 14 + 18,
      isActive: false, activeTime: 0,
    });
    const p = new THREE.Vector3(x, y, z);
    nodePositions.push(p.clone());
    nodeInitial.push(p.clone());
    makeLabel(i, topics[i]);
  }

  nodes.forEach((node, i) => {
    const isTop = i === 0;
    const color = isTop ? TOP_COLOR : BASE_COLOR;
    const emissive = isTop ? TOP_EMIS : BASE_EMIS;
    const r = isTop ? node.radius * 1.5 : node.radius;
    node.baseRadius = r;

    const geo = new THREE.SphereGeometry(r, 32, 32);
    const mat = new THREE.MeshPhysicalMaterial({
      color, emissive, emissiveIntensity: 0.35,
      roughness: 0.45, metalness: 0.25,
      clearcoat: 0.5, clearcoatRoughness: 0.3,
      transmission: 0.18, transparent: true, opacity: 0.92,
    });
    const sphere = new THREE.Mesh(geo, mat);
    sphere.position.set(node.x, node.y, node.z);
    sphere.userData = { id: node.id, label: node.label, defColor: color, defEmis: emissive };

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.72, 16, 16),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 })
    );
    sphere.add(glow);
    sphere.glow = glow;

    // halo ring for the central node
    if (isTop) {
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(r * 1.5, r * 1.62, 48),
        new THREE.MeshBasicMaterial({ color: FIRE_EMIS, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
      );
      sphere.add(halo);
      sphere.halo = halo;
    }

    group.add(sphere);
    nodeObjects.push(sphere);
  });

  // links
  nodes.forEach((node) => {
    const n = Math.floor(Math.random() * 2) + 2;
    for (let i = 0; i < n; i++) {
      const t = Math.floor(Math.random() * nodes.length);
      if (t !== node.id) links.push({ source: node.id, target: t });
    }
  });
  const uniqueLinks = [];
  links.forEach((l) => {
    if (!uniqueLinks.some((u) => (u.source === l.source && u.target === l.target) || (u.source === l.target && u.target === l.source)))
      uniqueLinks.push(l);
  });
  uniqueLinks.forEach((link) => {
    const geo = new THREE.BufferGeometry().setFromPoints([nodePositions[link.source], nodePositions[link.target]]);
    const mat = new THREE.LineBasicMaterial({ color: 0x2e6a9c, transparent: true, opacity: 0.32 });
    const line = new THREE.Line(geo, mat);
    group.add(line);
    linkObjects.push(line);
  });

  // lights
  scene.add(new THREE.AmbientLight(0x2a3a52));
  const l1 = new THREE.PointLight(0x4a7baf, 2, 1000); l1.position.set(200, 220, 240); scene.add(l1);
  const l2 = new THREE.PointLight(0x3aa0d8, 1, 1000); l2.position.set(-220, -200, -180); scene.add(l2);
  const l3 = new THREE.PointLight(0x58c8ee, 0.6, 320); l3.position.set(0, 0, 220); scene.add(l3);

  // synaptic pulse
  class Pulse {
    constructor(s, t) {
      this.s = s; this.t = t; this.progress = 0;
      this.speed = Math.random() * 0.3 + 0.7; this.life = 0; this.max = 5;
      this.li = uniqueLinks.findIndex((l) => (l.source === s && l.target === t) || (l.source === t && l.target === s));
      if (this.li !== -1) {
        linkObjects[this.li].visible = false;
        const pts = [nodePositions[s].clone(), nodePositions[t].clone()];
        this.mat = new THREE.LineBasicMaterial({ color: FIRE_EMIS, transparent: true, opacity: 0.9 });
        this.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), this.mat);
        group.add(this.line);
        this.glows = [];
        for (let i = 0; i < 4; i++) {
          const gm = new THREE.LineBasicMaterial({ color: FIRE_EMIS, transparent: true, opacity: 0.12 - i * 0.02 });
          const gl = new THREE.Line(this.line.geometry.clone(), gm);
          group.add(gl); this.glows.push(gl);
        }
      }
    }
    update() {
      this.life += 0.016; this.progress += this.speed * 0.012;
      if (this.life > this.max || this.li === -1 || this.progress >= 1) return true;
      const sp = nodePositions[this.s], tp = nodePositions[this.t];
      this.line.geometry.setFromPoints([sp, tp]);
      this.glows.forEach((g) => g.geometry.setFromPoints([sp, tp]));
      const tm = this.life * 20;
      this.glows.forEach((g, i) => {
        const pf = Math.sin(tm + i * 0.2) * 0.5 + 0.5;
        g.material.opacity = (0.12 - i * 0.02) * pf;
      });
      this.mat.opacity = Math.sin(tm * 0.5) * 0.2 + 0.8;
      return false;
    }
    dispose() {
      if (this.li !== -1) linkObjects[this.li].visible = true;
      group.remove(this.line); this.line.geometry.dispose(); this.line.material.dispose();
      this.glows.forEach((g) => { group.remove(g); g.geometry.dispose(); g.material.dispose(); });
    }
  }

  function showLabel(i) {
    if (isPanelOpen) return;
    const obj = nodeObjects[i], label = nodeLabels[i];
    const wp = new THREE.Vector3(); obj.getWorldPosition(wp);
    const v = wp.clone().project(camera);
    label.style.left = (v.x * 0.5 + 0.5) * window.innerWidth + "px";
    label.style.top = (-v.y * 0.5 + 0.5) * window.innerHeight + "px";
    label.classList.remove("visible"); void label.offsetWidth; label.classList.add("visible");
    setTimeout(() => label.classList.remove("visible"), 2500);
  }

  function fireNode(i, depth = 0) {
    if (depth > 2) return;
    const node = nodes[i], obj = nodeObjects[i];
    if (node.isActive) return;
    showLabel(i);
    obj.material.emissive = new THREE.Color(FIRE_EMIS);
    obj.material.color = new THREE.Color(FIRE_COLOR);
    obj.material.emissiveIntensity = 1.5;
    obj.material.transmission = 0.5;
    if (obj.glow) { obj.glow.material.color = new THREE.Color(0xffffff); obj.glow.material.opacity = 0.9; }

    // expanding rings
    const rings = [];
    for (let r = 0; r < 3; r++) {
      const rg = new THREE.TorusGeometry(node.baseRadius * 1.5, node.baseRadius * 0.08, 8, 32);
      const rm = new THREE.MeshBasicMaterial({ color: FIRE_EMIS, transparent: true, opacity: 0.55 - r * 0.15, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(rg, rm);
      ring.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      ring.position.copy(obj.position); ring.scale.set(0.1, 0.1, 0.1);
      group.add(ring); rings.push(ring);
    }
    let pt = 0;
    (function anim() {
      pt += 0.05;
      rings.forEach((ring, i2) => {
        const g = 1 + pt * (0.2 + i2 * 0.05);
        ring.scale.set(g, g, g);
        ring.material.opacity = Math.max(0, 0.55 - pt * 0.2 - i2 * 0.1);
        ring.rotation.x += 0.01; ring.rotation.y += 0.008;
      });
      if (pt < 3) requestAnimationFrame(anim);
      else rings.forEach((r) => { group.remove(r); r.geometry.dispose(); r.material.dispose(); });
    })();

    node.isActive = true; node.activeTime = 2.0;

    const connected = [];
    uniqueLinks.forEach((l) => {
      if (l.source === i && !nodes[l.target].isActive) connected.push(l.target);
      else if (l.target === i && !nodes[l.source].isActive) connected.push(l.source);
    });
    if (pulses.length < 5 && connected.length) {
      const t = connected[Math.floor(Math.random() * connected.length)];
      pulses.push(new Pulse(i, t));
    }
  }

  function fireAll() {
    const order = nodes.map((_, i) => i).sort(() => Math.random() - 0.5);
    order.forEach((idx, i) => setTimeout(() => { if (!nodes[idx].isActive) fireNode(idx); }, i * 140));
  }

  // smoothly rotate a node toward the front
  let targetRotY = null, targetRotX = null;
  function focusNode(i) {
    const p = nodeInitial[i];
    targetRotY = -Math.atan2(p.x, p.z);
    targetRotX = Math.atan2(p.y, Math.sqrt(p.x * p.x + p.z * p.z)) * 0.5;
  }

  // interaction (only when panel closed)
  const mouse = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  let hovered = null, dragging = false, prev = { x: 0, y: 0 }, moved = 0;

  function onMove(e) {
    if (isPanelOpen) return;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObjects(nodeObjects);
    if (hovered && hovered !== hits[0]?.object) { hovered = null; document.body.style.cursor = ""; }
    if (hits.length) {
      const obj = hits[0].object;
      document.body.style.cursor = "pointer";
      if (hovered !== obj) { hovered = obj; if (!isPanelOpen) fireNode(obj.userData.id); }
    }
  }

  document.addEventListener("mousedown", (e) => { dragging = true; moved = 0; prev = { x: e.clientX, y: e.clientY }; });
  document.addEventListener("mouseup", () => { dragging = false; });
  document.addEventListener("mousemove", (e) => {
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    if (dragging && !isPanelOpen) {
      moved += Math.abs(dx) + Math.abs(dy);
      group.rotation.y += dx * 0.005;
      group.rotation.x += dy * 0.005;
      targetRotY = targetRotX = null;
    }
    prev = { x: e.clientX, y: e.clientY };
    onMove(e);
  });

  renderer.domElement.addEventListener("click", (e) => {
    if (isPanelOpen || moved > 6) return;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObjects(nodeObjects);
    if (hits.length) {
      const id = hits[0].object.userData.id;
      if (id === 0) { fireAll(); }
      else if (window.NCIL_openSection) window.NCIL_openSection(sectionByNode[id], id);
    }
  });

  /* ---------- touch (mobile drag-rotate + tap-select) ---------- */
  renderer.domElement.style.touchAction = "none";
  let touchActive = false;

  renderer.domElement.addEventListener("touchstart", (e) => {
    if (isPanelOpen || e.touches.length !== 1) return;
    touchActive = true;
    dragging = true;
    moved = 0;
    prev = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });

  renderer.domElement.addEventListener("touchmove", (e) => {
    if (!touchActive || isPanelOpen || e.touches.length !== 1) return;
    e.preventDefault(); // stop page scroll / pull-to-refresh while rotating
    const t = e.touches[0];
    const dx = t.clientX - prev.x, dy = t.clientY - prev.y;
    moved += Math.abs(dx) + Math.abs(dy);
    group.rotation.y += dx * 0.006;
    group.rotation.x += dy * 0.006;
    targetRotY = targetRotX = null;
    prev = { x: t.clientX, y: t.clientY };
  }, { passive: false });

  renderer.domElement.addEventListener("touchend", (e) => {
    dragging = false;
    if (!touchActive) return;
    touchActive = false;
    if (isPanelOpen || moved > 12) return; // it was a drag, not a tap
    // tap-to-select using the last touch point
    const pt = e.changedTouches[0];
    if (!pt) return;
    mouse.x = (pt.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(pt.clientY / window.innerHeight) * 2 + 1;
    ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObjects(nodeObjects);
    if (hits.length) {
      const id = hits[0].object.userData.id;
      if (id === 0) { fireAll(); }
      else if (window.NCIL_openSection) window.NCIL_openSection(sectionByNode[id], id);
    }
  }, { passive: true });

  renderer.domElement.addEventListener("touchcancel", () => {
    dragging = false; touchActive = false;
  }, { passive: true });

  function updateLabels() {
    if (isPanelOpen) return;
    for (let i = 0; i < nodeObjects.length; i++) {
      const label = nodeLabels[i];
      if (label.classList.contains("visible")) {
        const wp = new THREE.Vector3(); nodeObjects[i].getWorldPosition(wp);
        const v = wp.clone().project(camera);
        label.style.left = (v.x * 0.5 + 0.5) * window.innerWidth + "px";
        label.style.top = (-v.y * 0.5 + 0.5) * window.innerHeight + "px";
      }
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    time = Date.now() * 0.001;

    for (let i = 0; i < nodeObjects.length; i++) {
      const node = nodes[i], obj = nodeObjects[i], ip = nodeInitial[i];
      const f = 0.3;
      obj.position.x = ip.x + Math.sin(time * f + node.phase) * node.amp;
      obj.position.y = ip.y + Math.cos(time * f + node.phase * 1.3) * node.amp;
      obj.position.z = ip.z + Math.sin(time * f * 0.7 + node.phase * 0.9) * node.amp;
      nodePositions[i].copy(obj.position);

      if (obj.halo) { obj.halo.rotation.z += 0.003; obj.halo.lookAt(camera.position); }

      if (node.isActive) {
        node.activeTime -= 0.016;
        if (node.activeTime <= 0) {
          node.isActive = false;
          obj.material.emissive.setHex(obj.userData.defEmis);
          obj.material.color.setHex(obj.userData.defColor);
          obj.material.emissiveIntensity = 0.35; obj.material.transmission = 0.18;
          if (obj.glow) { obj.glow.material.color.setHex(obj.userData.defColor); obj.glow.material.opacity = 0.5; }
        } else {
          const tf = node.activeTime / 2;
          obj.material.emissiveIntensity = 1.2 * tf + 0.3 * Math.sin(time * 5) * tf;
          if (obj.glow) obj.glow.material.opacity = 0.5 + 0.4 * tf;
        }
      }
    }
    updateLabels();

    for (let i = pulses.length - 1; i >= 0; i--) {
      const done = pulses[i].update();
      if (done) {
        if (pulses[i].progress >= 1 && !nodes[pulses[i].t].isActive && !isPanelOpen) fireNode(pulses[i].t, 1);
        pulses[i].dispose(); pulses.splice(i, 1);
      }
    }

    uniqueLinks.forEach((link, idx) => {
      const pos = linkObjects[idx].geometry.attributes.position.array;
      const sp = nodePositions[link.source], tp = nodePositions[link.target];
      pos[0] = sp.x; pos[1] = sp.y; pos[2] = sp.z; pos[3] = tp.x; pos[4] = tp.y; pos[5] = tp.z;
      linkObjects[idx].geometry.attributes.position.needsUpdate = true;
    });

    // gentle auto-rotate / focus easing
    if (targetRotY !== null) {
      group.rotation.y += (targetRotY - group.rotation.y) * 0.05;
      group.rotation.x += (targetRotX - group.rotation.x) * 0.05;
    } else if (!dragging) {
      group.rotation.y += isPanelOpen ? 0.0012 : 0.0006;
    }

    renderer.render(scene, camera);
  }

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  animate();
  setTimeout(fireAll, 1400);

  // public hooks for the UI layer
  window.NCIL = {
    setPanelOpen(v) { isPanelOpen = v; },
    fireNode, fireAll, focusNode,
    resetView() { targetRotY = targetRotX = null; },
  };
})();
