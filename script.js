// ============================================
// IVO PITA JOIAS - SCRIPT COMPLETO (CORRIGIDO)
// ============================================

// ============================================
// CONFIGURAÇÕES
// ============================================
const PLANILHA_ID = "1CwBlISE9wAFKkyYxfGXDDBKJ9LTIx_wVL6mR8ei5tCM";

const ESTOQUE_API_URL =
  "https://script.google.com/macros/s/AKfycbwRaA3rQLawY32JJssrGfCDx08iSnapR6f_K3LgK9T3TwNcXX56Rvmy4DBO1chfkT-M/exec";

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

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================
let allProducts = [];
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let selectedColor = "";
let tempProduct = null;
let heroSwiper = null;
let subtotal = 0;
let imagensZoom = [];
let zoomIndex = 0;

let quantidadeSelecionada = 0;
let coresSelecionadas = {};
let coresDisponiveis = [];

// ============================================
// CACHE DE ESTOQUE (evita consultas repetidas)
// ============================================
const ESTOQUE_CACHE = new Map();
const ESTOQUE_CACHE_TTL = 30 * 1000; // 30 segundos

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
// TOAST PADRONIZADO (sempre topo-direita)
// ============================================
function showToast(texto, tipo = 'success', duracao = 2500) {
  const cores = {
    success: 'linear-gradient(135deg, #2f6b4f, #1f4d38)',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  };

  Toastify({
    text: texto,
    duration: duracao,
    gravity: 'top',
    position: 'right',
    stopOnFocus: true,
    style: {
      background: cores[tipo] || cores.success,
      borderRadius: '14px',
      fontWeight: '700',
      fontSize: '13px',
      padding: '14px 20px',
      boxShadow: '0 10px 30px rgba(15, 47, 34, 0.25)',
      maxWidth: '340px'
    },
    offset: {
      x: 16,
      y: 90
    }
  }).showToast();
}
window.showToast = showToast;

