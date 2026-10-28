// ============================================
// IVO PITA JOIAS - SCRIPT OTIMIZADO v2 (sem banner)
// ============================================

const PLANILHA_ID = "142Ir0-8yfUuu2sSbbRo8x6SwjeQL74MLMUpNElVn1rc";

const ESTOQUE_API_URL =
  "https://script.google.com/macros/s/AKfycbwtdqgkfRH8mXRFRCfSTYSkmvXWtp0xAmdW6Qd_j8hCCrPl5ynOMeyolSCzvtoON1yyWQ/exec";

const CACHE_KEY_DADOS = 'ivo_dados_v3';
const CACHE_KEY_TIME = 'ivo_dados_time_v3';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos

const IMG_SIZE_CARD = 300;   
const IMG_SIZE_MODAL = 500;  
const IMG_SIZE_ZOOM = 1000;  

let siteConfig = {
  whatsapp: "5588981762208",
  whatsappDisplay: "(88) 98176-2208",
  email: "contato@ivopita.com.br",
  endereco: "Juazeiro do Norte, CE",
  telefone: "(88) 99909-9999",
  sobreTexto:
    "A IVO PITA nasceu para celebrar momentos especiais com peças que unem design sofisticado e materiais nobres.",
  freteGratisValor: 3500,
  taxaFrete: 15,
  pixDesconto: 5,
};

let FRETE_GRATIS_VALOR = 3500;
let TAXA_FRETE = 75;

const PLACEHOLDER_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#f0f7f2"/>
  <rect x="20" y="20" width="360" height="360" fill="none" stroke="#c9a86a" stroke-width="2" stroke-dasharray="8,6" rx="20"/>
  <text x="200" y="210" font-family="Montserrat, Arial, sans-serif" font-size="16" font-weight="600" fill="#2f6b4f" text-anchor="middle">SEM IMAGEM</text>
  <text x="200" y="235" font-family="Montserrat, Arial, sans-serif" font-size="11" fill="#5c6b63" text-anchor="middle">Ivo Pita Joias</text>
</svg>
`)}`;

window.PLACEHOLDER_SVG = PLACEHOLDER_SVG;

let allProducts = [];
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let selectedColor = "";
let tempProduct = null;
let subtotal = 0;
let imagensZoom = [];
let zoomIndex = 0;
let quantidadeSelecionada = 0;
let coresSelecionadas = {};
let coresDisponiveis = [];
let estruturaCategorias = [];
let sidebarDinamicaAtiva = false;
let __dadosCarregados = null;
let __sidebarJaRenderizada = false;

const ESTOQUE_CACHE = new Map();
const ESTOQUE_CACHE_TTL = 2 * 60 * 1000; // 2 minutos

// ============================================
// CACHE DE ESTOQUE
// ============================================
function getEstoqueCache(produtoId) {
  const entry = ESTOQUE_CACHE.get(String(produtoId));
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ESTOQUE_CACHE_TTL) {
    ESTOQUE_CACHE.delete(String(produtoId));
    return null;
  }
  return entry.saldo;
}

function setEstoqueCache(produtoId, saldo) {
  ESTOQUE_CACHE.set(String(produtoId), { saldo: parseInt(saldo) || 0, timestamp: Date.now() });
}

function invalidarEstoqueCache() {
  ESTOQUE_CACHE.clear();
}

// ============================================
// TOAST
// ============================================
function showToast(texto, tipo = 'success', duracao = 2500) {
  if (typeof Toastify === 'undefined') { console.log('[Toast]', texto); return; }
  const cores = {
    success: 'linear-gradient(135deg, #2f6b4f, #1f4d38)',
    error: '#ef4444', warning: '#f59e0b', info: '#3b82f6'
  };
  Toastify({
    text: texto, duration: duracao, gravity: 'top', position: 'right', stopOnFocus: true,
    style: {
      background: cores[tipo] || cores.success, borderRadius: '14px', fontWeight: '700',
      fontSize: '13px', padding: '14px 20px',
      boxShadow: '0 10px 30px rgba(15, 47, 34, 0.25)', maxWidth: '340px'
    },
    offset: { x: 16, y: 90 }
  }).showToast();
}
window.showToast = showToast;

// ============================================
// HELPERS
// ============================================
function normalizar(texto) {
  if (!texto) return "";
  return texto.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizarPalavraBusca(palavra) {
  return palavra.replace(/s$/, "").replace(/a$/, "").replace(/o$/, "").replace(/es$/, "").replace(/ns$/, "m");
}

// ============================================
// DRIVE IMG — VERSÃO SIMPLIFICADA (funciona!)
// ============================================
function driveImg(url, size = IMG_SIZE_CARD) {
  if (!url || url === 'placeholder.png') return PLACEHOLDER_SVG;

  // ✅ Já é googleusercontent: aplica SOMENTE =w (largura)
  // O Drive mantém a proporção automaticamente
  if (url.includes("googleusercontent.com")) {
    const baseUrl = url
      .replace(/=w\d+.*$/, '')
      .replace(/=s\d+.*$/, '')
      .replace(/=h\d+.*$/, '')
      .split('?')[0];
    return `${baseUrl}=w${size}`;
  }

  // ✅ URL antiga do drive.google.com → converte para lh3
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return `https://lh3.googleusercontent.com/u/0/d/${match[1]}=w${size}`;
  }

  if (url.startsWith("http")) return url;
  return PLACEHOLDER_SVG;
}

// ============================================
// CARREGAMENTO DE DADOS
// ============================================
async function carregarTudo() {
  const cache = localStorage.getItem(CACHE_KEY_DADOS);
  const cacheTime = parseInt(localStorage.getItem(CACHE_KEY_TIME) || '0');

  if (cache && Date.now() - cacheTime < CACHE_TTL_MS) {
    try {
      const dados = JSON.parse(cache);
      console.log('⚡ Renderizando do cache local');
      aplicarDados(dados);
      __dadosCarregados = dados;
      setTimeout(() => atualizarEmBackground(false), 200);
      return;
    } catch (e) {
      localStorage.removeItem(CACHE_KEY_DADOS);
    }
  }

  await atualizarEmBackground(true);
}

async function atualizarEmBackground(mostrarLoading = false) {
  try {
    if (mostrarLoading) {
      const c = document.getElementById('produtos-container');
      if (c && c.querySelectorAll('.product-card').length === 0) {
        c.innerHTML = Array(10).fill('<div class="skeleton-card"></div>').join('');
      }
    }

    const t0 = performance.now();
    const dados = await new Promise((resolve, reject) => {
      const cb = 'ivo_load_' + Date.now();
      let script = null;
      let resolvido = false;

      // ✅ Timeout de 25s (Apps Script frio pode demorar)
      const timeout = setTimeout(() => {
        if (resolvido) return;
        resolvido = true;
        console.warn('⏱️ Timeout do carregamento (25s)');
        reject(new Error('Timeout ao carregar dados'));
        // ⚠️ NÃO deletar o callback imediatamente — deixa o script terminar
        // para evitar o erro "callback is not defined"
      }, 25000);

      window[cb] = function (response) {
        if (resolvido) return;
        resolvido = true;
        clearTimeout(timeout);
        delete window[cb];
        if (script && script.parentNode) script.parentNode.removeChild(script);
        resolve(response);
      };

      script = document.createElement('script');
      script.src = `${ESTOQUE_API_URL}?callback=${cb}&_t=${Date.now()}`;
      script.onerror = () => {
        if (resolvido) return;
        resolvido = true;
        clearTimeout(timeout);
        delete window[cb];
        if (script && script.parentNode) script.parentNode.removeChild(script);
        reject(new Error('Erro de rede'));
      };
      document.body.appendChild(script);
    });

    console.log(`✅ Dados em ${Math.round(performance.now() - t0)}ms`);

    if (!dados || dados.error) throw new Error(dados?.error || 'Erro desconhecido');

    try {
      localStorage.setItem(CACHE_KEY_DADOS, JSON.stringify(dados));
      localStorage.setItem(CACHE_KEY_TIME, String(Date.now()));
    } catch (e) { }

    __dadosCarregados = dados;
    aplicarDados(dados);
  } catch (err) {
    console.error('❌ Erro:', err);
    const c = document.getElementById('produtos-container');
    if (c) {
      c.innerHTML = `
        <div class="col-span-full text-center py-12">
          <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
          <p class="text-textMuted font-bold">Erro ao carregar produtos</p>
          <p class="text-textMuted text-xs mt-2">${err.message}</p>
          <button onclick="localStorage.removeItem('${CACHE_KEY_DADOS}');location.reload()"
            class="mt-4 bg-primary text-white px-6 py-2 rounded-full text-sm font-bold">
            <i class="fas fa-sync-alt mr-2"></i>Tentar novamente
          </button>
        </div>`;
    }
  }
}


