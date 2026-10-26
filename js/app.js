/* Calculadora de orçamentos para vidraçarias — lógica
   Conta do preço, desenho do box, mensagem ao cliente e 3D (modo #extras). */
(function(){
  var $ = function(id){ return document.getElementById(id); };
  // Extras (3D, outros modelos e mensagem ao cliente) ficam escondidos.
  // Para mostrar, abra o link da calculadora com #extras no final.
  var EXTRAS = (location.hash === '#extras');

  // ---------- Box em 3D (ilustrativo) ----------
  var V3 = null;
  function iniciar3D(){
    var box = $('v3d');
    if (typeof THREE === 'undefined' || !THREE.OrbitControls){
      var f = document.createElement('p'); f.className = 'v3d-falha';
      f.textContent = 'Não deu para carregar o 3D agora. Confira a internet e abra a página de novo.';
      box.appendChild(f); return;
    }
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch(e){ var f2 = document.createElement('p'); f2.className='v3d-falha'; f2.textContent='Este aparelho não mostra 3D. O orçamento continua funcionando normalmente.'; box.appendChild(f2); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    box.insertBefore(renderer.domElement, box.firstChild);
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(38, 4/3, 0.05, 50);
    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
    controls.minDistance = 1.2; controls.maxDistance = 7;
    controls.minPolarAngle = 0.35; controls.maxPolarAngle = Math.PI/2 - 0.04;
    controls.minAzimuthAngle = -1.25; controls.maxAzimuthAngle = 1.25;
    var reduz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    controls.autoRotate = !reduz; controls.autoRotateSpeed = 0.6;
    renderer.domElement.addEventListener('pointerdown', function(){ controls.autoRotate = false; });

    scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc9c0, 0.7));
    var sol = new THREE.DirectionalLight(0xffffff, 0.7); sol.position.set(2, 4, 3); scene.add(sol);

    var ambiente = new THREE.Group(); scene.add(ambiente);
    var grupo = new THREE.Group(); scene.add(grupo);

    function ajustar(){
      var w = box.clientWidth, h = box.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w/h; camera.updateProjectionMatrix();
    }
    if (window.ResizeObserver) new ResizeObserver(ajustar).observe(box); else window.addEventListener('resize', ajustar);
    ajustar();
    (function loop(){ requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); })();
    V3 = { scene: scene, camera: camera, controls: controls, grupo: grupo, ambiente: ambiente, L: 0, A: 0 };
  }

  function limpar(g){ g.traverse(function(o){ if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); while (g.children.length) g.remove(g.children[0]); }
  function peca(g, w, h, d, mat, x, y, z){ var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; }

  function enquadrar(vista){
    if (!V3 || !V3.foco) return;
    var f = V3.foco, dist = f.tam * 1.35 + 0.5;
    V3.controls.target.copy(f.centro);
    if (vista === 'lado') V3.camera.position.set(f.centro.x + dist*0.75, f.centro.y + f.tam*0.12, f.centro.z + dist*0.65);
    else V3.camera.position.set(f.centro.x + dist*0.28, f.centro.y + f.tam*0.08, f.centro.z + dist);
    V3.controls.update();
  }

  var VIDRO3D = { incolor:{ c:0xbfe3da, o:0.28 }, fume:{ c:0x3f4749, o:0.6 }, jateado:{ c:0xf1f4f3, o:0.85 } };
  var PERFIL3D = { branco:{ c:0xf2f2f0, m:0.1, r:0.6 }, preto:{ c:0x1f2326, m:0.3, r:0.5 }, natural:{ c:0xb4b9bc, m:0.35, r:0.4 } };
  function mat(c, extra){ var o = { color: c, roughness: 0.8 }; for (var k in extra) o[k] = extra[k]; return new THREE.MeshStandardMaterial(o); }
  function materiais(tipo, cor){
    var pf = PERFIL3D[cor] || PERFIL3D.branco, vd = VIDRO3D[tipo] || VIDRO3D.incolor;
    return {
      perfil: mat(pf.c, { metalness: pf.m, roughness: pf.r }),
      vidro: mat(vd.c, { transparent: true, opacity: vd.o, roughness: tipo === 'jateado' ? 0.9 : 0.05, metalness: 0, depthWrite: false, side: THREE.DoubleSide }),
      metal: mat(0xa9afb3, { metalness: 0.3, roughness: 0.35 })
    };
  }

  // parede com abertura (vão) centrada em x = 0
  function paredeComVao(g, W, H, esp, z, L, y0, A, m){
    var lateral = (W - L) / 2;
    peca(g, lateral, H, esp, m, -(L/2 + lateral/2), H/2, z);
    peca(g, lateral, H, esp, m,  (L/2 + lateral/2), H/2, z);
    if (y0 > 0.001) peca(g, L, y0, esp, m, 0, y0/2, z);
    var topo = H - (y0 + A);
    if (topo > 0.001) peca(g, L, topo, esp, m, 0, y0 + A + topo/2, z);
  }

  // duas folhas de correr com trilhos, montadas no eixo x local, centradas em 0
  function ladoCorrer(comp, A, ms, pux, puxAlto){
    var g = new THREE.Group(), e = 0.035;
    peca(g, comp, e, 0.07, ms.perfil, 0, A - e/2, 0);
    peca(g, comp, 0.015, 0.07, ms.perfil, 0, 0.0075, 0);
    peca(g, 0.025, A, 0.05, ms.perfil, -comp/2 + 0.0125, A/2, 0);
    peca(g, 0.025, A, 0.05, ms.perfil,  comp/2 - 0.0125, A/2, 0);
    var fw = (comp - 0.05) * 0.53, fh = A - e - 0.03;
    var f1 = peca(g, fw, fh, 0.008, ms.vidro, -comp/2 + 0.025 + fw/2, 0.015 + fh/2, -0.016); f1.renderOrder = 1;
    var f2 = peca(g, fw, fh, 0.008, ms.vidro,  comp/2 - 0.025 - fw/2, 0.015 + fh/2,  0.016); f2.renderOrder = 2;
    if (pux){ var ph = puxAlto ? 0.6 : 0.32; peca(g, 0.02, ph, 0.02, ms.metal, comp/2 - 0.025 - fw + 0.07, Math.min(1.1, fh*0.55), 0.045); }
    return g;
  }

  function cenaBanheiro(amb, W, D, A){
    var piso = mat(0xb4ada1, { roughness: 0.9 }), parede = mat(0xc9c2b6, { roughness: 1 }), azulejo = mat(0x93a5a8);
    peca(amb, W + 1.2, 0.02, D + 1.4, piso, 0, -0.01, -D/2 + 0.45);
    peca(amb, W + 0.02, A + 0.4, 0.04, azulejo, 0, (A + 0.4)/2, -D);
    var cano = mat(0x9ea4a7, { metalness: 0.7, roughness: 0.3 });
    peca(amb, 0.03, 0.03, 0.35, cano, -W*0.2, A*0.95, -D + 0.18);
    peca(amb, 0.16, 0.02, 0.16, cano, -W*0.2, A*0.94, -D + 0.34);
    return { parede: parede };
  }

  var CENAS = {
    'box-correr': function(amb, g, d, ms){
      var b = cenaBanheiro(amb, d.L, 1.0, d.A);
      peca(amb, 0.12, d.A + 0.4, 1.0, b.parede, -d.L/2 - 0.06, (d.A + 0.4)/2, -0.5);
      peca(amb, 0.12, d.A + 0.4, 1.0, b.parede,  d.L/2 + 0.06, (d.A + 0.4)/2, -0.5);
      g.add(ladoCorrer(d.L, d.A, ms, d.pux, false));
      return { centro: new THREE.Vector3(0, d.A/2, 0), tam: Math.max(d.L, d.A) };
    },
    'box-canto': function(amb, g, d, ms){
      var L = d.L, P = d.L2, A = d.A;
      var piso = mat(0xb4ada1, { roughness: 0.9 }), azulejo = mat(0x93a5a8);
      peca(amb, L + 1.4, 0.02, P + 1.4, piso, -0.2, -0.01, -P/2 + 0.2);
      peca(amb, L + 0.6, A + 0.4, 0.04, azulejo, -0.3, (A + 0.4)/2, -P - 0.02);
      peca(amb, 0.04, A + 0.4, P + 0.02, azulejo, L/2 + 0.02, (A + 0.4)/2, -P/2);
      var cano = mat(0x9ea4a7, { metalness: 0.7, roughness: 0.3 });
      peca(amb, 0.35, 0.03, 0.03, cano, L/2 - 0.18, A*0.95, -P*0.5);
      peca(amb, 0.16, 0.02, 0.16, cano, L/2 - 0.34, A*0.94, -P*0.5);
      var frente = ladoCorrer(L, A, ms, d.pux, false); g.add(frente);
      var lado = ladoCorrer(P, A, ms, false, false); lado.rotation.y = Math.PI/2; lado.position.set(-L/2, 0, -P/2); g.add(lado);
      return { centro: new THREE.Vector3(-0.1, A/2, -P/2 + 0.2), tam: Math.max(L, P, A) };
    },
    'janela': function(amb, g, d, ms){
      var L = d.L, A = d.A, y0 = Math.max(0.2, Math.min(1.1, 2.2 - A)), H = y0 + A + 0.6, W = L + 2;
      var reboco = mat(0xc9c2b6, { roughness: 1 }), piso = mat(0xb4ada1, { roughness: 0.9 });
      peca(amb, W, 0.02, 2.2, piso, 0, -0.01, 0.6);
      paredeComVao(amb, W, H, 0.15, -0.075, L, y0, A, reboco);
      peca(amb, L + 0.1, 0.03, 0.22, mat(0xe9e6e1), 0, y0 - 0.015, 0.03);
      var e = 0.04;
      peca(g, L, e, 0.08, ms.perfil, 0, y0 + A - e/2, 0);
      peca(g, L, e, 0.08, ms.perfil, 0, y0 + e/2, 0);
      peca(g, e, A, 0.08, ms.perfil, -L/2 + e/2, y0 + A/2, 0);
      peca(g, e, A, 0.08, ms.perfil,  L/2 - e/2, y0 + A/2, 0);
      var fw = (L - 2*e) * 0.53, fh = A - 2*e, mo = 0.03;
      [[-L/2 + e + fw/2, -0.018], [L/2 - e - fw/2, 0.018]].forEach(function(p){
        var v = peca(g, fw - 2*mo, fh - 2*mo, 0.006, ms.vidro, p[0], y0 + A/2, p[1]); v.renderOrder = 2;
        peca(g, fw, mo, 0.03, ms.perfil, p[0], y0 + e + mo/2, p[1]);
        peca(g, fw, mo, 0.03, ms.perfil, p[0], y0 + A - e - mo/2, p[1]);
        peca(g, mo, fh, 0.03, ms.perfil, p[0] - fw/2 + mo/2, y0 + A/2, p[1]);
        peca(g, mo, fh, 0.03, ms.perfil, p[0] + fw/2 - mo/2, y0 + A/2, p[1]);
      });
      if (d.pux) peca(g, 0.02, 0.1, 0.03, ms.metal, L/2 - e - fw + 0.03, y0 + A/2, 0.045);
      return { centro: new THREE.Vector3(0, y0 + A/2, 0), tam: Math.max(L, A) + 0.4 };
    },
    'porta': function(amb, g, d, ms){
      var L = d.L, A = d.A, H = A + 0.5, W = L + 2.4;
      var reboco = mat(0xc9c2b6, { roughness: 1 }), piso = mat(0xa8865f, { roughness: 0.8 });
      peca(amb, W, 0.02, 3, piso, 0, -0.01, 0);
      paredeComVao(amb, W, H, 0.15, -0.09, L, 0, A, reboco);
      g.add(ladoCorrer(L, A, ms, d.pux, true));
      return { centro: new THREE.Vector3(0, A/2, 0), tam: Math.max(L, A) };
    },
    'espelho': function(amb, g, d, ms){
      var L = d.L, A = d.A, y0 = A < 1.3 ? 1.0 : Math.max(0.1, 2.2 - A), W = Math.max(L + 1.6, 2.4), H = Math.max(y0 + A + 0.5, 2.6);
      peca(amb, W, H, 0.04, mat(0x93a5a8, { roughness: 1 }), 0, H/2, -0.03);
      peca(amb, W, 0.02, 1.6, mat(0xb4ada1, { roughness: 0.9 }), 0, -0.01, 0.75);
      if (y0 >= 0.85){
        var cw = Math.min(L, 1.2);
        peca(amb, cw, 0.8, 0.48, mat(0xd8c7ad, { roughness: 0.7 }), 0, 0.4, 0.23);
        peca(amb, cw + 0.04, 0.03, 0.5, mat(0xf4f4f2, { roughness: 0.3 }), 0, 0.815, 0.24);
      }
      peca(g, L + 0.01, A + 0.01, 0.004, mat(0xa8b4b7, { metalness: 0.05, roughness: 0.3 }), 0, y0 + A/2, -0.006);
      peca(g, L, A, 0.006, mat(0xcfdcdf, { metalness: 0.05, roughness: 0.12 }), 0, y0 + A/2, 0);
      var brilho = mat(0xffffff, { transparent: true, opacity: 0.35, depthWrite: false });
      var s1 = peca(g, 0.05, A*0.5, 0.001, brilho, -L*0.25, y0 + A*0.62, 0.005); s1.rotation.z = -0.5;
      var s2 = peca(g, 0.025, A*0.4, 0.001, brilho, -L*0.18, y0 + A*0.6, 0.005); s2.rotation.z = -0.5;
      return { centro: new THREE.Vector3(0, y0 + A/2, 0), tam: Math.max(L, A) + 0.3 };
    },
    'guarda': function(amb, g, d, ms){
      var L = d.L, A = d.A;
      peca(amb, L + 0.8, 0.16, 1.8, mat(0xb4ada1, { roughness: 0.9 }), 0, -0.08, -0.7);
      peca(amb, L + 0.8, A + 2, 0.06, mat(0xc9c2b6, { roughness: 1 }), 0, (A + 2)/2 - 0.16, -1.6);
      var n = Math.max(1, Math.ceil(L / 1.0)), gap = 0.02, pw = (L - (n - 1) * gap) / n, base = 0.08;
      peca(g, L, base, 0.07, ms.perfil, 0, base/2, 0.05);
      for (var i = 0; i < n; i++){
        var x = -L/2 + pw/2 + i * (pw + gap);
        var v = peca(g, pw, A - base, 0.01, ms.vidro, x, base + (A - base)/2, 0.05); v.renderOrder = 2;
      }
      var tubo = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, L, 16), ms.perfil);
      tubo.rotation.z = Math.PI/2; tubo.position.set(0, A + 0.02, 0.05); g.add(tubo);
      return { centro: new THREE.Vector3(0, A/2, -0.3), tam: Math.max(L * 0.8, A * 1.6) };
    }
  };

  // linha fina em volta do vidro e do perfil, para não sumirem quando a cor for parecida com a parede
  function contornar(g){
    var malhas = []; g.traverse(function(o){ if (o.isMesh) malhas.push(o); });
    var mLinha = new THREE.LineBasicMaterial({ color: 0x1f2326, transparent: true, opacity: 0.5 });
    malhas.forEach(function(m){ var l = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), mLinha); l.renderOrder = 3; m.add(l); });
  }

  function atualizar3D(modelo, L, A, L2, tipo, cor, pux){
    if (!V3 || !(L > 0 && A > 0)) return;
    L = Math.min(L, 6); A = Math.min(A, 3.2); L2 = Math.min(Math.max(L2 || 0.9, 0.3), 3);
    var chave = modelo + '|' + L.toFixed(3) + '|' + A.toFixed(3) + '|' + L2.toFixed(3);
    var mudou = chave !== V3.chave; V3.chave = chave;
    $('v3d-medida').textContent = Math.round(L*100) + (modelo === 'box-canto' ? ' + ' + Math.round(L2*100) : '') + ' × ' + Math.round(A*100) + ' cm';
    limpar(V3.ambiente); limpar(V3.grupo);
    var cena = CENAS[modelo] || CENAS['box-correr'];
    V3.foco = cena(V3.ambiente, V3.grupo, { L: L, A: A, L2: L2, pux: pux }, materiais(tipo, cor));
    contornar(V3.grupo);
    if (mudou) enquadrar('frente');
  }
  // ---------- fim do 3D ----------

  var BRL = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  function brl(n){ return isFinite(n) ? BRL.format(n) : '—'; }
  function dec(n,d){ return n.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}); }
  function pct(x){ return isFinite(x) ? dec(x*100,1).replace(',0','') + '%' : '—'; }
  function num(v){ var n = parseFloat(String(v||'').trim().replace(/\s/g,'').replace(',','.')); return isFinite(n) && n >= 0 ? n : 0; }
  function med(v){ var n = num(v); return n > 10 ? n/100 : n; }   // até 10 = metro; acima = cm
  function val(id){ return num($(id).value); }
  function radio(name){ var r = document.querySelector('input[name="'+name+'"]:checked'); return r ? r.value : ''; }

  var ps = $('parcelas');
  for (var i=1;i<=12;i++){ var o=document.createElement('option'); o.value=i; o.textContent=i===1?'1 vez':i+' vezes'; ps.appendChild(o); }
  ps.value = '6';

  var KEY = 'orc-box-v2';
  var campos = Array.prototype.slice.call(document.querySelectorAll('#form input, #form select, #enviar input')).filter(function(el){ return el.id && el.id !== 'cliente' && !el.disabled; });
  var padrao = {};
  document.querySelectorAll('.preco').forEach(function(el){ padrao[el.id] = el.value; });
  function salvar(){
    var d = {};
    campos.forEach(function(el){ d[el.id] = (el.type==='checkbox'||el.type==='radio') ? el.checked : el.value; });
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch(e) {}
  }
  function carregar(){
    var d = null;
    try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(e) {}
    if (!d) return;
    campos.forEach(function(el){
      if (!(el.id in d)) return;
      if (el.type==='checkbox'||el.type==='radio') el.checked = !!d[el.id]; else el.value = d[el.id];
    });
  }

  // desenho do box
  var VIDRO = { incolor:'#CFE6E1', fume:'#7D8587', jateado:'#E9EDEC' };
  var PERFIL = { branco:'#F2F2F0', preto:'#22262A', natural:'#AEB3B6' };
  function desenhar(L, A, tipo, cor, pux){
    var svg = $('svg-box'), W = 200, H = 240;
    var maxW = 150, maxH = 190;
    var r = (L>0 && A>0) ? L/A : 0.63;
    var bw = Math.min(maxW, maxH*r), bh = bw / r;
    if (bh > maxH){ bh = maxH; bw = bh*r; }
    var x = 38 + (maxW-bw)/2, y = 12 + (maxH-bh)/2;
    var fw = 5, folha = (bw - 2*fw)*0.53;
    var vid = VIDRO[tipo] || VIDRO.incolor, per = PERFIL[cor] || PERFIL.branco;
    var s = '';
    s += '<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+bh+'" fill="'+per+'" stroke="currentColor" stroke-opacity=".55" stroke-width="1"/>';
    s += '<rect x="'+(x+fw)+'" y="'+(y+fw)+'" width="'+folha+'" height="'+(bh-2*fw)+'" fill="'+vid+'" fill-opacity=".9" stroke="'+per+'" stroke-width="2"/>';
    s += '<rect x="'+(x+bw-fw-folha)+'" y="'+(y+fw)+'" width="'+folha+'" height="'+(bh-2*fw)+'" fill="'+vid+'" fill-opacity=".75" stroke="currentColor" stroke-opacity=".35" stroke-width="1"/>';
    s += '<line x1="'+(x+fw+folha*0.25)+'" y1="'+(y+fw+8)+'" x2="'+(x+fw+folha*0.1)+'" y2="'+(y+fw+40)+'" stroke="#FFFFFF" stroke-opacity=".7" stroke-width="3"/>';
    if (pux) s += '<rect x="'+(x+bw-fw-folha+6)+'" y="'+(y+bh/2-16)+'" width="4" height="32" rx="2" fill="currentColor" fill-opacity=".7"/>';
    // cotas
    var cy = y+bh+14;
    s += '<g stroke="currentColor" stroke-opacity=".6" stroke-width="1"><line x1="'+x+'" y1="'+cy+'" x2="'+(x+bw)+'" y2="'+cy+'"/><line x1="'+x+'" y1="'+(cy-4)+'" x2="'+x+'" y2="'+(cy+4)+'"/><line x1="'+(x+bw)+'" y1="'+(cy-4)+'" x2="'+(x+bw)+'" y2="'+(cy+4)+'"/>';
    var cx = x-12;
    s += '<line x1="'+cx+'" y1="'+y+'" x2="'+cx+'" y2="'+(y+bh)+'"/><line x1="'+(cx-4)+'" y1="'+y+'" x2="'+(cx+4)+'" y2="'+y+'"/><line x1="'+(cx-4)+'" y1="'+(y+bh)+'" x2="'+(cx+4)+'" y2="'+(y+bh)+'"/></g>';
    s += '<text x="'+(x+bw/2)+'" y="'+(cy+16)+'" text-anchor="middle" font-size="13" fill="currentColor">'+dec(L*100,0)+' cm</text>';
    s += '<text x="'+(cx-6)+'" y="'+(y+bh/2)+'" text-anchor="middle" font-size="13" fill="currentColor" transform="rotate(-90 '+(cx-6)+' '+(y+bh/2)+')">'+dec(A*100,0)+' cm</text>';
    svg.innerHTML = s;
  }

  function calcular(){
    var L = med($('largura').value), A = med($('altura').value);
    var tipo = radio('vidro'), cor = radio('perfil');
    var modelo = radio('modelo') || 'box-correr', L2 = med($('largura2').value), temConta = modelo === 'box-correr';
    $('l-largura').textContent = modelo === 'guarda' ? 'Comprimento' : 'Largura';
    $('lado2-wrap').hidden = modelo !== 'box-canto';
    $('desenho2d').hidden = !temConta;
    $('q2').textContent = TITULO[modelo] || TITULO['box-correr'];
    $('margem').value = $('margem-r').value;
    $('margem-v').textContent = $('margem-r').value + '%';
    var perda = val('perda')/100;
    var area = L*A, areaC = area*(1+perda);
    var pVidro = val('p-vidro-'+tipo), pPerfil = val('p-perfil-'+cor);
    var cVidro = areaC*pVidro;
    var perfisM = 2*L + 2*A, cPerfis = perfisM*pPerfil;
    var cKit = val('p-kit');
    var temPux = $('puxador').checked, cPux = temPux ? val('p-puxador') : 0;
    var escovaM = 2*A, cEscova = escovaM*val('p-escova');
    var cCons = val('p-consumiveis');
    var cMO = val('mo');
    var km = val('km'), consumo = val('consumo'), gas = val('gasolina'), viagens = Math.round(val('viagens'));
    var litros = consumo > 0 ? (km*2)/consumo : 0;
    var cDesl = litros*gas*viagens;
    var cFixos = val('fixos');
    var custo = cVidro+cPerfis+cKit+cPux+cEscova+cCons+cMO+cDesl+cFixos;

    var cartao = radio('pag') === 'cartao';
    var n = parseInt(ps.value,10) || 1;
    var taxaPct = cartao ? (n===1 ? val('p-taxa-1') : (n<=6 ? val('p-taxa-6') : val('p-taxa-12'))) : 0;
    var m = val('margem')/100, imp = val('impostos')/100, t = taxaPct/100;
    var manual = $('manual').checked;

    var precoVista = custo/(1-m-imp);
    var precoSug = custo/(1-m-imp-t);
    var minimo = custo/(1-imp-t);
    var preco = manual ? val('preco-manual') : precoSug;
    var valido = (1-m-imp-t) > 0 && (1-imp-t) > 0;
    var vImp = preco*imp, vTaxa = preco*t;
    var lucro = preco - vImp - vTaxa - custo;
    var margemReal = preco > 0 ? lucro/preco : NaN;
    var mostra = valido || manual;

    desenhar(L, A, tipo, cor, temPux);
    atualizar3D(modelo, L, A, L2, tipo, cor, temPux);
    ['incolor','fume','jateado'].forEach(function(k){ $('pv-'+k).textContent = brl(val('p-vidro-'+k))+' o m²'; });
    ['branco','preto','natural'].forEach(function(k){ $('pp-'+k).textContent = brl(val('p-perfil-'+k))+' o metro'; });
    $('o-desl').innerHTML = (viagens===1?'Uma ida':viagens+' idas')+' de '+dec(km*2,0)+' km (ida e volta) gastam '+dec(litros*viagens,1)+' L. Fica <b>'+brl(cDesl)+'</b> de gasolina.';

    $('parc-wrap').hidden = !cartao;
    $('manual-wrap').hidden = !manual;
    $('r-cond').textContent = 'Box de correr '+dec(L*100,0)+' × '+dec(A*100,0)+' cm, '+(cartao ? 'no cartão em '+n+(n===1?' vez':' vezes') : 'no Pix ou dinheiro');
    $('r-title').textContent = manual ? 'Se você cobrar' : 'Pode cobrar';
    $('b-label').textContent = manual ? 'Se você cobrar' : 'Pode cobrar';
    $('r-preco').textContent = mostra ? brl(preco) : '—';
    $('b-preco').textContent = mostra ? brl(preco) : '—';
    var sub = '';
    if (cartao && mostra && n>1) sub = 'São '+n+' parcelas de '+brl(preco/n)+'.';
    if (cartao && mostra && !manual) sub += (sub?' ':'')+'No Pix sairia '+brl(precoVista)+'.';
    if (!cartao && mostra && !manual) sub = 'Se for no cartão em 6 vezes, cobre '+brl(custo/(1-m-imp-val('p-taxa-6')/100))+'.';
    $('r-sub').textContent = sub;

    var frase = $('r-frase');
    if (mostra){
      frase.innerHTML = (lucro >= 0
        ? 'Sobram <b>'+brl(lucro)+'</b> no seu bolso, '+pct(margemReal)+' do que o cliente paga.'
        : 'Nesse valor você perde <b>'+brl(-lucro)+'</b>.')
        + ' Abaixo de <b>'+brl(minimo)+'</b> você paga para trabalhar.';
    } else frase.textContent = '';

    var al = $('r-alert');
    al.hidden = true; al.className = 'aviso';
    if (!(L>0 && A>0)){ al.hidden=false; al.classList.add('atencao'); al.textContent='Coloque a largura e a altura do vão para a conta ficar certa.'; }
    else if (!valido && !manual){ al.hidden=false; al.classList.add('ruim'); al.textContent='Lucro, imposto e taxa somados chegam a 100% ou mais. Diminua algum deles para a conta fechar.'; }
    else if (manual && lucro < 0){ al.hidden=false; al.classList.add('ruim'); al.textContent='Esse preço não cobre os custos. Para não sair no prejuízo, cobre pelo menos '+brl(minimo)+'.'; }
    else if (manual && margemReal < m){ al.hidden=false; al.classList.add('atencao'); al.textContent='Dá lucro, mas menos que os '+pct(m)+' que você quer. Para ganhar isso, o preço seria '+brl(precoSug)+'.'; }

    var tb = $('r-tabela'); tb.textContent='';
    function linha(cls, t1, t2, v){
      var tr=document.createElement('tr'); if(cls) tr.className=cls;
      var a=document.createElement('td'); a.textContent=t1;
      if (t2){ var s=document.createElement('small'); s.textContent=t2; a.appendChild(s); }
      var b=document.createElement('td'); b.textContent=brl(v);
      tr.appendChild(a); tr.appendChild(b); tb.appendChild(tr);
    }
    var nomeVidro = {incolor:'incolor',fume:'fumê',jateado:'jateado'}[tipo], nomePerfil = {branco:'branco',preto:'preto',natural:'natural fosco'}[cor];
    linha('', 'Vidro', dec(areaC,2)+' m² de temperado '+nomeVidro+' (com sobra)', cVidro);
    linha('', 'Perfil', dec(perfisM,2)+' m, '+nomePerfil, cPerfis);
    linha('', 'Ferragem e vedação', 'kit'+(temPux?', puxador':'')+' e '+dec(escovaM,2)+' m de escova', cKit+cPux+cEscova);
    linha('', 'Silicone e parafuso', '', cCons);
    linha('', 'Mão de obra', '', cMO);
    linha('', 'Gasolina', viagens===1?'1 ida':viagens+' idas', cDesl);
    linha('', 'Gastos fixos', '', cFixos);
    linha('soma', 'Seu custo', '', custo);
    if (mostra){
      linha('saida', 'Imposto', pct(imp)+' do preço', vImp);
      if (t>0) linha('saida', 'Taxa da maquininha', pct(t)+' do preço', vTaxa);
      linha('saida', lucro>=0?'Seu lucro':'Prejuízo', pct(margemReal)+' do preço', lucro);
      linha('final', 'Preço para o cliente', '', preco);
    }

    var pMk = custo*(1+m), lMk = pMk*(1-imp-t) - custo, mMk = lMk/pMk;
    var ex = $('r-explica');
    if (m > 0 && custo > 0){
      ex.hidden = false;
      ex.innerHTML = '<b>Por que não é só somar '+pct(m)+' no custo?</b> Daria '+brl(pMk)+'. Só que o imposto'+(t>0?' e a taxa da maquininha saem':' sai')+' desse valor, e no fim sobraria '+(lMk<0?'prejuízo de '+brl(-lMk):brl(lMk)+', que é '+pct(mMk)+' e não '+pct(m))+'.';
    } else ex.hidden = true;

    // mensagem para o cliente (sem custo e sem lucro)
    var cli = $('cliente').value.trim(), loja = $('nome-vidracaria').value.trim();
    var dias = Math.max(1, Math.round(val('validade')) || 7);
    var linhas = [];
    linhas.push(cli ? 'Olá, '+cli+'! Segue o orçamento do seu box:' : 'Olá! Segue o orçamento do seu box:');
    linhas.push('');
    linhas.push('Box de correr de 2 folhas');
    linhas.push('Medida: '+dec(L*100,0)+' × '+dec(A*100,0)+' cm');
    linhas.push('Vidro temperado 8 mm '+nomeVidro+', perfil '+nomePerfil+(temPux ? ', com puxador' : ''));
    linhas.push('Material, entrega e instalação inclusos');
    linhas.push('');
    if (mostra){
      if (cartao){
        linhas.push('Valor: '+brl(preco)+(n>1 ? ' em '+n+'x de '+brl(preco/n)+' no cartão' : ' no cartão'));
        if (!manual) linhas.push('No Pix ou dinheiro: '+brl(precoVista));
      } else {
        linhas.push('Valor: '+brl(preco)+' no Pix ou dinheiro');
        if (!manual){ var p6 = custo/(1-m-imp-val('p-taxa-6')/100); if (isFinite(p6) && p6>0) linhas.push('Ou em até 6x de '+brl(p6/6)+' no cartão ('+brl(p6)+')'); }
      }
    }
    linhas.push('');
    linhas.push('Orçamento válido por '+dias+(dias===1?' dia.':' dias.'));
    if (loja) linhas.push(loja);
    var texto = linhas.join('\n');
    $('previa').textContent = texto;
    $('whats').href = 'https://wa.me/?text=' + encodeURIComponent(texto);

    // modelos que ainda não têm conta: só o 3D
    $('enviar').hidden = !temConta || !EXTRAS;
    $('r-h-conta').hidden = !temConta;
    if (!temConta){
      var nome = NOMES[modelo];
      $('r-cond').textContent = nome + ' ' + Math.round(L*100) + (modelo === 'box-canto' ? ' + ' + Math.round(L2*100) : '') + ' × ' + Math.round(A*100) + ' cm';
      $('r-title').textContent = 'Conta em breve';
      $('b-label').textContent = 'Conta em breve';
      $('r-preco').textContent = '—'; $('b-preco').textContent = '—'; $('r-sub').textContent = '';
      $('r-frase').textContent = 'A conta de ' + nome.toLowerCase() + ' ainda vai ser montada com um vidraceiro. Por enquanto dá para ver como fica em 3D.';
      $('r-alert').hidden = true; $('r-tabela').textContent = ''; $('r-explica').hidden = true;
    }
  }
  var NOMES = { 'box-correr':'Box de correr', 'box-canto':'Box de canto', 'janela':'Janela de correr', 'porta':'Porta de vidro', 'espelho':'Espelho', 'guarda':'Guarda-corpo' };
  var TITULO = { 'box-correr':'Como vai ser o box?', 'box-canto':'Como vai ser o box?', 'janela':'Como vai ser a janela?', 'porta':'Como vai ser a porta?', 'espelho':'Como vai ser o espelho?', 'guarda':'Como vai ser o guarda-corpo?' };
  var MEDIDAS_PADRAO = { 'box-correr':['120','190'], 'box-canto':['90','190','90'], 'janela':['150','100'], 'porta':['160','210'], 'espelho':['80','100'], 'guarda':['300','110'] };
  document.querySelectorAll('input[name="modelo"]').forEach(function(r){
    r.addEventListener('change', function(){
      var d = MEDIDAS_PADRAO[r.value]; if (!d) return;
      $('largura').value = d[0]; $('altura').value = d[1]; if (d[2]) $('largura2').value = d[2];
    });
  });

  carregar();
  $('margem-r').value = $('margem').value || '30';
  if (EXTRAS){
    // a biblioteca do 3D só é baixada no modo extras (página leve no celular)
    var carregar3D = function(src, depois){ var sc = document.createElement('script'); sc.src = src; sc.onload = depois; sc.onerror = depois; document.head.appendChild(sc); };
    carregar3D('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js', function(){
      carregar3D('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js', function(){ iniciar3D(); calcular(); });
    });
  }
  else {
    $('bloco3d').hidden = true;
    document.querySelectorAll('input[name="modelo"]').forEach(function(r){
      if (r.value === 'box-correr') return;
      r.disabled = true;
      var s = r.parentNode.querySelector('small'); if (s) s.textContent = 'Em breve';
    });
    $('m-box-correr').checked = true;
    $('intro-txt').textContent = 'Escolha o que vai orçar, responda quatro perguntas e o preço sai pronto, com material, gasolina, mão de obra, imposto e o seu lucro.';
  }
  $('v3d-frente').addEventListener('click', function(){ if (V3){ V3.controls.autoRotate = false; enquadrar('frente'); } });
  $('v3d-lado').addEventListener('click', function(){ if (V3){ V3.controls.autoRotate = false; enquadrar('lado'); } });
  $('form').addEventListener('input', function(){ calcular(); salvar(); });
  $('form').addEventListener('change', function(){ calcular(); salvar(); });
  $('enviar').addEventListener('input', function(){ calcular(); salvar(); });
  $('copiar').addEventListener('click', function(){
    var texto = $('previa').textContent, msg = $('copiar-msg');
    function selecionar(){
      var r = document.createRange(); r.selectNodeContents($('previa'));
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      msg.textContent = 'Não consegui copiar sozinho. A mensagem ficou selecionada: é só copiar.';
    }
    try {
      navigator.clipboard.writeText(texto).then(function(){ msg.textContent = 'Mensagem copiada. Agora é só colar na conversa com o cliente.'; }, selecionar);
    } catch(e){ selecionar(); }
  });
  document.querySelectorAll('[data-passo]').forEach(function(b){
    b.addEventListener('click', function(){
      var v = Math.max(1, Math.round(val('viagens')) + parseInt(b.getAttribute('data-passo'),10));
      $('viagens').value = v; calcular(); salvar();
    });
  });
  $('reset').addEventListener('click', function(){
    Object.keys(padrao).forEach(function(id){ $(id).value = padrao[id]; });
    calcular(); salvar();
    $('reset-msg').textContent = 'Pronto, voltaram os valores de exemplo.';
  });
  calcular();
})();
