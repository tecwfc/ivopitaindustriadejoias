// ============================================
// IVO PITA JOIAS - SCRIPT OTIMIZADO v2 (sem banner)
// ============================================

const PLANILHA_ID = "142Ir0-8yfUuu2sSbbRo8x6SwjeQL74MLMUpNElVn1rc";

const ESTOQUE_API_URL =
  "https://script.google.com/macros/s/AKfycbwtdqgkfRH8mXRFRCfSTYSkmvXWtp0xAmdW6Qd_j8hCCrPl5ynOMeyolSCzvtoON1yyWQ/exec";

const CACHE_KEY_DADOS = 'ivo_dados_v3';
const CACHE_KEY_TIME = 'ivo_dados_time_v3';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos (antes era 5)

const IMG_SIZE_CARD = 400;
const IMG_SIZE_MODAL = 600;
const IMG_SIZE_ZOOM = 1200;

let siteConfig = {
  whatsapp: "5588999049636",
  whatsappDisplay: "(88) 99904-9636",
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

const ESTOQUE_CACHE = new Map();
const ESTOQUE_CACHE_TTL = 5 * 1000; // 5 segundos

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

function normalizar(texto) {
  if (!texto) return "";
  return texto.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizarPalavraBusca(palavra) {
  return palavra.replace(/s$/, "").replace(/a$/, "").replace(/o$/, "").replace(/es$/, "").replace(/ns$/, "m");
}

function driveImg(url, size = IMG_SIZE_CARD) {
  if (!url || url === 'placeholder.png') return PLACEHOLDER_SVG;

  // Já é do Google Drive cacheado → força tamanho correto
  if (url.includes("googleusercontent.com")) {
    // Remove qualquer parâmetro de tamanho antigo e aplica o novo
    return url.replace(/=s\d+.*$/, `=s${size}`).replace(/=w\d+.*$/, `=s${size}`);
  }

  // Extrai ID do Google Drive
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    // ✅ "=s" força o Google a redimensionar de verdade (mais rápido que "=w")
    return `https://lh3.googleusercontent.com/u/0/d/${match[1]}=s${size}`;
  }

  if (url.startsWith("http")) return url;
  return PLACEHOLDER_SVG;
}
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
      const timeout = setTimeout(() => {
        delete window[cb];
        if (script && script.parentNode) script.parentNode.removeChild(script);
        reject(new Error('Timeout'));
      }, 12000);
      window[cb] = function (response) {
        clearTimeout(timeout);
        delete window[cb];
        if (script && script.parentNode) script.parentNode.removeChild(script);
        resolve(response);
      };
      script = document.createElement('script');
      script.src = `${ESTOQUE_API_URL}?callback=${cb}&_t=${Date.now()}`;
      script.onerror = () => {
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
    } catch (e) {}

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
  allProducts = (dados.produtos || []).filter(p => {
    const disp = String(p["Disponível"] || p.disponivel || '').toLowerCase().trim();
    return disp === 'sim';
  }).map(p => {
    if (!p["Saldo Estoque"] && p["Saldo Estoque"] !== 0) {
      p["Saldo Estoque"] = (parseInt(p.Estoque) || 0) - (parseInt(p.Vendidos) || 0);
    }
    return p;
  });

  console.log(`📦 ${allProducts.length} produtos disponíveis`);
  aplicarConfig(dados.config || {});
  renderizarMarquee(dados.marquee || []);

  if (dados.estrutura && Array.isArray(dados.estrutura) && dados.estrutura.length > 0) {
    estruturaCategorias = dados.estrutura;
    renderizarSidebarDinamica();
  }

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

// ============================================
// 🆕 SIDEBAR DINÂMICA
// ============================================
function renderizarSidebarDinamica() {
  const scroll = document.getElementById('sidebar-scroll');
  if (!scroll) return;

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
    console.log('ℹ️ Sem estrutura dinâmica — mantendo HTML estático');
    return;
  }

  const grupos = {};
  estruturaCategorias.forEach(item => {
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

  Object.keys(grupos).forEach(nomeGrupo => {
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

    const categoriasOrdenadas = Object.keys(grupos[nomeGrupo]).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    categoriasOrdenadas.forEach(nomeCategoria => {
      const subs = grupos[nomeGrupo][nomeCategoria];

      if (subs.length === 0) {
        const btn = document.createElement('button');
        btn.className = 'sidebar-item-sub';
        btn.setAttribute('type', 'button');
        btn.setAttribute('data-categoria', nomeCategoria.toLowerCase());
        btn.innerHTML = `<span>${nomeCategoria}</span>`;
        contentDiv.appendChild(btn);
        return;
      }

      const nomeCurto = nomeCategoria
        .replace(/\s+(dourado|dourada|dourados|douradas)\s*$/i, '')
        .replace(/\s+(prata|prateado|prateada|prateados|prateadas)\s*$/i, '')
        .trim();

      if (subs.length === 1 && subs[0].toLowerCase() === nomeCurto.toLowerCase()) {
        const btn = document.createElement('button');
        btn.className = 'sidebar-item-sub';
        btn.setAttribute('type', 'button');
        btn.setAttribute('data-categoria', nomeCategoria.toLowerCase());
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

      subs.forEach(sub => {
        const btn = document.createElement('button');
        btn.className = 'sidebar-item-sub';
        btn.setAttribute('type', 'button');
        btn.setAttribute('data-categoria', (nomeCategoria + ' ' + sub).toLowerCase());
        btn.innerHTML = `<span>${sub}</span>`;
        subContent.appendChild(btn);
      });

      subDiv.appendChild(subContent);
      contentDiv.appendChild(subDiv);
    });

    groupDiv.appendChild(contentDiv);
    scroll.appendChild(groupDiv);
  });

  sidebarDinamicaAtiva = true;
  rebindSidebarEvents();

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
  document.querySelectorAll('.sidebar-item, .sidebar-item-sub').forEach(el => {
    el.classList.remove('sidebar-item-active', 'active');
  });

  if (categoria === 'todos') {
    const el = document.querySelector('.sidebar-item[data-categoria="todos"]');
    if (el) el.classList.add('sidebar-item-active');
    return;
  }

  const el = document.querySelector(`.sidebar-item-sub[data-categoria="${categoria}"]`);
  if (el) el.classList.add('active');
}

// ============================================
// ATUALIZAR CONTADOR DE PRODUTOS (HEADER)
// ============================================
function atualizarContadorProdutos() {
  const countEl = document.getElementById('products-count');
  if (countEl) {
    const total = document.querySelectorAll('#produtos-container .product-card').length;
    countEl.textContent = `${total} produto${total !== 1 ? 's' : ''}`;
  }
}

// ============================================
// ATUALIZAR CONTADORES NA SIDEBAR
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

// ============================================
// CONTAR PRODUTOS DE UMA CATEGORIA
// ============================================
function contarProdutosPorCategoria(categoria) {
  if (!allProducts || allProducts.length === 0) return 0;

  const catFiltro = normalizar(categoria);
  const palavrasFiltro = catFiltro.split(/\s+/).filter((p) => p.length > 0);
  const palavrasFiltroNorm = palavrasFiltro.map(normalizarPalavraBusca);

  return allProducts.filter((p) => {
    const catProduto = normalizar(p["Categoria"] || "");
    const subcatProduto = normalizar(p["Subcategoria"] || "");
    const nomeProduto = normalizar(p["Nome do Produto"] || "");
    const refProduto = normalizar(p["referencia"] || "");
    const combinado = catProduto + " " + subcatProduto + " " + nomeProduto + " " + refProduto;
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
// FUNÇÕES DO MODAL DE CORES
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
// CARRINHO
// ============================================
function updateCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
  const cartCount = document.getElementById("cart-count");
  if (cartCount) cartCount.innerText = cart.length;

  const container = document.getElementById("cart-items");
  if (!container) return;
  container.innerHTML = "";
  subtotal = 0;

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty-state">
        <div class="cart-empty-icon"><i class="fas fa-shopping-bag"></i></div>
        <p class="cart-empty-title">Sua sacola está vazia</p>
        <p class="cart-empty-subtitle">Adicione produtos para começar</p>
      </div>`;
  } else {
    cart.forEach((item) => {
      subtotal += item.price;
      const precoUnitario = item.price / item.quantity;
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
              <button onclick="changeQty('${item.id}', -1)" class="cart-qty-btn"><i class="fas fa-minus"></i></button>
              <span class="cart-qty-value">${item.quantity}</span>
              <button onclick="changeQty('${item.id}', 1)" class="cart-qty-btn"><i class="fas fa-plus"></i></button>
            </div>
            <button onclick="removeCartItem('${item.id}')" class="cart-item-remove"><i class="fas fa-trash-alt"></i></button>
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
    if (text) text.innerHTML = `Faltam R$ ${falta.toFixed(2).replace(".", ",")} para frete grátis`;
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

  // ✅ SEMPRE recalcula do preço unitário original (evita arredondamento)
  item.price = item.precoUnitario * item.quantity;
  updateCart();
};


// ✅ NOVA FUNÇÃO: Valida o carrinho antes de abrir/renderizar
async function validarCarrinho() {
  if (cart.length === 0) return;

  const ids = [...new Set(cart.map(i => i.baseId))];
  const produtosDesatualizados = [];

  // Verifica em paralelo para não travar
  const checks = await Promise.all(
    ids.map(async (id) => {
      const resp = await verificarEstoqueServidor(id);
      return { id, resp };
    })
  );

  for (const { id, resp } of checks) {
    // Se falhou ou saldo é 0, mas o produto está no carrinho, remove
    if (resp && resp.success) {
      const quantidadeNoCart = quantidadeNoCarrinho(id);
      const saldoServidor = parseInt(resp.saldo) || 0;

      if (saldoServidor <= 0) {
        produtosDesatualizados.push({ id, motivo: 'esgotado' });
      } else if (quantidadeNoCart > saldoServidor) {
        // Ajusta para o máximo disponível
        produtosDesatualizados.push({ id, motivo: 'ajustar', saldo: saldoServidor });
      }
    }
  }

  if (produtosDesatualizados.length === 0) return;

  produtosDesatualizados.forEach(item => {
    if (item.motivo === 'esgotado') {
      cart = cart.filter(i => String(i.baseId) !== String(item.id));
    } else if (item.motivo === 'ajustar') {
      // Reduz a quantidade para o máximo disponível
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
      precoUnitario: price / qty // ✅ Guarda o preço unitário original
    });
  }

  invalidarEstoqueCache(); // ✅ Força refetch do estoque
  showToast(`✅ ${name.substring(0, 30)} adicionado!`, "success", 2000);
  updateCart();

  // ✅ NOVO: Feedback visual no botão
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

    // Badge de estoque
    let stockBadge = "";
    if (estoque <= 0) {
      stockBadge = `<span class="stock-out"><i class="fas fa-times-circle"></i> Indisponível</span>`;
    } else if (estoque <= 3) {
      stockBadge = `<span class="stock-low"><i class="fas fa-exclamation-triangle"></i> Últimas ${estoque}!</span>`;
    } else {
      stockBadge = `<span class="stock-available"><i class="fas fa-check-circle"></i> ${estoque} disponíveis</span>`;
    }

    // Botão
    const nomeEscapado = nome.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const refEscapada = referencia.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const imgEscapada = imagem.replace(/"/g, "&quot;");

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

    // Categoria + Subcategoria mostra os dois
    // let categoriaHTML = "";
    // if (categoria || subcategoria) {
    //   const partes = [];
    //   if (categoria) partes.push(categoria);
    //   if (subcategoria) partes.push(subcategoria);
    //   categoriaHTML = `<p class="product-card-category">${partes.join(" • ")}</p>`;
    // }
    // ---------- CATEGORIA (oculta via CSS) ----------
      let categoriaHTML = "";
      if (categoria) {
        categoriaHTML = `<p class="product-card-category">${categoria}</p>`;
      }

      // ---------- SUBCATEGORIA (visível) ----------
      let subcategoriaHTML = "";
      if (subcategoria) {
        subcategoriaHTML = `<p class="product-card-subcategory">${subcategoria}</p>`;
      }

    // Referência
    const refHTML = referencia
      ? `<p class="product-card-ref">REF: ${referencia}</p>`
      : "";

    // ⚡ PRIMEIRAS 5 IMAGENS: carregam imediatamente (LCP rápido)
    // ⚡ RESTO: lazy load com IntersectionObserver
    const isPriority = index < 5;
    const imgSrc = driveImg(imagem, IMG_SIZE_CARD);

    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-card-image">
        <img
          ${isPriority ? `src="${imgSrc}"` : `data-src="${imgSrc}" src="${PLACEHOLDER_SVG}"`}
          alt="${nome}"
          loading="${isPriority ? 'eager' : 'lazy'}"
          decoding="async"
          fetchpriority="${isPriority ? 'high' : 'low'}"
          width="400"
          height="400"
          class="product-card-img"
          onerror="this.onerror=null; this.src='${PLACEHOLDER_SVG}'"
          onclick="abrirZoomDireto('${imgEscapada}')"
        >
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

  // ⚡ Ativa lazy loading para as imagens com data-src
  ativarLazyLoading();

  setTimeout(atualizarContadorProdutos, 100);
}

// ============================================
// LAZY LOADING COM INTERSECTION OBSERVER
// ============================================
let lazyObserver = null;

function ativarLazyLoading() {
  // Se o navegador não suporta, carrega tudo de uma vez
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
    return;
  }

  // Cria o observer só uma vez
  if (!lazyObserver) {
    lazyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = img.dataset.src;
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
          }
          lazyObserver.unobserve(img);
        }
      });
    }, {
      rootMargin: '300px 0px', // começa a carregar 300px antes de aparecer
      threshold: 0.01
    });
  }

  // Observa todas as imagens com data-src
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
function aplicarConfig(cfg) {
  if (!cfg || typeof cfg !== "object") return;

  siteConfig = Object.assign({}, siteConfig, cfg);

  if (cfg.freteGratisValor) FRETE_GRATIS_VALOR = parseFloat(cfg.freteGratisValor) || 3500;
  if (cfg.taxaFrete) TAXA_FRETE = parseFloat(cfg.taxaFrete) || 15;

  const whatsNumero = String(cfg.whatsapp || siteConfig.whatsapp).replace(/\D/g, "");
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
// ZOOM COM LUPA (2 NÍVEIS)
// ============================================
let zoomScale = 1;
let zoomPositionX = 0;
let zoomPositionY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

const ZOOM_MIN = 1;
const ZOOM_MAX = 5;

function abrirZoomDireto(imagem) {
  const modal = document.getElementById("image-zoom-modal");
  const img = document.getElementById("zoom-image");
  const thumbnails = document.getElementById("zoom-thumbnails");
  if (!modal || !img || !thumbnails) return;

  const imagemExibir = driveImg(imagem, IMG_SIZE_ZOOM);
  imagensZoom = [imagemExibir];
  zoomIndex = 0;
  zoomScale = 1;
  zoomPositionX = 0;
  zoomPositionY = 0;

  img.src = imagensZoom[zoomIndex];
  img.style.transform = 'scale(1) translate(0, 0)';
  img.classList.remove('zoomed');
  modal.classList.remove('zoomed-active');

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

  // Clique na imagem → alterna zoom
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

  // Duplo clique → resetar
  newImg.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    resetZoom();
  });

  // Arrastar quando estiver com zoom
  newImg.addEventListener('mousedown', (e) => {
    if (zoomScale <= 1) return;
    e.preventDefault();
    isDragging = true;
    dragStartX = e.clientX - zoomPositionX;
    dragStartY = e.clientY - zoomPositionY;
  });

  // Roda do mouse → zoom gradual
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

  // Movimento global (mouse sai da imagem)
    // Antes de adicionar, remover os antigos
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

  // Touch (mobile)
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
  // ✅ Captura o botão que disparou (se veio de um evento)
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
    buttonElement: buttonElement // ✅ Guarda o botão
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
  const nomeCliente = document.getElementById("customer-name").value || "Não informado";
  const endereco = document.getElementById("address").value || "Não informado";
  const dataAtual = new Date().toLocaleDateString("pt-BR");
  const horaAtual = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const totalFinal = subtotal >= FRETE_GRATIS_VALOR ? subtotal : subtotal + TAXA_FRETE;
  const freteTexto = subtotal >= FRETE_GRATIS_VALOR ? "Grátis" : `R$ ${TAXA_FRETE.toFixed(2).replace(".", ",")}`;

  const numeroPedido = String(Date.now()).slice(-6);
  const anoAtual = new Date().getFullYear();

  let itensHTML = "";
  let totalItens = 0;
  cart.forEach((item, index) => {
    const precoUnitario = item.price / item.quantity;
    totalItens += item.quantity;
    itensHTML += `
      <tr>
        <td style="padding: 8px 6px; text-align: center; font-size: 9px; color: #6b7280; border-bottom: 1px solid #f0f0f0; vertical-align: middle;">${String(index + 1).padStart(2, '0')}</td>
        <td style="padding: 8px 6px; border-bottom: 1px solid #f0f0f0; vertical-align: middle;">
          <div style="font-size: 10px; font-weight: 600; color: #182420; line-height: 1.35;">${item.name}</div>
          ${item.ref ? `<div style="font-size: 9px; color: #182420; margin-top: 3px; font-weight: 600; letter-spacing: 0.02em;">REF. ${item.ref}</div>` : ""}
        </td>
        <td style="padding: 8px 6px; text-align: center; font-size: 10px; color: #182420; border-bottom: 1px solid #f0f0f0; vertical-align: middle;">${item.quantity}</td>
        <td style="padding: 8px 6px; text-align: right; font-size: 10px; color: #6b7280; border-bottom: 1px solid #f0f0f0; vertical-align: middle;">R$ ${precoUnitario.toFixed(2).replace(".", ",")}</td>
        <td style="padding: 8px 6px; text-align: right; font-size: 10px; font-weight: 700; color: #1f4d38; border-bottom: 1px solid #f0f0f0; vertical-align: middle;">R$ ${item.price.toFixed(2).replace(".", ",")}</td>
      </tr>`;
  });

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
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 18px;">
          <div>
            <div style="font-size: 8px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 4px;">Cliente</div>
            <div style="font-size: 11px; font-weight: 600; color: #182420; line-height: 1.35;">${nomeCliente}</div>
          </div>
          <div>
            <div style="font-size: 8px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 4px;">Endereço de entrega</div>
            <div style="font-size: 10px; color: #4b5563; line-height: 1.45;">${endereco}</div>
          </div>
        </div>
        <div style="margin-bottom: 16px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 1.5px solid #1f4d38;">
                <th style="padding: 8px 6px; font-size: 8px; font-weight: 700; color: #1f4d38; text-transform: uppercase; letter-spacing: 0.12em; text-align: center; width: 40px;">Item</th>
                <th style="padding: 8px 6px; font-size: 8px; font-weight: 700; color: #1f4d38; text-transform: uppercase; letter-spacing: 0.12em; text-align: left;">Descrição</th>
                <th style="padding: 8px 6px; font-size: 8px; font-weight: 700; color: #1f4d38; text-transform: uppercase; letter-spacing: 0.12em; text-align: center; width: 50px;">Qtd</th>
                <th style="padding: 8px 6px; font-size: 8px; font-weight: 700; color: #1f4d38; text-transform: uppercase; letter-spacing: 0.12em; text-align: right; width: 85px;">Valor unit.</th>
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
  if (!document.getElementById("customer-name").value.trim()) {
    showToast("Informe seu nome!", "error", 2000);
    return;
  }
  if (!document.getElementById("address").value.trim()) {
    showToast("Informe o endereço!", "error", 2000);
    return;
  }

  // Carrega as libs só agora
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
async function processarPedidoPublico(nomeCliente, endereco) {
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
async function downloadPDF() {
  let element = document.getElementById("pdf-content-to-print");
  if (!element) {
    await visualizarPDF();
    setTimeout(() => downloadPDF(), 500);
    return;
  }

  const nomeCliente = document.getElementById("customer-name").value.trim();
  const endereco = document.getElementById("address").value.trim();

  if (cart.length === 0) { showToast("Sacola vazia!", "error", 2000); return; }
  if (!nomeCliente) { showToast("Informe seu nome!", "error", 2000); return; }
  if (!endereco) { showToast("Informe o endereço!", "error", 2000); return; }

  const btn = document.getElementById("download-pdf-btn");
  const original = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
  }

  showToast("Gerando PDF...", "info", 2000);

  try {
    // Garante que as libs estão carregadas
    await carregarLibsPDF();

    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    const canvas = await html2canvas(element, {
      scale: 2, // reduzido de 3 para 2 (mais rápido e menor arquivo)
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.85); // JPEG em vez de PNG (muito mais leve)

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

    const resultado = await processarPedidoPublico(nomeCliente, endereco);

    if (!resultado || !resultado.success) {
      throw new Error((resultado && resultado.error) || "Erro ao salvar pedido");
    }

    cart = [];
    updateCart();
    document.getElementById("customer-name").value = "";
    document.getElementById("address").value = "";

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
// FINALIZAR PEDIDO VIA WHATSAPP
// ============================================
async function finalizarPedidoDireto() {
  const nomeCliente = document.getElementById("customer-name").value;
  const endereco = document.getElementById("address").value;

  if (cart.length === 0) { showToast("Sacola vazia!", "error", 2000); return; }
  if (!nomeCliente.trim()) {
    showToast("Informe seu nome!", "error", 2000);
    document.getElementById("customer-name").focus();
    return;
  }
  if (!endereco.trim()) {
    showToast("Informe o endereço!", "error", 2000);
    document.getElementById("address").focus();
    return;
  }

  // ✅ NOVO: Valida estoque antes de tentar finalizar
  showToast("Validando estoque...", "info", 1500);
  await validarCarrinho();

  if (cart.length === 0) {
    showToast("Seu carrinho ficou vazio (itens esgotaram).", "error", 3000);
    return;
  }

  const checkoutBtn = document.getElementById("checkout-btn");
  if (checkoutBtn) {
    checkoutBtn.disabled = true;
    checkoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
  }

  try {
    const totalFinal = subtotal >= FRETE_GRATIS_VALOR ? subtotal : subtotal + TAXA_FRETE;
    const freteExibicao = subtotal >= FRETE_GRATIS_VALOR ? "GRÁTIS" : `R$ ${TAXA_FRETE.toFixed(2).replace(".", ",")}`;

    const resultado = await processarPedidoPublico(nomeCliente, endereco);

    if (!resultado || !resultado.success) {
      const erro = (resultado && resultado.error) || "Erro ao salvar pedido";

      // ✅ NOVO: Tratamento específico para erro de estoque
      if (erro.toLowerCase().includes("estoque insuficiente") ||
          erro.toLowerCase().includes("não encontrado")) {
        showToast("⚠️ Um item esgotou enquanto você finalizava. Atualizando...", "warning", 5000);

        invalidarEstoqueCache();
        localStorage.removeItem(CACHE_KEY_DADOS);

        setTimeout(async () => {
          await carregarTudo();
          await validarCarrinho();
          // Reabre o carrinho
          document.getElementById("cart-modal")?.classList.remove("hidden");
          document.getElementById("cart-modal")?.classList.add("flex");
        }, 1500);

        throw new Error("Estoque desatualizado — revise seu carrinho");
      }

      throw new Error(erro);
    }

    const mensagemWhats = `🛍️ *NOVO PEDIDO - IVO PITA* 🛍️\n\n👤 *CLIENTE:* ${nomeCliente.toUpperCase()}\n📍 *ENDEREÇO:* ${endereco}\n\n*📦 ITENS DO PEDIDO:*\n${cart.map((i) => `✅ ${i.quantity}x ${i.name}${i.ref ? ` (Ref: ${i.ref})` : ""} - R$ ${(i.price / i.quantity).toFixed(2).replace(".", ",")} cada`).join("\n")}\n\n*💰 RESUMO DO PEDIDO:*\n─────────────────\nSubtotal: R$ ${subtotal.toFixed(2).replace(".", ",")}\nFrete: ${freteExibicao}\n─────────────────\n*TOTAL: R$ ${totalFinal.toFixed(2).replace(".", ",")}*\n─────────────────\n\n✨ *Obrigado pela preferência!*`;

    const numeroWhats = window.__whatsappNumero || String(siteConfig.whatsapp).replace(/\D/g, "") || "5588999049636";

    // ✅ NOVO: Guarda timestamp do último pedido (evita duplicidade acidental)
    localStorage.setItem("ultimo_pedido_ts", Date.now().toString());

    cart = [];
    updateCart();
    document.getElementById("customer-name").value = "";
    document.getElementById("address").value = "";
    document.getElementById("cart-modal")?.classList.add("hidden");
    document.getElementById("cart-modal")?.classList.remove("flex");

    window.open(`https://wa.me/${numeroWhats}?text=${encodeURIComponent(mensagemWhats)}`, "_blank");

    showToast("✅ Pedido enviado e estoque atualizado!", "success", 4000);

    invalidarEstoqueCache();
    localStorage.removeItem(CACHE_KEY_DADOS);
    carregarTudo();

  } catch (error) {
    console.error("❌ Erro:", error);
    showToast("❌ " + error.message, "error", 5000);
  } finally {
    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Finalizar';
    }
  }
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
          const nomeProduto = normalizar(p["Nome do Produto"] || "");
          const refProduto = normalizar(p["referencia"] || "");
          const combinado = catProduto + " " + subcatProduto + " " + nomeProduto + " " + refProduto;
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
  console.log("🚀 Ivo Pita - Inicializando (versão otimizada)...");

  // ⚡ UMA única chamada que traz TUDO
  carregarTudo();
  updateCart();

  // Event listeners
  document.getElementById('sidebar-open-btn')?.addEventListener('click', abrirSidebarMobile);
  document.getElementById('sidebar-close-mobile')?.addEventListener('click', fecharSidebarMobile);
  document.getElementById('sidebar-overlay')?.addEventListener('click', fecharSidebarMobile);

  // Sidebar estática (fallback — sempre ativa)
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

 // ✅ MODIFICADO: Valida o carrinho ao abrir
document.getElementById("cart-btn")?.addEventListener("click", async () => {
  document.getElementById("cart-modal")?.classList.remove("hidden");
  document.getElementById("cart-modal")?.classList.add("flex");

  // Valida em background (não trava a abertura do modal)
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

  document.getElementById("mobile-menu-btn")?.addEventListener("click", () => {
    abrirSidebarMobile();
  });

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

  console.log("✅ Ivo Pita - Sistema pronto!");
});

// Limpar carrinho antigo
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
  } catch (e) {}
})();

console.log("✅ Script Ivo Pita (sem banner) carregado!");