function aplicarDados(dados) {
  // ✅ VERIFICA MANUTENÇÃO (antes de tudo)
  if (dados.manutencao && dados.manutencao.emManutencao) {
    if (sessionStorage.getItem("admin_bypass") !== "true") {
      window.location.replace("manutencao.html");
      return;
    }
  }

  // ✅ FILTRA PRODUTOS DISPONÍVEIS
  allProducts = (dados.produtos || []).filter(function (p) {
    const disp = String(p["Disponível"] || p.disponivel || '').toLowerCase().trim();
    return disp === 'sim';
  }).map(function (p) {
    if (!p["Saldo Estoque"] && p["Saldo Estoque"] !== 0) {
      p["Saldo Estoque"] = (parseInt(p.Estoque) || 0) - (parseInt(p.Vendidos) || 0);
    }
    return p;
  });

 log(`📦 ${allProducts.length} produtos disponíveis`);
  aplicarConfig(dados.config || {});
  renderizarMarquee(dados.marquee || []);
  


// script.js — trocar 400 por 300
(function preloadPrimeirasImagens() {
  const primeiras = allProducts.slice(0, 2);
  primeiras.forEach(p => {
    if (!p.Imagem) return;
    const url = driveImg(p.Imagem, 300); // ✅ mesmo tamanho do src
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    link.setAttribute('fetchpriority', 'high');
    // ✅ Evita aviso de "não usado" caso o navegador escolha o 500w
    link.setAttribute('imagesrcset', `${driveImg(p.Imagem, 300)} 300w, ${driveImg(p.Imagem, 500)} 500w`);
    link.setAttribute('imagesizes', "(max-width: 600px) 45vw, (max-width: 1100px) 30vw, 20vw");
    document.head.appendChild(link);
  });
})();

  // ✅ GUARDA os tamanhos do backend
  if (dados.tamanhos && Array.isArray(dados.tamanhos) && dados.tamanhos.length > 0) {
    window.__tamanhosBackend = dados.tamanhos;
    log(`📐 ${dados.tamanhos.length} tamanhos carregados do backend`);
  }

  // ✅ Renderiza a sidebar (com lock)
  if (dados.estrutura && Array.isArray(dados.estrutura) && dados.estrutura.length > 0) {
    estruturaCategorias = dados.estrutura;
    if (!window.__sidebarJaRenderizada) {
      window.__sidebarJaRenderizada = true;
      renderizarSidebarDinamica();
    } else {
      log('🔒 Sidebar já renderizada — pulando renderização duplicada');
    }
  }

  // ✅ Renderiza produtos
  if (allProducts.length === 0) {
    const container = document.getElementById("produtos-container");
    if (container) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12">
          <i class="fas fa-gem text-4xl text-primary/30 mb-4"></i>
          <p class="text-textMuted">Nenhum produto disponível.</p>
        </div>`;
    }
  } else {
    renderProducts(allProducts);
  }

  setTimeout(atualizarContadoresSidebar, 50);
  setTimeout(atualizarContadorProdutos, 50);
}


function renderizarSidebarDinamica() {
  const scroll = document.getElementById('sidebar-scroll');
  if (!scroll) return;

  // ✅ 1. PRIORIZA os tamanhos do BACKEND (se existirem)
  let tamanhos = [];
  if (window.__tamanhosBackend && Array.isArray(window.__tamanhosBackend) && window.__tamanhosBackend.length > 0) {
    tamanhos = window.__tamanhosBackend.map(function (t) {
      return {
        cor: String(t.cor || 'dourado').toLowerCase().trim(),
        chave: normalizar(String(t.chave || '')),
        label: String(t.label || '').trim(),
        valor: String(t.valor || '').trim()
      };
    });
   log(`📏 [DEBUG] ${tamanhos.length} tamanhos vindos do BACKEND`);
  } else {
    // Fallback: lê do HTML estático
    const vistos = new Set();
    scroll.querySelectorAll('.sidebar-item-tamanho').forEach(function (btn) {
      const cat = (btn.getAttribute('data-categoria') || '').toLowerCase().trim();
      if (!cat || vistos.has(cat)) return;
      vistos.add(cat);
      const catNorm = normalizar(cat);
      const partes = cat.split(/\s+/);
      tamanhos.push({
        cor: catNorm.indexOf('prata') !== -1 ? 'prata' : 'dourado',
        chave: normalizar(partes[0] || ''),
        label: btn.textContent.trim(),
        valor: partes[partes.length - 1] || ''
      });
    });
    log(`📏 [DEBUG] ${tamanhos.length} tamanhos vindos do HTML (fallback)`);
  }

  // ✅ 2. Guarda "Todas" e limpa
  const btnTodas = scroll.querySelector('.sidebar-item[data-categoria="todos"]');
  scroll.innerHTML = '';

  if (btnTodas) {
    scroll.appendChild(btnTodas);
  } else {
    const novaTodas = document.createElement('button');
    novaTodas.className = 'sidebar-item sidebar-item-active';
    novaTodas.setAttribute('data-categoria', 'todos');
    novaTodas.innerHTML = `
      <span class="sidebar-icon"><i class="fas fa-gem"></i></span>
      <span class="sidebar-label">Todas as Joias</span>
      <span class="sidebar-count" id="count-todos">0</span>
    `;
    scroll.appendChild(novaTodas);
  }

  if (!estruturaCategorias || estruturaCategorias.length === 0) {
    log('ℹ️ Sem estrutura dinâmica — mantendo HTML estático');
    return;
  }

  // ✅ 3. Agrupa a estrutura
  const grupos = {};
  estruturaCategorias.forEach(function (item) {
    const g = item.grupo || 'Outros';
    if (!grupos[g]) grupos[g] = {};
    const c = item.categoria || 'Sem categoria';
    if (!grupos[g][c]) grupos[g][c] = [];
    if (item.subcategoria && item.subcategoria.trim() !== '') {
      grupos[g][c].push(item.subcategoria);
    }
  });

  const iconesGrupo = {
    'Folheado Dourado': 'fa-solid fa-crown',
    'Folheado Prata': 'fa-regular fa-gem'
  };
  const coresGrupo = {
    'Folheado Dourado': 'linear-gradient(135deg, #fef3c7, #fcd34d)',
    'Folheado Prata': 'linear-gradient(135deg, #f1f5f9, #cbd5e1)'
  };
  const coresIconeGrupo = {
    'Folheado Dourado': '#92400e',
    'Folheado Prata': '#475569'
  };

  Object.keys(grupos).forEach(function (nomeGrupo) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'sidebar-group';

    const titulo = document.createElement('button');
    titulo.className = 'sidebar-group-title';
    titulo.setAttribute('type', 'button');
    titulo.onclick = function () { toggleSidebarGroup(this); };
    titulo.innerHTML = `
      <span class="sidebar-group-icon" style="background: ${coresGrupo[nomeGrupo] || 'linear-gradient(135deg, #eef4ef, #d9e7de)'};">
        <i class="${iconesGrupo[nomeGrupo] || 'fa-solid fa-gem'}" style="color: ${coresIconeGrupo[nomeGrupo] || '#1f4d38'};"></i>
      </span>
      <span>${nomeGrupo}</span>
      <i class="fas fa-chevron-down sidebar-group-arrow"></i>
    `;
    groupDiv.appendChild(titulo);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'sidebar-group-content';

    const categoriasOrdenadas = Object.keys(grupos[nomeGrupo]).sort(function (a, b) {
      return a.localeCompare(b, 'pt-BR');
    });

    categoriasOrdenadas.forEach(function (nomeCategoria) {
      const subs = grupos[nomeGrupo][nomeCategoria];
      const nomeCategoriaLower = nomeCategoria.toLowerCase();

      // ✅ Detecta a cor da categoria
      let corAtual = 'dourado';
      if (nomeCategoriaLower.indexOf('prata') !== -1 ||
          nomeCategoriaLower.indexOf('prateado') !== -1 ||
          nomeCategoriaLower.indexOf('prateada') !== -1) {
        corAtual = 'prata';
      }

      // Se a categoria não tem subs, vira botão único
      if (subs.length === 0) {
        const btn = document.createElement('button');
        btn.className = 'sidebar-item-sub';
        btn.setAttribute('type', 'button');
        btn.setAttribute('data-categoria', nomeCategoriaLower);
        btn.innerHTML = `<span>${nomeCategoria}</span>`;
        contentDiv.appendChild(btn);
        return;
      }

      const nomeCurto = nomeCategoria
        .replace(/\s+(dourado|dourada|dourados|douradas)\s*$/i, '')
        .replace(/\s+(prata|prateado|prateada|prateados|prateadas)\s*$/i, '')
        .trim();

      // Se só tem 1 sub e é igual ao nomeCurto, vira botão único
      if (subs.length === 1 && subs[0].toLowerCase() === nomeCurto.toLowerCase()) {
        const btn = document.createElement('button');
        btn.className = 'sidebar-item-sub';
        btn.setAttribute('type', 'button');
        btn.setAttribute('data-categoria', nomeCategoriaLower);
        btn.innerHTML = `<span>${nomeCategoria}</span>`;
        contentDiv.appendChild(btn);
        return;
      }

      const subDiv = document.createElement('div');
      subDiv.className = 'sidebar-subgroup';

      const subTitle = document.createElement('button');
      subTitle.className = 'sidebar-subgroup-title';
      subTitle.setAttribute('type', 'button');
      subTitle.onclick = function () { toggleSidebarSubgroup(this); };
      subTitle.innerHTML = `<span>${nomeCurto}</span><i class="fas fa-chevron-down"></i>`;
      subDiv.appendChild(subTitle);

      const subContent = document.createElement('div');
      subContent.className = 'sidebar-subgroup-content';

      const catNorm = normalizar(nomeCategoriaLower);

      subs.forEach(function (sub) {
        const btn = document.createElement('button');
        btn.className = 'sidebar-item-sub';
        btn.setAttribute('type', 'button');
        btn.setAttribute('data-categoria', (nomeCategoria + ' ' + sub).toLowerCase());
        btn.innerHTML = `<span>${sub}</span>`;
        subContent.appendChild(btn);

        const subNorm = normalizar(sub);

        // ✅ FILTRA os tamanhos do backend por cor + chave
        const tamanhosAqui = tamanhos.filter(function (t) {
          if (!t.chave) return false;
          if (t.cor !== corAtual) return false;
          const chaveNorm = normalizar(t.chave);
          return catNorm.indexOf(chaveNorm) !== -1 || subNorm.indexOf(chaveNorm) !== -1;
        });

        if (tamanhosAqui.length > 0) {
         log(`📏 [DEBUG] "${nomeCategoria} > ${sub}": ${tamanhosAqui.length} tamanhos (${corAtual})`);
        }

        // ✅ Cria os botões DINAMICAMENTE a partir dos dados do backend
        tamanhosAqui.forEach(function (t) {
          const btnT = document.createElement('button');
          btnT.className = 'sidebar-item-tamanho';
          btnT.setAttribute('type', 'button');
          btnT.setAttribute('data-categoria', `${t.chave} ${t.cor} ${t.valor}`);
          btnT.innerHTML = `<span>${t.label}</span>`;
          subContent.appendChild(btnT);
        });
      });

      subDiv.appendChild(subContent);
      contentDiv.appendChild(subDiv);
    });

    groupDiv.appendChild(contentDiv);
    scroll.appendChild(groupDiv);
  });

  sidebarDinamicaAtiva = true;
  rebindSidebarEvents();

  const totalFinal = scroll.querySelectorAll('.sidebar-item-tamanho').length;
 log(`🎉 [DEBUG] FIM: ${totalFinal} botões de tamanho renderizados na sidebar`);

  const searchInput = document.getElementById('sidebar-search');
  if (searchInput && searchInput.value.trim()) {
    aplicarBuscaSidebar(searchInput.value);
  }
}



function rebindSidebarEvents() {
  document.querySelectorAll('.sidebar-item').forEach(btn => {
    btn.onclick = function (e) {
      e.preventDefault();
      const categoria = this.getAttribute('data-categoria');
      if (!categoria) return;
      marcarItemSidebarAtivo(categoria);
      filtrarPorCategoria(categoria);
      if (window.innerWidth <= 900) fecharSidebarMobile();
    };
  });

  document.querySelectorAll('.sidebar-item-sub').forEach(btn => {
    btn.onclick = function (e) {
      e.preventDefault();
      const categoria = this.getAttribute('data-categoria');
      if (!categoria) return;
      marcarItemSidebarAtivo(categoria);
      filtrarPorCategoria(categoria);
      if (window.innerWidth <= 900) fecharSidebarMobile();
    };
  });

    // ✅ Botões de tamanho (sub-subcategoria)
  document.querySelectorAll('.sidebar-item-tamanho').forEach(btn => {
    btn.onclick = function (e) {
      e.preventDefault();
      const categoria = this.getAttribute('data-categoria');
      if (!categoria) return;
      marcarItemSidebarAtivo(categoria);
      filtrarPorCategoria(categoria);
      if (window.innerWidth <= 900) fecharSidebarMobile();
    };
  });

  atualizarContadoresSidebar();
}

function aplicarBuscaSidebar(termo) {
  const termoNorm = normalizar(termo);
  const elementos = document.querySelectorAll(
    '.sidebar-item, .sidebar-item-sub, .sidebar-group-title, .sidebar-subgroup-title'
  );
  elementos.forEach(el => {
    const texto = normalizar(el.textContent);
    const match = !termoNorm || texto.includes(termoNorm);
    el.style.display = match ? '' : 'none';
  });
}

// ============================================
// SIDEBAR - TOGGLE
// ============================================
function toggleSidebarGroup(btn) {
  const group = btn.closest('.sidebar-group');
  if (!group) return;
  group.classList.toggle('open');
}

function toggleSidebarSubgroup(btn) {
  const subgroup = btn.closest('.sidebar-subgroup');
  if (!subgroup) return;
  subgroup.classList.toggle('open');
}

window.toggleSidebarGroup = toggleSidebarGroup;
window.toggleSidebarSubgroup = toggleSidebarSubgroup;

// ============================================
// SIDEBAR - ABRIR/FECHAR MOBILE
// ============================================
function abrirSidebarMobile() {
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileOverlay = document.getElementById('mobile-overlay');
  if (mobileMenu) mobileMenu.classList.add('translate-x-full');
  if (mobileOverlay) mobileOverlay.classList.add('hidden');

  if (window.innerWidth <= 900) {
    document.querySelectorAll('.sidebar-group').forEach(g => g.classList.remove('open'));
    document.querySelectorAll('.sidebar-subgroup').forEach(sg => sg.classList.remove('open'));
  }

  const sidebar = document.getElementById('sidebar-categorias');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.add('open');
  if (overlay) overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function fecharSidebarMobile() {
  const sidebar = document.getElementById('sidebar-categorias');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
  document.body.style.overflow = '';
}

window.abrirSidebarMobile = abrirSidebarMobile;
window.fecharSidebarMobile = fecharSidebarMobile;

// ============================================
// SIDEBAR - MARCAR ITEM ATIVO
// ============================================
function marcarItemSidebarAtivo(categoria) {
  // Limpa todos os ativos (incluindo os de tamanho)
  document.querySelectorAll('.sidebar-item, .sidebar-item-sub, .sidebar-item-tamanho').forEach(el => {
    el.classList.remove('sidebar-item-active', 'active');
  });

  if (categoria === 'todos') {
    const el = document.querySelector('.sidebar-item[data-categoria="todos"]');
    if (el) el.classList.add('sidebar-item-active');
    return;
  }

  // Verifica se é um item de tamanho
  const elTamanho = document.querySelector(`.sidebar-item-tamanho[data-categoria="${categoria}"]`);
  if (elTamanho) {
    elTamanho.classList.add('active');
    return;
  }

  // Senão, é subcategoria normal
  const elSub = document.querySelector(`.sidebar-item-sub[data-categoria="${categoria}"]`);
  if (elSub) elSub.classList.add('active');
}
// ============================================
// CONTADOR DE PRODUTOS (HEADER)
// ============================================
function atualizarContadorProdutos() {
  const countEl = document.getElementById('products-count');
  if (countEl) {
    const total = document.querySelectorAll('#produtos-container .product-card').length;
    countEl.textContent = `${total} produto${total !== 1 ? 's' : ''}`;
  }
}

// ============================================
// CONTADORES NA SIDEBAR
// ============================================
function atualizarContadoresSidebar() {
  if (!allProducts || allProducts.length === 0) return;

  const totalEl = document.getElementById('count-todos');
  if (totalEl) totalEl.textContent = allProducts.length;

  document.querySelectorAll('.sidebar-item-sub[data-categoria]').forEach(btn => {
    const categoria = btn.getAttribute('data-categoria');
    if (!categoria) return;

    const quantidade = contarProdutosPorCategoria(categoria);

    let countSpan = btn.querySelector('.sidebar-count');
    if (!countSpan) {
      countSpan = document.createElement('span');
      countSpan.className = 'sidebar-count';
      btn.appendChild(countSpan);
    }
    countSpan.textContent = quantidade;
    btn.style.opacity = quantidade === 0 ? '0.5' : '1';
  });

  document.querySelectorAll('.sidebar-group-title').forEach(groupTitle => {
    let total = 0;
    const content = groupTitle.parentElement.querySelector('.sidebar-group-content');
    if (content) {
      content.querySelectorAll('.sidebar-item-sub[data-categoria]').forEach(btn => {
        const categoria = btn.getAttribute('data-categoria');
        total += contarProdutosPorCategoria(categoria);
      });
    }

    let countSpan = groupTitle.querySelector('.sidebar-count');
    if (!countSpan) {
      countSpan = document.createElement('span');
      countSpan.className = 'sidebar-count';
      groupTitle.appendChild(countSpan);
    }
    countSpan.textContent = total;
  });

  document.querySelectorAll('.sidebar-subgroup').forEach(subgroup => {
    const subgroupTitle = subgroup.querySelector('.sidebar-subgroup-title');
    const content = subgroup.querySelector('.sidebar-subgroup-content');
    if (!subgroupTitle || !content) return;

    let total = 0;
    content.querySelectorAll('.sidebar-item-sub[data-categoria]').forEach(btn => {
      const categoria = btn.getAttribute('data-categoria');
      total += contarProdutosPorCategoria(categoria);
    });

    // Contadores dos tamanhos (sub-subcategorias)
document.querySelectorAll('.sidebar-item-tamanho[data-categoria]').forEach(btn => {
  const categoria = btn.getAttribute('data-categoria');
  if (!categoria) return;

  const quantidade = contarProdutosPorCategoria(categoria);

  let countSpan = btn.querySelector('.sidebar-count');
  if (!countSpan) {
    countSpan = document.createElement('span');
    countSpan.className = 'sidebar-count';
    btn.appendChild(countSpan);
  }
  countSpan.textContent = quantidade;
  btn.style.opacity = quantidade === 0 ? '0.5' : '1';
});

    let countSpan = subgroupTitle.querySelector('.sidebar-count');
    if (!countSpan) {
      countSpan = document.createElement('span');
      countSpan.className = 'sidebar-count';
      const icon = subgroupTitle.querySelector('i');
      if (icon) subgroupTitle.insertBefore(countSpan, icon);
      else subgroupTitle.appendChild(countSpan);
    }
    countSpan.textContent = total;
  });
}

function contarProdutosPorCategoria(categoria) {
  if (!allProducts || allProducts.length === 0) return 0;

  const catFiltro = normalizar(categoria);
  const palavrasFiltro = catFiltro.split(/\s+/).filter((p) => p.length > 0);
  const palavrasFiltroNorm = palavrasFiltro.map(normalizarPalavraBusca);

  return allProducts.filter((p) => {
   const catProduto = normalizar(p["Categoria"] || "");
    const subcatProduto = normalizar(p["Subcategoria"] || "");
    const tamanhoProduto = normalizar(p["Tamanho"] || "");  // 👈 NOVO
    const nomeProduto = normalizar(p["Nome do Produto"] || "");
    const refProduto = normalizar(p["referencia"] || "");
    const combinado = catProduto + " " + subcatProduto + " " + tamanhoProduto + " " + nomeProduto + " " + refProduto;
    const combinadoNorm = combinado.split(/\s+/).map(normalizarPalavraBusca).join(" ");
    return palavrasFiltroNorm.every((palavra) => combinadoNorm.includes(palavra));
  }).length;
}

// ============================================
// ORDENAR PRODUTOS
// ============================================
function ordenarProdutos(tipo) {
  if (!allProducts || allProducts.length === 0) return;

  const cards = [...document.querySelectorAll('#produtos-container .product-card')];
  if (cards.length === 0) return;

  const nomesVisiveis = cards.map(card => {
    const titleEl = card.querySelector('.product-card-title');
    return titleEl ? titleEl.textContent.trim() : '';
  });

  const produtosFiltrados = allProducts.filter(p => nomesVisiveis.includes(p["Nome do Produto"]));

  let ordenados = [...produtosFiltrados];

  switch (tipo) {
    case 'menor-preco':
      ordenados.sort((a, b) => (parseFloat(a["Preço"]) || 0) - (parseFloat(b["Preço"]) || 0));
      break;
    case 'maior-preco':
      ordenados.sort((a, b) => (parseFloat(b["Preço"]) || 0) - (parseFloat(a["Preço"]) || 0));
      break;
    case 'nome-az':
      ordenados.sort((a, b) => (a["Nome do Produto"] || '').localeCompare(b["Nome do Produto"] || ''));
      break;
    case 'nome-za':
      ordenados.sort((a, b) => (b["Nome do Produto"] || '').localeCompare(a["Nome do Produto"] || ''));
      break;
  }

  renderProducts(ordenados);
}

// ============================================
// MODAL DE CORES
// ============================================
function renderizarCores() {
  const container = document.getElementById("colors-container");
  if (!container) return;

  container.innerHTML = "";

  if (!Array.isArray(coresDisponiveis) || coresDisponiveis.length === 0) {
    container.innerHTML = `<p class="text-sm text-gray-500">Nenhuma cor disponível.</p>`;
    return;
  }

  coresDisponiveis.forEach(function (nomeCor) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = nomeCor;
    btn.className =
      "px-4 py-3 rounded-xl border border-primary/20 " +
      "bg-white hover:bg-primary hover:text-white " +
      "transition-all duration-200 font-semibold text-sm";
    btn.onclick = function () { window.selectColor(nomeCor); };
    container.appendChild(btn);
  });
}

window.renderizarCores = renderizarCores;

function selectColor(cor) {
  if (quantidadeSelecionada <= 0) {
    showToast("Escolha a quantidade primeiro!", "error", 2000);
    return;
  }

  const corLower = cor.toLowerCase();
  const qtd = quantidadeSelecionada;

  if (coresSelecionadas[corLower]) {
    coresSelecionadas[corLower] += qtd;
  } else {
    coresSelecionadas[corLower] = qtd;
  }

  window.renderizarCores();
  quantidadeSelecionada = 0;
  window.atualizarResumoSelecao();

  showToast(`🎨 ${qtd}x ${cor} adicionado`, "success", 2000);

  document.querySelectorAll(".qty-option-btn").forEach((btn) => btn.classList.remove("selected"));

  const instruction = document.getElementById("color-instruction");
  if (instruction) {
    instruction.innerText = "Escolha a quantidade primeiro";
    instruction.classList.remove("highlight");
  }
}
window.selectColor = selectColor;

function atualizarUISelecao() {
  document.querySelectorAll(".qty-option-btn").forEach((btn) => {
    btn.classList.remove("selected");
    if (parseInt(btn.innerText) === quantidadeSelecionada) {
      btn.classList.add("selected");
    }
  });

  const instruction = document.getElementById("color-instruction");
  if (instruction) {
    if (quantidadeSelecionada > 0) {
      instruction.innerText = `Agora escolha a cor para ${quantidadeSelecionada} unidade(s)`;
      instruction.classList.add("highlight");
    } else {
      instruction.innerText = "Escolha a quantidade primeiro";
      instruction.classList.remove("highlight");
    }
  }
}
window.atualizarUISelecao = atualizarUISelecao;

function atualizarResumoSelecao() {
  const resumoContainer = document.getElementById("selection-summary");
  if (!resumoContainer) return;

  const entradas = Object.entries(coresSelecionadas).filter(([_, qtd]) => qtd > 0);

  if (entradas.length === 0) {
    resumoContainer.innerHTML = "";
    resumoContainer.classList.add("hidden");
    return;
  }

  resumoContainer.classList.remove("hidden");

  let html = `<p class="summary-title">Seleção atual:</p><div class="summary-items">`;
  let totalItens = 0;

  entradas.forEach(([cor, qtd]) => {
    const corOriginal = coresDisponiveis.find((c) => c.toLowerCase() === cor) || cor;
    html += `<div class="summary-item">
            <span class="summary-color">${corOriginal}</span>
            <span class="summary-qty">${qtd}x</span>
        </div>`;
    totalItens += qtd;
  });

  html += `</div><p class="summary-total">Total: ${totalItens} unidade(s)</p>`;
  resumoContainer.innerHTML = html;
}
window.atualizarResumoSelecao = atualizarResumoSelecao;

function resetarModalUI() {
  const resumoContainer = document.getElementById("selection-summary");
  if (resumoContainer) {
    resumoContainer.innerHTML = "";
    resumoContainer.classList.add("hidden");
  }

  const instruction = document.getElementById("color-instruction");
  if (instruction) {
    instruction.innerText = "Escolha a quantidade primeiro";
    instruction.classList.remove("highlight");
  }

  const inputCustom = document.getElementById("custom-quantity");
  if (inputCustom) inputCustom.value = 1;

  document.querySelectorAll(".qty-option-btn").forEach((btn) => btn.classList.remove("selected"));
  document.querySelectorAll(".color-name-btn").forEach((btn) => btn.classList.remove("selected"));
}
window.resetarModalUI = resetarModalUI;

function adicionarSemCor(quantidade, buttonElement) {
  if (!tempProduct) return;

  const estoqueDisponivel = tempProduct.estoqueDisponivel || 0;

  if (!quantidade || quantidade <= 0) {
    showToast("Digite uma quantidade válida", "error", 2000);
    return;
  }

  if (quantidade > estoqueDisponivel) {
    showToast(`Só temos ${estoqueDisponivel} unidade(s) disponível(is)`, "error", 2500);
    return;
  }

  const uniqueId = `${tempProduct.id}-unico`;
  const totalPrice = tempProduct.price * quantidade;

  addToCart(
    uniqueId,
    tempProduct.name,
    totalPrice,
    tempProduct.img,
    tempProduct.id,
    tempProduct.ref,
    quantidade,
    buttonElement || tempProduct.buttonElement
  );
  window.closeSizeModal();
}
window.adicionarSemCor = adicionarSemCor;

function confirmarSelecao() {
  const instruction = document.getElementById("color-instruction");

  if (coresDisponiveis.length === 0) {
    const inputCustom = document.getElementById("custom-quantity");
    let qtd = parseInt(inputCustom?.value) || 0;
    if (!qtd || qtd <= 0) {
      showToast("Digite uma quantidade válida", "error", 2000);
      return;
    }
    window.adicionarSemCor(qtd);
    return;
  }

  if (quantidadeSelecionada > 0) {
    showToast(
      `Você escolheu ${quantidadeSelecionada} unidade(s). Clique em uma cor para confirmar!`,
      "warning", 3000
    );
    if (instruction) {
      instruction.classList.add("highlight");
      instruction.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return;
  }

  const entradas = Object.entries(coresSelecionadas).filter(([_, qtd]) => qtd > 0);

  if (entradas.length === 0) {
    showToast("Selecione pelo menos uma cor!", "error", 2000);
    return;
  }

  const totalSelecionado = entradas.reduce((soma, [_, qtd]) => soma + qtd, 0);
  const estoqueDisponivel = tempProduct.estoqueDisponivel || 0;

  if (totalSelecionado > estoqueDisponivel) {
    showToast(
      `Total selecionado (${totalSelecionado}) ultrapassa o estoque disponível (${estoqueDisponivel}).`,
      "error", 3000
    );
    return;
  }

  entradas.forEach(([cor, qtd]) => {
    const corOriginal = coresDisponiveis.find((c) => c.toLowerCase() === cor) || cor;
    const uniqueId = `${tempProduct.id}-${corOriginal}`;
    const fullName = `${tempProduct.name} - ${corOriginal}`;
    const totalPrice = tempProduct.price * qtd;
    addToCart(
      uniqueId,
      fullName,
      totalPrice,
      tempProduct.img,
      tempProduct.id,
      tempProduct.ref,
      qtd,
      tempProduct.buttonElement
    );
  });

  window.closeSizeModal();
}
window.confirmarSelecao = confirmarSelecao;

window.closeSizeModal = function () {
  const modal = document.getElementById("size-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
  selectedColor = "";
  tempProduct = null;
  quantidadeSelecionada = 0;
  coresSelecionadas = {};

  const imagemContainer = document.getElementById("product-single-image");
  if (imagemContainer) imagemContainer.remove();
};

// ============================================
// VERIFICAR ESTOQUE NO SERVIDOR
// ============================================
async function verificarEstoqueServidor(produtoId) {
  const cached = getEstoqueCache(produtoId);
  if (cached !== null) {
    return { success: true, id: produtoId, saldo: cached, cached: true };
  }

  return new Promise((resolve) => {
    const callbackName = "verificar_estoque_" + Date.now();
    let resolvido = false;
    let script = null;

    const finalizar = (resultado) => {
      if (resolvido) return;
      resolvido = true;
      delete window[callbackName];
      if (script && script.parentNode) script.parentNode.removeChild(script);
      resolve(resultado);
    };

    window[callbackName] = function (response) {
      if (response && response.success) {
        setEstoqueCache(produtoId, response.saldo);
      }
      finalizar(response);
    };

    script = document.createElement("script");
    script.src = `${ESTOQUE_API_URL}?modo=publico&tipo=verificar_estoque&id=${encodeURIComponent(produtoId)}&callback=${callbackName}`;

    script.onerror = function () {
      finalizar({ success: false, error: "Erro de rede" });
    };

    setTimeout(() => {
      finalizar({ success: false, error: "Timeout" });
    }, 3000);

    document.body.appendChild(script);
  });
}

function quantidadeNoCarrinho(baseId) {
  return cart
    .filter(item => String(item.baseId) === String(baseId))
    .reduce((soma, item) => soma + item.quantity, 0);
}

// ============================================
// 👤 CADASTRO DE CLIENTE
// ============================================

// Chaves do localStorage
const CLIENTE_STORAGE_KEY = 'ivo_cliente_dados';       // dados salvos (finais)
const CLIENTE_RASCUNHO_KEY = 'ivo_cliente_rascunho';   // dados em preenchimento

// ---------- DADOS SALVOS ----------

function carregarDadosCliente() {
  try {
    const raw = localStorage.getItem(CLIENTE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn("Erro ao carregar dados do cliente:", e);
    return null;
  }
}

function persistirDadosCliente(dados) {
  try {
    localStorage.setItem(CLIENTE_STORAGE_KEY, JSON.stringify(dados));
  } catch (e) {
    console.warn("Erro ao salvar dados do cliente:", e);
  }
}

function clienteEstaCadastrado() {
  const c = carregarDadosCliente();
  return c && c.nome && c.endereco && c.numero && c.cidade && c.estado;
}

// ---------- RASCUNHO (AUTO-SAVE) ----------

function carregarRascunhoCliente() {
  try {
    const raw = localStorage.getItem(CLIENTE_RASCUNHO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function salvarRascunhoCliente() {
  try {
    const campos = [
      'cliente-nome', 'cliente-tipo', 'cliente-cpf', 'cliente-ie',
      'cliente-nascimento', 'cliente-celular', 'cliente-email',
      'cliente-cep', 'cliente-endereco', 'cliente-numero',
      'cliente-complemento', 'cliente-bairro', 'cliente-cidade',
      'cliente-estado'
    ];

    const rascunho = {};
    let temConteudo = false;

    campos.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const chave = id.replace('cliente-', '');
        rascunho[chave] = el.value;
        if (chave !== 'tipo' && el.value && el.value.trim() !== '') {
          temConteudo = true;
        }
      }
    });

    if (!temConteudo) {
      localStorage.removeItem(CLIENTE_RASCUNHO_KEY);
      return;
    }

    localStorage.setItem(CLIENTE_RASCUNHO_KEY, JSON.stringify(rascunho));
  } catch (e) {
    console.warn('Erro ao salvar rascunho:', e);
  }
}

function limparRascunhoCliente() {
  try {
    localStorage.removeItem(CLIENTE_RASCUNHO_KEY);
  } catch (e) { }
}

// ---------- UI DO MODAL ----------

function atualizarResumoCliente() {
  const btn = document.getElementById('btn-cadastro-cliente');
  const btnTexto = document.getElementById('btn-cadastro-texto');
  const resumo = document.getElementById('cliente-resumo');
  const resumoNome = document.getElementById('cliente-resumo-nome');
  const resumoEndereco = document.getElementById('cliente-resumo-endereco');
  const resumoContato = document.getElementById('cliente-resumo-contato');

  const c = carregarDadosCliente();

  if (clienteEstaCadastrado() && c) {
    if (resumo) resumo.classList.remove('hidden');
  if (btnTexto) btnTexto.textContent = 'Editar Dados';

    if (resumoNome) resumoNome.textContent = c.nome || '—';
    if (resumoEndereco) {
      const partes = [
        `${c.endereco || ''}, ${c.numero || ''}`,
        c.complemento ? c.complemento : null,
        c.bairro || '',
        `${c.cidade || ''} - ${c.estado || ''}`,
        c.cep ? `CEP: ${c.cep}` : null
      ].filter(Boolean);
      resumoEndereco.textContent = partes.join(' • ');
    }
    if (resumoContato) {
      const contatos = [];
      if (c.celular) contatos.push(c.celular);
      if (c.email) contatos.push(c.email);
      resumoContato.textContent = contatos.join(' • ') || '—';
    }
  } else {
    if (resumo) resumo.classList.add('hidden');
    if (btnTexto) btnTexto.textContent = 'Cadastrar Dados';
  }
}

function atualizarLabelsTipo(tipo) {
  const labelCpf = document.getElementById('label-cpf');
  const labelIe = document.getElementById('label-ie');
  const inputCpf = document.getElementById('cliente-cpf');
  const inputIe = document.getElementById('cliente-ie');

  if (tipo === 'J') {
    if (labelCpf) labelCpf.textContent = 'CNPJ';
    if (labelIe) labelIe.textContent = 'Inscrição Estadual (I.E.)';
    if (inputCpf) inputCpf.placeholder = '00.000.000/0000-00';
    if (inputCpf) inputCpf.maxLength = 18;
    if (inputIe) inputIe.placeholder = 'Ex: 1234567890';
  } else {
    if (labelCpf) labelCpf.textContent = 'CPF';
    if (labelIe) labelIe.textContent = 'RG / Identidade';
    if (inputCpf) inputCpf.placeholder = '000.000.000-00';
    if (inputCpf) inputCpf.maxLength = 14;
    if (inputIe) inputIe.placeholder = 'Ex: 1234567890';
  }
}

window.abrirModalCliente = function () {
  const c = carregarDadosCliente();
  const rascunho = carregarRascunhoCliente();
  const dados = { ...(c || {}), ...(rascunho || {}) };

  if (dados && Object.keys(dados).length > 0) {
    document.getElementById('cliente-nome').value = dados.nome || '';
    document.getElementById('cliente-tipo').value = dados.tipo || 'F';
    document.getElementById('cliente-cpf').value = dados.cpf || '';
    document.getElementById('cliente-ie').value = dados.ie || '';
    document.getElementById('cliente-nascimento').value = dados.nascimento || '';
    document.getElementById('cliente-celular').value = dados.celular || '';
    document.getElementById('cliente-email').value = dados.email || '';
    document.getElementById('cliente-cep').value = dados.cep || '';
    document.getElementById('cliente-endereco').value = dados.endereco || '';
    document.getElementById('cliente-numero').value = dados.numero || '';
    document.getElementById('cliente-complemento').value = dados.complemento || '';
    document.getElementById('cliente-bairro').value = dados.bairro || '';
    document.getElementById('cliente-cidade').value = dados.cidade || '';
    document.getElementById('cliente-estado').value = dados.estado || '';

    atualizarLabelsTipo(dados.tipo || 'F');

    if (rascunho && Object.keys(rascunho).length > 0) {
      setTimeout(() => {
        showToast("💾 Rascunho restaurado automaticamente", "info", 2500);
      }, 400);
    }
  } else {
    document.getElementById('form-cliente').reset();
    document.getElementById('cliente-tipo').value = 'F';
    atualizarLabelsTipo('F');
  }

  const modal = document.getElementById('cliente-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
  document.body.style.overflow = 'hidden';

  setTimeout(() => {
    const primeiroVazio = ['cliente-nome', 'cliente-cpf', 'cliente-celular', 'cliente-cep']
      .map(id => document.getElementById(id))
      .find(el => el && !el.value);
    (primeiroVazio || document.getElementById('cliente-nome'))?.focus();
  }, 300);
};

window.fecharModalCliente = function () {
  const modal = document.getElementById('cliente-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  document.body.style.overflow = '';
};

window.salvarDadosCliente = function () {
  const dados = {
    nome: document.getElementById('cliente-nome').value.trim(),
    tipo: document.getElementById('cliente-tipo').value,
    cpf: document.getElementById('cliente-cpf').value.trim(),
    ie: document.getElementById('cliente-ie').value.trim(),
    nascimento: document.getElementById('cliente-nascimento').value,
    celular: document.getElementById('cliente-celular').value.trim(),
    email: document.getElementById('cliente-email').value.trim(),
    cep: document.getElementById('cliente-cep').value.trim(),
    endereco: document.getElementById('cliente-endereco').value.trim(),
    numero: document.getElementById('cliente-numero').value.trim(),
    complemento: document.getElementById('cliente-complemento').value.trim(),
    bairro: document.getElementById('cliente-bairro').value.trim(),
    cidade: document.getElementById('cliente-cidade').value.trim(),
    estado: document.getElementById('cliente-estado').value.trim().toUpperCase()
  };

  if (!dados.nome) { showToast("Informe o nome completo", "error", 2500); return; }
  if (!dados.cpf) { showToast(dados.tipo === 'J' ? "Informe o CNPJ" : "Informe o CPF", "error", 2500); return; }
  if (!dados.celular) { showToast("Informe o celular", "error", 2500); return; }
  if (!dados.cep) { showToast("Informe o CEP", "error", 2500); return; }
  if (!dados.endereco) { showToast("Informe o endereço", "error", 2500); return; }
  if (!dados.numero) { showToast("Informe o número", "error", 2500); return; }
  if (!dados.bairro) { showToast("Informe o bairro", "error", 2500); return; }
  if (!dados.cidade) { showToast("Informe a cidade", "error", 2500); return; }
  if (!dados.estado || dados.estado.length !== 2) { showToast("Informe o estado (ex: CE)", "error", 2500); return; }

  if (dados.tipo === 'F' && dados.cpf.length < 14) {
    showToast("CPF incompleto. Formato: 000.000.000-00", "error", 3000);
    return;
  }
  if (dados.tipo === 'J' && dados.cpf.length < 18) {
    showToast("CNPJ incompleto. Formato: 00.000.000/0000-00", "error", 3000);
    return;
  }

  persistirDadosCliente(dados);
  limparRascunhoCliente();
  atualizarResumoCliente();
  fecharModalCliente();
  showToast("✅ Dados salvos com sucesso!", "success", 3000);
};

// ============================================
// 🗑️ LIMPAR DADOS DO CLIENTE
// ============================================
window.limparDadosCliente = function () {
  // Confirmação em duas etapas para evitar clique acidental
  const temDadosSalvos = !!carregarDadosCliente();
  const temRascunho = !!carregarRascunhoCliente();

  if (!temDadosSalvos && !temRascunho) {
    showToast("ℹ️ Não há dados para limpar", "info", 2500);
    return;
  }

  const msg = "⚠️ Tem certeza que deseja limpar TODOS os seus dados?\n\n" +
              "• Nome\n• CPF/CNPJ\n• Endereço completo\n• Contato\n\n" +
              "Você precisará preencher tudo de novo na próxima compra.";

  if (!confirm(msg)) return;

  try {
    // Remove dados salvos
    localStorage.removeItem(CLIENTE_STORAGE_KEY);
    // Remove rascunho (auto-save)
    localStorage.removeItem(CLIENTE_RASCUNHO_KEY);
  } catch (e) {
    console.warn("Erro ao limpar storage:", e);
  }

  // Limpa todos os campos visuais do formulário
  const campos = [
    'cliente-nome', 'cliente-cpf', 'cliente-ie',
    'cliente-nascimento', 'cliente-celular', 'cliente-email',
    'cliente-cep', 'cliente-endereco', 'cliente-numero',
    'cliente-complemento', 'cliente-bairro', 'cliente-cidade',
    'cliente-estado'
  ];
  campos.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // Reset do tipo (F/J) para o padrão
  const tipoEl = document.getElementById('cliente-tipo');
  if (tipoEl) tipoEl.value = 'F';
  atualizarLabelsTipo('F');

  // Atualiza o resumo no carrinho (vai esconder o card "Dados cadastrados")
  atualizarResumoCliente();

  // Fecha o modal e avisa o usuário
  fecharModalCliente();
  showToast("🗑️ Dados limpos com sucesso!", "success", 3000);
};

// ============================================
// MÁSCARAS E BUSCAS AUTOMÁTICAS
// ============================================

function aplicarMascaraCEP(input) {
  let v = input.value.replace(/\D/g, '').substring(0, 8);
  if (v.length > 5) v = v.replace(/(\d{5})(\d)/, '$1-$2');
  input.value = v;
}

function aplicarMascaraCPF(input, tipo) {
  let v = input.value.replace(/\D/g, '');
  if (tipo === 'J') {
    v = v.substring(0, 14);
    if (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5');
    else if (v.length > 8) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})/, '$1.$2.$3/$4');
    else if (v.length > 5) v = v.replace(/^(\d{2})(\d{3})(\d{0,3})/, '$1.$2.$3');
    else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,3})/, '$1.$2');
  } else {
    v = v.substring(0, 11);
    if (v.length > 9) v = v.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/^(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/^(\d{3})(\d{0,3})/, '$1.$2');
  }
  input.value = v;
}

function aplicarMascaraCelular(input) {
  let v = input.value.replace(/\D/g, '').substring(0, 11);
  if (v.length > 10) v = v.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  else if (v.length > 6) v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
  input.value = v;
}

async function buscarCEP() {
  const cepInput = document.getElementById('cliente-cep');
  const loading = document.getElementById('cep-loading');
  const cep = cepInput?.value.replace(/\D/g, '');

  if (!cep || cep.length !== 8) return;

  if (loading) loading.classList.remove('hidden');

  try {
    const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await resp.json();

    if (data.erro) {
      showToast("CEP não encontrado", "error", 2500);
      return;
    }

    const enderecoInput = document.getElementById('cliente-endereco');
    const bairroInput = document.getElementById('cliente-bairro');
    const cidadeInput = document.getElementById('cliente-cidade');
    const estadoInput = document.getElementById('cliente-estado');

    if (enderecoInput) enderecoInput.value = data.logradouro || '';
    if (bairroInput) bairroInput.value = data.bairro || '';
    if (cidadeInput) cidadeInput.value = data.localidade || '';
    if (estadoInput) estadoInput.value = (data.uf || '').toUpperCase();

    showToast("✅ Endereço preenchido automaticamente!", "success", 2000);

    setTimeout(() => document.getElementById('cliente-numero')?.focus(), 300);

  } catch (e) {
    console.warn("Erro ao buscar CEP:", e);
    showToast("Erro ao buscar CEP. Preencha manualmente.", "warning", 3000);
  } finally {
    if (loading) loading.classList.add('hidden');
  }
}

async function buscarCNPJ() {
  const cnpjInput = document.getElementById('cliente-cpf');
  const cnpj = cnpjInput?.value.replace(/\D/g, '');

  if (!cnpj || cnpj.length !== 14) return;

  try {
    showToast("Buscando CNPJ...", "info", 1500);
    const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    const data = await resp.json();

    if (data.message) {
      showToast("CNPJ não encontrado", "error", 2500);
      return;
    }

    const nomeInput = document.getElementById('cliente-nome');
    const ieInput = document.getElementById('cliente-ie');
    const cepInput = document.getElementById('cliente-cep');
    const enderecoInput = document.getElementById('cliente-endereco');
    const numeroInput = document.getElementById('cliente-numero');
    const complementoInput = document.getElementById('cliente-complemento');
    const bairroInput = document.getElementById('cliente-bairro');
    const cidadeInput = document.getElementById('cliente-cidade');
    const estadoInput = document.getElementById('cliente-estado');
    const celularInput = document.getElementById('cliente-celular');

    if (nomeInput && data.razao_social) nomeInput.value = data.razao_social;
    if (ieInput && data.inscricao_estadual) ieInput.value = data.inscricao_estadual;
    if (celularInput && data.ddd_telefone_1) {
      const tel = data.ddd_telefone_1.replace(/\D/g, '');
      celularInput.value = tel.replace(/^(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
    }

    if (data.cep) {
      const cepLimpo = data.cep.replace(/\D/g, '');
      if (cepInput) cepInput.value = cepLimpo.replace(/(\d{5})(\d)/, '$1-$2');

      if (enderecoInput && data.logradouro) enderecoInput.value = data.logradouro;
      if (numeroInput && data.numero) numeroInput.value = data.numero;
      if (complementoInput && data.complemento) complementoInput.value = data.complemento;
      if (bairroInput && data.bairro) bairroInput.value = data.bairro;
      if (cidadeInput && data.municipio) cidadeInput.value = data.municipio;
      if (estadoInput && data.uf) estadoInput.value = data.uf.toUpperCase();
    }

    showToast("✅ Dados do CNPJ preenchidos!", "success", 2500);

  } catch (e) {
    console.warn("Erro ao buscar CNPJ:", e);
    showToast("Erro ao buscar CNPJ. Preencha manualmente.", "warning", 3000);
  }
}

// ============================================
// FORMATAÇÃO DO ENDEREÇO COMPLETO
// ============================================
function formatarEnderecoCompleto() {
  const c = carregarDadosCliente();
  if (!c) return '';

  const partes = [
    `${c.endereco || ''}, ${c.numero || ''}`,
    c.complemento ? c.complemento : null,
    c.bairro || '',
    `${c.cidade || ''} - ${c.estado || ''}`,
    c.cep ? `CEP: ${c.cep}` : null
  ].filter(Boolean);

  return partes.join(', ');
}

// ============================================
// CONFIGURAR LISTENERS DO CLIENTE
// ============================================
function configurarListenersCliente() {
  document.getElementById('cliente-tipo')?.addEventListener('change', function () {
    atualizarLabelsTipo(this.value);
    const cpfInput = document.getElementById('cliente-cpf');
    if (cpfInput) cpfInput.value = '';
    salvarRascunhoCliente();
  });

  document.getElementById('cliente-cpf')?.addEventListener('input', function () {
    const tipo = document.getElementById('cliente-tipo')?.value || 'F';
    aplicarMascaraCPF(this, tipo);
    salvarRascunhoCliente();

    const cnpjLimpo = this.value.replace(/\D/g, '');
    if (tipo === 'J' && cnpjLimpo.length === 14) {
      buscarCNPJ();
    }
  });

  document.getElementById('cliente-celular')?.addEventListener('input', function () {
    aplicarMascaraCelular(this);
    salvarRascunhoCliente();
  });

  document.getElementById('cliente-cep')?.addEventListener('input', function () {
    aplicarMascaraCEP(this);
    salvarRascunhoCliente();
    const cepLimpo = this.value.replace(/\D/g, '');
    if (cepLimpo.length === 8) {
      buscarCEP();
    }
  });

  document.getElementById('cliente-estado')?.addEventListener('input', function () {
    this.value = this.value.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 2);
    salvarRascunhoCliente();
  });

  const camposAutoSave = [
    'cliente-nome', 'cliente-ie', 'cliente-nascimento', 'cliente-email',
    'cliente-endereco', 'cliente-numero', 'cliente-complemento',
    'cliente-bairro', 'cliente-cidade'
  ];
  camposAutoSave.forEach(id => {
    document.getElementById(id)?.addEventListener('input', salvarRascunhoCliente);
    document.getElementById(id)?.addEventListener('change', salvarRascunhoCliente);
  });

  document.getElementById('btn-cadastro-cliente')?.addEventListener('click', abrirModalCliente);

  document.getElementById('form-cliente')?.addEventListener('submit', function (e) {
    e.preventDefault();
    salvarDadosCliente();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      const modal = document.getElementById('cliente-modal');
      if (modal && !modal.classList.contains('hidden')) {
        fecharModalCliente();
      }
    }
  });

  document.getElementById('cliente-modal')?.addEventListener('click', function (e) {
    if (e.target === this) fecharModalCliente();
  });

  atualizarResumoCliente();
}

// ============================================
// CARRINHO
// ============================================
function updateCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
  const cartCount = document.getElementById("cart-count");
  if (cartCount) {
    cartCount.innerText = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }

  const container = document.getElementById("cart-items");
  if (!container) return;
  container.innerHTML = "";
  subtotal = 0;

  if (cart.length === 0) {
    container.innerHTML = `
  <div class="cart-empty-state">
    <div class="cart-empty-icon"><i class="fas fa-shopping-bag"></i></div>
    <p class="cart-empty-title">Sacola vazia</p>
    <p class="cart-empty-subtitle">Adicione produtos</p>
  </div>`;
  } else {
    cart.forEach((item) => {
      subtotal += item.price;
      const precoUnitario = item.precoUnitario || (item.price / item.quantity);
      const div = document.createElement("div");
      div.className = "cart-item";
      div.innerHTML = `
        <div class="cart-item-image">
          <img src="${driveImg(item.img, 200)}" alt="${item.name}" loading="lazy" decoding="async">
        </div>
        <div class="cart-item-details">
          <h4 class="cart-item-name">${item.name}</h4>
          ${item.ref ? `<p class="cart-item-ref">Ref: ${item.ref}</p>` : ""}
          <div class="cart-item-price-row">
            <span class="cart-item-unit-price">R$ ${precoUnitario.toFixed(2).replace(".", ",")} <small>/un</small></span>
            <span class="cart-item-total-price">R$ ${item.price.toFixed(2).replace(".", ",")}</span>
          </div>
          <div class="cart-item-controls">
            <div class="cart-qty-control">
              <button type="button" onclick="changeQty('${item.id}', -1)" class="cart-qty-btn" aria-label="Diminuir">
                <i class="fas fa-minus"></i>
              </button>
              <span class="cart-qty-value">${item.quantity}</span>
              <button type="button" onclick="changeQty('${item.id}', 1)" class="cart-qty-btn" aria-label="Aumentar">
                <i class="fas fa-plus"></i>
              </button>
            </div>
            <button type="button" onclick="removeCartItem('${item.id}')" class="cart-item-remove" aria-label="Remover">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>`;
      container.appendChild(div);
    });
  }

  const bar = document.getElementById("free-shipping-bar");
  const text = document.getElementById("free-shipping-text");
  const subtotalEl = document.getElementById("cart-subtotal");
  const shippingEl = document.getElementById("cart-shipping");
  const totalEl = document.getElementById("cart-total");
  const clearBtn = document.getElementById("clear-cart-btn");

  if (subtotalEl) subtotalEl.innerText = `R$ ${subtotal.toFixed(2).replace(".", ",")}`;

  if (subtotal >= FRETE_GRATIS_VALOR) {
    if (bar) bar.style.width = "100%";
    if (text) text.innerHTML = "🎉 Frete GRÁTIS!";
    if (shippingEl) shippingEl.innerText = "GRÁTIS";
    if (totalEl) totalEl.innerText = `R$ ${subtotal.toFixed(2).replace(".", ",")}`;
  } else {
    const percent = (subtotal / FRETE_GRATIS_VALOR) * 100;
    const falta = FRETE_GRATIS_VALOR - subtotal;
    if (bar) bar.style.width = `${Math.min(percent, 100)}%`;
   if (text) text.innerHTML = `Faltam R$ ${falta.toFixed(2).replace(".", ",")} p/ frete grátis`;
    if (shippingEl) shippingEl.innerText = `R$ ${TAXA_FRETE.toFixed(2).replace(".", ",")}`;
    if (totalEl) totalEl.innerText = `R$ ${(subtotal + TAXA_FRETE).toFixed(2).replace(".", ",")}`;
  }

  if (clearBtn) {
    if (cart.length === 0) clearBtn.classList.add("hidden");
    else clearBtn.classList.remove("hidden");
  }

  if (cart.length === 0) {
    document.getElementById("cart-modal")?.classList.add("hidden");
    document.getElementById("cart-modal")?.classList.remove("flex");
  }
}

window.removeCartItem = function (id) {
  cart = cart.filter((i) => i.id !== id);
  updateCart();
  showToast("Item removido da sacola", "error", 2000);
};

window.changeQty = function (id, delta) {
  const item = cart.find((i) => i.id === id);
  if (!item) return;

  if (delta > 0) {
    item.quantity++;
  } else {
    if (item.quantity > 1) {
      item.quantity--;
    } else {
      cart = cart.filter((i) => i.id !== id);
      updateCart();
      return;
    }
  }

  item.price = item.precoUnitario * item.quantity;
  updateCart();
};

// ============================================
// VALIDAR CARRINHO
// ============================================
async function validarCarrinho() {
  if (cart.length === 0) return;

  const ids = [...new Set(cart.map(i => i.baseId))];
  const produtosDesatualizados = [];

  const checks = await Promise.all(
    ids.map(async (id) => {
      const resp = await verificarEstoqueServidor(id);
      return { id, resp };
    })
  );

  for (const { id, resp } of checks) {
    if (resp && resp.success) {
      const quantidadeNoCart = quantidadeNoCarrinho(id);
      const saldoServidor = parseInt(resp.saldo) || 0;

      if (saldoServidor <= 0) {
        produtosDesatualizados.push({ id, motivo: 'esgotado' });
      } else if (quantidadeNoCart > saldoServidor) {
        produtosDesatualizados.push({ id, motivo: 'ajustar', saldo: saldoServidor });
      }
    }
  }

  if (produtosDesatualizados.length === 0) return;

  produtosDesatualizados.forEach(item => {
    if (item.motivo === 'esgotado') {
      cart = cart.filter(i => String(i.baseId) !== String(item.id));
    } else if (item.motivo === 'ajustar') {
      let restante = item.saldo;
      cart = cart.filter(i => {
        if (String(i.baseId) !== String(item.id)) return true;
        if (restante <= 0) return false;
        if (i.quantity <= restante) {
          restante -= i.quantity;
          return true;
        }
        i.quantity = restante;
        i.price = i.precoUnitario * i.quantity;
        restante = 0;
        return true;
      });
    }
  });

  updateCart();
  showToast("⚠️ Itens do carrinho foram ajustados (estoque esgotou).", "warning", 4000);
}
window.validarCarrinho = validarCarrinho;

// ============================================
// ADD TO CART
// ============================================
function addToCart(id, name, price, img, baseId, ref, quantity, buttonElement) {
  const qty = quantity || 1;
  const existing = cart.find((i) => i.id === id);

  if (existing) {
    existing.quantity += qty;
    existing.price = existing.precoUnitario * existing.quantity;
  } else {
    cart.push({
      id,
      name,
      price,
      img,
      quantity: qty,
      baseId,
      ref,
      precoUnitario: price / qty
    });
  }

  invalidarEstoqueCache();
  showToast(`✅ ${name.substring(0, 30)} adicionado!`, "success", 2000);
  updateCart();

  if (buttonElement) {
    const originalContent = buttonElement.innerHTML;
    const originalBg = buttonElement.style.background;

    buttonElement.innerHTML = '<i class="fas fa-check"></i> Adicionado!';
    buttonElement.style.background = 'linear-gradient(135deg, #28a745, #218838)';
    buttonElement.disabled = true;

    setTimeout(() => {
      buttonElement.innerHTML = originalContent;
      buttonElement.style.background = originalBg;
      buttonElement.disabled = false;
    }, 1500);
  }
}

// ============================================
// RENDERIZAR PRODUTOS
// ============================================
// ============================================
// RENDERIZAR PRODUTOS — OTIMIZADO v2
// ============================================
function renderProducts(products) {
  const container = document.getElementById("produtos-container");
  if (!container) return;

  container.innerHTML = "";

  if (!products || products.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12">
        <i class="fas fa-search text-4xl text-primary/30 mb-4"></i>
        <p class="text-textMuted">Nenhum produto encontrado.</p>
      </div>`;
    setTimeout(atualizarContadorProdutos, 50);
    return;
  }

  const fragment = document.createDocumentFragment();

  products.forEach((p, index) => {
    const estoque = parseInt(p["Saldo Estoque"]) || 0;
    const temCores = p["Cores"] && String(p["Cores"]).trim() !== "";
    const preco = parseFloat(p["Preço"]) || 0;

    const nome = p["Nome do Produto"] || "Produto sem nome";
    const referencia = p["referencia"] || "";
    const categoria = p["Categoria"] || "";
    const subcategoria = p["Subcategoria"] || "";
    const imagem = p["Imagem"] || "";

    // ============================================
    // ✅ IMAGENS OTIMIZADAS (3 tamanhos + srcset)
    // ============================================
    // ✅ 2 tamanhos são suficientes (300 e 500)
    const imgSrcSmall  = driveImg(imagem, 300);
    const imgSrcMedium = driveImg(imagem, 500);

    const srcsetAttr = `${imgSrcSmall} 300w, ${imgSrcMedium} 500w`;
    const sizesAttr  = "(max-width: 600px) 45vw, (max-width: 1100px) 30vw, 20vw";

    // ============================================
    // ✅ BADGE DE ESTOQUE
    // ============================================
    let stockBadge = "";
    if (estoque <= 0) {
      stockBadge = `<span class="stock-out"><i class="fas fa-times-circle"></i> Indisponível</span>`;
    } else if (estoque <= 3) {
      stockBadge = `<span class="stock-low"><i class="fas fa-exclamation-triangle"></i> Últimas ${estoque}!</span>`;
    } else {
      stockBadge = `<span class="stock-available"><i class="fas fa-check-circle"></i> ${estoque} disponíveis</span>`;
    }

    // ============================================
    // ✅ ESCAPE DE STRINGS (segurança em onclick)
    // ============================================
    const nomeEscapado = nome.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const refEscapada = referencia.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const imgEscapada = imagem.replace(/"/g, "&quot;");

    // ============================================
    // ✅ BOTÃO DINÂMICO (com/sem cores)
    // ============================================
    let botaoHTML = "";
    if (estoque <= 0) {
      botaoHTML = `<button disabled class="product-card-btn-disabled">Indisponível</button>`;
    } else if (temCores) {
      botaoHTML = `<button onclick='openSizeSelector("${p["ID"]}", "${nomeEscapado}", "${refEscapada}", ${preco}, "${imgEscapada}")' class="product-card-btn">
        <i class="fas fa-palette"></i> Escolher Opções
      </button>`;
    } else {
      botaoHTML = `<button onclick='openSizeSelector("${p["ID"]}", "${nomeEscapado}", "${refEscapada}", ${preco}, "${imgEscapada}")' class="product-card-btn product-card-btn-direct">
        <i class="fas fa-cart-plus"></i> Adicionar
      </button>`;
    }

    // ============================================
    // ✅ METADADOS (categoria/subcategoria/ref)
    // ============================================
    let categoriaHTML = categoria ? `<p class="product-card-category">${categoria}</p>` : "";
    let subcategoriaHTML = subcategoria ? `<p class="product-card-subcategory">${subcategoria}</p>` : "";
    const refHTML = referencia ? `<p class="product-card-ref">REF: ${referencia}</p>` : "";

    // ============================================
    // ✅ PRIORIDADE (primeiros 5 = eager + high)
    // ============================================
    const isPriority = index < 5;

    // ============================================
    // ✅ MONTAGEM FINAL DO CARD
    // ============================================
    const card = document.createElement("div");
    card.className = "product-card";

    // Imagem: prioridade alta para os 5 primeiros, lazy para o resto
    const imgTag = isPriority
      ? `<img
          src="${imgSrcSmall}"
          srcset="${srcsetAttr}"
          sizes="${sizesAttr}"
          alt="${nome}"
          loading="eager"
          decoding="async"
          fetchpriority="high"
          width="400"
          height="400"
          class="product-card-img"
          onerror="this.onerror=null; this.src='${PLACEHOLDER_SVG}'"
          onclick="abrirZoomDireto('${imgEscapada}')"
        >`
      : `<img
          data-src="${imgSrcMedium}"
          data-srcset="${srcsetAttr}"
          src="${PLACEHOLDER_SVG}"
          sizes="${sizesAttr}"
          alt="${nome}"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
          width="400"
          height="400"
          class="product-card-img"
          onerror="this.onerror=null; this.src='${PLACEHOLDER_SVG}'"
          onclick="abrirZoomDireto('${imgEscapada}')"
        >`;

    card.innerHTML = `
      <div class="product-card-image">
        ${imgTag}
        ${estoque <= 0 ? '<div class="product-card-sold-out"><span>ESGOTADO</span></div>' : ""}
      </div>
      <div class="product-card-content">
        <h3 class="product-card-title">${nome}</h3>
        ${refHTML}
        ${categoriaHTML}
        ${subcategoriaHTML}
        <p class="product-card-price">R$ ${preco.toFixed(2).replace(".", ",")}</p>
        <div class="product-card-stock">${stockBadge}</div>
        ${botaoHTML}
      </div>
    `;

    fragment.appendChild(card);
  });

  container.appendChild(fragment);

  // ✅ Ativa lazy loading nos cards restantes
  ativarLazyLoading();

  setTimeout(atualizarContadorProdutos, 100);
}

// ============================================
// LAZY LOADING
// ============================================
// ============================================
// LAZY LOADING v2 (com srcset + srcset)
// ============================================
let lazyObserver = null;

function ativarLazyLoading() {
  // Fallback para navegadores antigos
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.dataset.src;
      if (img.dataset.srcset) img.srcset = img.dataset.srcset;
      img.removeAttribute('data-src');
      img.removeAttribute('data-srcset');
    });
    return;
  }

  // Cria observer uma única vez (reutiliza)
  if (!lazyObserver) {
    lazyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            if (img.dataset.srcset) img.srcset = img.dataset.srcset;
            img.removeAttribute('data-src');
            img.removeAttribute('data-srcset');
          }
          lazyObserver.unobserve(img);
        }
      });
    }, {
      rootMargin: '200px 0px', // ✅ 200px = carrega pouco antes de aparecer
      threshold: 0.01
    });
  }

  document.querySelectorAll('img[data-src]').forEach(img => {
    lazyObserver.observe(img);
  });
}

