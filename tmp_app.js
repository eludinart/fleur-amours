async function fetchCards(){
  const r = await fetch('/api/cards');
  return r.json();
}

function el(id){return document.getElementById(id)}

async function init(){
  const data = await fetchCards();
  window.cards = data.cards || [];
  renderList(window.cards);
}

async function fetchGraph(minShared=1){
  const r = await fetch('/api/graph?min_shared=' + encodeURIComponent(minShared));
  return r.json();
}

function renderList(cards){
  const ul = el('list'); ul.innerHTML='';
  cards.forEach((c,i)=>{
    const li = document.createElement('li');
    li.textContent = (c.slug||'') + ' — ' + (c.name||c.meta?.source||'');
    li.onclick = ()=> loadCard(i+1);
    ul.appendChild(li);
  });
}

async function loadCard(index){
  const r = await fetch('/api/cards/'+index);
  const c = await r.json();
  window.current = c;
  el('cardTitle').textContent = c.name || c.slug || 'Carte';
  el('name').value = c.name||'';
  el('slug').value = c.slug||'';
  el('tags').value = (c.tags||[]).join(', ');
  el('sections').value = JSON.stringify(c.sections||[], null, 2);
  el('info').value = JSON.stringify(c.info||{}, null, 2);
  el('editor').style.display='block';
  el('matrix').style.display='none';
}

el('save')?.addEventListener('click', async ()=>{
  const c = window.current || {};
  c.name = el('name').value;
  c.slug = el('slug').value;
  try{
    c.info = JSON.parse(el('info').value || '{}');
    c.sections = JSON.parse(el('sections').value || '[]');
    const tags = (el('tags').value||'').split(',').map(s=>s.trim()).filter(Boolean);
    c.tags = tags;
  }catch(e){ alert('Info JSON invalide'); return }
  // PUT by slug
  const slug = c.slug || encodeURIComponent(c.meta?.source || '');
  const res = await fetch('/api/cards/'+slug, {method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify(c)});
  const j = await res.json();
  alert('Enregistré: '+(j.path||''));
  init();
});

el('matrixBtn')?.addEventListener('click', ()=>{
  el('editor').style.display='none';
  el('matrix').style.display='block';
  el('network').style.display='none';
});

el('networkBtn')?.addEventListener('click', ()=>{
  el('editor').style.display='none';
  el('matrix').style.display='none';
  el('network').style.display='block';
});

el('buildGraph')?.addEventListener('click', async ()=>{
  const min = Number(el('minShared').value||1);
  const g = await fetchGraph(min);
  renderGraph(g);
});

el('runSim')?.addEventListener('click', async ()=>{
  const seeds = (el('simSeeds').value||'').split(',').map(s=>s.trim()).filter(Boolean);
  const steps = Number(el('simSteps').value||6);
  const decay = Number(el('simDecay').value||0.6);
  const r = await fetch('/api/simulate', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ seeds, steps, decay }) });
  const j = await r.json();
  renderSim(j);
});

