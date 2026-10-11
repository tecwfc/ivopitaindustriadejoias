// ============================================
// WR AROMATIZANTES - SCRIPT PRINCIPAL v2
// (SEM: referência, subcategoria, cores, tamanhos, destaque)
// ============================================

const ESTOQUE_API_URL = "https://script.google.com/macros/s/AKfycbz54JYWtZOJOVJtPWLxydLrrn6h18NKCdYb90LT_UGHMnzUKc98kVX8QVI-Wvw4rQJj/exec";

const CACHE_KEY_DADOS = 'wr_dados_v1';
const CACHE_KEY_TIME = 'wr_dados_time_v1';
const CACHE_TTL_MS = 15 * 60 * 1000;

const IMG_SIZE_CARD = 400;
const IMG_SIZE_MODAL = 600;
const IMG_SIZE_ZOOM = 1200;

let siteConfig = {
  whatsapp: "5588999049636",
  whatsappDisplay: "(88) 99904-9636",
  email: "contato@wraromatizantes.com.br",
  endereco: "Juazeiro do Norte, CE",
  telefone: "(88) 99904-9636",
  sobreTexto: "A WR Aromatizantes nasceu para levar o cheirinho mais querido do Brasil para casas, carros e escritórios.",
  freteGratisValor: 100,
  taxaFrete: 5,
  pixDesconto: 5,
};

let FRETE_GRATIS_VALOR = 100;
let TAXA_FRETE = 5;

const PLACEHOLDER_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#faf8ff"/>
  <rect x="20" y="20" width="360" height="360" fill="none" stroke="#6d28d9" stroke-width="2" stroke-dasharray="8,6" rx="20"/>
  <text x="200" y="210" font-family="Plus Jakarta Sans, Arial, sans-serif" font-size="16" font-weight="700" fill="#6d28d9" text-anchor="middle">SEM IMAGEM</text>
  <text x="200" y="235" font-family="Plus Jakarta Sans, Arial, sans-serif" font-size="11" fill="#6b7280" text-anchor="middle">WR Aromatizantes</text>
</svg>
`)}`;

window.PLACEHOLDER_SVG = PLACEHOLDER_SVG;

let allProducts = [];
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let tempProduct = null;
let subtotal = 0;
let imagensZoom = [];
let zoomIndex = 0;