// ============================================
// MARQUEE DINÂMICO
// ============================================
function renderizarMarquee(items) {
  const track = document.getElementById("marquee-track");
  if (!track) return;

  if (!items || items.length === 0) {
    items = [
      { texto: "Frete Grátis acima de R$ 3.500", icone: "fa-solid fa-crown", cor: "dourado" },
      { texto: "Enviamos para todo o Brasil", icone: "fa-solid fa-truck-fast", cor: "branco" },
      { texto: "Joias Folheadas a Ouro e Prata", icone: "fa-solid fa-gem", cor: "dourado" },
      { texto: "5% OFF no PIX", icone: "fa-solid fa-percent", cor: "branco" },
      { texto: "@ivopita", icone: "fa-brands fa-instagram", cor: "dourado" },
      { texto: "Qualidade e Elegância", icone: "fa-solid fa-star", cor: "branco" },
    ];
  }

  const listaDuplicada = [...items, ...items];

  track.innerHTML = listaDuplicada
    .map((item) => {
      const classeCor = item.cor === "dourado" ? "marquee-item-accent" : "";
      return `
      <span class="marquee-item ${classeCor}">
        <i class="${item.icone || "fa-solid fa-star"}"></i> ${item.texto}
      </span>`;
    })
    .join("");
}