// ============================================
// FUNÇÕES AUXILIARES
// ============================================
function normalizar(texto) {
  if (!texto) return "";
  return texto
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizarPalavraBusca(palavra) {
  return palavra
    .replace(/s$/, "")
    .replace(/a$/, "")
    .replace(/o$/, "")
    .replace(/es$/, "")
    .replace(/ns$/, "m");
}

function driveImg(url) {
  if (!url) return "https://via.placeholder.com/400?text=Sem+Imagem";
  if (url.includes("googleusercontent.com")) return url;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://lh3.googleusercontent.com/u/0/d/${match[1]}=w800`;
  if (url.startsWith("http")) return url;
  return "https://via.placeholder.com/400?text=Sem+Imagem";
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

    if (quantidade === 0) {
      btn.style.opacity = '0.5';
    } else {
      btn.style.opacity = '1';
    }
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
      if (icon) {
        subgroupTitle.insertBefore(countSpan, icon);
      } else {
        subgroupTitle.appendChild(countSpan);
      }
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

  const produtosFiltrados = allProducts.filter(p =>
    nomesVisiveis.includes(p["Nome do Produto"])
  );

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
    btn.onclick = function () {
      window.selectColor(nomeCor);
    };
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

  document
    .querySelectorAll(".qty-option-btn")
    .forEach((btn) => btn.classList.remove("selected"));

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

  addToCart(uniqueId, tempProduct.name, totalPrice, tempProduct.img, tempProduct.id, tempProduct.ref, quantidade);
  window.closeSizeModal();
}
window.adicionarSemCor = adicionarSemCor;

function confirmarSelecao() {
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
      "error",
      3000
    );
    return;
  }

  entradas.forEach(([cor, qtd]) => {
    const corOriginal = coresDisponiveis.find((c) => c.toLowerCase() === cor) || cor;
    const uniqueId = `${tempProduct.id}-${corOriginal}`;
    const fullName = `${tempProduct.name} - ${corOriginal}`;
    const totalPrice = tempProduct.price * qtd;
    addToCart(uniqueId, fullName, totalPrice, tempProduct.img, tempProduct.id, tempProduct.ref, qtd);
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

    const script = document.createElement("script");
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
            </div>
        `;
  } else {
    cart.forEach((item) => {
      subtotal += item.price;
      const precoUnitario = item.price / item.quantity;
      const div = document.createElement("div");
      div.className = "cart-item";
      div.innerHTML = `
                <div class="cart-item-image">
                    <img src="${driveImg(item.img)}" alt="${item.name}">
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
                </div>
            `;
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

function addToCart(id, name, price, img, baseId, ref, quantity) {
  const qty = quantity || 1;
  const existing = cart.find((i) => i.id === id);

  if (existing) {
    existing.quantity += qty;
    existing.price += price;
  } else {
    cart.push({ id, name, price, img, quantity: qty, baseId, ref });
  }

  showToast(`✅ ${name.substring(0, 30)} adicionado!`, "success", 2000);
  updateCart();
}

// ============================================
// CARREGAR PRODUTOS (via JSONP)
// ============================================
async function loadProducts() {
  try {
    console.log("🔄 Carregando produtos via JSONP...");

    const data = await new Promise((resolve, reject) => {
      const callbackName = "listar_produtos_" + Date.now();

      window[callbackName] = function (response) {
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
        resolve(response);
      };

      const script = document.createElement("script");
      script.src = `${ESTOQUE_API_URL}?callback=${callbackName}`;

      script.onerror = function () {
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
        reject(new Error("Erro ao carregar produtos"));
      };

      const timeoutId = setTimeout(() => {
        if (window[callbackName]) {
          delete window[callbackName];
          if (script.parentNode) script.parentNode.removeChild(script);
          reject(new Error("Timeout ao carregar produtos"));
        }
      }, 30000);

      const originalCallback = window[callbackName];
      window[callbackName] = function (resp) {
        clearTimeout(timeoutId);
        originalCallback(resp);
      };

      document.body.appendChild(script);
    });

    console.log("📥 Dados recebidos:", data);

    if (data.error) throw new Error(data.error);

    allProducts = data.produtos || [];
    aplicarConfig(data.config || {});
    renderizarMarquee(data.marquee || []);

    allProducts = allProducts.map((p) => {
      if (!p["Saldo Estoque"]) {
        const inicial = parseInt(p.Estoque) || 0;
        const vendidos = parseInt(p.Vendidos) || 0;
        p["Saldo Estoque"] = inicial - vendidos;
      }
      return p;
    });

    if (allProducts.length === 0) {
      const container = document.getElementById("produtos-container");
      if (container) {
        container.innerHTML = `
                    <div class="col-span-full text-center py-12">
                        <i class="fas fa-gem text-4xl text-primary/30 mb-4"></i>
                        <p class="text-textMuted">Nenhum produto disponível.</p>
                    </div>
                `;
      }
      return;
    }

    console.log(`✅ ${allProducts.length} produtos carregados`);

    renderProducts(allProducts);

    setTimeout(atualizarContadoresSidebar, 500);
    setTimeout(atualizarContadorProdutos, 500);

  } catch (err) {
    console.error("Erro ao carregar produtos:", err);
    const container = document.getElementById("produtos-container");
    if (container) {
      container.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
                    <p class="text-textMuted font-bold">Erro ao carregar produtos</p>
                    <button onclick="loadProducts()" class="mt-4 bg-primary text-white px-6 py-2 rounded-full text-sm font-bold">
                        <i class="fas fa-sync-alt mr-2"></i>Tentar novamente
                    </button>
                </div>
            `;
    }
  }
}