function renderSim(res){
  const out = el('simResult'); out.style.display='block'; out.innerHTML='';
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const header = document.createElement('tr');
  const slugs = res.slugs || [];
  const steps = res.timeline || [];
  const th0 = document.createElement('th'); th0.textContent='step'; header.appendChild(th0);
  slugs.forEach(s=>{ const th=document.createElement('th'); th.textContent=s; header.appendChild(th)});
  thead.appendChild(header); table.appendChild(thead);
  const tbody = document.createElement('tbody');
  steps.forEach((st, idx)=>{
    const tr = document.createElement('tr');
    const td0 = document.createElement('td'); td0.textContent = idx; tr.appendChild(td0);
    slugs.forEach(s=>{ const td=document.createElement('td'); td.textContent = (st[s]||0).toFixed(3); tr.appendChild(td)});
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  out.appendChild(table);
}

function renderGraph(g){
  const container = document.getElementById('networkContainer');
  container.innerHTML = '';
  // create cytoscape container
  const cyDiv = document.createElement('div');
  cyDiv.style.width = '100%'; cyDiv.style.height = '100%';
  container.appendChild(cyDiv);
  // ensure cytoscape is loaded
  if(typeof cytoscape === 'undefined'){
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/cytoscape/dist/cytoscape.min.js';
    s.onload = ()=> _initCytoscape(cyDiv, g);
    document.body.appendChild(s);
  } else {
    _initCytoscape(cyDiv, g);
  }
}

function _initCytoscape(container, g){
  const elements = [];
  g.nodes.forEach(n=> elements.push({ data: { id: n.id, label: n.label } }));
  g.edges.forEach(e=> elements.push({ data: { source: e.source, target: e.target, weight: e.weight } }));
    const cy = cytoscape({ container, elements, style: [
      { selector: 'node', style: { 'label': 'data(label)', 'background-color':'#6b5ce6', 'color':'#fff', 'text-valign':'center', 'text-wrap':'wrap', 'font-size':10, 'width': 'mapData(tagCount, 0, 5, 18, 40)', 'height': 'mapData(tagCount, 0, 5, 18, 40)' } },
      { selector: 'edge', style: { 'width': 'mapData(weight, 1, 5, 1, 6)', 'line-color':'#c7c9ff', 'curve-style':'bezier' } },
      { selector: 'node:selected', style: { 'border-width': 3, 'border-color':'#333' } }
    ], layout: { name: 'cose' } });

    // augment nodes with tagCount
    cy.nodes().forEach(n=>{
      const id = n.id();
      const card = (window.cards || []).find(c=> (c.slug||'') === id);
      const tc = card ? (card.tags ? card.tags.length : 0) : 0;
      n.data('tagCount', tc);
    });

    // events
    cy.on('tap', 'node', function(evt){
      const node = evt.target;
      const id = node.id();
      showNodeDetail(id);
    });

    window._cy = cy;
  }

  function showNodeDetail(slug){
    fetch('/api/cards/' + encodeURIComponent(slug)).then(r=> r.json()).then(card=>{
      const panel = document.getElementById('nodeDetail');
      const body = document.getElementById('detailBody');
      document.getElementById('detailTitle').textContent = card.name || card.slug || slug;
      body.innerHTML = '';
      const meta = document.createElement('div'); meta.className='muted'; meta.textContent = `slug: ${card.slug || ''}`; body.appendChild(meta);
      if(card.tags && card.tags.length){
        const tags = document.createElement('div'); tags.innerHTML = '<strong>Tags:</strong> ' + card.tags.join(', '); body.appendChild(tags);
      }
      if(card.info){
        const info = document.createElement('pre'); info.style.whiteSpace='pre-wrap'; info.textContent = JSON.stringify(card.info, null, 2); body.appendChild(info);
      }
      if(card.sections){
        const sec = document.createElement('div'); sec.innerHTML = '<strong>Sections:</strong>';
        card.sections.forEach(s=>{
          const h = document.createElement('div'); h.style.fontWeight='700'; h.textContent = s.subtitle || ''; sec.appendChild(h);
          const p = document.createElement('div'); p.textContent = (s.paragraphs||[]).join('\n\n'); sec.appendChild(p);
        });
        body.appendChild(sec);
      }
      panel.style.display='block';
    }).catch(e=>{ console.error(e) });
  }

  // controls: layout, zoom, export
  document.getElementById('layoutSelect')?.addEventListener('change', function(){
    const name = this.value;
    if(window._cy){ window._cy.layout({ name }).run(); }
  });
  document.getElementById('zoomIn')?.addEventListener('click', ()=>{ if(window._cy) window._cy.zoom({ level: Math.min(window._cy.zoom()+0.2, 2) }) });
  document.getElementById('zoomOut')?.addEventListener('click', ()=>{ if(window._cy) window._cy.zoom({ level: Math.max(window._cy.zoom()-0.2, 0.2) }) });
  document.getElementById('exportPng')?.addEventListener('click', ()=>{ if(window._cy){ const data = window._cy.png({ full: true, scale: 2 }); const a = document.createElement('a'); a.href = data; a.download = 'graph.png'; a.click(); } });
}

el('buildMatrix')?.addEventListener('click', ()=>{
  const key = el('numericKey').value.trim();
  const cards = window.cards || [];
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const header = document.createElement('tr');
  ['slug','name','sections_count', key].forEach(h=>{ const th=document.createElement('th'); th.textContent=h; header.appendChild(th)});
  thead.appendChild(header); table.appendChild(thead);
  const tbody = document.createElement('tbody');
  cards.forEach(c=>{
    const tr = document.createElement('tr');
    const sections = Array.isArray(c.sections)?c.sections.length: (c.info?.sections? c.info.sections.length:0);
    const val = key ? (Number(c[key] ?? c.info?.[key] ?? null) ?? '') : '';
    [c.slug, c.name, sections, val].forEach(v=>{ const td=document.createElement('td'); td.textContent = v; tr.appendChild(td)});
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  const out = el('matrixTable'); out.innerHTML=''; out.appendChild(table);
});

document.addEventListener('DOMContentLoaded', init);