// ============================================
// APLICAR CONFIGURAÇÕES
// ============================================
// ============================================
// APLICAR CONFIGURAÇÕES
// ============================================
function aplicarConfig(cfg) {
  if (!cfg || typeof cfg !== "object") return;

  siteConfig = Object.assign({}, siteConfig, cfg);

  if (cfg.freteGratisValor) FRETE_GRATIS_VALOR = parseFloat(cfg.freteGratisValor) || 3500;
  if (cfg.taxaFrete) TAXA_FRETE = parseFloat(cfg.taxaFrete) || 15;

  // ✅ CORREÇÃO DO NÚMERO DO WHATSAPP AQUI
  let whatsNumero = String(cfg.whatsapp || siteConfig.whatsapp || "5588981762208").replace(/\D/g, "");
  whatsNumero = whatsNumero.replace(/^0+/, ""); // remove zeros à esquerda
  if (!whatsNumero.startsWith("55")) {
    whatsNumero = "55" + whatsNumero; // adiciona o código do Brasil
  }
  if (whatsNumero.length < 12 || whatsNumero.length > 13) {
    whatsNumero = "5588981762208"; // fallback de segurança
  }

  const whatsLink = `https://wa.me/${whatsNumero}`;

  document.querySelectorAll('a[href*="wa.me"]').forEach((a) => {
    a.href = whatsLink;
  });

  const instaUser = String(cfg.instagram || siteConfig.instagram).replace("@", "");
  document.querySelectorAll('a[href*="instagram.com"]').forEach((a) => {
    a.href = `https://www.instagram.com/${instaUser}`;
  });

  const footerEndereco = document.querySelector("footer .fa-location-dot")?.parentElement;
  if (footerEndereco && cfg.endereco)
    footerEndereco.innerHTML = `<i class="fa-solid fa-location-dot text-gold"></i> ${cfg.endereco}`;

  const footerTelefone = document.querySelector("footer .fa-phone")?.parentElement;
  if (footerTelefone && (cfg.telefone || cfg.whatsappDisplay)) {
    footerTelefone.innerHTML = `<i class="fa-solid fa-phone text-gold"></i> ${cfg.telefone || cfg.whatsappDisplay}`;
  }

  const footerEmail = document.querySelector("footer .fa-envelope")?.parentElement;
  if (footerEmail && cfg.email) {
    footerEmail.innerHTML = `<i class="fa-solid fa-envelope text-gold"></i> ${cfg.email}`;
  }

  const sobreParagrafo = document.querySelector("footer p.text-slate-300");
  if (sobreParagrafo && cfg.sobreTexto) {
    sobreParagrafo.innerHTML = `<strong>IVO PITA</strong> ${cfg.sobreTexto.replace(/^A\s+IVO PITA\s*/i, "")}`;
  }

  window.__whatsappNumero = whatsNumero;
}
window.aplicarConfig = aplicarConfig;