// ============================================
// RENDERIZAR PRODUTOS
// ============================================
function renderProducts(products) {
  const container = document.getElementById("produtos-container");
  if (!container) return;
  container.innerHTML = "";

  if (products.length === 0) {
    container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <i class="fas fa-search text-4xl text-primary/30 mb-4"></i>
                <p class="text-textMuted">Nenhum produto encontrado.</p>
            </div>
        `;
    setTimeout(atualizarContadorProdutos, 50);
    return;
  }

  products.forEach((p) => {
    const estoque = parseInt(p["Saldo Estoque"]) || 0;
    const temCores = p["Cores"] && p["Cores"].trim() !== "";
    const preco = parseFloat(p["Preço"]) || 0;

    let stockBadge = "";
    if (estoque <= 0) {
      stockBadge = `<span class="stock-out"><i class="fas fa-times-circle"></i> Indisponível</span>`;
    } else if (estoque <= 3) {
      stockBadge = `<span class="stock-low"><i class="fas fa-exclamation-triangle"></i> Últimas ${estoque}!</span>`;
    } else {
      stockBadge = `<span class="stock-available"><i class="fas fa-check-circle"></i> ${estoque} disponíveis</span>`;
    }

    let botaoHTML = "";
    const nomeEscapado = (p["Nome do Produto"] || "").replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const refEscapada = (p["referencia"] || "").replace(/'/g, "\\'");
    const imgEscapada = (p["Imagem"] || "").replace(/"/g, '&quot;');

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

    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
            <div class="product-card-image">
                <img src="${driveImg(p["Imagem"])}" 
                     alt="${p["Nome do Produto"]}" 
                     onerror="this.src='https://via.placeholder.com/400?text=Sem+Imagem'"
                     onclick="abrirZoomDireto('${p["Imagem"]}')">
                ${estoque <= 0 ? '<div class="product-card-sold-out"><span>ESGOTADO</span></div>' : ""}
            </div>
            <div class="product-card-content">
                <h3 class="product-card-title">${p["Nome do Produto"]}</h3>
                ${p["referencia"] ? `<p class="product-card-ref">Ref: ${p["referencia"]}</p>` : ""}
                ${p["Categoria"] ? `<p class="text-[10px] text-slate-500">${p["Categoria"]}${p["Subcategoria"] ? " • " + p["Subcategoria"] : ""}</p>` : ""}
                <p class="product-card-price">R$ ${preco.toFixed(2).replace(".", ",")}</p>
                <div class="product-card-stock">${stockBadge}</div>
                ${botaoHTML}
            </div>
        `;
    container.appendChild(card);
  });

  setTimeout(atualizarContadorProdutos, 100);
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
      </span>
    `;
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
  console.log("✅ Configurações aplicadas:", siteConfig);
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

  const imagemExibir = driveImg(imagem);
  imagensZoom = [imagemExibir];
  zoomIndex = 0;

  img.src = imagensZoom[zoomIndex];
  img.onerror = function () {
    this.src = "https://via.placeholder.com/800x800?text=Sem+Imagem";
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

function abrirZoomModal(imagem) {
  abrirZoomDireto(imagem);
}

window.fecharZoom = fecharZoom;
window.zoomAnterior = zoomAnterior;
window.zoomProximo = zoomProximo;
window.abrirZoomDireto = abrirZoomDireto;
window.abrirZoomModal = abrirZoomModal;

// ============================================
// OPEN SIZE SELECTOR (com cache + background)
// ============================================
window.openSizeSelector = function (id, name, ref, price, img) {
  console.log("🎯 openSizeSelector:", { id, name, ref, price });

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
      "error",
      3000
    );
    return;
  }

  const priceNum = parseFloat(price) || 0;
  tempProduct = {
    id: p["ID"], name: name, price: priceNum, img: img, ref: ref,
    estoqueDisponivel: estoqueDisponivel
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
      <img src="${driveImg(p["Imagem"])}" 
           alt="${name}"
           onerror="this.src='https://via.placeholder.com/100?text=Sem+Imagem'">
    `;
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
        window.adicionarSemCor(qtd);
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
// CARREGAR BANNER HERO
// ============================================
async function carregarBannerHero() {
  try {
    console.log("🔄 Carregando banners via JSONP...");

    const data = await new Promise((resolve, reject) => {
      const callbackName = "listar_banners_" + Date.now();
      window[callbackName] = function (response) {
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
        resolve(response);
      };

      const script = document.createElement("script");
      script.src = `${ESTOQUE_API_URL}?callback=${callbackName}`;

      script.onerror = function () {
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
        reject(new Error("Erro ao carregar banners"));
      };

      const timeoutId = setTimeout(() => {
        if (window[callbackName]) {
          delete window[callbackName];
          if (script.parentNode) script.parentNode.removeChild(script);
          reject(new Error("Timeout"));
        }
      }, 30000);

      document.body.appendChild(script);
    });

    const banners = data.banners || [];
    const wrapper = document.querySelector(".heroSwiper .swiper-wrapper");
    if (!wrapper) return;
    wrapper.innerHTML = "";

    let hasBanners = false;

    banners.forEach((b) => {
      if (b.ativo && b.ativo.toLowerCase() === "nao") return;
      if (!b.titulo) return;
      hasBanners = true;

      const posicaoBruta = (b.posicao || "centro").toLowerCase().trim();
      const posicao = ["centro", "esquerda", "direita"].includes(posicaoBruta) ? posicaoBruta : "centro";

      const slide = document.createElement("div");
      slide.className = `swiper-slide banner-pos-${posicao}`;
      slide.style.position = "relative";
      slide.style.width = "100%";
      slide.style.height = "100%";
      slide.innerHTML = `
        <div class="banner-slide-wrapper">
          <img src="${driveImg(b.imagem)}" 
               class="banner-slide-img" 
               alt="${b.titulo}"
               onerror="this.src='https://via.placeholder.com/1600x600?text=Ivo+Pita'">
          <div class="banner-slide-bar">
            <div class="banner-slide-content">
              <h2 class="banner-slide-title">${b.titulo}</h2>
              ${b.btnText && b.btnLink ? `<a href="${b.btnLink}" class="banner-slide-btn">${b.btnText}</a>` : ""}
            </div>
          </div>
        </div>
      `;
      wrapper.appendChild(slide);
    });

    if (!hasBanners) {
      const slide = document.createElement("div");
      slide.className = "swiper-slide banner-pos-centro";
      slide.style.position = "relative";
      slide.style.width = "100%";
      slide.style.height = "100%";
      slide.innerHTML = `
        <div class="banner-slide-wrapper" style="background: linear-gradient(135deg, #f0f7f2, #e8f3ec);">
          <div class="banner-slide-bar" style="position: relative; height: 100%;">
            <div class="banner-slide-content" style="align-items: center; text-align: center; margin: 0 auto;">
              <h2 class="banner-slide-title" style="color: #1f4d38;">Ivo Pita Joias</h2>
              <p class="banner-slide-subtitle" style="color: #5c6b63;">Qualidade e Elegância</p>
            </div>
          </div>
        </div>
      `;
      wrapper.appendChild(slide);
    }

    if (heroSwiper) heroSwiper.destroy();
    heroSwiper = new Swiper(".heroSwiper", {
      loop: true,
      effect: "fade",
      fadeEffect: { crossFade: true },
      speed: 900,
      autoHeight: false,
      autoplay: { delay: 5500, disableOnInteraction: false },
      pagination: { el: ".swiper-pagination", clickable: true },
    });
  } catch (err) {
    console.error("Erro banners:", err);
  }
}

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
      </tr>
    `;
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
            <tbody>
              ${itensHTML}
            </tbody>
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

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  document.getElementById("pdf-preview-content").innerHTML = gerarConteudoPDF();
  document.getElementById("pdf-preview-modal").classList.remove("hidden");
  document.getElementById("pdf-preview-modal").classList.add("flex");
}

// ============================================
// FUNÇÃO: Finalizar Pedido via ROTA PÚBLICA
// ============================================
async function processarPedidoPublico(nomeCliente, endereco) {
  const itensParaBaixar = {};
  cart.forEach((item) => {
    const baseId = String(item.baseId || item.id.split("-")[0]);
    if (!itensParaBaixar[baseId]) itensParaBaixar[baseId] = 0;
    itensParaBaixar[baseId] += item.quantity;
  });

  const itemsArray = Object.keys(itensParaBaixar).map((id) => ({
    id: id,
    quantity: itensParaBaixar[id]
  }));

  const itensTexto = cart
    .map((i) => `${i.quantity}x ${i.name}${i.ref ? ` (Ref: ${i.ref})` : ""} (R$ ${(i.price / i.quantity).toFixed(2).replace(".", ",")} cada)`)
    .join(" | ");

  const totalFinal = subtotal >= FRETE_GRATIS_VALOR ? subtotal : subtotal + TAXA_FRETE;
  const freteAplicado = subtotal >= FRETE_GRATIS_VALOR ? 0 : TAXA_FRETE;

  return new Promise((resolve, reject) => {
    const callbackName = "fazer_pedido_" + Date.now();

    window[callbackName] = function (response) {
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
      resolve(response);
    };

    const script = document.createElement("script");
    const params =
      `modo=publico&tipo=fazer_pedido` +
      `&cliente=${encodeURIComponent(nomeCliente)}` +
      `&endereco=${encodeURIComponent(endereco)}` +
      `&itens=${encodeURIComponent(itensTexto)}` +
      `&subtotal=${subtotal}` +
      `&frete=${freteAplicado}` +
      `&total=${totalFinal}` +
      `&data=${encodeURIComponent(new Date().toISOString())}` +
      `&items=${encodeURIComponent(JSON.stringify(itemsArray))}` +
      `&callback=${callbackName}`;

    script.src = `${ESTOQUE_API_URL}?${params}`;

    script.onerror = function () {
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
      reject(new Error("Erro ao processar pedido"));
    };

    setTimeout(() => {
      if (window[callbackName]) {
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
        reject(new Error("Timeout ao processar pedido"));
      }
    }, 30000);

    document.body.appendChild(script);
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

  if (cart.length === 0) {
    showToast("Sacola vazia!", "error", 2000);
    return;
  }
  if (!nomeCliente) {
    showToast("Informe seu nome!", "error", 2000);
    return;
  }
  if (!endereco) {
    showToast("Informe o endereço!", "error", 2000);
    return;
  }

  const btn = document.getElementById("download-pdf-btn");
  const original = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
  }

  showToast("Gerando PDF...", "info", 2000);

  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    const canvas = await html2canvas(element, {
      scale: 3,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight
    });
    const imgData = canvas.toDataURL("image/png");

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true
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
      pdf.addImage(imgData, "PNG", margin, yOffset, imgWidth, imgHeight, undefined, "FAST");
    } else {
      let position = 0;
      let pageNum = 0;
      while (position < imgHeight) {
        if (pageNum > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, margin - position, imgWidth, imgHeight, undefined, "FAST");
        position += printableHeight;
        pageNum++;
      }
    }

    const dataArquivo = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    pdf.save(`Pedido_IvoPita_${dataArquivo}.pdf`);

    console.log("📦 Enviando pedido...");
    const resultado = await processarPedidoPublico(nomeCliente, endereco);

    console.log("📥 Resultado:", resultado);

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
    loadProducts();
    setTimeout(() => loadProducts(), 3000);

  } catch (error) {
    console.error("❌ Erro:", error);
    showToast("❌ Erro: " + error.message, "error", 4000);
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

  if (cart.length === 0) {
    showToast("Sacola vazia!", "error", 2000);
    return;
  }
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

  const checkoutBtn = document.getElementById("checkout-btn");
  if (checkoutBtn) {
    checkoutBtn.disabled = true;
    checkoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
  }

  try {
    const totalFinal = subtotal >= FRETE_GRATIS_VALOR ? subtotal : subtotal + TAXA_FRETE;
    const freteExibicao = subtotal >= FRETE_GRATIS_VALOR ? "GRÁTIS" : `R$ ${TAXA_FRETE.toFixed(2).replace(".", ",")}`;

    console.log("📦 Enviando pedido...");
    const resultado = await processarPedidoPublico(nomeCliente, endereco);

    console.log("📥 Resultado:", resultado);

    if (!resultado || !resultado.success) {
      throw new Error((resultado && resultado.error) || "Erro ao salvar pedido");
    }

    const mensagemWhats = `🛍️ *NOVO PEDIDO - IVO PITA* 🛍️\n\n👤 *CLIENTE:* ${nomeCliente.toUpperCase()}\n📍 *ENDEREÇO:* ${endereco}\n\n*📦 ITENS DO PEDIDO:*\n${cart.map((i) => `✅ ${i.quantity}x ${i.name}${i.ref ? ` (Ref: ${i.ref})` : ""} - R$ ${(i.price / i.quantity).toFixed(2).replace(".", ",")} cada`).join("\n")}\n\n*💰 RESUMO DO PEDIDO:*\n─────────────────\nSubtotal: R$ ${subtotal.toFixed(2).replace(".", ",")}\nFrete: ${freteExibicao}\n─────────────────\n*TOTAL: R$ ${totalFinal.toFixed(2).replace(".", ",")}*\n─────────────────\n\n✨ *Obrigado pela preferência!*`;

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
    loadProducts();
    setTimeout(() => loadProducts(), 3000);

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
// FILTRAR POR CATEGORIA
// ============================================
function filtrarPorCategoria(categoria) {
  if (typeof allProducts === "undefined" || typeof renderProducts === "undefined") return;

  console.log("🔍 Filtrando por:", categoria);

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

  console.log(`📦 ${filtrados.length} produtos encontrados para "${categoria}"`);

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

  loadProducts();
  carregarBannerHero();
  updateCart();

  document.getElementById('sidebar-open-btn')?.addEventListener('click', abrirSidebarMobile);
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
    setTimeout(() => {
      document.getElementById("search-input-mobile")?.focus();
    }, 300);
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
      window.adicionarSemCor(qty);
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

console.log("✅ Script Ivo Pita Industria de Joias carregado!");