const ESTOQUE_CACHE = new Map();
const ESTOQUE_CACHE_TTL = 30 * 1000;

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
    success: 'linear-gradient(135deg, #6d28d9, #4c1d95)',
    error: '#ef4444', warning: '#f59e0b', info: '#3b82f6'
  };
  Toastify({
    text: texto, duration: duracao, gravity: 'top', position: 'right', stopOnFocus: true,
    style: {
      background: cores[tipo] || cores.success, borderRadius: '14px', fontWeight: '700',
      fontSize: '13px', padding: '14px 20px',
      boxShadow: '0 10px 30px rgba(109, 40, 217, 0.25)', maxWidth: '340px'
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

  if (url.includes("googleusercontent.com")) {
    return url.replace(/=s\d+.*$/, `=s${size}`).replace(/=w\d+.*$/, `=s${size}`);
  }

  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
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
      const cb = 'wr_load_' + Date.now();
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

  if (allProducts.length === 0) {
    const container = document.getElementById("produtos-container");
    if (container) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12">
          <i class="fas fa-spray-can text-4xl text-primary/30 mb-4"></i>
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
// SIDEBAR
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
// CONTADORES
// ============================================
function atualizarContadorProdutos() {
  const countEl = document.getElementById('products-count');
  if (countEl) {
    const total = document.querySelectorAll('#produtos-container .product-card').length;
    countEl.textContent = `${total} produto${total !== 1 ? 's' : ''}`;
  }
}

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
}

function contarProdutosPorCategoria(categoria) {
  if (!allProducts || allProducts.length === 0) return 0;

  const catFiltro = normalizar(categoria);
  const palavrasFiltro = catFiltro.split(/\s+/).filter((p) => p.length > 0);
  const palavrasFiltroNorm = palavrasFiltro.map(normalizarPalavraBusca);

  return allProducts.filter((p) => {
    const catProduto = normalizar(p["Categoria"] || "");
    const nomeProduto = normalizar(p["Nome do Produto"] || "");
    const combinado = catProduto + " " + nomeProduto;
    const combinadoNorm = combinado.split(/\s+/).map(normalizarPalavraBusca).join(" ");
    return palavrasFiltroNorm.every((palavra) => combinadoNorm.includes(palavra));
  }).length;
}

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
// MODAL DE QUANTIDADE (SEM CORES)
// ============================================
function resetarModalUI() {
  const inputCustom = document.getElementById("custom-quantity");
  if (inputCustom) inputCustom.value = 1;

  document.querySelectorAll(".qty-option-btn").forEach((btn) => btn.classList.remove("selected"));
}
window.resetarModalUI = resetarModalUI;

function adicionarSemCor(quantidade) {
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

  addToCart(uniqueId, tempProduct.name, totalPrice, tempProduct.img, tempProduct.id, quantidade);
  window.closeSizeModal();
}
window.adicionarSemCor = adicionarSemCor;

function confirmarSelecao() {
  const inputCustom = document.getElementById("custom-quantity");
  let qtd = parseInt(inputCustom?.value) || 0;
  if (!qtd || qtd <= 0) {
    showToast("Digite uma quantidade válida", "error", 2000);
    return;
  }
  window.adicionarSemCor(qtd);
}
window.confirmarSelecao = confirmarSelecao;

window.closeSizeModal = function () {
  const modal = document.getElementById("size-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
  tempProduct = null;

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
  const precoUnitario = item.price / item.quantity;
  if (delta > 0) {
    item.quantity++;
    item.price = precoUnitario * item.quantity;
  } else {
    if (item.quantity > 1) {
      item.quantity--;
      item.price = precoUnitario * item.quantity;
    } else {
      cart = cart.filter((i) => i.id !== id);
    }
  }
  updateCart();
};

function addToCart(id, name, price, img, baseId, quantity) {
  const qty = quantity || 1;
  const existing = cart.find((i) => i.id === id);

  if (existing) {
    existing.quantity += qty;
    existing.price += price;
  } else {
    cart.push({ id, name, price, img, quantity: qty, baseId });
  }

  showToast(`✅ ${name.substring(0, 30)} adicionado!`, "success", 2000);
  updateCart();
}

// ============================================
// RENDERIZAR PRODUTOS (SEM REF/SUBCAT/CAT)
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
    const preco = parseFloat(p["Preço"]) || 0;
    const nome = p["Nome do Produto"] || "Produto sem nome";
    const imagem = p["Imagem"] || "";

    let stockBadge = "";
    if (estoque <= 0) {
      stockBadge = `<span class="stock-out"><i class="fas fa-times-circle"></i> Indisponível</span>`;
    } else if (estoque <= 3) {
      stockBadge = `<span class="stock-low"><i class="fas fa-exclamation-triangle"></i> Últimas ${estoque}!</span>`;
    } else {
      stockBadge = `<span class="stock-available"><i class="fas fa-check-circle"></i> ${estoque} disponíveis</span>`;
    }

    const nomeEscapado = nome.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const imgEscapada = imagem.replace(/"/g, "&quot;");

    let botaoHTML = "";
    if (estoque <= 0) {
      botaoHTML = `<button disabled class="product-card-btn-disabled">Indisponível</button>`;
    } else {
      botaoHTML = `<button onclick='openSizeSelector("${p["ID"]}", "${nomeEscapado}", ${preco}, "${imgEscapada}")' class="product-card-btn product-card-btn-direct">
        <i class="fas fa-cart-plus"></i> Adicionar
      </button>`;
    }

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
        <p class="product-card-price">R$ ${preco.toFixed(2).replace(".", ",")}</p>
        <div class="product-card-stock">${stockBadge}</div>
        ${botaoHTML}
      </div>
    `;

    fragment.appendChild(card);
  });

  container.appendChild(fragment);
  ativarLazyLoading();
  setTimeout(atualizarContadorProdutos, 100);
}

// ============================================
// LAZY LOADING
// ============================================
let lazyObserver = null;

function ativarLazyLoading() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
    return;
  }

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
      rootMargin: '300px 0px',
      threshold: 0.01
    });
  }

  document.querySelectorAll('img[data-src]').forEach(img => {
    lazyObserver.observe(img);
  });
}

// ============================================
// MARQUEE
// ============================================
function renderizarMarquee(items) {
  const track = document.getElementById("marquee-track");
  if (!track) return;

  if (!items || items.length === 0) {
    items = [
      { texto: "Frete Grátis acima de R$ 100", icone: "fa-solid fa-truck-fast", cor: "dourado" },
      { texto: "Enviamos para todo o Cariri", icone: "fa-solid fa-location-dot", cor: "branco" },
      { texto: "Fragrâncias de Luxo", icone: "fa-solid fa-crown", cor: "dourado" },
      { texto: "5% OFF no PIX", icone: "fa-solid fa-percent", cor: "branco" },
      { texto: "@wraromatizantes", icone: "fa-brands fa-instagram", cor: "dourado" },
      { texto: "O Cheirinho Mais Querido do Brasil", icone: "fa-solid fa-star", cor: "branco" },
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

  if (cfg.freteGratisValor) FRETE_GRATIS_VALOR = parseFloat(cfg.freteGratisValor) || 100;
  if (cfg.taxaFrete) TAXA_FRETE = parseFloat(cfg.taxaFrete) || 5;

  const whatsNumero = String(cfg.whatsapp || siteConfig.whatsapp).replace(/\D/g, "");
  const whatsLink = `https://wa.me/${whatsNumero}`;

  document.querySelectorAll('a[href*="wa.me"]').forEach((a) => {
    a.href = whatsLink;
  });

  const instaUser = String(cfg.instagram || siteConfig.instagram || '').replace("@", "");
  document.querySelectorAll('a[href*="instagram.com"]').forEach((a) => {
    a.href = `https://www.instagram.com/${instaUser}`;
  });

  window.__whatsappNumero = whatsNumero;
}
window.aplicarConfig = aplicarConfig;

// ============================================
// ZOOM
// ============================================
function abrirZoomDireto(imagem) {
  const modal = document.getElementById("image-zoom-modal");
  const img = document.getElementById("zoom-image");
  const thumbnails = document.getElementById("zoom-thumbnails");
  if (!modal || !img || !thumbnails) return;

  const imagemExibir = driveImg(imagem, IMG_SIZE_ZOOM);
  imagensZoom = [imagemExibir];
  zoomIndex = 0;

  img.src = imagensZoom[zoomIndex];
  img.onerror = function () {
    this.onerror = null;
    this.src = PLACEHOLDER_SVG;
  };

  thumbnails.innerHTML = "";
  imagensZoom.forEach((src, i) => {
    const thumb = document.createElement("img");
    thumb.src = src;
    thumb.className = `thumbnail-image ${i === zoomIndex ? "active" : ""}`;
    thumb.onclick = function () {
      zoomIndex = i;
      document.getElementById("zoom-image").src = imagensZoom[i];
      document.querySelectorAll("#zoom-thumbnails .thumbnail-image").forEach((t, idx) => {
        t.classList.toggle("active", idx === i);
      });
    };
    thumbnails.appendChild(thumb);
  });

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function fecharZoom() {
  const modal = document.getElementById("image-zoom-modal");
  if (modal) modal.classList.remove("active");
  document.body.style.overflow = "";
}

function zoomAnterior() {
  if (imagensZoom.length === 0) return;
  zoomIndex = (zoomIndex - 1 + imagensZoom.length) % imagensZoom.length;
  document.getElementById("zoom-image").src = imagensZoom[zoomIndex];
  document.querySelectorAll("#zoom-thumbnails .thumbnail-image").forEach((t, i) => {
    t.classList.toggle("active", i === zoomIndex);
  });
}

function zoomProximo() {
  if (imagensZoom.length === 0) return;
  zoomIndex = (zoomIndex + 1) % imagensZoom.length;
  document.getElementById("zoom-image").src = imagensZoom[zoomIndex];
  document.querySelectorAll("#zoom-thumbnails .thumbnail-image").forEach((t, i) => {
    t.classList.toggle("active", i === zoomIndex);
  });
}

window.fecharZoom = fecharZoom;
window.zoomAnterior = zoomAnterior;
window.zoomProximo = zoomProximo;
window.abrirZoomDireto = abrirZoomDireto;

// ============================================
// OPEN SIZE SELECTOR (SÓ QUANTIDADE)
// ============================================
window.openSizeSelector = function (id, name, price, img) {
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
    id: p["ID"], name: name, price: priceNum, img: img,
    estoqueDisponivel: estoqueDisponivel
  };

  const nameEl = document.getElementById("size-product-name");
  const refEl = document.getElementById("size-product-ref");
  const priceEl = document.getElementById("size-product-price");

  if (nameEl) nameEl.innerText = name;
  if (refEl) refEl.style.display = "none"; // 🚫 Sem referência
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
      abrirZoomDireto(p["Imagem"]);
    };
  }

  // 🚫 Cores removidas — sempre esconde
  const colorStep = document.getElementById("color-step");
  const summaryContainer = document.getElementById("selection-summary");
  if (colorStep) colorStep.classList.add("hidden");
  if (summaryContainer) summaryContainer.classList.add("hidden");

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
      window.adicionarSemCor(qtd);
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
// BUSCA (SÓ POR NOME)
// ============================================
function performSearch(termo) {
  const termoNormalizado = normalizar(termo);
  const filtrados = allProducts.filter(
    (p) => normalizar(p["Nome do Produto"]).includes(termoNormalizado)
  );
  renderProducts(filtrados);
}

// ============================================
// PDF (SEM REF)
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
          <div style="font-size: 10px; font-weight: 600; color: #1a1a2e; line-height: 1.35;">${item.name}</div>
        </td>
        <td style="padding: 8px 6px; text-align: center; font-size: 10px; color: #1a1a2e; border-bottom: 1px solid #f0f0f0; vertical-align: middle;">${item.quantity}</td>
        <td style="padding: 8px 6px; text-align: right; font-size: 10px; color: #6b7280; border-bottom: 1px solid #f0f0f0; vertical-align: middle;">R$ ${precoUnitario.toFixed(2).replace(".", ",")}</td>
        <td style="padding: 8px 6px; text-align: right; font-size: 10px; font-weight: 700; color: #6d28d9; border-bottom: 1px solid #f0f0f0; vertical-align: middle;">R$ ${item.price.toFixed(2).replace(".", ",")}</td>
      </tr>`;
  });

  return `
  <div class="pdf-preview-content" id="pdf-content-to-print" style="
    width: 210mm;
    min-height: 297mm;
    padding: 0;
    background: #ffffff;
    font-family: 'Plus Jakarta Sans', Arial, sans-serif;
    box-sizing: border-box;
    color: #1a1a2e;
    display: flex;
    flex-direction: column;
    position: relative;
  ">
    <div style="height: 4px; background: linear-gradient(90deg, #6d28d9 0%, #f59e0b 100%);"></div>
    <div style="flex: 1; padding: 6mm 2mm 6mm 2mm; display: flex; flex-direction: column;">
      <div style="flex: 1; padding: 0 6mm; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb; margin-bottom: 18px;">
          <div>
            <div style="font-size: 22px; font-weight: 800; color: #6d28d9; letter-spacing: 0.02em; line-height: 1;">WR AROMATIZANTES</div>
            <div style="font-size: 8px; font-weight: 600; color: #9ca3af; letter-spacing: 0.25em; text-transform: uppercase; margin-top: 3px;">O cheirinho mais querido do Brasil</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 8px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 2px;">Pedido nº</div>
            <div style="font-size: 12px; font-weight: 700; color: #6d28d9; letter-spacing: 0.03em;">#${anoAtual}-${numeroPedido}</div>
            <div style="font-size: 9px; color: #9ca3af; margin-top: 3px;">${dataAtual} · ${horaAtual}</div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 18px;">
          <div>
            <div style="font-size: 8px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 4px;">Cliente</div>
            <div style="font-size: 11px; font-weight: 600; color: #1a1a2e; line-height: 1.35;">${nomeCliente}</div>
          </div>
          <div>
            <div style="font-size: 8px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 4px;">Endereço de entrega</div>
            <div style="font-size: 10px; color: #4b5563; line-height: 1.45;">${endereco}</div>
          </div>
        </div>
        <div style="margin-bottom: 16px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 1.5px solid #6d28d9;">
                <th style="padding: 8px 6px; font-size: 8px; font-weight: 700; color: #6d28d9; text-transform: uppercase; letter-spacing: 0.12em; text-align: center; width: 40px;">Item</th>
                <th style="padding: 8px 6px; font-size: 8px; font-weight: 700; color: #6d28d9; text-transform: uppercase; letter-spacing: 0.12em; text-align: left;">Descrição</th>
                <th style="padding: 8px 6px; font-size: 8px; font-weight: 700; color: #6d28d9; text-transform: uppercase; letter-spacing: 0.12em; text-align: center; width: 50px;">Qtd</th>
                <th style="padding: 8px 6px; font-size: 8px; font-weight: 700; color: #6d28d9; text-transform: uppercase; letter-spacing: 0.12em; text-align: right; width: 85px;">Valor unit.</th>
                <th style="padding: 8px 6px; font-size: 8px; font-weight: 700; color: #6d28d9; text-transform: uppercase; letter-spacing: 0.12em; text-align: right; width: 95px;">Total</th>
              </tr>
            </thead>
            <tbody>${itensHTML}</tbody>
          </table>
        </div>
        <div style="display: flex; justify-content: flex-end; margin-bottom: 22px;">
          <div style="width: 260px; border-top: 1px solid #e5e7eb; padding-top: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 10px; color: #6b7280;">
              <span>Subtotal (${totalItens} ${totalItens === 1 ? 'item' : 'itens'})</span>
              <span style="color: #1a1a2e; font-weight: 600;">R$ ${subtotal.toFixed(2).replace(".", ",")}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 10px; color: #6b7280;">
              <span>Frete</span>
              <span style="color: ${subtotal >= FRETE_GRATIS_VALOR ? '#16a34a' : '#1a1a2e'}; font-weight: 600;">${freteTexto}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0 6px; border-top: 1px solid #e5e7eb; margin-top: 6px;">
              <span style="font-size: 10px; font-weight: 700; color: #6d28d9; text-transform: uppercase; letter-spacing: 0.1em;">Total</span>
              <span style="font-size: 15px; font-weight: 800; color: #6d28d9; letter-spacing: -0.02em;">R$ ${totalFinal.toFixed(2).replace(".", ",")}</span>
            </div>
          </div>
        </div>
        <div style="margin-top: auto; padding-top: 12px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #9ca3af;">
          <div>
            <div style="font-weight: 700; color: #6d28d9; letter-spacing: 0.05em; font-size: 9px; margin-bottom: 3px;">WR AROMATIZANTES</div>
            <div>${siteConfig.whatsappDisplay || "(88) 99904-9636"} · ${siteConfig.email || "contato@wraromatizantes.com.br"}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 700; color: #6d28d9; letter-spacing: 0.05em; font-size: 9px; margin-bottom: 3px;">${siteConfig.instagramDisplay || "@wraromatizantes"}</div>
            <div>${siteConfig.endereco || "Juazeiro do Norte, CE"}</div>
          </div>
        </div>
      </div>
    </div>
    <div style="height: 3px; background: linear-gradient(90deg, #f59e0b 0%, #6d28d9 100%);"></div>
  </div>`;
}

async function visualizarPDF() {
  if (cart.length === 0) { showToast("Sacola vazia!", "error", 2000); return; }
  if (!document.getElementById("customer-name").value.trim()) { showToast("Informe seu nome!", "error", 2000); return; }
  if (!document.getElementById("address").value.trim()) { showToast("Informe o endereço!", "error", 2000); return; }

  const ok = await carregarLibsPDF();
  if (!ok) { showToast("Erro ao carregar gerador de PDF", "error"); return; }

  if (document.fonts && document.fonts.ready) await document.fonts.ready;

  document.getElementById("pdf-preview-content").innerHTML = gerarConteudoPDF();
  document.getElementById("pdf-preview-modal").classList.remove("hidden");
  document.getElementById("pdf-preview-modal").classList.add("flex");
}

let pdfLibsLoaded = false;

async function carregarLibsPDF() {
  if (pdfLibsLoaded) return true;
  if (window.jspdf && window.html2canvas) { pdfLibsLoaded = true; return true; }

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
    ]).then(() => { pdfLibsLoaded = true; resolve(true); }).catch(() => resolve(false));
  });
}

async function processarPedidoPublico(nomeCliente, endereco) {
  const itensParaBaixar = {};
  cart.forEach((item) => {
    const baseId = String(item.baseId || item.id.split("-")[0]);
    if (!itensParaBaixar[baseId]) itensParaBaixar[baseId] = 0;
    itensParaBaixar[baseId] += item.quantity;
  });

  const itemsCompactos = Object.keys(itensParaBaixar).map((id) => `${id}:${itensParaBaixar[id]}`).join(',');

  const itensTexto = cart
    .map((i) => `${i.quantity}x ${i.name} (R$ ${(i.price / i.quantity).toFixed(2).replace(".", ",")} cada)`)
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

    window[callbackName] = function (data) { finalizar(data); };

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

    script.onerror = function () { finalizar({ success: false, error: "Erro de rede ao enviar pedido" }); };
    setTimeout(() => { finalizar({ success: false, error: "Timeout ao processar pedido" }); }, 20000);

    document.body.appendChild(script);
  });
}

async function downloadPDF() {
  let element = document.getElementById("pdf-content-to-print");
  if (!element) { await visualizarPDF(); setTimeout(() => downloadPDF(), 500); return; }

  const nomeCliente = document.getElementById("customer-name").value.trim();
  const endereco = document.getElementById("address").value.trim();

  if (cart.length === 0) { showToast("Sacola vazia!", "error", 2000); return; }
  if (!nomeCliente) { showToast("Informe seu nome!", "error", 2000); return; }
  if (!endereco) { showToast("Informe o endereço!", "error", 2000); return; }

  const btn = document.getElementById("download-pdf-btn");
  const original = btn ? btn.innerHTML : "";
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...'; }

  showToast("Gerando PDF...", "info", 2000);

  try {
    await carregarLibsPDF();
    if (document.fonts && document.fonts.ready) await document.fonts.ready;

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
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });

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
    pdf.save(`Pedido_WRAromatizantes_${dataArquivo}.pdf`);

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
    if (btn) { btn.disabled = false; btn.innerHTML = original; }
  }
}

async function finalizarPedidoDireto() {
  const nomeCliente = document.getElementById("customer-name").value;
  const endereco = document.getElementById("address").value;

  if (cart.length === 0) { showToast("Sacola vazia!", "error", 2000); return; }
  if (!nomeCliente.trim()) { showToast("Informe seu nome!", "error", 2000); document.getElementById("customer-name").focus(); return; }
  if (!endereco.trim()) { showToast("Informe o endereço!", "error", 2000); document.getElementById("address").focus(); return; }

  const checkoutBtn = document.getElementById("checkout-btn");
  if (checkoutBtn) { checkoutBtn.disabled = true; checkoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...'; }

  try {
    const totalFinal = subtotal >= FRETE_GRATIS_VALOR ? subtotal : subtotal + TAXA_FRETE;
    const freteExibicao = subtotal >= FRETE_GRATIS_VALOR ? "GRÁTIS" : `R$ ${TAXA_FRETE.toFixed(2).replace(".", ",")}`;

    const resultado = await processarPedidoPublico(nomeCliente, endereco);

    if (!resultado || !resultado.success) {
      throw new Error((resultado && resultado.error) || "Erro ao salvar pedido");
    }

    const mensagemWhats = `🛍️ *NOVO PEDIDO - WR AROMATIZANTES* 🛍️\n\n👤 *CLIENTE:* ${nomeCliente.toUpperCase()}\n📍 *ENDEREÇO:* ${endereco}\n\n*📦 ITENS DO PEDIDO:*\n${cart.map((i) => `✅ ${i.quantity}x ${i.name} - R$ ${(i.price / i.quantity).toFixed(2).replace(".", ",")} cada`).join("\n")}\n\n*💰 RESUMO DO PEDIDO:*\n─────────────────\nSubtotal: R$ ${subtotal.toFixed(2).replace(".", ",")}\nFrete: ${freteExibicao}\n─────────────────\n*TOTAL: R$ ${totalFinal.toFixed(2).replace(".", ",")}*\n─────────────────\n\n✨ *Obrigado pela preferência!*`;

    const numeroWhats = window.__whatsappNumero || String(siteConfig.whatsapp).replace(/\D/g, "") || "5588999049636";

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
    showToast("❌ Erro: " + error.message, "error", 4000);
  } finally {
    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Finalizar';
    }
  }
}

// ============================================
// FILTRAR POR CATEGORIA (SÓ NOME/CATEGORIA)
// ============================================
function filtrarPorCategoria(categoria) {
  if (typeof allProducts === "undefined" || typeof renderProducts === "undefined") return;

  // 🎯 Mapa de aliases: o que o usuário clica → o que buscar
  const aliases = {
    "1litro": ["refil", "1l", "1 litro", "litro"],
    "spray 120ml": ["spray 120", "120ml", "120 ml"],
    "spray 500ml": ["spray 500", "500ml", "500 ml"],
    "automotivo": ["automotiv", "carro", "moto", "auto"]
  };

  const catNorm = normalizar(categoria);
  
  // Se tem alias, usa os termos alternativos; senão, usa o próprio
  const termosBusca = aliases[catNorm] || [catNorm];

  const filtrados =
    categoria === "todos"
      ? allProducts
      : allProducts.filter((p) => {
          const catProduto = normalizar(p["Categoria"] || "");
          const nomeProduto = normalizar(p["Nome do Produto"] || "");
          const combinado = catProduto + " " + nomeProduto;

          // Verifica se ALGUM dos termos de busca está no combinado
          return termosBusca.some(termo => {
            const termoNorm = normalizar(termo);
            const palavrasTermo = termoNorm.split(/\s+/).filter((w) => w.length > 0);
            const palavrasTermoNorm = palavrasTermo.map(normalizarPalavraBusca);
            const combinadoNorm = combinado.split(/\s+/).map(normalizarPalavraBusca).join(" ");
            return palavrasTermoNorm.every((palavra) => combinadoNorm.includes(palavra));
          });
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
    if (titleEl) titleEl.textContent = 'Nossas Fragrâncias';
    if (subtitleEl) subtitleEl.textContent = 'O cheirinho mais querido do Brasil';
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
// INICIALIZAÇÃO
// ============================================
document.addEventListener("DOMContentLoaded", function () {
  console.log("🚀 WR Aromatizantes - Inicializando...");

  carregarTudo();
  updateCart();

  document.getElementById('sidebar-close-mobile')?.addEventListener('click', fecharSidebarMobile);
  document.getElementById('sidebar-overlay')?.addEventListener('click', fecharSidebarMobile);

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
    const termo = normalizar(e.target.value);
    document.querySelectorAll('.sidebar-item, .sidebar-item-sub, .sidebar-group-title, .sidebar-subgroup-title').forEach(el => {
      const texto = normalizar(el.textContent);
      const match = !termo || texto.includes(termo);
      el.style.display = match ? '' : 'none';
    });
  });

  document.getElementById('sort-select')?.addEventListener('change', function () {
    ordenarProdutos(this.value);
  });

  document.getElementById("search-input-desktop")?.addEventListener("input", (e) => performSearch(e.target.value));
  document.getElementById("search-input-mobile")?.addEventListener("input", (e) => performSearch(e.target.value));

  document.getElementById("mobile-search-btn")?.addEventListener("click", () => {
    document.getElementById("search-overlay")?.classList.remove("-translate-y-full");
    setTimeout(() => { document.getElementById("search-input-mobile")?.focus(); }, 300);
  });

  document.getElementById("mobile-search-close")?.addEventListener("click", () => {
    document.getElementById("search-overlay")?.classList.add("-translate-y-full");
  });

  document.getElementById("cart-btn")?.addEventListener("click", () => {
    document.getElementById("cart-modal")?.classList.remove("hidden");
    document.getElementById("cart-modal")?.classList.add("flex");
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

  document.getElementById("mobile-menu-btn")?.addEventListener("click", () => { abrirSidebarMobile(); });

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

    if (!qty || qty <= 0) { showToast("Digite uma quantidade válida", "error", 2000); return; }

    window.adicionarSemCor(qty);
  });

  document.getElementById("custom-quantity")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") { e.preventDefault(); document.getElementById("add-custom-qty").click(); }
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
    const observer = new MutationObserver(() => { atualizarContadorProdutos(); });
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

  console.log("✅ WR Aromatizantes - Sistema pronto!");
});

// Limpar carrinho antigo
(function limparCarrinhoAntigo() {
  try {
    const stored = localStorage.getItem("cart");
    if (!stored) return;
    const cartAntigo = JSON.parse(stored);
    const temFormatoAntigo = cartAntigo.some((item) => /\d{13,}/.test(item.id) || /Math.random/.test(item.id));
    if (temFormatoAntigo) { localStorage.removeItem("cart"); console.log("🧹 Carrinho antigo limpo"); }
  } catch (e) {}
})();

console.log("✅ Script WR Aromatizantes carregado!");