// ============================================
// ZOOM COM LUPA
// ============================================
let zoomScale = 1;
let zoomPositionX = 0;
let zoomPositionY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

// ============================================
// LOG CONDICIONAL (só aparece com ?debug=1 na URL)
// ============================================
const DEBUG = new URLSearchParams(location.search).has('debug');
const log = DEBUG ? console.log.bind(console) : () => {};
const warn = DEBUG ? console.warn.bind(console) : () => {};


const ZOOM_MIN = 1;
const ZOOM_MAX = 5;

function abrirZoomDireto(imagem) {
  const modal = document.getElementById("image-zoom-modal");
  const img = document.getElementById("zoom-image");
  const thumbnails = document.getElementById("zoom-thumbnails");
  if (!modal || !img || !thumbnails) return;

  // ✅ 1. Mostra preview rápido em 400px
  const previewUrl = driveImg(imagem, 400);
  const fullUrl = driveImg(imagem, IMG_SIZE_ZOOM);

  imagensZoom = [fullUrl];
  zoomIndex = 0;
  zoomScale = 1;
  zoomPositionX = 0;
  zoomPositionY = 0;

  img.src = previewUrl;
  img.style.transform = 'scale(1) translate(0, 0)';
  img.classList.remove('zoomed');
  modal.classList.remove('zoomed-active');

  // ✅ 2. Em background, carrega a versão grande
  const highRes = new Image();
  highRes.src = fullUrl;
  highRes.onload = () => {
    if (img.src === previewUrl) {
      img.src = fullUrl; // troca quando carregar
    }
  };

  img.onerror = function () {
    this.onerror = null;
    this.src = PLACEHOLDER_SVG;
  };

  thumbnails.innerHTML = "";
  imagensZoom.forEach((src, i) => {
    const thumb = document.createElement("img");
    thumb.src = src;
    thumb.className = `thumbnail-image ${i === zoomIndex ? "active" : ""}`;
    thumb.onclick = function (e) {
      e.stopPropagation();
      zoomIndex = i;
      document.getElementById("zoom-image").src = imagensZoom[i];
      resetZoom();
      document.querySelectorAll("#zoom-thumbnails .thumbnail-image").forEach((t, idx) => {
        t.classList.toggle("active", idx === i);
      });
    };
    thumbnails.appendChild(thumb);
  });

  configurarEventosZoom();

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function configurarEventosZoom() {
  const img = document.getElementById("zoom-image");
  const modal = document.getElementById("image-zoom-modal");
  if (!img || !modal) return;

  const imgClone = img.cloneNode(true);
  img.parentNode.replaceChild(imgClone, img);
  const newImg = document.getElementById("zoom-image");

  newImg.addEventListener('click', (e) => {
    e.stopPropagation();
    if (zoomScale === 1) {
      zoomScale = 2.5;
      aplicarTransformacao();
      newImg.classList.add('zoomed');
      modal.classList.add('zoomed-active');
    } else {
      resetZoom();
    }
  });

  newImg.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    resetZoom();
  });

  newImg.addEventListener('mousedown', (e) => {
    if (zoomScale <= 1) return;
    e.preventDefault();
    isDragging = true;
    dragStartX = e.clientX - zoomPositionX;
    dragStartY = e.clientY - zoomPositionY;
  });

  modal.addEventListener('wheel', (e) => {
    if (!modal.classList.contains('active')) return;
    e.preventDefault();

    if (e.deltaY < 0) {
      zoomScale = Math.min(zoomScale + 0.2, ZOOM_MAX);
    } else {
      zoomScale = Math.max(zoomScale - 0.2, ZOOM_MIN);
    }

    aplicarTransformacao();

    if (zoomScale > 1) {
      newImg.classList.add('zoomed');
      modal.classList.add('zoomed-active');
    } else {
      newImg.classList.remove('zoomed');
      modal.classList.remove('zoomed-active');
      zoomPositionX = 0;
      zoomPositionY = 0;
    }
  }, { passive: false });

  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  let touchStartDistance = 0;
  let touchStartScale = 1;

  newImg.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDistance = Math.sqrt(dx * dx + dy * dy);
      touchStartScale = zoomScale;
    } else if (e.touches.length === 1 && zoomScale > 1) {
      isDragging = true;
      dragStartX = e.touches[0].clientX - zoomPositionX;
      dragStartY = e.touches[0].clientY - zoomPositionY;
    }
  });

  newImg.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      zoomScale = Math.min(Math.max(touchStartScale * (distance / touchStartDistance), ZOOM_MIN), ZOOM_MAX);
      aplicarTransformacao();

      if (zoomScale > 1) {
        newImg.classList.add('zoomed');
        modal.classList.add('zoomed-active');
      } else {
        newImg.classList.remove('zoomed');
        modal.classList.remove('zoomed-active');
      }
    } else if (e.touches.length === 1 && isDragging && zoomScale > 1) {
      e.preventDefault();
      zoomPositionX = e.touches[0].clientX - dragStartX;
      zoomPositionY = e.touches[0].clientY - dragStartY;
      aplicarTransformacao();
    }
  }, { passive: false });

  newImg.addEventListener('touchend', () => {
    isDragging = false;
  });
}

function handleMouseMove(e) {
  if (!isDragging || zoomScale <= 1) return;
  zoomPositionX = e.clientX - dragStartX;
  zoomPositionY = e.clientY - dragStartY;
  aplicarTransformacao();
}

function handleMouseUp() {
  isDragging = false;
}

function aplicarTransformacao() {
  const img = document.getElementById("zoom-image");
  if (!img) return;

  const maxOffset = 200 * (zoomScale - 1);
  zoomPositionX = Math.max(-maxOffset, Math.min(maxOffset, zoomPositionX));
  zoomPositionY = Math.max(-maxOffset, Math.min(maxOffset, zoomPositionY));

  img.style.transform = `scale(${zoomScale}) translate(${zoomPositionX / zoomScale}px, ${zoomPositionY / zoomScale}px)`;

  const indicator = document.getElementById('zoom-indicator');
  if (indicator) {
    indicator.textContent = `🔍 Zoom ${Math.round(zoomScale * 100)}% — Arraste para explorar`;
  }
}

function aplicarZoom(delta) {
  zoomScale = Math.min(Math.max(zoomScale + delta, ZOOM_MIN), ZOOM_MAX);
  aplicarTransformacao();

  const img = document.getElementById("zoom-image");
  const modal = document.getElementById("image-zoom-modal");

  if (zoomScale > 1) {
    img.classList.add('zoomed');
    modal.classList.add('zoomed-active');
  } else {
    img.classList.remove('zoomed');
    modal.classList.remove('zoomed-active');
    zoomPositionX = 0;
    zoomPositionY = 0;
  }
}
window.aplicarZoom = aplicarZoom;

function resetZoom() {
  zoomScale = 1;
  zoomPositionX = 0;
  zoomPositionY = 0;

  const img = document.getElementById("zoom-image");
  const modal = document.getElementById("image-zoom-modal");
  if (img) {
    img.style.transform = 'scale(1) translate(0, 0)';
    img.classList.remove('zoomed');
  }
  if (modal) modal.classList.remove('zoomed-active');
}
window.resetZoom = resetZoom;

function fecharZoom() {
  const modal = document.getElementById("image-zoom-modal");
  if (modal) modal.classList.remove("active");
  document.body.style.overflow = "";
  resetZoom();
}

function zoomAnterior() {
  if (imagensZoom.length === 0) return;
  zoomIndex = (zoomIndex - 1 + imagensZoom.length) % imagensZoom.length;
  document.getElementById("zoom-image").src = imagensZoom[zoomIndex];
  resetZoom();
  document.querySelectorAll("#zoom-thumbnails .thumbnail-image").forEach((t, i) => {
    t.classList.toggle("active", i === zoomIndex);
  });
}

function zoomProximo() {
  if (imagensZoom.length === 0) return;
  zoomIndex = (zoomIndex + 1) % imagensZoom.length;
  document.getElementById("zoom-image").src = imagensZoom[zoomIndex];
  resetZoom();
  document.querySelectorAll("#zoom-thumbnails .thumbnail-image").forEach((t, i) => {
    t.classList.toggle("active", i === zoomIndex);
  });
}

function abrirZoomModal(imagem) {
  abrirZoomDireto(imagem);
}

window.fecharZoom = fecharZoom;
window.zoomAnterior = zoomAnterior;
window.zoomProximo = zoomProximo;
window.abrirZoomDireto = abrirZoomDireto;
window.abrirZoomModal = abrirZoomModal;

