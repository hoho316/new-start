/* =========================================================
   长征路线图 · 交互引擎 v2
   闭环：全局总览 → 点击节点 → 信息卡片 → 放大看地理形态 → 返回全景
   增强：① 高层级自动水系标注 ② 自然地理节点独立图层
        ③ 步行路由拟合的真实折线 + 加密点平滑曲线
   ========================================================= */
(function () {
  'use strict';

  const D = window.LM;
  const G = window.LM_GEO || { rivers: [], lakes: [], wpts: {}, terrain: {} };
  const RG = window.LM_ROUTES || null;

  const NODE = {};
  D.nodes.forEach(n => {
    if (G.terrain[n.id]) n.tf = G.terrain[n.id];
    NODE[n.id] = n;
  });
  const TYPE = D.types;
  const T = k => TYPE[k] || { label: '节点', icon: '·', cls: 'march' };
  const ARMY = D.armies;

  /* 类型配色（标记环 / 图例） */
  const TYPE_COLOR = {
    flag: '#ff3b30', fight: '#ff6b5b', meet: '#f5c451', river: '#35b6ff',
    snow: '#8ecbff', grass: '#43d98b', join: '#ffd166', turn: '#ff8c42',
    march: '#8aa0bd', end: '#ff3b30'
  };

  /* 自然地理层：雪山 / 草地 / 渡口 —— 用蓝、绿两色系独立区分 */
  const GEO_TYPES = new Set(['snow', 'grass', 'river']);
  const GEO_COLOR = { snow: '#8ecbff', grass: '#43d98b', river: '#2fb4ff' };
  const GEO_SHAPE = { snow: '六边冰晶', grass: '叶片', river: '水滴' };

  const state = {
    active: new Set(['c1', 'c2', 'c4']),
    phase: 2,
    sel: null,
    terrain: false,
    base: 'night',
    prevBase: 'night',
    query: '',
    tlIdx: 999,
    timer: null,
    geo: true,        // 自然地理节点层
    water: true,      // 水系标注层
    detail: false     // 路线精细几何（高缩放时切换）
  };

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const havKm = (a, b) => {
    const R = 6371, toR = Math.PI / 180;
    const dLat = (b[0] - a[0]) * toR, dLng = (b[1] - a[1]) * toR;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  /* ---------------- 地图初始化 ---------------- */
  const map = L.map('map', {
    center: [30.5, 105.5], zoom: 5, minZoom: 3, maxZoom: 15,
    zoomControl: false, attributionControl: true,
    worldCopyJump: true, zoomSnap: .25, zoomDelta: .5
  });

  /* 自定义 pane：水系线在路线之下，水系注记在标记之下 */
  map.createPane('hydroLines').style.zIndex = 390;
  map.createPane('hydroLabels').style.zIndex = 450;
  map.createPane('relief').style.zIndex = 250;
  map.getPane('hydroLines').style.pointerEvents = 'none';
  map.getPane('hydroLabels').style.pointerEvents = 'none';
  map.getPane('relief').style.pointerEvents = 'none';

  const BASES = {
    night: {
      label: '墨夜地形',
      make: () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 15, attribution: '地形底图 &copy; Esri · World Topographic Map', className: 'darken' })
    },
    relief: {
      label: '地貌晕渲',
      make: () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 15, attribution: '地形底图 &copy; Esri · World Topographic Map' })
    },
    sat: {
      label: '卫星实景',
      make: () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 15, attribution: '影像底图 &copy; Esri · Maxar · Earthstar Geographics' })
    },
    natgeo: {
      label: '军事制图',
      make: () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 15, attribution: '底图 &copy; Esri · National Geographic' })
    }
  };

  /* 山体晕渲：放大看地形起伏时叠加，凸显山脊、沟谷与湿地微地形 */
  const hillshade = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 15, pane: 'relief', opacity: 1, className: 'hs-tile' }
  );

  let baseLayer = null;
  function setBase(key) {
    if (baseLayer) map.removeLayer(baseLayer);
    baseLayer = BASES[key].make().addTo(map);
    baseLayer.setZIndex(1);
    state.base = key;
    $$('.basegrp button').forEach(b => b.classList.toggle('on', b.dataset.base === key));
    const pane = map.getPane('tilePane');
    pane.classList.toggle('darken', key === 'night');
    pane.classList.toggle('satboost', key === 'sat');
  }

  L.control.scale({ position: 'topright', imperial: false, maxWidth: 130 }).addTo(map);
  /* 路线由 OSM 步行 / 公路路径服务拟合，按 ODbL 要求标注来源 */
  const META = window.LM_ROUTE_META;
  map.attributionControl.addAttribution(
    '路线拟合 &copy; OpenStreetMap contributors' +
    (META ? `（步行 ${META.walk} 段 · 公路 ${META.road} 段 · 手绘 ${META.curve} 段）` : '')
  );

  /* =========================================================
     一、行军路线（真实道路折线，两级精度）
     ========================================================= */
  const routeLayers = {};   // armyId -> [casing, halo, line]
  const routePts = {};      // armyId -> [[lat,lng]] 节点骨架（用于 bounds）

  function nodeGeom(aid) {
    return D.routes[aid].map(id => [NODE[id].lat, NODE[id].lng]);
  }
  function geom(aid, detailed) {
    if (RG && RG[aid]) return detailed ? RG[aid].full : RG[aid].coarse;
    return nodeGeom(aid);
  }

  Object.keys(D.routes).forEach(aid => {
    routePts[aid] = nodeGeom(aid);
    const color = ARMY[aid].color;
    const pts = geom(aid, false);

    const casing = L.polyline(pts, {
      color: '#060a12', weight: 6, opacity: .3, interactive: false, lineCap: 'round', lineJoin: 'round', smoothFactor: 1
    }).addTo(map);
    const halo = L.polyline(pts, {
      color: color, weight: 9, opacity: .12, interactive: false, lineCap: 'round', lineJoin: 'round', smoothFactor: 1
    }).addTo(map);
    const line = L.polyline(pts, {
      color: color, weight: 2.8, opacity: .96, interactive: false,
      lineCap: 'round', lineJoin: 'round', smoothFactor: 1,
      className: 'route-flow', dashArray: null
    }).addTo(map);
    line.bringToFront();

    routeLayers[aid] = [casing, halo, line];
  });

  /* 高缩放切换精细几何：全景看走向，放大看真实路径 */
  function routeDetail() {
    const want = map.getZoom() >= 8.5;
    if (want === state.detail) return;
    state.detail = want;
    Object.keys(routeLayers).forEach(aid => {
      const pts = geom(aid, want);
      routeLayers[aid].forEach(l => l.setLatLngs(pts));
    });
  }

  /* =========================================================
     二、水系标注层（河流 / 湖泊 / 沼泽湿地，按层级自动浮现）
     ========================================================= */
  const hydro = [];   // { kind, lv, line?, circ?, label, ang, dist, on }
  let hydroReady = false;

  function buildHydro() {
    /* --- 河流 --- */
    G.rivers.forEach(r => {
      const latlngs = r.c.map(p => [p[0], p[1]]);

      /* 注记锚点：取离任一节点最近的河段顶点 —— 标注必然出现在路线跨越处附近 */
      let bi = 0, bd = 1e9;
      latlngs.forEach((p, i) => {
        D.nodes.forEach(n => {
          const d = havKm(p, [n.lat, n.lng]);
          if (d < bd) { bd = d; bi = i; }
        });
      });

      const w = r.lv === 1 ? 1.9 : r.lv === 2 ? 1.4 : 1.1;
      const op = r.lv === 1 ? .58 : r.lv === 2 ? .5 : .4;
      const line = L.polyline(latlngs, {
        pane: 'hydroLines', color: r.lv === 1 ? '#2e86c8' : r.lv === 2 ? '#367fc0' : '#4682a0',
        weight: w, opacity: op, interactive: false,
        lineCap: 'round', lineJoin: 'round', smoothFactor: 1,
        className: 'hydro-line lv' + r.lv
      });
      const halo = L.polyline(latlngs, {
        pane: 'hydroLines', color: '#0a2a44',
        weight: w + 3.2, opacity: .35, interactive: false, lineCap: 'round', smoothFactor: 1
      });

      /* 标签倾角：沿河走向旋转，超过 ±90° 则翻转保持正向可读 */
      const angleAt = i => {
        const a = latlngs[Math.max(0, i - 1)], b = latlngs[Math.min(latlngs.length - 1, i + 1)];
        let ang = Math.atan2(-(b[0] - a[0]), (b[1] - a[1])) * 180 / Math.PI;
        if (ang > 90 || ang < -90) ang += 180;
        return ang;
      };
      const mkLabel = (i, cls) => L.marker(latlngs[i], {
        pane: 'hydroLabels', interactive: false,
        icon: L.divIcon({
          className: 'hlb-wrap',
          html: `<span class="hlb lv${r.lv}" style="transform:translate(-50%,-50%) rotate(${angleAt(i).toFixed(1)}deg) translateY(-10px)">${r.n}</span>`,
          iconSize: [0, 0], iconAnchor: [0, 0]
        })
      });

      const label = mkLabel(bi);

      hydro.push({ kind: 'river', lv: r.lv, line, halo, label, dist: bd, on: false });

      /* 大江大河沿程重复注记，放大到任一段都能读到水系名 */
      if (r.lv <= 2 && latlngs.length >= 5) {
        [0.28, 0.68].forEach(f => {
          const i = Math.round((latlngs.length - 1) * f);
          if (Math.abs(i - bi) < Math.max(2, latlngs.length * 0.14)) return;
          hydro.push({ kind: 'river', lv: r.lv, line: null, label: mkLabel(i), dist: 1e9, on: false });
        });
      }
    });

    /* --- 湖泊与湿地 --- */
    G.lakes.forEach(k => {
      const wet = k.t === 'wet';
      const circ = L.circle(k.c, {
        pane: 'hydroLines',
        radius: k.r,
        color: wet ? '#43d98b' : '#4ea8ff',
        weight: 1.2,
        opacity: wet ? .55 : .62,
        dashArray: wet ? '6 7' : null,
        fillColor: wet ? '#2ea86a' : '#2f8fe0',
        fillOpacity: wet ? .14 : .22,
        interactive: false,
        className: wet ? 'hydro-wet' : 'hydro-lake'
      });
      const label = L.marker(k.c, {
        pane: 'hydroLabels', interactive: false,
        icon: L.divIcon({
          className: 'hlb-wrap',
          html: `<span class="hlb lake ${wet ? 'wet' : ''}" style="transform:translate(-50%,-50%)">${k.n}</span>`,
          iconSize: [0, 0], iconAnchor: [0, 0]
        })
      });
      hydro.push({ kind: wet ? 'wet' : 'lake', lv: k.lv, circ, label, dist: 0, on: false });
    });

    hydroReady = true;
    updateHydro();
  }

  /* 层级阈值：越放大，露出的水系越细 */
  function hydroVisible(h) {
    const z = map.getZoom();
    if (!state.water) return false;
    if (h.kind === 'river') {
      return z >= (h.lv === 1 ? 6.2 : h.lv === 2 ? 7.8 : 9.2);
    }
    if (h.kind === 'wet') return z >= 7.6;
    return z >= 8.6;
  }
  function labelVisible(h) {
    const z = map.getZoom();
    if (!state.water) return false;
    if (h.kind === 'river') return z >= (h.lv === 1 ? 7.6 : h.lv === 2 ? 8.8 : 10.2);
    if (h.kind === 'wet') return z >= 8.2;
    return z >= 9.4;
  }

  function updateHydro() {
    if (!hydroReady) return;
    hydro.forEach(h => {
      const showBody = hydroVisible(h);
      const showLb = labelVisible(h);
      [h.line, h.halo, h.circ].forEach(l => {
        if (!l) return;
        if (showBody && !map.hasLayer(l)) l.addTo(map);
        if (!showBody && map.hasLayer(l)) map.removeLayer(l);
      });
      if (h.label) {
        if (showLb && !map.hasLayer(h.label)) h.label.addTo(map);
        if (!showLb && map.hasLayer(h.label)) map.removeLayer(h.label);
      }
      h.on = showBody;
    });
    const n = hydro.filter(h => h.on && (h.line || h.circ)).length;
    const el = $('#waterCount');
    if (el) el.textContent = n;
    document.body.classList.toggle('hydro-off', !state.water);
  }

  /* =========================================================
     三、节点标记（自然地理节点独立造型）
     ========================================================= */
  const markers = {};
  D.nodes.forEach((n, i) => {
    const a = ARMY[n.a];
    const isGeo = GEO_TYPES.has(n.t);
    const star = n.star ? ' star' : '';
    const tCls = ' t-' + n.t + (isGeo ? ' geo g-' + n.t : '') + (i % 2 ? ' alt' : '');
    const style = `--c:${a.color};--tc:${TYPE_COLOR[n.t]};` + (isGeo ? `--gc:${GEO_COLOR[n.t]};` : '');
    const html = `
      <div class="mk${star}${tCls}" style="${style}animation-delay:${Math.min(i * 18, 900)}ms">
        <span class="mk-halo"></span>
        <span class="mk-core">${T(n.t).icon}</span>
        <span class="mk-label"><b>${T(n.t).label}</b>${n.n}</span>
      </div>`;
    const icon = L.divIcon({ className: 'mk-wrap', html, iconSize: [0, 0], iconAnchor: [0, 0] });
    const m = L.marker([n.lat, n.lng], { icon, riseOnHover: true, zIndexOffset: n.star ? 400 : 0 }).addTo(map);
    m.on('click', e => { L.DomEvent.stopPropagation(e); selectNode(n.id); });
    markers[n.id] = m;
  });

  /* 行军前锋（时间轴游标） */
  const playheadIcon = L.divIcon({
    className: 'ph-wrap',
    html: '<div class="ph"><span class="ph-ring"></span><span class="ph-dot"></span></div>',
    iconSize: [0, 0], iconAnchor: [0, 0]
  });
  const playhead = L.marker([30, 105], { icon: playheadIcon, interactive: false, zIndexOffset: 900 }).addTo(map);
  playhead.setOpacity(0);

  /* ---------------- 节点选中 ---------------- */
  /* 卡片占据右侧 426px，飞行时把节点推到可视区中心 */
  function focusOn(latlng, zoom) {
    const cardOn = $('#card').classList.contains('on');
    const offsetX = cardOn && window.innerWidth > 900 ? 214 : 0;
    const p = map.project(L.latLng(latlng), zoom).add([offsetX, 34]);
    map.flyTo(map.unproject(p, zoom), zoom, { duration: .95 });
  }

  function selectNode(id, opts) {
    opts = opts || {};
    const n = NODE[id];
    if (!n) return;
    state.sel = id;

    $$('.mk').forEach(el => el.classList.remove('active'));
    const mkEl = markers[id].getElement();
    if (mkEl) mkEl.querySelector('.mk').classList.add('active');
    markers[id].setZIndexOffset(1000);

    Object.keys(markers).forEach(k => { if (k !== id) markers[k].setZIndexOffset(NODE[k].star ? 400 : 0); });

    renderCard(n);
    $('#card').classList.add('on');
    $('#hint').classList.add('hide');

    /* 侧栏同步 */
    $$('.ni').forEach(el => el.classList.toggle('on', el.dataset.id === id));
    const cur = document.querySelector(`.ni[data-id="${id}"]`);
    if (cur) cur.scrollIntoView({ block: 'center', behavior: 'smooth' });

    /* 时间轴同步到该节点 */
    if (!opts.keepTime) {
      const ti = tlList.findIndex(x => x.id === id);
      if (ti > -1) { state.tlIdx = ti; $('#tlRange').value = ti; applyTimeline(); }
    }

    if (!opts.silent) {
      /* 地形视图内换站时，同步切换晕渲模式与浮条信息 */
      if (state.terrain) { enterTerrain(n); }
      else { focusOn([n.lat, n.lng], Math.max(map.getZoom(), 8)); }
    }
  }

  function closeCard() {
    $('#card').classList.remove('on');
    state.sel = null;
    if (state.terrain) exitTerrain(true);
    $$('.mk').forEach(el => el.classList.remove('active'));
    $$('.ni').forEach(el => el.classList.remove('on'));
  }

  /* ---------------- 信息卡片 ---------------- */
  function fmtDate(n) {
    const f = s => s.replace(/-/g, '.');
    if (!n.de) return f(n.d);
    return f(n.d) + ' — ' + f(n.de).slice(5);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function renderCard(n) {
    const a = ARMY[n.a], t = T(n.t);
    const card = $('#card');
    card.style.setProperty('--ac', a.color);
    const order = D.routes[n.a];
    const idx = order.indexOf(n.id);
    const prev = idx > 0 ? NODE[order[idx - 1]] : null;
    const next = idx > -1 && idx < order.length - 1 ? NODE[order[idx + 1]] : null;
    const isGeo = GEO_TYPES.has(n.t);

    const battle = n.b ? `
      <div class="sec">
        <h4>战役细节</h4>
        <div class="battle">
          <div class="battle-hd"><i></i>${esc(n.b.place)}</div>
          <div class="brow"><span>时 间</span><p>${esc(n.b.time)}</p></div>
          <div class="brow"><span>地 点</span><p>${esc(n.b.place)}</p></div>
          <div class="brow"><span>参战方</span><p>${esc(n.b.side)}</p></div>
          <div class="brow"><span>经 过</span><p>${esc(n.b.proc)}</p></div>
          <div class="brow res"><span>结 果</span><p>${esc(n.b.res)}</p></div>
        </div>
      </div>` : '';

    const geoBlock = n.tf ? `
      <div class="sec geo-sec">
        <h4>地貌纹理</h4>
        <div class="geocard" style="--gc:${GEO_COLOR[n.t]}">
          <b>${esc(n.tf.k)}</b>
          <p>${esc(n.tf.d)}</p>
        </div>
      </div>` : '';

    card.innerHTML = `
      <div class="card-head">
        <button class="card-close" id="cardClose" aria-label="关闭">✕</button>
        <div class="ribbon${isGeo ? ' geo' : ''}" ${isGeo ? `style="--ac:${GEO_COLOR[n.t]}"` : ''}>${t.icon} · ${t.label} · ${esc(a.short)}</div>
        <h3>${esc(n.n)}</h3>
        <div class="when">${fmtDate(n)}${n.star ? ' · 关键节点' : ''}</div>
      </div>
      <div class="card-body">
        <div class="meta-grid">
          <div class="meta"><span>行 军 方</span><b style="color:${a.color}">${esc(a.short)}</b></div>
          <div class="meta"><span>所 在</span><b>${esc(n.p)}</b></div>
          ${n.ele ? `<div class="meta"><span>海 拔</span><b>${esc(n.ele)}</b></div>` : `<div class="meta"><span>节 点</span><b>第 ${idx + 1} 站 / ${order.length}</b></div>`}
          <div class="meta code wide"><span>坐 标（WGS-84）</span><b>${n.lat.toFixed(3)}°N , ${n.lng.toFixed(3)}°E</b></div>
        </div>

        ${geoBlock}
        <div class="sec">
          <h4>地理环境</h4>
          <p>${esc(n.g)}</p>
        </div>
        <div class="sec">
          <h4>事件经过</h4>
          <p>${esc(n.ev)}</p>
        </div>
        ${battle}
        <div class="sec signif">
          <h4>历史意义</h4>
          <p>${esc(n.sig)}</p>
        </div>
      </div>
      <div class="card-foot">
        <button class="nav-b" id="prevBtn" ${prev ? '' : 'disabled'} title="${prev ? esc(prev.n) : ''}">‹</button>
        <button class="btn-terrain ${state.terrain ? 'active' : ''}" id="terrainBtn">
          ${state.terrain ? '◉ 已放大地形 · 返回全景' : '⌖ 放大看地理形态'}
        </button>
        <button class="nav-b" id="nextBtn" ${next ? '' : 'disabled'} title="${next ? esc(next.n) : ''}">›</button>
      </div>`;

    $('#cardClose').onclick = closeCard;
    $('#terrainBtn').onclick = () => state.terrain ? exitTerrain() : enterTerrain(n);
    $('#prevBtn').onclick = () => prev && selectNode(prev.id);
    $('#nextBtn').onclick = () => next && selectNode(next.id);
  }

  /* =========================================================
     四、地形视图（山体晕渲 + 湿地纹理 + 水系叠加）
     ========================================================= */
  function terrainZoom(n) {
    if (n.t === 'snow') return 12.3;
    if (n.t === 'grass') return 13.0;
    if (n.t === 'river') return 12.6;
    return 12.5;
  }

  let reliefMode = null;
  function setRelief(mode) {
    /* mode: 'snow' | 'grass' | null */
    if (reliefMode === mode) return;
    reliefMode = mode;
    const pane = map.getPane('relief');
    pane.className = 'leaflet-pane leaflet-relief-pane';
    const tp = map.getPane('tilePane');
    tp.classList.remove('snowboost', 'wetboost');
    if (!mode) { if (map.hasLayer(hillshade)) map.removeLayer(hillshade); return; }
    pane.classList.add(mode === 'snow' ? 'relief-snow' : mode === 'grass' ? 'relief-grass' : 'relief-river');
    if (mode === 'snow') tp.classList.add('snowboost'); else if (mode === 'grass') tp.classList.add('wetboost');
    if (!map.hasLayer(hillshade)) hillshade.addTo(map);
    hillshade.setZIndex(250);
  }

  function enterTerrain(n) {
    if (!state.sel) return;
    state.prevBase = state.base;
    state.terrain = true;

    setBase('sat');
    const z = terrainZoom(n);
    map.flyTo([n.lat, n.lng], z, { duration: 1.15 });

    const isGeo = GEO_TYPES.has(n.t);
    const kind = n.t === 'snow' ? '雪山地形' : n.t === 'grass' ? '沼泽湿地'
      : n.t === 'river' ? '江河水文' : '地貌实景';
    $('#tcIco').textContent = T(n.t).icon;
    $('#tcTitle').textContent = n.n + ' · ' + kind;
    const parts = [`${n.lat.toFixed(3)}°N ${n.lng.toFixed(3)}°E`];
    if (n.ele) parts.push(n.ele);
    parts.push(ARMY[n.a].short);
    $('#tcSub').textContent = parts.join('　');
    $('#tcGeo').textContent = n.tf ? `${n.tf.k} — ${n.tf.d}` : '';
    $('#tcGeo').classList.toggle('on', !!n.tf);
    $('#tcWater').textContent = nearbyWater(n);
    $('#tcWater').classList.toggle('on', !!$('#tcWater').textContent);
    $('#terrainChip').classList.add('on');
    setRelief(n.t === 'snow' ? 'snow' : n.t === 'grass' ? 'grass' : n.t === 'river' ? 'river' : null);

    const btn = $('#terrainBtn');
    if (btn) { btn.classList.add('active'); btn.textContent = '◉ 已放大地形 · 返回全景'; }
  }

  /* 近旁水系：即使注记落在卡片之下，也能从浮条读到 */
  function nearbyWater(n) {
    const p = [n.lat, n.lng];
    const list = [];
    G.rivers.forEach(r => {
      let bd = 1e9;
      r.c.forEach(c => { const d = havKm(p, c); if (d < bd) bd = d; });
      if (bd < 45) list.push({ n: r.n, d: bd });
    });
    G.lakes.forEach(k => {
      const d = havKm(p, k.c);
      if (d < 45) list.push({ n: k.n, d });
    });
    if (!list.length) return '';
    list.sort((a, b) => a.d - b.d);
    return '近旁水系　' + list.slice(0, 3)
      .map(x => `${x.n} ${x.d < 1 ? '近旁' : x.d.toFixed(0) + 'km'}`).join('　·　');
  }

  function exitTerrain(silent) {
    state.terrain = false;
    setRelief(null);
    setBase(state.prevBase === 'sat' ? 'night' : state.prevBase);
    $('#terrainChip').classList.remove('on');
    const btn = $('#terrainBtn');
    if (btn) { btn.classList.remove('active'); btn.textContent = '⌖ 放大看地理形态'; }
    if (!silent) overview();
  }

  /* ---------------- 全景 ---------------- */
  function overview() {
    const pts = [];
    Object.keys(routePts).forEach(a => { if (state.active.has(a)) routePts[a].forEach(p => pts.push(p)); });
    if (!pts.length) return;
    const b = L.latLngBounds(pts);
    const rightPad = $('#card').classList.contains('on') ? 470 : 90;
    map.flyToBounds(b, { paddingTopLeft: [50, 70], paddingBottomRight: [rightPad, 120], duration: 1.05 });
  }

  /* ---------------- 低缩放层级降噪 ---------------- */
  function declutter() {
    const z = map.getZoom();
    const showAll = z >= 6.6;
    const showLabelAll = z >= 9;
    const showLabelStar = z >= 7;
    D.nodes.forEach(n => {
      const m = markers[n.id];
      if (!m || !map.hasLayer(m)) return;
      const el = m.getElement();
      if (!el) return;
      const mk = el.querySelector('.mk');
      if (!mk) return;
      mk.classList.toggle('minor-hidden', !showAll && !n.star);
      mk.classList.toggle('show-label', showLabelAll || (n.star && showLabelStar));
      if (state.sel === n.id) mk.classList.add('show-label');
    });
  }

  /* ---------------- 侧栏 ---------------- */
  function visibleNodes() {
    return D.nodes.filter(n => state.active.has(n.a));
  }

  function renderList() {
    const wrap = $('#nodelist');
    const q = state.query.trim();
    let html = '';
    ['c1', 'c2', 'c4'].forEach(aid => {
      if (!state.active.has(aid)) return;
      const list = D.nodes.filter(n => n.a === aid && (!q || (n.n + n.p + n.ev + n.sig).indexOf(q) > -1));
      if (!list.length) return;
      html += `<div class="nl-group" style="--c:${ARMY[aid].color}">
        <div class="nl-gt"><i></i><em>${ARMY[aid].short}</em><span>${list.length} 站</span></div>`;
      list.forEach(n => {
        const isGeo = GEO_TYPES.has(n.t);
        html += `<div class="ni${state.sel === n.id ? ' on' : ''}${isGeo ? ' is-geo' : ''}" data-id="${n.id}"
          ${isGeo ? `style="--gc:${GEO_COLOR[n.t]}"` : ''}>
          <span class="dot" style="--c:${isGeo ? GEO_COLOR[n.t] : ARMY[aid].color}"></span>
          <span class="tx"><b>${esc(n.n)}</b><s>${fmtDate(n)} · ${esc(n.p)}</s></span>
          <span class="tp">${T(n.t).s || T(n.t).label}</span>
        </div>`;
      });
      html += '</div>';
    });
    wrap.innerHTML = html || '<div style="padding:26px 10px;color:#6b7d97;font-size:12px;text-align:center">未找到匹配节点</div>';
    wrap.querySelectorAll('.ni').forEach(el => {
      el.onclick = () => selectNode(el.dataset.id);
    });
    $('#totalCount').textContent = visibleNodes().length;
    document.body.classList.toggle('geo-off', !state.geo);
  }

  function applyGeoLayer() {
    Object.keys(markers).forEach(id => {
      const on = state.active.has(NODE[id].a) && (state.geo || !GEO_TYPES.has(NODE[id].t));
      const m = markers[id];
      if (on && !map.hasLayer(m)) m.addTo(map);
      if (!on && map.hasLayer(m)) map.removeLayer(m);
    });
    document.body.classList.toggle('geo-off', !state.geo);
    setTimeout(declutter, 20);
  }

  function refreshArmyUI() {
    $$('.army').forEach(el => {
      const on = state.active.has(el.dataset.a);
      el.classList.toggle('off', !on);
      el.querySelector('.ct').textContent = D.nodes.filter(n => n.a === el.dataset.a).length + ' 站';
    });
    Object.keys(routeLayers).forEach(aid => {
      const on = state.active.has(aid);
      routeLayers[aid].forEach(l => {
        if (on && !map.hasLayer(l)) l.addTo(map);
        if (!on && map.hasLayer(l)) map.removeLayer(l);
      });
    });
    Object.keys(markers).forEach(id => {
      const on = state.active.has(NODE[id].a) && (state.geo || !GEO_TYPES.has(NODE[id].t));
      const m = markers[id];
      if (on && !map.hasLayer(m)) m.addTo(map);
      if (!on && map.hasLayer(m)) map.removeLayer(m);
    });
    renderList();
    buildTimeline();
    updateStats();
    setTimeout(declutter, 30);
  }

  function updateStats() {
    const ns = visibleNodes();
    const sn = ns.filter(n => n.t === 'snow').length;
    const gr = ns.filter(n => n.t === 'grass').length;
    const rv = ns.filter(n => n.t === 'river').length;
    const bt = ns.filter(n => !!n.b).length;
    const st = document.querySelectorAll('.hstat b');
    if (st[4]) st[4].textContent = ns.length;
    if ($('#snowCount')) $('#snowCount').textContent = sn;
    if ($('#grassCount')) $('#grassCount').textContent = gr;
    if ($('#riverCount')) $('#riverCount').textContent = rv;
    if ($('#geoTotal')) $('#geoTotal').textContent = sn + gr + rv;
    if ($('#battleCount')) $('#battleCount').textContent = bt;
  }

  /* ---------------- 时间轴 ---------------- */
  let tlList = [];
  function buildTimeline() {
    tlList = visibleNodes().slice().sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
    const r = $('#tlRange');
    r.max = Math.max(tlList.length - 1, 0);
    if (state.tlIdx > tlList.length - 1) state.tlIdx = tlList.length - 1;
    r.value = state.tlIdx;
    applyTimeline();
  }

  function applyTimeline() {
    const n = tlList[state.tlIdx];
    if (!n) { playhead.setOpacity(0); return; }
    $('#tlDate').textContent = n.d.replace(/-/g, '.');
    $('#tlCur').innerHTML = `第 <b>${state.tlIdx + 1}</b> / ${tlList.length} 站 · ${esc(n.n)}`;
    Object.keys(markers).forEach(id => {
      const node = NODE[id];
      const faded = state.active.has(node.a) && node.d > n.d;
      const el = markers[id].getElement();
      if (el) { const mk = el.querySelector('.mk'); if (mk) mk.classList.toggle('faded', faded); }
    });
    playhead.setLatLng([n.lat, n.lng]);
    playhead.setOpacity(state.tlIdx >= tlList.length - 1 ? .35 : 1);
  }

  function play() {
    if (state.timer) { stop(); return; }
    if (state.tlIdx >= tlList.length - 1) state.tlIdx = 0;
    $('#tlPlay').textContent = '❚❚';
    state.timer = setInterval(() => {
      state.tlIdx++;
      if (state.tlIdx >= tlList.length - 1) { state.tlIdx = tlList.length - 1; stop(); }
      $('#tlRange').value = state.tlIdx;
      applyTimeline();
      const n = tlList[state.tlIdx];
      if (n && !state.terrain && !state.sel) map.panTo([n.lat, n.lng], { animate: true, duration: .45 });
    }, 520);
  }
  function stop() {
    clearInterval(state.timer); state.timer = null;
    $('#tlPlay').textContent = '▶';
  }

  /* ---------------- 事件绑定 ---------------- */
  $('#tlRange').oninput = e => {
    stop();
    state.tlIdx = +e.target.value;
    applyTimeline();
  };
  $('#tlPlay').onclick = play;

  $$('.army').forEach(el => {
    el.onclick = () => {
      const a = el.dataset.a;
      if (state.active.has(a)) {
        if (state.active.size === 1) return;
        state.active.delete(a);
      } else state.active.add(a);
      refreshArmyUI();
    };
  });

  $$('.phase button').forEach(b => {
    b.onclick = () => {
      $$('.phase button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      state.phase = +b.dataset.phase;
      if (state.phase === 1) state.active = new Set(['c1']);
      else state.active = new Set(['c1', 'c2', 'c4']);
      closeCard();
      refreshArmyUI();
      setTimeout(overview, 60);
      $('#hint').classList.remove('hide');
      setTimeout(() => $('#hint').classList.add('hide'), 5200);
    };
  });

  $$('.basegrp button').forEach(b => {
    b.onclick = () => { setBase(b.dataset.base); state.prevBase = b.dataset.base; };
  });

  /* 图层开关：水系标注 / 自然地理层 */
  $('#btnWater').onclick = () => {
    state.water = !state.water;
    $('#btnWater').classList.toggle('on', state.water);
    updateHydro();
  };
  $('#btnGeo').onclick = () => {
    state.geo = !state.geo;
    $('#btnGeo').classList.toggle('on', state.geo);
    applyGeoLayer();
  };

  $('#btnPano').onclick = () => { stop(); if (state.terrain) exitTerrain(true); overview(); };
  $('#tcClose').onclick = () => exitTerrain();
  $('#searchInput').oninput = e => { state.query = e.target.value; renderList(); };

  map.on('click', () => { if (state.sel) closeCard(); });
  map.on('zoomend', () => {
    declutter();
    routeDetail();
    updateHydro();
    /* 地形视图下山体晕渲仅在中高缩放生效，避免全景过度压暗 */
    if (state.terrain && reliefMode) {
      const want = map.getZoom() >= 10.5;
      if (want && !map.hasLayer(hillshade)) hillshade.addTo(map);
      if (!want && map.hasLayer(hillshade)) map.removeLayer(hillshade);
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (state.terrain) exitTerrain(); else closeCard(); }
    if (!state.sel) return;
    const order = D.routes[NODE[state.sel].a];
    const i = order.indexOf(state.sel);
    if (e.key === 'ArrowRight' && i < order.length - 1) selectNode(order[i + 1]);
    if (e.key === 'ArrowLeft' && i > 0) selectNode(order[i - 1]);
  });

  /* ---------------- 启动 ---------------- */
  setBase('night');
  buildHydro();
  refreshArmyUI();
  state.tlIdx = tlList.length - 1;
  $('#tlRange').value = state.tlIdx;
  applyTimeline();

  if (RG) {
    const total = ['c1', 'c2', 'c4'].reduce((s, a) => s + (RG[a] ? RG[a].full.length : 0), 0);
    document.body.dataset.routePts = total;
  }

  map.whenReady(() => {
    setTimeout(() => {
      overview();
      $('#loading').classList.add('out');
      setTimeout(() => $('#loading').remove(), 600);
      setTimeout(() => $('#hint').classList.add('hide'), 7000);
    }, 420);
  });

  /* 调试句柄（便于控制台核对视图状态） */
  window.LM_VIEW = { map, state, markers, routeLayers, hydro, overview, selectNode, NODE };

})();