// ============================================
// OPEN SIZE SELECTOR
// ============================================
window.openSizeSelector = function (id, name, ref, price, img) {
  let buttonElement = null;
  if (window.event && window.event.currentTarget) {
    buttonElement = window.event.currentTarget;
  } else if (window.event && window.event.target) {
    buttonElement = window.event.target.closest('button');
  }

  const p = allProducts.find((prod) => String(prod["ID"]) === String(id));
  if (!p) {
    showToast("Produto não encontrado!", "error", 2000);
    return;
  }

  const estoqueLocal = parseInt(p["Saldo Estoque"]) || 0;
  const jaNoCarrinho = quantidadeNoCarrinho(id);
  let estoqueDisponivel = estoqueLocal - jaNoCarrinho;

  const cached = getEstoqueCache(id);
  if (cached !== null) {
    estoqueDisponivel = cached - jaNoCarrinho;
  }

  if (estoqueDisponivel <= 0) {
    showToast(
      jaNoCarrinho > 0
        ? `Você já tem ${jaNoCarrinho} no carrinho. Estoque total: ${estoqueLocal}.`
        : "Produto esgotado!",
      "error", 3000
    );
    return;
  }

  const priceNum = parseFloat(price) || 0;
  tempProduct = {
    id: p["ID"],
    name: name,
    price: priceNum,
    img: img,
    ref: ref,
    estoqueDisponivel: estoqueDisponivel,
    buttonElement: buttonElement
  };

  quantidadeSelecionada = 0;
  coresSelecionadas = {};
  selectedColor = "";

  const nameEl = document.getElementById("size-product-name");
  const refEl = document.getElementById("size-product-ref");
  const priceEl = document.getElementById("size-product-price");

  if (nameEl) nameEl.innerText = name;
  if (refEl) refEl.innerText = ref ? `Ref: ${ref}` : "Ref: —";
  if (priceEl) {
    priceEl.innerHTML = `
      R$ ${priceNum.toFixed(2).replace(".", ",")} cada
      <small id="estoque-display">${estoqueDisponivel} unidades disponíveis${jaNoCarrinho > 0 ? ` (${jaNoCarrinho} no carrinho)` : ""}</small>
    `;
  }

  const imgContainer = document.getElementById("size-product-image-container");
  if (imgContainer) {
    imgContainer.innerHTML = `
      <img src="${driveImg(p["Imagem"], IMG_SIZE_MODAL)}"
           alt="${name}"
           loading="lazy"
           decoding="async"
           onerror="this.onerror=null; this.src=window.PLACEHOLDER_SVG;">`;
    imgContainer.onclick = function () {
      abrirZoomModal(p["Imagem"]);
    };
  }

  coresDisponiveis = p["Cores"]
    ? p["Cores"].split(",").map((c) => c.trim()).filter((c) => c)
    : [];
  const temCores = coresDisponiveis.length > 0;

  const colorStep = document.getElementById("color-step");
  const sizeStep = document.getElementById("size-step");
  const summaryContainer = document.getElementById("selection-summary");
  const btnAddCustomQty = document.getElementById("add-custom-qty");

  if (temCores) {
    if (colorStep) colorStep.classList.remove("hidden");
    if (sizeStep) sizeStep.classList.remove("hidden");
    if (summaryContainer) summaryContainer.classList.remove("hidden");
    const titleEl = document.getElementById("modal-step-title");
    if (titleEl) titleEl.innerText = "Selecione a Quantidade";
    if (btnAddCustomQty) {
      btnAddCustomQty.innerHTML = "Selecionar";
      btnAddCustomQty.classList.remove("btn-direct-add");
    }
    window.renderizarCores();
  } else {
    if (colorStep) colorStep.classList.add("hidden");
    if (sizeStep) sizeStep.classList.remove("hidden");
    if (summaryContainer) summaryContainer.classList.add("hidden");
    const titleEl = document.getElementById("modal-step-title");
    if (titleEl) titleEl.innerText = "Escolha a Quantidade";
    if (btnAddCustomQty) {
      btnAddCustomQty.innerHTML = '<i class="fas fa-cart-plus"></i> Adicionar';
      btnAddCustomQty.classList.add("btn-direct-add");
    }
    selectedColor = "Único";
  }

  const optionsContainer = document.getElementById("options-container");
  if (!optionsContainer) return;
  optionsContainer.innerHTML = "";

  let quantidades = [];
  if (p["Quantidade"] && p["Quantidade"].trim()) {
    quantidades = p["Quantidade"].split(",").map((q) => parseInt(q.trim())).filter((q) => !isNaN(q) && q > 0);
  }
  if (quantidades.length === 0) quantidades = [1, 2, 3, 5, 10];
  quantidades = quantidades.filter((q) => q <= estoqueDisponivel);
  if (quantidades.length === 0) quantidades = [1];

  quantidades.forEach((qtd) => {
    const btn = document.createElement("button");
    btn.className = "qty-option-btn";
    btn.innerText = qtd;
    btn.onclick = function () {
      if (temCores) {
        quantidadeSelecionada = qtd;
        window.atualizarUISelecao();
      } else {
        window.adicionarSemCor(qtd, buttonElement);
      }
    };
    optionsContainer.appendChild(btn);
  });

  const inputCustom = document.getElementById("custom-quantity");
  if (inputCustom) {
    inputCustom.value = 1;
    inputCustom.max = estoqueDisponivel;
  }

  if (typeof window.resetarModalUI === "function") window.resetarModalUI();

  const modal = document.getElementById("size-modal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }

  verificarEstoqueServidor(id).then((resp) => {
    if (resp && resp.success) {
      const saldoServidor = parseInt(resp.saldo) || 0;
      p["Saldo Estoque"] = saldoServidor;
      const novoDisponivel = saldoServidor - jaNoCarrinho;

      if (tempProduct && String(tempProduct.id) === String(id)) {
        tempProduct.estoqueDisponivel = novoDisponivel;

        const estoqueDisplay = document.getElementById("estoque-display");
        if (estoqueDisplay) {
          estoqueDisplay.textContent = `${novoDisponivel} unidades disponíveis${jaNoCarrinho > 0 ? ` (${jaNoCarrinho} no carrinho)` : ""}`;
        }

        if (novoDisponivel < estoqueDisponivel && novoDisponivel >= 0) {
          showToast(`⚠️ Estoque atualizado: ${novoDisponivel} disponíveis`, "warning", 2500);
        }
      }
    }
  }).catch((err) => {
    console.warn("⚠️ Verificação em background falhou:", err);
  });
};

// ============================================
// BUSCA
// ============================================
function performSearch(termo) {
  const termoNormalizado = normalizar(termo);
  const filtrados = allProducts.filter(
    (p) =>
      normalizar(p["Nome do Produto"]).includes(termoNormalizado) ||
      normalizar(p["referencia"]).includes(termoNormalizado)
  );
  renderProducts(filtrados);
}

// ============================================
// PDF — MODELO PROFISSIONAL A4
// ============================================
function gerarConteudoPDF() {
  const cliente = carregarDadosCliente() || {};
  const dataAtual = new Date().toLocaleDateString("pt-BR");
  const horaAtual = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const totalFinal = subtotal >= FRETE_GRATIS_VALOR ? subtotal : subtotal + TAXA_FRETE;
  const freteTexto = subtotal >= FRETE_GRATIS_VALOR ? "Grátis" : `R$ ${TAXA_FRETE.toFixed(2).replace(".", ",")}`;

  const numeroPedido = String(Date.now()).slice(-6);
  const anoAtual = new Date().getFullYear();

  let itensHTML = "";
  let totalItens = 0;
  cart.forEach((item, index) => {
    const precoUnitario = item.precoUnitario || (item.price / item.quantity);
    totalItens += item.quantity;
    itensHTML += `
      <tr>
        <td style="padding: 8px 6px; text-align: center; font-size: 10px; color: #6b7280; border-bottom: 1px solid #f0f0f0; vertical-align: middle;">${index + 1}</td>
        <td style="padding: 8px 6px; text-align: center; border-bottom: 1px solid #f0f0f0; vertical-align: middle;">
          <div style="font-size: 9px; color: #182420; font-weight: 600; letter-spacing: 0.02em;">${item.ref || '—'}</div>
        </td>
        <td style="padding: 8px 6px; border-bottom: 1px solid #f0f0f0; vertical-align: middle;">
          <div style="font-size: 10px; font-weight: 600; color: #182420; line-height: 1.35;">${item.name}</div>
        </td>
        <td style="padding: 8px 6px; text-align: center; font-size: 10px; color: #182420; border-bottom: 1px solid #f0f0f0; vertical-align: middle;">${item.quantity}</td>
        <td style="padding: 8px 6px; text-align: right; font-size: 10px; color: #6b7280; border-bottom: 1px solid #f0f0f0; vertical-align: middle;">R$ ${precoUnitario.toFixed(2).replace(".", ",")}</td>
        <td style="padding: 8px 6px; text-align: right; font-size: 10px; font-weight: 700; color: #1f4d38; border-bottom: 1px solid #f0f0f0; vertical-align: middle;">R$ ${item.price.toFixed(2).replace(".", ",")}</td>
      </tr>`;
  });

  const docLabel = cliente.tipo === 'J' ? 'CNPJ' : 'CPF';
  const ieLabel = cliente.tipo === 'J' ? 'I.E.' : 'RG';

  const blocoCliente = `
    <div style="font-size: 8px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 4px;">Cliente</div>
    <div style="font-size: 11px; font-weight: 600; color: #182420; line-height: 1.35;">${cliente.nome || ''}</div>
    <div style="font-size: 9px; color: #4b5563; margin-top: 3px; line-height: 1.5;">
      ${cliente.tipo === 'J' ? 'Pessoa Jurídica' : 'Pessoa Física'}
      ${cliente.cpf ? ` • ${docLabel}: ${cliente.cpf}` : ''}
      ${cliente.ie ? ` • ${ieLabel}: ${cliente.ie}` : ''}
      ${cliente.nascimento ? `<br>Nascimento: ${formatarDataBR(cliente.nascimento)}` : ''}
    </div>
  `;

  const blocoEndereco = `
    <div style="font-size: 8px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 4px;">Endereço de Entrega</div>
    <div style="font-size: 10px; color: #4b5563; line-height: 1.45;">
      ${cliente.endereco || ''}, ${cliente.numero || ''}${cliente.complemento ? ' - ' + cliente.complemento : ''}<br>
      ${cliente.bairro || ''}<br>
      ${cliente.cidade || ''} - ${cliente.estado || ''}<br>
      CEP: ${cliente.cep || ''}
    </div>
  `;

  const blocoContato = `
    <div style="font-size: 8px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 4px;">Contato</div>
    <div style="font-size: 10px; color: #4b5563; line-height: 1.45;">
      ${cliente.celular ? `Celular: ${cliente.celular}<br>` : ''}
      ${cliente.email ? `E-mail: ${cliente.email}` : ''}
    </div>
  `;

  return `
  <div class="pdf-preview-content" id="pdf-content-to-print" style="
    width: 210mm;
    min-height: 297mm;
    padding: 0;
    background: #ffffff;
    font-family: 'Montserrat', Arial, sans-serif;
    box-sizing: border-box;
    color: #182420;
    display: flex;
    flex-direction: column;
    position: relative;
  ">
    <div style="height: 4px; background: linear-gradient(90deg, #2f6b4f 0%, #c9a86a 100%);"></div>
    <div style="flex: 1; padding: 6mm 2mm 6mm 2mm; display: flex; flex-direction: column;">
      <div style="flex: 1; padding: 0 6mm; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb; margin-bottom: 18px;">
          <div>
            <div style="font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 700; color: #1f4d38; letter-spacing: 0.02em; line-height: 1;">IVO PITA</div>
            <div style="font-size: 8px; font-weight: 600; color: #9ca3af; letter-spacing: 0.25em; text-transform: uppercase; margin-top: 3px;">Indústria de Joias</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 8px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 2px;">Pedido nº</div>
            <div style="font-size: 12px; font-weight: 700; color: #1f4d38; letter-spacing: 0.03em;">#${anoAtual}-${numeroPedido}</div>
            <div style="font-size: 9px; color: #9ca3af; margin-top: 3px;">${dataAtual} · ${horaAtual}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; margin-bottom: 16px;">
          <div>${blocoCliente}</div>
          <div>${blocoContato}</div>
        </div>

        <div style="margin-bottom: 16px;">
          ${blocoEndereco}
        </div>

        <div style="margin-bottom: 16px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 1.5px solid #1f4d38;">
                <th style="padding: 8px 6px; font-size: 8px; font-weight: 700; color: #1f4d38; text-transform: uppercase; letter-spacing: 0.12em; text-align: center; width: 45px;">Itens</th>
                <th style="padding: 8px 6px; font-size: 8px; font-weight: 700; color: #1f4d38; text-transform: uppercase; letter-spacing: 0.12em; text-align: center; width: 90px;">Referência</th>
                <th style="padding: 8px 6px; font-size: 8px; font-weight: 700; color: #1f4d38; text-transform: uppercase; letter-spacing: 0.12em; text-align: left;">Descrição</th>
                <th style="padding: 8px 6px; font-size: 8px; font-weight: 700; color: #1f4d38; text-transform: uppercase; letter-spacing: 0.12em; text-align: center; width: 50px;">Qtde</th>
                <th style="padding: 8px 6px; font-size: 8px; font-weight: 700; color: #1f4d38; text-transform: uppercase; letter-spacing: 0.12em; text-align: right; width: 85px;">Valor Uni.</th>
                <th style="padding: 8px 6px; font-size: 8px; font-weight: 700; color: #1f4d38; text-transform: uppercase; letter-spacing: 0.12em; text-align: right; width: 95px;">Total</th>
              </tr>
            </thead>
            <tbody>${itensHTML}</tbody>
          </table>
        </div>

        <div style="display: flex; justify-content: flex-end; margin-bottom: 22px;">
          <div style="width: 260px; border-top: 1px solid #e5e7eb; padding-top: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 10px; color: #6b7280;">
              <span>Subtotal (${totalItens} ${totalItens === 1 ? 'item' : 'itens'})</span>
              <span style="color: #182420; font-weight: 600;">R$ ${subtotal.toFixed(2).replace(".", ",")}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 10px; color: #6b7280;">
              <span>Frete</span>
              <span style="color: ${subtotal >= FRETE_GRATIS_VALOR ? '#16a34a' : '#182420'}; font-weight: 600;">${freteTexto}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0 6px; border-top: 1px solid #e5e7eb; margin-top: 6px;">
              <span style="font-size: 10px; font-weight: 700; color: #1f4d38; text-transform: uppercase; letter-spacing: 0.1em;">Total</span>
              <span style="font-size: 15px; font-weight: 800; color: #1f4d38; letter-spacing: -0.02em;">R$ ${totalFinal.toFixed(2).replace(".", ",")}</span>
            </div>
          </div>
        </div>

        <div style="margin-top: auto; padding-top: 12px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #9ca3af;">
          <div>
            <div style="font-weight: 700; color: #1f4d38; letter-spacing: 0.05em; font-size: 9px; margin-bottom: 3px;">IVO PITA — INDÚSTRIA DE JOIAS</div>
            <div>${siteConfig.whatsappDisplay || "(88) 99904-9636"} · ${siteConfig.email || "contato@ivopita.com.br"}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 700; color: #1f4d38; letter-spacing: 0.05em; font-size: 9px; margin-bottom: 3px;">${siteConfig.instagramDisplay || "@ivopita"}</div>
            <div>${siteConfig.endereco || "Juazeiro do Norte, CE"}</div>
          </div>
        </div>
      </div>
    </div>
    <div style="height: 3px; background: linear-gradient(90deg, #c9a86a 0%, #2f6b4f 100%);"></div>
  </div>`;
}


async function visualizarPDF() {
  if (cart.length === 0) {
    showToast("Sacola vazia!", "error", 2000);
    return;
  }

  // if (!clienteEstaCadastrado()) {
  //   showToast("Cadastre seus dados antes de visualizar o PDF", "warning", 3000);
  //   setTimeout(() => abrirModalCliente(), 500);
  //   return;
  // }

  const ok = await carregarLibsPDF();
  if (!ok) {
    showToast("Erro ao carregar gerador de PDF", "error");
    return;
  }

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  document.getElementById("pdf-preview-content").innerHTML = gerarConteudoPDF();
  document.getElementById("pdf-preview-modal").classList.remove("hidden");
  document.getElementById("pdf-preview-modal").classList.add("flex");
}

// ============================================
// PROCESSAR PEDIDO VIA JSONP
// ============================================
async function processarPedidoPublico(nomeCliente, endereco, dadosCliente) {
  const itensParaBaixar = {};
  cart.forEach((item) => {
    const baseId = String(item.baseId || item.id.split("-")[0]);
    if (!itensParaBaixar[baseId]) itensParaBaixar[baseId] = 0;
    itensParaBaixar[baseId] += item.quantity;
  });

  const itemsCompactos = Object.keys(itensParaBaixar)
    .map((id) => `${id}:${itensParaBaixar[id]}`)
    .join(',');

  const itensTexto = cart
    .map((i) => `${i.quantity}x ${i.name}${i.ref ? ` (Ref: ${i.ref})` : ""} (R$ ${(i.price / i.quantity).toFixed(2).replace(".", ",")} cada)`)
    .join(" | ");

  const totalFinal = subtotal >= FRETE_GRATIS_VALOR ? subtotal : subtotal + TAXA_FRETE;
  const freteAplicado = subtotal >= FRETE_GRATIS_VALOR ? 0 : TAXA_FRETE;

  const c = dadosCliente || carregarDadosCliente() || {};
  const dadosExtras = [
    c.cpf ? `CPF/CNPJ: ${c.cpf}` : '',
    c.ie ? `${c.tipo === 'J' ? 'I.E.' : 'RG'}: ${c.ie}` : '',
    c.celular ? `Cel: ${c.celular}` : '',
    c.email ? `Email: ${c.email}` : '',
    c.nascimento ? `Nasc: ${formatarDataBR(c.nascimento)}` : ''
  ].filter(Boolean).join(' • ');

  return new Promise((resolve) => {
    const callbackName = "fazer_pedido_" + Date.now();
    let resolvido = false;
    let script = null;

    const finalizar = (dados) => {
      if (resolvido) return;
      resolvido = true;
      delete window[callbackName];
      if (script && script.parentNode) script.parentNode.removeChild(script);
      resolve(dados);
    };

    window[callbackName] = function (data) {
      finalizar(data);
    };

    script = document.createElement("script");
    const params =
      `modo=publico&tipo=fazer_pedido` +
      `&cliente=${encodeURIComponent(nomeCliente)}` +
      `&endereco=${encodeURIComponent(endereco)}` +
      `&itens=${encodeURIComponent(itensTexto)}` +
      `&dadosExtras=${encodeURIComponent(dadosExtras)}` +
      `&subtotal=${subtotal}` +
      `&frete=${freteAplicado}` +
      `&total=${totalFinal}` +
      `&data=${encodeURIComponent(new Date().toISOString())}` +
      `&itemsCompactos=${encodeURIComponent(itemsCompactos)}` +
      `&callback=${callbackName}`;

    script.src = `${ESTOQUE_API_URL}?${params}`;

    script.onerror = function () {
      finalizar({ success: false, error: "Erro de rede ao enviar pedido" });
    };

    setTimeout(() => {
      finalizar({ success: false, error: "Timeout ao processar pedido" });
    }, 20000);

    document.body.appendChild(script);
  });
}

// ============================================
// CARREGAR LIBS DO PDF
// ============================================
let pdfLibsLoaded = false;

async function carregarLibsPDF() {
  if (pdfLibsLoaded) return true;
  if (window.jspdf && window.html2canvas) {
    pdfLibsLoaded = true;
    return true;
  }

  return new Promise((resolve) => {
    const loadScript = (src) => {
      return new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = res;
        s.onerror = rej;
        document.head.appendChild(s);
      });
    };

    Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
    ]).then(() => {
      pdfLibsLoaded = true;
      resolve(true);
    }).catch(() => resolve(false));
  });
}

// ============================================
// DOWNLOAD PDF
// ============================================
// ============================================
// DOWNLOAD PDF
// ============================================
async function downloadPDF() {
  let element = document.getElementById("pdf-content-to-print");
  if (!element) {
    await visualizarPDF();
    setTimeout(() => downloadPDF(), 500);
    return;
  }

  if (cart.length === 0) { 
    showToast("Sacola vazia!", "error", 2000); 
    return; 
  }

  // ✅ REMOVIDA A TRAVA DE CADASTRO AQUI
  const cliente = carregarDadosCliente() || {};
  const nomeCliente = cliente.nome || 'Cliente (a confirmar)';
  const enderecoCompleto = clienteEstaCadastrado() ? formatarEnderecoCompleto() : 'A confirmar via WhatsApp';

  const btn = document.getElementById("download-pdf-btn");
  const original = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
  }

  showToast("Gerando PDF...", "info", 2000);

  try {
    await carregarLibsPDF();

    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.85);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: "portrait", unit: "mm", format: "a4", compress: true
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 4;
    const printableWidth = pageWidth - margin * 2;
    const printableHeight = pageHeight - margin * 2;

    const imgRatio = canvas.height / canvas.width;
    let imgWidth = printableWidth;
    let imgHeight = imgWidth * imgRatio;

    if (imgHeight <= printableHeight) {
      const yOffset = margin + (printableHeight - imgHeight) / 2;
      pdf.addImage(imgData, "JPEG", margin, yOffset, imgWidth, imgHeight, undefined, "FAST");
    } else {
      let position = 0;
      let pageNum = 0;
      while (position < imgHeight) {
        if (pageNum > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", margin, margin - position, imgWidth, imgHeight, undefined, "FAST");
        position += printableHeight;
        pageNum++;
      }
    }

    const dataArquivo = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    pdf.save(`Pedido_IvoPita_${dataArquivo}.pdf`);

    // ✅ Salva o pedido no servidor (em background)
    const resultado = await processarPedidoPublico(nomeCliente, enderecoCompleto, cliente);

    if (!resultado || !resultado.success) {
      throw new Error((resultado && resultado.error) || "Erro ao salvar pedido");
    }

    cart = [];
    updateCart();

    document.getElementById("pdf-preview-modal")?.classList.add("hidden");
    document.getElementById("pdf-preview-modal")?.classList.remove("flex");
    document.getElementById("cart-modal")?.classList.add("hidden");
    document.getElementById("cart-modal")?.classList.remove("flex");

    showToast("✅ Pedido finalizado! PDF baixado.", "success", 4000);

    invalidarEstoqueCache();
    localStorage.removeItem(CACHE_KEY_DADOS);
    carregarTudo();

  } catch (error) {
    console.error("❌ Erro:", error);
    showToast("❌ Erro: " + error.message + " — O PDF foi baixado, mas o pedido NÃO foi salvo.", "error", 6000);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  }
}

// ============================================
// FINALIZAR PEDIDO VIA WHATSAPP (RÁPIDO - abre em <1s)
// ============================================
async function finalizarPedidoDireto() {
  if (cart.length === 0) {
    showToast("Sacola vazia!", "error", 2000);
    return;
  }

  const cliente = carregarDadosCliente() || {};
  const temDadosCompletos = clienteEstaCadastrado();

  // ✅ Abre a aba JÁ no clique do usuário (evita popup blocker)
  const janelaWhats = window.open('', '_blank');

  if (!janelaWhats || janelaWhats.closed) {
    const continuar = confirm(
      "⚠️ Seu navegador bloqueou a abertura do WhatsApp.\n\n" +
      "Clique em OK para tentar novamente e permitir popups para este site."
    );
    if (!continuar) return;
    return finalizarPedidoDiretoFallback();
  }

  const nomeCliente = cliente.nome || 'Cliente (a confirmar)';
  const enderecoCompleto = temDadosCompletos ? formatarEnderecoCompleto() : 'A confirmar via WhatsApp';

  // ✅ Monta a mensagem AGORA (sem esperar nada do servidor)
  const totalFinal = subtotal >= FRETE_GRATIS_VALOR ? subtotal : subtotal + TAXA_FRETE;
  const freteExibicao = subtotal >= FRETE_GRATIS_VALOR
    ? "GRÁTIS"
    : `R$ ${TAXA_FRETE.toFixed(2).replace(".", ",")}`;

  let dadosClienteTexto = '';
  if (temDadosCompletos && cliente.nome) {
    dadosClienteTexto = [
      `👤 *CLIENTE:* ${cliente.nome.toUpperCase()}`,
      `📄 *Tipo:* ${cliente.tipo === 'J' ? 'Pessoa Jurídica' : 'Pessoa Física'}`,
      cliente.cpf ? `🆔 *${cliente.tipo === 'J' ? 'CNPJ' : 'CPF'}:* ${cliente.cpf}` : '',
      cliente.ie ? `📋 *${cliente.tipo === 'J' ? 'I.E.' : 'RG'}:* ${cliente.ie}` : '',
      cliente.nascimento ? `🎂 *Nascimento:* ${formatarDataBR(cliente.nascimento)}` : '',
      '',
      `📍 *ENDEREÇO DE ENTREGA:*`,
      `${cliente.endereco}, ${cliente.numero}${cliente.complemento ? ' - ' + cliente.complemento : ''}`,
      `Bairro: ${cliente.bairro}`,
      `${cliente.cidade} - ${cliente.estado}`,
      `CEP: ${cliente.cep}`,
      '',
      `📞 *CONTATO:*`,
      `Celular: ${cliente.celular}`,
      cliente.email ? `E-mail: ${cliente.email}` : ''
    ].filter(Boolean).join('\n');
  } else {
    dadosClienteTexto = `👤 *CLIENTE:* (não cadastrado — favor preencher os dados no WhatsApp)`;
  }

  const mensagemWhats =
    `🛍️ *NOVO PEDIDO - IVO PITA* 🛍️\n\n` +
    `${dadosClienteTexto}\n\n` +
    `*📦 ITENS DO PEDIDO:*\n` +
    cart.map((i) =>
      `✅ ${i.quantity}x ${i.name}${i.ref ? ` (Ref: ${i.ref})` : ""} - R$ ${(i.price / i.quantity).toFixed(2).replace(".", ",")} cada`
    ).join("\n") +
    `\n\n*💰 RESUMO DO PEDIDO:*\n` +
    `─────────────────\n` +
    `Subtotal: R$ ${subtotal.toFixed(2).replace(".", ",")}\n` +
    `Frete: ${freteExibicao}\n` +
    `─────────────────\n` +
    `*TOTAL: R$ ${totalFinal.toFixed(2).replace(".", ",")}*\n` +
    `─────────────────\n\n` +
    `✨ *Obrigado pela preferência!*`;

  // ✅ Garante o 55 na frente do número
  let numeroWhats = String(
    window.__whatsappNumero ||
    siteConfig.whatsapp ||
    "5588981762208"
  ).replace(/\D/g, "").replace(/^0+/, "");

  if (!numeroWhats.startsWith("55")) {
    numeroWhats = "55" + numeroWhats;
  }

  const urlWhats = `https://wa.me/${numeroWhats}?text=${encodeURIComponent(mensagemWhats)}`;

  // ✅ ABRE O WHATSAPP IMEDIATAMENTE (antes de qualquer await)
  if (janelaWhats && !janelaWhats.closed) {
    janelaWhats.location.href = urlWhats;
  } else {
    window.location.href = urlWhats;
  }

  // ✅ Salva a "foto" do pedido antes de limpar o carrinho
  const clienteSnapshot = { ...cliente };
  const nomeClienteSnapshot = nomeCliente;
  const enderecoSnapshot = enderecoCompleto;
  const cartSnapshot = cart.slice();
  const subtotalSnapshot = subtotal;
  const freteSnapshot = subtotal >= FRETE_GRATIS_VALOR ? 0 : TAXA_FRETE;
  const totalSnapshot = totalFinal;

  // ✅ Limpa carrinho e fecha modal imediatamente
  localStorage.setItem("ultimo_pedido_ts", Date.now().toString());
  cart = [];
  updateCart();
  document.getElementById("cart-modal")?.classList.add("hidden");
  document.getElementById("cart-modal")?.classList.remove("flex");

  showToast("✅ Pedido enviado! WhatsApp abrindo...", "success", 3000);

  // ✅ Em BACKGROUND: salva o pedido no servidor (não bloqueia o WhatsApp)
  (async function salvarPedidoEmBackground() {
    try {
      // Restaura o carrinho temporariamente para o processarPedidoPublico ler
      const cartOriginal = cart;
      cart = cartSnapshot;
      subtotal = subtotalSnapshot;
      
      // Chama o processamento do pedido
      const resultado = await processarPedidoPublico(
        nomeClienteSnapshot,
        enderecoSnapshot,
        clienteSnapshot
      );

      // Restaura o carrinho vazio
      cart = cartOriginal;
      subtotal = 0;

      if (!resultado || !resultado.success) {
        console.warn("⚠️ Erro ao salvar pedido em background:", resultado?.error || "desconhecido");
      } else {
        console.log("✅ Pedido salvo no servidor com sucesso");
      }

      invalidarEstoqueCache();
      localStorage.removeItem(CACHE_KEY_DADOS);
      carregarTudo();
    } catch (err) {
      console.warn("⚠️ Erro ao salvar pedido em background:", err);
      invalidarEstoqueCache();
      localStorage.removeItem(CACHE_KEY_DADOS);
      carregarTudo();
    }
  })();
}





// ============================================
// FINALIZAR PEDIDO VIA WHATSAPP
// ============================================
// async function finalizarPedidoDireto() {
//   if (cart.length === 0) {
//     showToast("Sacola vazia!", "error", 2000);
//     return;
//   }

//   // ✅ NÃO exige mais cadastro. Se não tiver dados, segue mesmo assim.
//   const cliente = carregarDadosCliente() || {};
//   const temDadosCompletos = clienteEstaCadastrado();

//   // ✅ Abre a aba JÁ no clique do usuário (evita popup blocker)
//   const janelaWhats = window.open('', '_blank');

//   if (!janelaWhats || janelaWhats.closed) {
//     const continuar = confirm(
//       "⚠️ Seu navegador bloqueou a abertura do WhatsApp.\n\n" +
//       "Clique em OK para tentar novamente e permitir popups para este site."
//     );
//     if (!continuar) return;
//     return finalizarPedidoDiretoFallback();
//   }

//   const nomeCliente = cliente.nome || 'Cliente (a confirmar)';
//   const enderecoCompleto = temDadosCompletos ? formatarEnderecoCompleto() : 'A confirmar via WhatsApp';

//   showToast("Validando estoque...", "info", 1500);
//   await validarCarrinho();

//   if (cart.length === 0) {
//     if (janelaWhats && !janelaWhats.closed) janelaWhats.close();
//     showToast("Seu carrinho ficou vazio (itens esgotaram).", "error", 3000);
//     return;
//   }

//   const checkoutBtn = document.getElementById("checkout-btn");
//   if (checkoutBtn) {
//     checkoutBtn.disabled = true;
//     checkoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
//   }

//   try {
//     const totalFinal = subtotal >= FRETE_GRATIS_VALOR ? subtotal : subtotal + TAXA_FRETE;
//     const freteExibicao = subtotal >= FRETE_GRATIS_VALOR
//       ? "GRÁTIS"
//       : `R$ ${TAXA_FRETE.toFixed(2).replace(".", ",")}`;

//     const resultado = await processarPedidoPublico(nomeCliente, enderecoCompleto, cliente);

//     if (!resultado || !resultado.success) {
//       const erro = (resultado && resultado.error) || "Erro ao salvar pedido";

//       if (erro.toLowerCase().includes("estoque insuficiente") || erro.toLowerCase().includes("não encontrado")) {
//         showToast("⚠️ Um item esgotou enquanto você finalizava. Atualizando...", "warning", 5000);
//         invalidarEstoqueCache();
//         localStorage.removeItem(CACHE_KEY_DADOS);
//         setTimeout(async () => {
//           await carregarTudo();
//           await validarCarrinho();
//           document.getElementById("cart-modal")?.classList.remove("hidden");
//           document.getElementById("cart-modal")?.classList.add("flex");
//         }, 1500);
//         throw new Error("Estoque desatualizado — revise seu carrinho");
//       }

//       if (erro.toLowerCase().includes("muitos pedidos")) {
//         throw new Error("Aguarde cerca de 1 minuto antes de tentar novamente.");
//       }

//       throw new Error(erro);
//     }

//     // ✅ Monta os dados do cliente APENAS se estiverem cadastrados
//     let dadosClienteTexto = '';
//     if (temDadosCompletos && cliente.nome) {
//       dadosClienteTexto = [
//         `👤 *CLIENTE:* ${cliente.nome.toUpperCase()}`,
//         `📄 *Tipo:* ${cliente.tipo === 'J' ? 'Pessoa Jurídica' : 'Pessoa Física'}`,
//         cliente.cpf ? `🆔 *${cliente.tipo === 'J' ? 'CNPJ' : 'CPF'}:* ${cliente.cpf}` : '',
//         cliente.ie ? `📋 *${cliente.tipo === 'J' ? 'I.E.' : 'RG'}:* ${cliente.ie}` : '',
//         cliente.nascimento ? `🎂 *Nascimento:* ${formatarDataBR(cliente.nascimento)}` : '',
//         '',
//         `📍 *ENDEREÇO DE ENTREGA:*`,
//         `${cliente.endereco}, ${cliente.numero}${cliente.complemento ? ' - ' + cliente.complemento : ''}`,
//         `Bairro: ${cliente.bairro}`,
//         `${cliente.cidade} - ${cliente.estado}`,
//         `CEP: ${cliente.cep}`,
//         '',
//         `📞 *CONTATO:*`,
//         `Celular: ${cliente.celular}`,
//         cliente.email ? `E-mail: ${cliente.email}` : ''
//       ].filter(Boolean).join('\n');
//     } else {
//       dadosClienteTexto = `👤 *CLIENTE:* (não cadastrado — favor preencher os dados no WhatsApp)`;
//     }

//     const mensagemWhats =
//       `🛍️ *NOVO PEDIDO - IVO PITA* 🛍️\n\n` +
//       `${dadosClienteTexto}\n\n` +
//       `*📦 ITENS DO PEDIDO:*\n` +
//       cart.map((i) =>
//         `✅ ${i.quantity}x ${i.name}${i.ref ? ` (Ref: ${i.ref})` : ""} - R$ ${(i.price / i.quantity).toFixed(2).replace(".", ",")} cada`
//       ).join("\n") +
//       `\n\n*💰 RESUMO DO PEDIDO:*\n` +
//       `─────────────────\n` +
//       `Subtotal: R$ ${subtotal.toFixed(2).replace(".", ",")}\n` +
//       `Frete: ${freteExibicao}\n` +
//       `─────────────────\n` +
//       `*TOTAL: R$ ${totalFinal.toFixed(2).replace(".", ",")}*\n` +
//       `─────────────────\n\n` +
//       `✨ *Obrigado pela preferência!*`;

//     // ✅ Garante o 55 na frente do número
//     let numeroWhats = String(
//       window.__whatsappNumero ||
//       siteConfig.whatsapp ||
//       "5588981762208"
//     ).replace(/\D/g, "").replace(/^0+/, "");

//     if (!numeroWhats.startsWith("55")) {
//       numeroWhats = "55" + numeroWhats;
//     }

//     const urlWhats = `https://wa.me/${numeroWhats}?text=${encodeURIComponent(mensagemWhats)}`;

//     localStorage.setItem("ultimo_pedido_ts", Date.now().toString());

//     if (janelaWhats && !janelaWhats.closed) {
//       janelaWhats.location.href = urlWhats;
//     } else {
//       window.location.href = urlWhats;
//     }

//     cart = [];
//     updateCart();
//     document.getElementById("cart-modal")?.classList.add("hidden");
//     document.getElementById("cart-modal")?.classList.remove("flex");

//     showToast("✅ Pedido enviado e estoque atualizado!", "success", 4000);

//     invalidarEstoqueCache();
//     localStorage.removeItem(CACHE_KEY_DADOS);
//     carregarTudo();

//   } catch (error) {
//     console.error("❌ Erro ao finalizar pedido:", error);

//     if (janelaWhats && !janelaWhats.closed) {
//       janelaWhats.close();
//     }

//     showToast("❌ " + error.message, "error", 5000);

//   } finally {
//     if (checkoutBtn) {
//       checkoutBtn.disabled = false;
//       checkoutBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Finalizar';
//     }
//   }
// }


// ============================================
// FALLBACK (caso a aba tenha sido bloqueada)
// ============================================
async function finalizarPedidoDiretoFallback() {
  if (cart.length === 0) return;

  // ✅ NÃO exige mais cadastro
  const cliente = carregarDadosCliente() || {};
  const temDadosCompletos = clienteEstaCadastrado();

  const checkoutBtn = document.getElementById("checkout-btn");
  if (checkoutBtn) {
    checkoutBtn.disabled = true;
    checkoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
  }

  const nomeCliente = cliente.nome || 'Cliente (a confirmar)';
  const enderecoCompleto = temDadosCompletos ? formatarEnderecoCompleto() : 'A confirmar via WhatsApp';

  try {
    const resultado = await processarPedidoPublico(nomeCliente, enderecoCompleto, cliente);

    if (!resultado || !resultado.success) {
      throw new Error((resultado && resultado.error) || "Erro ao salvar pedido");
    }

    const totalFinal = subtotal >= FRETE_GRATIS_VALOR ? subtotal : subtotal + TAXA_FRETE;
    const freteExibicao = subtotal >= FRETE_GRATIS_VALOR
      ? "GRÁTIS"
      : `R$ ${TAXA_FRETE.toFixed(2).replace(".", ",")}`;

    let dadosClienteTexto = '';
    if (temDadosCompletos && cliente.nome) {
      dadosClienteTexto = [
        `👤 *CLIENTE:* ${cliente.nome.toUpperCase()}`,
        `📄 *Tipo:* ${cliente.tipo === 'J' ? 'Pessoa Jurídica' : 'Pessoa Física'}`,
        cliente.cpf ? `🆔 *${cliente.tipo === 'J' ? 'CNPJ' : 'CPF'}:* ${cliente.cpf}` : '',
        cliente.ie ? `📋 *${cliente.tipo === 'J' ? 'I.E.' : 'RG'}:* ${cliente.ie}` : '',
        cliente.nascimento ? `🎂 *Nascimento:* ${formatarDataBR(cliente.nascimento)}` : '',
        '',
        `📍 *ENDEREÇO DE ENTREGA:*`,
        `${cliente.endereco}, ${cliente.numero}${cliente.complemento ? ' - ' + cliente.complemento : ''}`,
        `Bairro: ${cliente.bairro}`,
        `${cliente.cidade} - ${cliente.estado}`,
        `CEP: ${cliente.cep}`,
        '',
        `📞 *CONTATO:*`,
        `Celular: ${cliente.celular}`,
        cliente.email ? `E-mail: ${cliente.email}` : ''
      ].filter(Boolean).join('\n');
    } else {
      dadosClienteTexto = `👤 *CLIENTE:* (não cadastrado — favor preencher os dados no WhatsApp)`;
    }

    const mensagemWhats =
      `🛍️ *NOVO PEDIDO - IVO PITA* 🛍️\n\n` +
      `${dadosClienteTexto}\n\n` +
      `*📦 ITENS DO PEDIDO:*\n` +
      cart.map((i) =>
        `✅ ${i.quantity}x ${i.name}${i.ref ? ` (Ref: ${i.ref})` : ""} - R$ ${(i.price / i.quantity).toFixed(2).replace(".", ",")} cada`
      ).join("\n") +
      `\n\n*💰 RESUMO DO PEDIDO:*\n` +
      `─────────────────\n` +
      `Subtotal: R$ ${subtotal.toFixed(2).replace(".", ",")}\n` +
      `Frete: ${freteExibicao}\n` +
      `─────────────────\n` +
      `*TOTAL: R$ ${totalFinal.toFixed(2).replace(".", ",")}*\n` +
      `─────────────────\n\n` +
      `✨ *Obrigado pela preferência!*`;

    // ✅ Garante o 55 na frente do número
    let numeroWhats = String(
      window.__whatsappNumero ||
      siteConfig.whatsapp ||
      "5588981762208"
    ).replace(/\D/g, "").replace(/^0+/, "");

    if (!numeroWhats.startsWith("55")) {
      numeroWhats = "55" + numeroWhats;
    }

    const urlWhats = `https://wa.me/${numeroWhats}?text=${encodeURIComponent(mensagemWhats)}`;

    localStorage.setItem("ultimo_pedido_ts", Date.now().toString());

    cart = [];
    updateCart();
    document.getElementById("cart-modal")?.classList.add("hidden");
    document.getElementById("cart-modal")?.classList.remove("flex");

    window.location.href = urlWhats;

  } catch (error) {
    console.error("❌ Erro no fallback:", error);
    showToast("❌ " + error.message, "error", 5000);
  } finally {
    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Finalizar';
    }
  }
}



function formatarDataBR(dataISO) {
  if (!dataISO) return '';
  const partes = dataISO.split('-');
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return dataISO;
}

// ============================================
// FILTRAR POR CATEGORIA
// ============================================
function filtrarPorCategoria(categoria) {
  if (typeof allProducts === "undefined" || typeof renderProducts === "undefined") return;

  const catFiltro = normalizar(categoria);
  const palavrasFiltro = catFiltro.split(/\s+/).filter((p) => p.length > 0);
  const palavrasFiltroNorm = palavrasFiltro.map(normalizarPalavraBusca);

  const filtrados =
    categoria === "todos"
      ? allProducts
      : allProducts.filter((p) => {
       const catProduto = normalizar(p["Categoria"] || "");
      const subcatProduto = normalizar(p["Subcategoria"] || "");
      const tamanhoProduto = normalizar(p["Tamanho"] || "");  // 👈 NOVO
      const nomeProduto = normalizar(p["Nome do Produto"] || "");
      const refProduto = normalizar(p["referencia"] || "");
      const combinado = catProduto + " " + subcatProduto + " " + tamanhoProduto + " " + nomeProduto + " " + refProduto;
        const combinadoNorm = combinado.split(/\s+/).map(normalizarPalavraBusca).join(" ");
        return palavrasFiltroNorm.every((palavra) => combinadoNorm.includes(palavra));
      });

  renderProducts(filtrados);

  setTimeout(atualizarContadorProdutos, 100);
  setTimeout(atualizarContadoresSidebar, 100);

  const produtosSection = document.getElementById("produtos");
  if (produtosSection) produtosSection.scrollIntoView({ behavior: "smooth", block: "start" });

  marcarItemSidebarAtivo(categoria);

  const titleEl = document.getElementById('products-title');
  const subtitleEl = document.getElementById('products-subtitle');

  if (categoria === 'todos') {
    if (titleEl) titleEl.textContent = 'Nossas Joias';
    if (subtitleEl) subtitleEl.textContent = 'Explore nossa coleção exclusiva';
  } else {
    const nomeFormatado = categoria
      .split(' ')
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');
    if (titleEl) titleEl.textContent = nomeFormatado;
    if (subtitleEl) subtitleEl.textContent = 'Produtos filtrados';
  }
}
window.filtrarPorCategoria = filtrarPorCategoria;

// ============================================
// TOGGLE SUBMENU MOBILE (compat)
// ============================================
function toggleSubmenuMobile(btn) {
  const parent = btn.closest(".space-y-1");
  const submenu = parent?.querySelector(".submenu-mobile");
  const icon = btn.querySelector(".fa-chevron-down");
  if (submenu) {
    submenu.classList.toggle("hidden");
    if (icon) icon.classList.toggle("rotate-180");
  }
}
window.toggleSubmenuMobile = toggleSubmenuMobile;

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener("DOMContentLoaded", function () {
  console.log("🚀 Ivo Pita - Inicializando...");

  carregarTudo();
  updateCart();

  // Sidebar mobile
  document.getElementById('sidebar-open-btn')?.addEventListener('click', abrirSidebarMobile);
  document.getElementById('sidebar-close-mobile')?.addEventListener('click', fecharSidebarMobile);
  document.getElementById('sidebar-overlay')?.addEventListener('click', fecharSidebarMobile);

  // Sidebar estática (fallback)
  document.querySelectorAll('.sidebar-item').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const categoria = this.getAttribute('data-categoria');
      if (!categoria) return;
      marcarItemSidebarAtivo(categoria);
      filtrarPorCategoria(categoria);
      if (window.innerWidth <= 900) fecharSidebarMobile();
    });
  });

  document.querySelectorAll('.sidebar-item-sub').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const categoria = this.getAttribute('data-categoria');
      if (!categoria) return;
      marcarItemSidebarAtivo(categoria);
      filtrarPorCategoria(categoria);
      if (window.innerWidth <= 900) fecharSidebarMobile();
    });
  });

  document.getElementById('sidebar-search')?.addEventListener('input', function (e) {
    aplicarBuscaSidebar(e.target.value);
  });

  document.getElementById('sort-select')?.addEventListener('change', function () {
    ordenarProdutos(this.value);
  });

  document.getElementById("search-input-desktop")?.addEventListener("input", (e) => performSearch(e.target.value));
  document.getElementById("search-input-mobile")?.addEventListener("input", (e) => performSearch(e.target.value));

  document.getElementById("mobile-search-btn")?.addEventListener("click", () => {
    document.getElementById("search-overlay")?.classList.remove("-translate-y-full");
    setTimeout(() => {
      document.getElementById("search-input-mobile")?.focus();
    }, 300);
  });

  document.getElementById("mobile-search-close")?.addEventListener("click", () => {
    document.getElementById("search-overlay")?.classList.add("-translate-y-full");
  });

  // Carrinho - valida ao abrir
  document.getElementById("cart-btn")?.addEventListener("click", async () => {
    document.getElementById("cart-modal")?.classList.remove("hidden");
    document.getElementById("cart-modal")?.classList.add("flex");
    validarCarrinho().catch(err => console.warn("Erro ao validar carrinho:", err));
  });

  document.getElementById("close-modal-btn")?.addEventListener("click", () => {
    document.getElementById("cart-modal")?.classList.add("hidden");
    document.getElementById("cart-modal")?.classList.remove("flex");
  });

  document.getElementById("checkout-btn")?.addEventListener("click", finalizarPedidoDireto);
  document.getElementById("pdf-preview-btn")?.addEventListener("click", visualizarPDF);

  document.getElementById("close-pdf-modal")?.addEventListener("click", () => {
    document.getElementById("pdf-preview-modal")?.classList.add("hidden");
    document.getElementById("pdf-preview-modal")?.classList.remove("flex");
  });

  document.getElementById("download-pdf-btn")?.addEventListener("click", downloadPDF);

  // Limpar carrinho
  const clearBtn = document.getElementById("clear-cart-btn");
  const confirmModal = document.getElementById("confirm-clear-modal");
  if (clearBtn && confirmModal) {
    clearBtn.onclick = () => confirmModal.classList.remove("hidden");
    document.getElementById("cancel-clear-btn").onclick = () => confirmModal.classList.add("hidden");
    document.getElementById("confirm-clear-btn").onclick = () => {
      cart = [];
      updateCart();
      confirmModal.classList.add("hidden");
    };
  }

  document.getElementById("mobile-menu-btn")?.addEventListener("click", abrirSidebarMobile);

  document.getElementById("cart-modal")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("cart-modal")) {
      document.getElementById("cart-modal").classList.add("hidden");
      document.getElementById("cart-modal").classList.remove("flex");
    }
  });

  document.getElementById("size-modal")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("size-modal")) window.closeSizeModal();
  });

  document.getElementById("image-zoom-modal")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("image-zoom-modal")) fecharZoom();
  });

  document.getElementById("add-custom-qty")?.addEventListener("click", () => {
    const input = document.getElementById("custom-quantity");
    const qty = parseInt(input.value);

    if (!qty || qty <= 0) {
      showToast("Digite uma quantidade válida", "error", 2000);
      return;
    }

    if (coresDisponiveis.length > 0) {
      quantidadeSelecionada = qty;
      window.atualizarUISelecao();
    } else {
      const btn = document.getElementById("add-custom-qty");
      window.adicionarSemCor(qty, btn);
    }
  });

  document.getElementById("custom-quantity")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("add-custom-qty").click();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      fecharZoom();
      window.closeSizeModal();
      document.getElementById("cart-modal")?.classList.add("hidden");
      document.getElementById("cart-modal")?.classList.remove("flex");
      document.getElementById("pdf-preview-modal")?.classList.add("hidden");
      document.getElementById("pdf-preview-modal")?.classList.remove("flex");
      fecharSidebarMobile();
    }
    if (e.key === "ArrowLeft") zoomAnterior();
    if (e.key === "ArrowRight") zoomProximo();
  });

  // Sidebar - botões de tamanho (sub-subcategoria)
document.querySelectorAll('.sidebar-item-tamanho').forEach(btn => {
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    const categoria = this.getAttribute('data-categoria');
    if (!categoria) return;
    marcarItemSidebarAtivo(categoria);
    filtrarPorCategoria(categoria);
    if (window.innerWidth <= 900) fecharSidebarMobile();
  });
});


  const produtosContainer = document.getElementById('produtos-container');
  if (produtosContainer) {
    const observer = new MutationObserver(() => {
      atualizarContadorProdutos();
    });
    observer.observe(produtosContainer, { childList: true, subtree: true });
  }

  setTimeout(atualizarContadoresSidebar, 3000);

  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get("busca");
  if (searchParam) {
    const el = document.getElementById("search-input-desktop");
    if (el) el.value = searchParam;
    performSearch(searchParam);
  }

  // Cadastro de cliente
  configurarListenersCliente();
  atualizarResumoCliente();

  // Salva rascunho antes de sair
  window.addEventListener('beforeunload', salvarRascunhoCliente);

  // Salva quando o modal é fechado
  const modalCliente = document.getElementById('cliente-modal');
  if (modalCliente) {
    const observer = new MutationObserver(() => {
      if (modalCliente.classList.contains('hidden')) {
        salvarRascunhoCliente();
      }
    });
    observer.observe(modalCliente, { attributes: true, attributeFilter: ['class'] });
  }

  console.log("✅ Ivo Pita - Sistema pronto!");
});

// ============================================
// LIMPAR CARRINHO ANTIGO
// ============================================
(function limparCarrinhoAntigo() {
  try {
    const stored = localStorage.getItem("cart");
    if (!stored) return;
    const cartAntigo = JSON.parse(stored);
    const temFormatoAntigo = cartAntigo.some(
      (item) => /\d{13,}/.test(item.id) || /Math.random/.test(item.id)
    );
    if (temFormatoAntigo) {
      localStorage.removeItem("cart");
      console.log("🧹 Carrinho antigo limpo");
    }
  } catch (e) { }
})();

console.log("✅ Script Ivo Pita (sem banner) carregado!");
