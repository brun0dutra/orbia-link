/* ==========================================================================
   Orbia Link — js/menu.js
   Módulo Cardápio e Pedidos (Etapa 3).

   Renderiza a experiência "Fazer pedido" para negócios com
   modules.menu.enabled === true em data/businesses.json:

     Página do negócio -> Cardápio -> Carrinho -> Checkout -> WhatsApp

   A interface é 100% client-side (HTML/CSS/JS/JSON):
     - dados do cardápio vêm de item.modules.menu (categories/products)
     - configurações de checkout em item.modules.menu.settings
     - carrinho persistido em localStorage (chave orbia:cart:<slug>)
     - pedido enviado via URL do WhatsApp (wa.me) com mensagem montada

   Dependência opcional: js/app.js expõe window.OrbiaLink.reroute() para
   voltar à página do negócio. Se ausente, o módulo ainda funciona.
   ========================================================================== */

(function () {
  "use strict";

  var CART_PREFIX = "orbia:cart:";
  var MAX_QTY = 50;

  var STOP_WORDS = new Set(["da", "de", "do", "das", "dos", "e", "&"]);

  var S = null; // sessão ativa do módulo
  var flashTimer = null;

  /* ---------- Helpers ---------- */

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function money(n) {
    var v = Math.round((Number(n) || 0) * 100) / 100;
    return "R$ " + v.toFixed(2).replace(".", ",");
  }

  function plural(n) {
    return n === 1 ? "item" : "itens";
  }

  function initialsOf(name) {
    var words = String(name)
      .split(/\s+/)
      .filter(function (w) {
        return w && !STOP_WORDS.has(w.toLowerCase());
      });
    if (!words.length) return "?";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      /* sem storage (modo privado): o carrinho continua em memória */
    }
  }

  function parseNumber(v) {
    if (v == null) return NaN;
    var s = String(v).trim().replace(/\s+/g, "").replace(",", ".");
    if (!s) return NaN;
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }

  /* ---------- Acesso aos dados do módulo ---------- */

  function modCfg(item) {
    return item && item.modules && item.modules.menu ? item.modules.menu : null;
  }

  function isEnabled(item) {
    var m = modCfg(item);
    return !!m && m.enabled === true;
  }

  function settingsOf(item) {
    var m = modCfg(item);
    return (m && m.settings) || {};
  }

  function whatsappDigits(item) {
    var m = modCfg(item);
    if (m && m.whatsapp) {
      var d = String(m.whatsapp).replace(/\D/g, "");
      if (d) return d;
    }
    // fallback: extrai o número do primeiro link wa.me do negócio
    var links = item.links || [];
    for (var i = 0; i < links.length; i++) {
      var mm = String(links[i].url || "").match(/wa\.me\/([0-9]+)/);
      if (mm) return mm[1];
    }
    return "";
  }

  function productById(item, id) {
    var cfg = modCfg(item);
    var prods = (cfg && cfg.products) || [];
    for (var i = 0; i < prods.length; i++) {
      if (prods[i].id === id) return prods[i];
    }
    return null;
  }

  function emojiForProduct(item, product) {
    var cfg = modCfg(item);
    var cats = (cfg && cfg.categories) || [];
    for (var i = 0; i < cats.length; i++) {
      if (cats[i].id === product.category) return cats[i].emoji || "🍽️";
    }
    return "🍽️";
  }

  function availReceipts(item) {
    var st = settingsOf(item);
    var out = [];
    if (st.delivery === true) out.push("delivery");
    if (st.pickup === true) out.push("pickup");
    return out.length ? out : ["pickup"];
  }

  function availPayments(item) {
    var st = settingsOf(item);
    return (st.payment_methods && st.payment_methods.length
      ? st.payment_methods
      : ["pix"]
    ).slice();
  }

  /* ---------- Carrinho (localStorage) ---------- */

  function cartKey(slug) {
    return CART_PREFIX + slug;
  }

  function loadCart(slug) {
    try {
      var raw = storageGet(cartKey(slug));
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function persistCart() {
    if (!S) return;
    storageSet(cartKey(S.slug), JSON.stringify(S.cart));
  }

  function cartTotals() {
    var items = 0;
    var amount = 0;
    S.cart.forEach(function (l) {
      items += l.qty;
      amount += (l.unit || 0) * l.qty;
    });
    return { items: items, amount: amount };
  }

  // basePrice opcional: permite preço promocional vindo da vitrine de
  // ofertas (módulo promotions) sem duplicar os dados do produto.
  function calcUnit(product, sel, basePrice) {
    var unit = Number(basePrice != null ? basePrice : product.price) || 0;
    var options = product.options || [];
    options.forEach(function (group, gi) {
      var picked = (sel[gi] || []).slice();
      picked.forEach(function (ii) {
        var it = group.items && group.items[ii];
        if (it) unit += Number(it.price) || 0;
      });
    });
    return unit;
  }

  function selectionKey(product, sel, basePrice) {
    var parts = [product.id];
    // o preço entra na chave: uma linha criada via promoção (preço
    // promocional) não deve se fundir com a mesma configuração no preço
    // normal do cardápio.
    parts.push("p:" + Math.round((Number(basePrice != null ? basePrice : product.price) || 0) * 100));
    var options = product.options || [];
    options.forEach(function (group, gi) {
      var picked = (sel[gi] || []).slice();
      picked.forEach(function (ii) {
        parts.push(gi + ":" + ii);
      });
    });
    var note = String(S.sheet ? S.sheet.note : "")
      .trim()
      .toLowerCase();
    if (note) parts.push("obs:" + note);
    return parts.join("|");
  }

  function buildLine(product, sel, qty, note, basePrice) {
    var options = product.options || [];
    var selArr = [];
    var optsArr = [];
    options.forEach(function (group, gi) {
      (sel[gi] || []).slice().forEach(function (ii) {
        var it = group.items[ii];
        if (!it) return;
        selArr.push({ gi: gi, ii: ii });
        optsArr.push({ name: it.name, price: Number(it.price) || 0 });
      });
    });
    return {
      key: selectionKey(product, sel, basePrice),
      productId: product.id,
      name: product.name,
      // base: preço base usado (normal ou promocional) — preserva o preço
      // da oferta ao editar a linha no carrinho.
      base: Number(basePrice != null ? basePrice : product.price) || 0,
      unit: calcUnit(product, sel, basePrice),
      qty: qty,
      note: String(note || "").trim(),
      sel: selArr,
      opts: optsArr,
    };
  }

  function upsertLine(line) {
    var existing = null;
    for (var i = 0; i < S.cart.length; i++) {
      if (S.cart[i].key === line.key) {
        existing = S.cart[i];
        break;
      }
    }
    if (existing) {
      existing.qty = Math.min(MAX_QTY, existing.qty + line.qty);
      existing.unit = line.unit;
    } else {
      S.cart.push(line);
    }
    persistCart();
  }

  function setQty(key, delta) {
    for (var i = 0; i < S.cart.length; i++) {
      if (S.cart[i].key === key) {
        var q = S.cart[i].qty + delta;
        S.cart[i].qty = Math.max(1, Math.min(MAX_QTY, q));
        break;
      }
    }
    persistCart();
  }

  function removeLine(key) {
    S.cart = S.cart.filter(function (l) {
      return l.key !== key;
    });
    persistCart();
  }

  /* ---------- Navegação do módulo ---------- */

  function openMenu(item) {
    S = {
      item: item,
      slug: item.slug,
      cart: loadCart(item.slug),
      screen: "menu",
      chk: null,
      editKey: null,
    };
    render();
  }

  function leaveToBusiness() {
    S = null;
    if (window.OrbiaLink && window.OrbiaLink.reroute) {
      window.OrbiaLink.reroute();
    }
  }

  function render() {
    if (!S) return;
    var appEl = document.getElementById("app");
    if (!appEl) return;
    appEl.innerHTML = "";
    var root = document.createElement("div");
    root.className = "m-app";
    root.setAttribute("data-screen", S.screen);
    // S.root precisa existir antes de renderizar: telas como a do cardápio
    // chamam syncCartBar() durante a montagem e dependem dele.
    S.root = root;
    if (S.screen === "menu") renderMenuScreen(root);
    else if (S.screen === "cart") renderCartScreen(root);
    else renderCheckoutScreen(root);
    appEl.appendChild(root);
  }

  /* ---------- Barra superior ---------- */

  function barMarkup(title, sub) {
    return (
      '<div class="m-bar">' +
      '<button type="button" class="m-iconbtn" data-act="' +
      (S.screen === "checkout" ? "step-back" : S.screen === "cart" ? "menu-back" : "page-back") +
      '" aria-label="Voltar">←</button>' +
      '<div class="m-bar__brand">' +
      '<span class="m-brand__ava" aria-hidden="true">' +
      esc(initialsOf(S.item.business.name)) +
      "</span>" +
      '<span class="m-brand__names">' +
      '<span class="m-brand__name">' +
      esc(S.item.business.name) +
      "</span>" +
      '<span class="m-brand__sub">' +
      esc(sub || title) +
      "</span>" +
      "</span>" +
      "</div>" +
      "</div>"
    );
  }

  /* ---------- Tela: Cardápio ---------- */

  function renderMenuScreen(root) {
    var item = S.item;
    var cfg = modCfg(item);
    var cats = (cfg && cfg.categories) || [];
    var prods = (cfg && cfg.products) || [];

    var chips =
      '<div class="m-cats" role="tablist" aria-label="Categorias">' +
      cats
        .map(function (c, i) {
          return (
            '<button type="button" class="m-cat' +
            (i === 0 ? " is-active" : "") +
            '" data-act="cat" data-idx="' +
            i +
            '" role="tab">' +
            (c.emoji ? '<span aria-hidden="true">' + c.emoji + "</span>" : "") +
            esc(c.name) +
            "</button>"
          );
        })
        .join("") +
      "</div>";

    var flat = []; // {cat, product}
    var sections = cats
      .map(function (cat) {
        var list = prods.filter(function (p) {
          return p.category === cat.id;
        });
        if (!list.length) return "";
        list.forEach(function (p) {
          flat.push({ cat: cat, product: p });
        });
        return (
          '<section class="m-sec" data-cat="' +
          esc(cat.id) +
          '">' +
          '<h2 class="m-sec__head">' +
          (cat.emoji ? '<span class="m-sec__emoji" aria-hidden="true">' + cat.emoji + "</span>" : "") +
          esc(cat.name) +
          '<span class="m-sec__count">' +
          list.length +
          "</span></h2>" +
          list
            .map(function (p) {
              return productMarkup(p);
            })
            .join("") +
          "</section>"
        );
      })
      .join("");

    root.innerHTML =
      barMarkup("Cardápio", "Cardápio") +
      chips +
      '<div class="m-body m-inner">' + sections + "</div>";

    // navegação
    $$(".m-bar [data-act='page-back']", root).forEach(function (b) {
      b.addEventListener("click", leaveToBusiness);
    });

    var chipEls = $$(".m-cat", root);
    chipEls.forEach(function (chip, i) {
      chip.addEventListener("click", function () {
        var sec = $$(".m-sec", root)[i];
        if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    var body = $(".m-body", root);
    body.addEventListener(
      "scroll",
      function () {
        var top = body.getBoundingClientRect().top + 14;
        var current = 0;
        var secs = $$(".m-sec", root);
        secs.forEach(function (sec, i) {
          if (sec.getBoundingClientRect().top - top <= 4) current = i;
        });
        chipEls.forEach(function (chip, i) {
          chip.classList.toggle("is-active", i === current);
        });
      },
      { passive: true }
    );

    // produtos
    var addEls = $$(".m-prod .m-add", root);
    addEls.forEach(function (btn, i) {
      var entry = flat[i];
      if (!entry) return;
      btn.addEventListener("click", function () {
        var p = entry.product;
        if (p.options && p.options.length) openSheet(p, null);
        else quickAdd(p);
      });
    });

    $$(".m-prod img.m-prod__img", root).forEach(function (img) {
      img.addEventListener("error", function () {
        if (img.parentNode) img.parentNode.removeChild(img);
      });
    });

    syncCartBar();
  }

  function productMarkup(p) {
    var img = p.image
      ? '<img class="m-prod__img" src="' +
        esc(p.image) +
        '" alt="" loading="lazy">'
      : "";
    return (
      '<div class="m-prod">' +
      img +
      '<div class="m-prod__info">' +
      '<div class="m-prod__name">' +
      esc(p.name) +
      "</div>" +
      (p.description
        ? '<div class="m-prod__desc">' + esc(p.description) + "</div>"
        : "") +
      '<div class="m-prod__meta">' +
      '<span class="m-prod__price">' +
      money(p.price) +
      "</span>" +
      '<button type="button" class="m-add" data-act="add" aria-label="Adicionar ' +
      esc(p.name) +
      '">+</button>' +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function quickAdd(product, basePrice) {
    var line = buildLine(product, {}, 1, "", basePrice);
    upsertLine(line);
    syncCartBar();
  }

  /* ---------- Barra fixa do carrinho (cardápio) ---------- */

  function syncCartBar() {
    if (!S || S.screen !== "menu" || !S.root) return;
    var totals = cartTotals();
    var bar = $(".m-cartbar", S.root);
    if (totals.items <= 0) {
      if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
      return;
    }
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "m-cartbar";
      bar.innerHTML =
        '<div class="m-cartbar__inner">' +
        '<div class="m-cartbar__txt">' +
        '<span class="m-cartbar__count"></span>' +
        '<span class="m-cartbar__amt"></span>' +
        "</div>" +
        '<button type="button" class="m-btn m-btn--primary m-cartbar__btn" data-act="open-cart">' +
        "VER CARRINHO →" +
        "</button>" +
        "</div>";
      $(".m-cartbar__btn", bar).addEventListener("click", function () {
        S.screen = "cart";
        render();
      });
      S.root.appendChild(bar);
    }
    $(".m-cartbar__count", bar).textContent =
      "🛒 " + totals.items + " " + plural(totals.items);
    $(".m-cartbar__amt", bar).textContent = money(totals.amount);
  }

  /* ---------- Bottom sheet: detalhe do produto ---------- */

  function openSheet(product, editLine, basePrice) {
    var qty = 1;
    var note = "";
    var sel = {};
    if (editLine) {
      qty = editLine.qty || 1;
      note = editLine.note || "";
      (editLine.sel || []).forEach(function (s) {
        (sel[s.gi] = sel[s.gi] || []).push(s.ii);
      });
    }
    // basePrice: preço promocional vindo da vitrine de ofertas; quando
    // ausente, usa o preço normal do produto. Na edição de uma linha do
    // carrinho, usa o preço base gravado na própria linha (preserva oferta).
    var bp =
      basePrice != null
        ? basePrice
        : editLine && editLine.base != null
          ? editLine.base
          : product.price;
    S.sheet = { product: product, editKey: editLine ? editLine.key : null, qty: qty, note: note, sel: sel, basePrice: bp };
    S.editKey = null;
    renderSheet();
  }

  function sheetMarkup() {
    var p = S.sheet.product;
    var groups = (p.options || [])
      .map(function (group, gi) {
        var hint = groupHintBase(group);
        var rows = (group.items || [])
          .map(function (it, ii) {
            var isRadio = group.min === 1 && group.max === 1;
            return (
              '<label class="m-opt" data-gi="' +
              gi +
              '" data-ii="' +
              ii +
              '">' +
              '<input type="' +
              (isRadio ? "radio" : "checkbox") +
              '" class="m-opt__inp" name="opt_' +
              gi +
              '" value="' +
              ii +
              '" data-gi="' +
              gi +
              '" data-ii="' +
              ii +
              '">' +
              '<span class="m-opt__box" aria-hidden="true"></span>' +
              '<span class="m-opt__name">' +
              esc(it.name) +
              "</span>" +
              '<span class="m-opt__price">' +
              (Number(it.price) > 0 ? "+ " + money(it.price) : "grátis") +
              "</span>" +
              "</label>"
            );
          })
          .join("");
        return (
          '<div class="m-grp" data-gi="' +
          gi +
          '">' +
          '<div class="m-grp__head">' +
          '<span class="m-grp__name">' +
          esc(group.name) +
          "</span>" +
          '<span class="m-grp__hint" data-role="hint"></span>' +
          "</div>" +
          '<div class="m-grp__rows">' +
          rows +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    var noteField = "";
    if (p.allow_note) {
      noteField =
        '<label class="m-field-label" for="sheet-note">Observação</label>' +
        '<textarea id="sheet-note" class="m-field" data-role="note" rows="2" maxlength="220" placeholder="Ex.: Sem cebola, bem passado…"></textarea>';
    }

    return (
      '<div class="m-scrim" data-act="sheet-close"></div>' +
      '<div class="m-sheet" role="dialog" aria-modal="true" aria-label="' +
      esc(p.name) +
      '">' +
      '<div class="m-sheet__handle" aria-hidden="true"></div>' +
      '<div class="m-sheet__head">' +
      '<div class="m-sheet__title">' +
      (S.sheet.editKey ? "Editar item" : "Personalizar") +
      "</div>" +
      '<button type="button" class="m-iconbtn" data-act="sheet-close" aria-label="Fechar">✕</button>' +
      "</div>" +
      (p.image
        ? '<img class="m-sheet__img" src="' + esc(p.image) + '" alt="" data-role="sheet-img">'
        : "") +
      '<div class="m-sheet__scroll">' +
      '<div class="m-sheet__name">' +
      esc(p.name) +
      "</div>" +
      (p.description
        ? '<div class="m-sheet__desc">' + esc(p.description) + "</div>"
        : "") +
      '<span class="m-sheet__price" data-role="base">' +
      money(S.sheet.basePrice != null ? S.sheet.basePrice : p.price) +
      "</span>" +
      groups +
      noteField +
      "</div>" +
      '<div class="m-sheet__foot">' +
      '<div class="m-stepper" aria-label="Quantidade">' +
      '<button type="button" class="m-stepper__btn" data-act="sqty-m" aria-label="Diminuir">−</button>' +
      '<span class="m-stepper__n" data-role="qty">1</span>' +
      '<button type="button" class="m-stepper__btn" data-act="sqty-p" aria-label="Aumentar">+</button>' +
      "</div>" +
      '<button type="button" class="m-btn m-btn--primary" data-act="sheet-add">' +
      '<span data-role="add-label">ADICIONAR</span>' +
      "</button>" +
      "</div>" +
      "</div>"
    );
  }

  function groupHintBase(group) {
    var min = group.min == null ? 0 : group.min;
    var max = group.max == null ? 0 : group.max;
    if (min === 1 && max === 1) return "Obrigatório";
    if (min > 0 && max > min) return "Escolha " + min + " a " + max;
    if (min > 0) return "Escolha ao menos " + min;
    if (max === 1) return "Opcional";
    if (max > 1) return "Opcional · até " + max;
    return "";
  }

  function renderSheet() {
    if (!S || !S.sheet || !S.root) return;
    var oldScrim = $(".m-scrim", S.root);
    if (oldScrim) {
      oldScrim.parentNode.removeChild(oldScrim);
    }
    var oldSheet = $(".m-sheet", S.root);
    if (oldSheet) {
      oldSheet.parentNode.removeChild(oldSheet);
    }

    var wrap = document.createElement("div");
    wrap.innerHTML = sheetMarkup();

    var scrim = $(".m-scrim", wrap);
    var sheet = $(".m-sheet", wrap);
    S.root.appendChild(scrim);
    S.root.appendChild(sheet);

    // pré-seleção (edição)
    var sel = S.sheet.sel;
    var groups = S.sheet.product.options || [];
    groups.forEach(function (group, gi) {
      var picked = sel[gi] || [];
      picked.forEach(function (ii) {
        var inp = $('.m-opt__inp[data-gi="' + gi + '"][data-ii="' + ii + '"]', sheet);
        if (inp) inp.checked = true;
      });
    });

    // observação
    var noteEl = $('[data-role="note"]', sheet);
    if (noteEl) noteEl.value = S.sheet.note;

    updateSheet();

    // eventos
    $$("[data-act='sheet-close']", sheet).forEach(function (el) {
      el.addEventListener("click", closeSheet);
    });
    if (scrim) scrim.addEventListener("click", closeSheet);

    var img = $('[data-role="sheet-img"]', sheet);
    if (img) {
      img.addEventListener("error", function () {
        if (img.parentNode) img.parentNode.removeChild(img);
      });
    }

    $$(".m-opt__inp", sheet).forEach(function (inp) {
      inp.addEventListener("change", function () {
        enforceGroupMax(inp);
        collectSheetSelection();
        updateSheet();
      });
    });

    var minus = $("[data-act='sqty-m']", sheet);
    var plus = $("[data-act='sqty-p']", sheet);
    if (minus) {
      minus.addEventListener("click", function () {
        S.sheet.qty = Math.max(1, S.sheet.qty - 1);
        updateSheet();
      });
    }
    if (plus) {
      plus.addEventListener("click", function () {
        S.sheet.qty = Math.min(MAX_QTY, S.sheet.qty + 1);
        updateSheet();
      });
    }

    var add = $("[data-act='sheet-add']", sheet);
    if (add) {
      add.addEventListener("click", function () {
        confirmSheet();
      });
    }
  }

  function enforceGroupMax(inp) {
    var gi = Number(inp.getAttribute("data-gi"));
    var group = S.sheet.product.options[gi];
    if (!group || !inp.checked) return;
    if ((group.max == null ? 0 : group.max) > 1) {
      var sheet = $(".m-sheet", S.root);
      var count = $$('.m-opt__inp[data-gi="' + gi + '"]:checked', sheet).length;
      if (count > group.max) {
        inp.checked = false;
      }
    }
  }

  function collectSheetSelection() {
    var sheet = $(".m-sheet", S.root);
    if (!sheet) return;
    var sel = {};
    $$(".m-grp", sheet).forEach(function (grp) {
      var gi = Number(grp.getAttribute("data-gi"));
      sel[gi] = [];
      $$('.m-opt__inp[data-gi="' + gi + '"]:checked', sheet).forEach(function (inp) {
        sel[gi].push(Number(inp.getAttribute("data-ii")));
      });
    });
    S.sheet.sel = sel;
  }

  function updateSheet() {
    var sheet = $(".m-sheet", S.root);
    if (!sheet) return;
    var p = S.sheet.product;
    var groups = p.options || [];
    var sel = S.sheet.sel;

    // preço unitário + validação
    var unit = Number(S.sheet.basePrice != null ? S.sheet.basePrice : p.price) || 0;
    var invalid = false;
    groups.forEach(function (group, gi) {
      var min = group.min == null ? 0 : group.min;
      var max = group.max == null ? 0 : group.max;
      var picked = sel[gi] || [];
      picked.forEach(function (ii) {
        var it = group.items[ii];
        if (it) unit += Number(it.price) || 0;
      });

      // bloqueia opções além do máximo
      var isCheck = !(min === 1 && max === 1);
      if (isCheck && max > 0 && picked.length >= max) {
        $$('.m-opt__inp[data-gi="' + gi + '"]:not(:checked)', sheet).forEach(function (inp) {
          inp.disabled = true;
        });
        $$('.m-opt[data-gi="' + gi + '"]', sheet).forEach(function (row) {
          var inp = $(".m-opt__inp", row);
          if (inp && !inp.checked) row.classList.add("is-locked");
          else row.classList.remove("is-locked");
        });
      } else {
        $$('.m-opt__inp[data-gi="' + gi + '"]', sheet).forEach(function (inp) {
          inp.disabled = false;
        });
        $$('.m-opt[data-gi="' + gi + '"]', sheet).forEach(function (row) {
          row.classList.remove("is-locked");
        });
      }

      // hint de estado
      var hint = $('.m-grp[data-gi="' + gi + '"] [data-role="hint"]', sheet);
      if (hint) {
        var base = groupHintBase(group);
        if (min > 0 && picked.length < min) {
          hint.textContent =
            "Faltam " + (min - picked.length) + " — " + base.toLowerCase();
          hint.classList.add("is-err");
          invalid = true;
        } else if (max > 1 && min > 0) {
          hint.textContent = picked.length + "/" + max + " selecionado" + (picked.length === 1 ? "" : "s");
          hint.classList.remove("is-err");
        } else {
          hint.textContent = base;
          hint.classList.remove("is-err");
        }
      }
    });

    // quantidade
    var qtyEl = $('[data-role="qty"]', sheet);
    if (qtyEl) qtyEl.textContent = S.sheet.qty;
    var minus = $("[data-act='sqty-m']", sheet);
    if (minus) minus.disabled = S.sheet.qty <= 1;

    // botão
    var btn = $("[data-act='sheet-add']", sheet);
    if (btn) {
      btn.disabled = invalid;
      var label = $('[data-role="add-label"]', btn);
      if (label) {
        label.textContent =
          (S.sheet.editKey ? "SALVAR" : "ADICIONAR") + " • " + money(unit * S.sheet.qty);
      }
    }
  }

  function confirmSheet() {
    if (!S.sheet) return;
    var p = S.sheet.product;
    var noteEl = $('[data-role="note"]', S.root);
    var note = noteEl ? noteEl.value : "";
    S.sheet.note = note;
    collectSheetSelection();

    var line = buildLine(p, S.sheet.sel, S.sheet.qty, note, S.sheet.basePrice);
    var editKey = S.sheet.editKey;
    if (editKey) removeLine(editKey);
    upsertLine(line);
    closeSheet();
    if (S && S.screen === "cart") render();
    else syncCartBar();
  }

  function closeSheet() {
    S.sheet = null;
    var root = S && S.root;
    if (!root) return;
    var scrim = $(".m-scrim", root);
    if (scrim) scrim.parentNode.removeChild(scrim);
    var sheet = $(".m-sheet", root);
    if (sheet) sheet.parentNode.removeChild(sheet);
  }

  /* ---------- Tela: Carrinho ---------- */

  function renderCartScreen(root) {
    var lines = S.cart;
    root.innerHTML = barMarkup("Seu pedido", "Seu pedido");

    var wrap = document.createElement("div");
    wrap.className = "m-screen m-inner";
    var heading = document.createElement("h1");
    heading.className = "m-heading";
    heading.textContent = "Seu pedido";

    var body = document.createElement("div");
    body.id = "cart-items";

    var list = "";
    if (!lines.length) {
      list +=
        '<div class="m-empty"><span class="m-empty__glyph">🛒</span>' +
        "Seu carrinho está vazio." +
        "</div>";
    } else {
      lines.forEach(function (l) {
        list += cartItemMarkup(l);
      });
    }
    body.innerHTML = list;

    wrap.appendChild(heading);
    wrap.appendChild(body);
    root.appendChild(wrap);

    // navegação
    $$("[data-act='menu-back']", root).forEach(function (b) {
      b.addEventListener("click", function () {
        S.screen = "menu";
        render();
      });
    });

    // itens: quantidade / editar / remover
    $$(".m-item", root).forEach(function (itemEl) {
      var key = itemEl.getAttribute("data-key");
      var minus = $("[data-act='qty-m']", itemEl);
      var plus = $("[data-act='qty-p']", itemEl);
      if (minus) {
        minus.disabled = lineQty(key) <= 1;
        minus.addEventListener("click", function () {
          setQty(key, -1);
          render();
        });
      }
      if (plus) {
        plus.addEventListener("click", function () {
          setQty(key, 1);
          render();
        });
      }
      var edit = $("[data-act='edit-item']", itemEl);
      if (edit) {
        edit.addEventListener("click", function () {
          var line = lineByKey(key);
          var product = productById(S.item, line.productId);
          if (product) openSheet(product, line);
        });
      }
      var remove = $("[data-act='remove-item']", itemEl);
      if (remove) {
        remove.addEventListener("click", function () {
          removeLine(key);
          render();
        });
      }
    });

    // barra inferior
    var totals = cartTotals();
    var bar = document.createElement("div");
    bar.className = "m-ctabar";
    bar.innerHTML =
      '<div class="m-ctabar__inner">' +
      '<div class="m-cartbar__txt">' +
      '<span class="m-cartbar__count">Subtotal</span>' +
      '<span class="m-cartbar__amt">' +
      money(totals.amount) +
      "</span>" +
      "</div>" +
      '<button type="button" class="m-btn m-btn--primary" data-act="cart-continue"' +
      (lines.length ? "" : " disabled") +
      ">CONTINUAR</button>" +
      "</div>";
    var cont = $("[data-act='cart-continue']", bar);
    cont.addEventListener("click", function () {
      if (!S.cart.length) return;
      S.chk = {
        step: null,
        receipt: null,
        address: { rua: "", numero: "", complemento: "", bairro: "" },
        pay: null,
        change: false,
        changeFor: "",
        note: "",
      };
      S.screen = "checkout";
      var steps = checkoutSteps();
      S.chk.step = steps[0] || "summary";
      render();
    });
    root.appendChild(bar);
  }

  function cartItemMarkup(l) {
    var cfg = "";
    var opts = l.opts || [];
    opts.forEach(function (o) {
      cfg += '<span class="m-item__cfg-line">+ ' + esc(o.name) + "</span>";
    });
    if (l.note) {
      cfg += '<span class="m-item__cfg-line">' + esc(l.note) + "</span>";
    }
    return (
      '<div class="m-item" data-key="' +
      esc(l.key) +
      '">' +
      '<div class="m-item__top">' +
      '<div class="m-item__name">' +
      esc(l.name) +
      "</div>" +
      '<div class="m-item__price">' +
      money((l.unit || 0) * l.qty) +
      "</div>" +
      "</div>" +
      (cfg ? '<div class="m-item__cfg">' + cfg + "</div>" : "") +
      '<div class="m-item__bar">' +
      '<div class="m-stepper">' +
      '<button type="button" class="m-stepper__btn" data-act="qty-m" aria-label="Diminuir">−</button>' +
      '<span class="m-stepper__n">' +
      l.qty +
      "</span>" +
      '<button type="button" class="m-stepper__btn" data-act="qty-p" aria-label="Aumentar">+</button>' +
      "</div>" +
      '<button type="button" class="m-btn m-btn--mini m-btn--ghost" data-act="edit-item">Editar</button>' +
      '<button type="button" class="m-btn m-btn--mini m-btn--danger" data-act="remove-item">Remover</button>' +
      "</div>" +
      "</div>"
    );
  }

  function lineQty(key) {
    var l = lineByKey(key);
    return l ? l.qty : 1;
  }

  function lineByKey(key) {
    for (var i = 0; i < S.cart.length; i++) {
      if (S.cart[i].key === key) return S.cart[i];
    }
    return null;
  }

  /* ---------- Checkout ---------- */

  function needPaymentStep() {
    var pays = availPayments(S.item);
    return pays.length > 1 || pays.indexOf("cash") !== -1;
  }

  function checkoutSteps() {
    var steps = [];
    if (availReceipts(S.item).length > 1) steps.push("receipt");
    else if (!S.chk.receipt) {
      S.chk.receipt = availReceipts(S.item)[0] || "pickup";
    }
    if (S.chk.receipt === "delivery") steps.push("address");
    if (needPaymentStep()) steps.push("payment");
    steps.push("note");
    steps.push("summary");
    return steps;
  }

  function renderCheckoutScreen(root) {
    var step = S.chk.step;
    var titles = {
      receipt: "Recebimento",
      address: "Endereço",
      payment: "Pagamento",
      note: "Observação",
      summary: "Resumo",
    };
    root.innerHTML =
      barMarkup(titles[step] || "Checkout", "Checkout") +
      '<div class="m-screen m-inner" data-role="step-body"></div>';

    var body = $("[data-role='step-body']", root);
    var t = {
      receipt: renderStepReceipt,
      address: renderStepAddress,
      payment: renderStepPayment,
      note: renderStepNote,
      summary: renderStepSummary,
    };
    (t[step] || t.summary)(body);

    // voltar
    $$("[data-act='step-back']", root).forEach(function (b) {
      b.addEventListener("click", goBackStep);
    });

    // barra inferior (exceto resumo, que monta a própria)
    if (step !== "summary") {
      var bar = document.createElement("div");
      bar.className = "m-ctabar";
      var needsChoice =
        (step === "receipt" && !S.chk.receipt) ||
        (step === "payment" && !S.chk.pay);
      bar.innerHTML =
        '<div class="m-ctabar__inner">' +
        '<button type="button" class="m-btn m-btn--primary m-btn--block" data-act="step-continue"' +
        (needsChoice ? " disabled" : "") +
        ">CONTINUAR</button>" +
        "</div>";
      $("[data-act='step-continue']", bar).addEventListener("click", advanceStep);
      root.appendChild(bar);
    }
  }

  function renderStepReceipt(body) {
    var heading = document.createElement("h1");
    heading.className = "m-heading";
    heading.textContent = "Como deseja receber?";

    var sub = document.createElement("p");
    sub.className = "m-sub";
    sub.textContent = "Escolha a forma de recebimento do seu pedido.";

    body.appendChild(heading);
    body.appendChild(sub);

    var opts = [
      { id: "delivery", glyph: "🚚", label: "Entrega", meta: "Receba no endereço informado" },
      { id: "pickup", glyph: "🏪", label: "Retirar no local", meta: "Passe aqui para buscar" },
    ];
    opts.forEach(function (o) {
      if (availReceipts(S.item).indexOf(o.id) === -1) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "m-pick";
      btn.setAttribute("data-pick", o.id);
      if (S.chk.receipt === o.id) btn.classList.add("is-on");
      btn.innerHTML =
        '<span class="m-pick__radio" aria-hidden="true"></span>' +
        '<span class="m-pick__glyph" aria-hidden="true">' +
        o.glyph +
        "</span>" +
        '<span class="m-pick__text"><span class="m-pick__label">' +
        o.label +
        "</span><span class='m-pick__meta'>" +
        o.meta +
        "</span></span>";
      btn.addEventListener("click", function () {
        S.chk.receipt = o.id;
        $$(".m-pick", body).forEach(function (el) {
          el.classList.toggle("is-on", el.getAttribute("data-pick") === o.id);
        });
        var cont = $("[data-act='step-continue']", S.root);
        if (cont) cont.disabled = false;
      });
      body.appendChild(btn);
    });
  }

  function renderStepAddress(body) {
    var heading = document.createElement("h1");
    heading.className = "m-heading";
    heading.textContent = "Endereço de entrega";

    var sub = document.createElement("p");
    sub.className = "m-sub";
    sub.textContent = "Para onde devemos levar seu pedido?";

    body.appendChild(heading);
    body.appendChild(sub);

    var wrap = document.createElement("div");
    wrap.innerHTML =
      '<label class="m-field-label" for="f-rua">Rua *</label>' +
      '<input class="m-field" id="f-rua" data-field="rua" maxlength="120" placeholder="Rua" autocomplete="street-address">' +
      '<div class="m-fieldgrid">' +
      '<div><label class="m-field-label" for="f-num">Número *</label>' +
      '<input class="m-field" id="f-num" data-field="numero" maxlength="10" placeholder="Número" inputmode="numeric">' +
      "</div>" +
      '<div><label class="m-field-label" for="f-compl">Complemento</label>' +
      '<input class="m-field" id="f-compl" data-field="complemento" maxlength="60" placeholder="Apto, casa…">' +
      "</div>" +
      "</div>" +
      '<label class="m-field-label" for="f-bairro">Bairro *</label>' +
      '<input class="m-field" id="f-bairro" data-field="bairro" maxlength="60" placeholder="Bairro">' +
      '<span class="m-err" data-role="err" hidden></span>';

    var a = S.chk.address || {};
    var setVal = function (key, id) {
      var el = document.getElementById(id);
      if (el && a[key]) el.value = a[key];
    };
    setVal("rua", "f-rua");
    setVal("numero", "f-num");
    setVal("complemento", "f-compl");
    setVal("bairro", "f-bairro");

    body.appendChild(wrap);
  }

  function renderStepPayment(body) {
    var heading = document.createElement("h1");
    heading.className = "m-heading";
    heading.textContent = "Como deseja pagar?";

    var sub = document.createElement("p");
    sub.className = "m-sub";
    sub.textContent = "Escolha a forma de pagamento.";

    body.appendChild(heading);
    body.appendChild(sub);

    var defs = {
      pix: { glyph: "💠", label: "Pix", meta: "Pagamento instantâneo" },
      cash: { glyph: "💵", label: "Dinheiro", meta: "Pague na entrega/retirada" },
      card: { glyph: "💳", label: "Cartão", meta: "Crédito ou débito" },
    };
    availPayments(S.item).forEach(function (id) {
      var d = defs[id] || { glyph: "💳", label: id, meta: "" };
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "m-pick";
      btn.setAttribute("data-pay", id);
      if (S.chk.pay === id) btn.classList.add("is-on");
      btn.innerHTML =
        '<span class="m-pick__radio" aria-hidden="true"></span>' +
        '<span class="m-pick__glyph" aria-hidden="true">' +
        d.glyph +
        "</span>" +
        '<span class="m-pick__text"><span class="m-pick__label">' +
        d.label +
        "</span><span class='m-pick__meta'>" +
        d.meta +
        "</span></span>";
      btn.addEventListener("click", function () {
        S.chk.pay = id;
        $$(".m-pick", body).forEach(function (el) {
          el.classList.toggle("is-on", el.getAttribute("data-pay") === id);
        });
        toggleTroco(body);
        var cont = $("[data-act='step-continue']", S.root);
        if (cont) cont.disabled = false;
      });
      body.appendChild(btn);
    });

    // bloco de troco (somente dinheiro)
    var troco = document.createElement("div");
    troco.className = "m-troco";
    troco.setAttribute("data-role", "troco");
    troco.hidden = S.chk.pay !== "cash";
    troco.innerHTML =
      '<span class="m-field-label">Precisa de troco?</span>' +
      '<button type="button" class="m-pick" data-change="no">' +
      '<span class="m-pick__radio" aria-hidden="true"></span>' +
      '<span class="m-pick__text"><span class="m-pick__label">Não</span>' +
      "<span class='m-pick__meta'>Não precisa de troco</span></span></button>" +
      '<button type="button" class="m-pick" data-change="yes">' +
      '<span class="m-pick__radio" aria-hidden="true"></span>' +
      '<span class="m-pick__text"><span class="m-pick__label">Sim</span>' +
      "<span class='m-pick__meta'>Vou informar o valor</span></span></button>" +
      '<div class="m-troco__field" data-role="change-field" hidden>' +
      '<label class="m-field-label" for="f-troco">Troco para R$</label>' +
      '<input class="m-field" id="f-troco" data-field="changeFor" maxlength="10" placeholder="Ex.: 50,00" inputmode="decimal">' +
      '<span class="m-err" data-role="err" hidden></span>' +
      "</div>";
    body.appendChild(troco);
    toggleTroco(body);

    $$("[data-change]", troco).forEach(function (b) {
      b.addEventListener("click", function () {
        S.chk.change = b.getAttribute("data-change") === "yes";
        $$("[data-change]", troco).forEach(function (el) {
          el.classList.toggle("is-on", el === b);
        });
        var field = $("[data-role='change-field']", troco);
        if (field) field.hidden = !S.chk.change;
      });
    });

    // pré-seleções (quando voltar de etapas seguintes)
    if (S.chk.pay) {
      var payBtn = $('.m-pick[data-pay="' + S.chk.pay + '"]', body);
      if (payBtn) payBtn.classList.add("is-on");
      if (S.chk.change) {
        var yes = $("[data-change='yes']", troco);
        if (yes) yes.classList.add("is-on");
        var field = $("[data-role='change-field']", troco);
        if (field) field.hidden = false;
        var inp = $('[data-field="changeFor"]', troco);
        if (inp && S.chk.changeFor) inp.value = S.chk.changeFor;
      } else {
        var noBtn = $("[data-change='no']", troco);
        if (noBtn) noBtn.classList.add("is-on");
      }
    }
  }

  function toggleTroco(body) {
    var troco = $("[data-role='troco']", body);
    if (!troco) return;
    troco.hidden = S.chk.pay !== "cash";
    if (troco.hidden) S.chk.change = false;
  }

  function renderStepNote(body) {
    var heading = document.createElement("h1");
    heading.className = "m-heading";
    heading.textContent = "Alguma observação?";

    var sub = document.createElement("p");
    sub.className = "m-sub";
    sub.textContent = "Opicional — conte algo sobre o pedido em geral.";

    body.appendChild(heading);
    body.appendChild(sub);

    var wrap = document.createElement("div");
    wrap.innerHTML =
      '<textarea class="m-field" data-field="note" rows="3" maxlength="300" placeholder="Ex.: Entregar na portaria…">' +
      esc(S.chk.note || "") +
      "</textarea>";
    body.appendChild(wrap);
  }

  function renderStepSummary(body) {
    var heading = document.createElement("h1");
    heading.className = "m-heading";
    heading.textContent = "Confira seu pedido";

    var sub = document.createElement("p");
    sub.className = "m-sub";
    sub.textContent = "Confira tudo antes de enviar.";

    body.appendChild(heading);
    body.appendChild(sub);

    var wrap = document.createElement("div");
    wrap.className = "m-sum";

    // itens
    var cardItems = document.createElement("div");
    cardItems.className = "m-sum__card";
    S.cart.forEach(function (l) {
      var p = productById(S.item, l.productId) || { category: "" };
      var cfg = "";
      (l.opts || []).forEach(function (o) {
        cfg += "+ " + o.name + "\n";
      });
      if (l.note) cfg += l.note + "\n";
      var div = document.createElement("div");
      div.className = "m-sum__row";
      div.innerHTML =
        '<span class="m-sum__glyph" aria-hidden="true">' +
        emojiForProduct(S.item, p) +
        "</span>" +
        '<div class="m-sum__body">' +
        '<div class="m-sum__line">' +
        l.qty +
        "x " +
        esc(l.name) +
        "</div>" +
        (cfg ? '<div class="m-sum__cfg">' + esc(cfg) + "</div>" : "") +
        "</div>" +
        '<span class="m-sum__amt">' +
        money((l.unit || 0) * l.qty) +
        "</span>";
      cardItems.appendChild(div);
    });

    var totals = cartTotals();
    var totalRow = document.createElement("div");
    totalRow.className = "m-sum__totals";
    totalRow.innerHTML =
      '<span class="m-sum__total-label">Total</span>' +
      '<span class="m-sum__total">' +
      money(totals.amount) +
      "</span>";

    var cardMeta = document.createElement("div");
    cardMeta.className = "m-sum__card";
    var meta = "";
    if (S.chk.receipt === "delivery") {
      meta +=
        "<strong>🚚 Entrega</strong><br>📍 " +
        esc(
          (S.chk.address.rua || "") +
            ", " +
            S.chk.address.numero +
            (S.chk.address.complemento ? ", " + S.chk.address.complemento : "")
        ) +
        "<br>" +
        esc(S.chk.address.bairro || "") +
        "<br><br>";
    } else {
      meta += "<strong>🏪 Retirar no local</strong><br><br>";
    }
    var payDefs = {
      pix: "💠 Pix",
      cash: "💵 Dinheiro",
      card: "💳 Cartão",
    };
    meta += "<strong>" + (payDefs[S.chk.pay] || S.chk.pay) + "</strong>";
    if (S.chk.pay === "cash" && S.chk.change) {
      meta += "<br>Troco para " + money(parseNumber(S.chk.changeFor) || 0);
    }
    if (S.chk.note) {
      meta += "<br><br><strong>Observação:</strong><br>" + esc(S.chk.note);
    }
    cardMeta.innerHTML = '<div class="m-sum__meta">' + meta + "</div>";

    wrap.appendChild(cardItems);
    wrap.appendChild(totalRow);
    wrap.appendChild(cardMeta);
    body.appendChild(wrap);

    // botão enviar
    var digits = whatsappDigits(S.item);
    var bar = document.createElement("div");
    bar.className = "m-ctabar";
    bar.innerHTML =
      '<div class="m-ctabar__inner">' +
      '<button type="button" class="m-btn m-btn--primary m-btn--block" data-act="send"' +
      (digits ? "" : " disabled") +
      ">🟢 ENVIAR PEDIDO</button>" +
      "</div>";
    $("[data-act='send']", bar).addEventListener("click", sendOrder);
    body.appendChild(bar);

    if (!digits) {
      var warn = document.createElement("p");
      warn.className = "m-sub";
      warn.style.textAlign = "center";
      warn.textContent =
        "Este negócio ainda não configurou um número de WhatsApp para receber pedidos.";
      body.appendChild(warn);
    }
  }

  /* ---------- Avançar / voltar no checkout ---------- */

  function collectCurrentStep() {
    var step = S.chk.step;
    var body = $("[data-role='step-body']", S.root);
    if (!body) return;
    if (step === "address") {
      ["rua", "numero", "complemento", "bairro"].forEach(function (f) {
        var el = $('[data-field="' + f + '"]', body);
        if (el) S.chk.address[f] = el.value.trim();
      });
    } else if (step === "payment") {
      $$('[data-field]', body).forEach(function (el) {
        if (el.getAttribute("data-field") === "changeFor") {
          S.chk.changeFor = el.value.trim();
        }
      });
    } else if (step === "note") {
      var el = $('[data-field="note"]', body);
      if (el) S.chk.note = el.value.trim();
    }
  }

  function advanceStep() {
    var step = S.chk.step;
    collectCurrentStep();

    if (step === "address") {
      var a = S.chk.address;
      var err = $(".m-err", S.root);
      if (!a.rua || !a.numero || !a.bairro) {
        if (err) {
          err.textContent =
            "Preencha rua, número e bairro para continuar.";
          err.hidden = false;
        }
        return;
      }
      if (err) err.hidden = true;
    }

    if (step === "payment" && S.chk.pay === "cash") {
      var errEl = $(".m-err", S.root);
      if (S.chk.change && !(parseNumber(S.chk.changeFor) > 0)) {
        if (errEl) {
          errEl.textContent = "Informe o valor para o troco.";
          errEl.hidden = false;
        }
        return;
      }
      if (errEl) errEl.hidden = true;
    }

    var steps = checkoutSteps();
    var idx = steps.indexOf(step);
    var next = steps[idx + 1];
    if (next) {
      S.chk.step = next;
      render();
    }
  }

  function goBackStep() {
    collectCurrentStep();
    var steps = checkoutSteps();
    var idx = steps.indexOf(S.chk.step);
    if (idx > 0) {
      S.chk.step = steps[idx - 1];
      render();
    } else {
      S.screen = "cart";
      S.chk = null;
      render();
    }
  }

  /* ---------- Envio para o WhatsApp ---------- */

  function orderMessage() {
    var out = [];
    out.push("Olá! Gostaria de fazer um pedido:");
    out.push("");

    S.cart.forEach(function (l) {
      var p = productById(S.item, l.productId) || { category: "" };
      var head =
        emojiForProduct(S.item, p) +
        " " +
        l.qty +
        "x " +
        l.name +
        " — " +
        money((l.unit || 0) * l.qty);
      out.push(head);
      (l.opts || []).forEach(function (o) {
        out.push("   + " + o.name);
      });
      if (l.note) out.push("   " + l.note);
      out.push("");
    });

    if (S.chk.receipt === "delivery") {
      var a = S.chk.address || {};
      out.push("📦 Entrega");
      out.push("📍 " + a.rua + ", " + a.numero + (a.complemento ? ", " + a.complemento : ""));
      out.push(a.bairro);
      out.push("");
    } else {
      out.push("🏪 Retirar no local");
      out.push("");
    }

    if (S.chk.pay === "pix") out.push("💠 Pix");
    else if (S.chk.pay === "cash") {
      out.push("💵 Dinheiro");
      if (S.chk.change) {
        out.push("   Troco para " + money(parseNumber(S.chk.changeFor) || 0));
      }
    } else {
      out.push("💳 Cartão");
    }
    out.push("");
    out.push("💰 Total: " + money(cartTotals().amount));

    if (S.chk.note) {
      out.push("");
      out.push("Observação:");
      out.push(S.chk.note);
    }

    return out.join("\n");
  }

  function sendOrder() {
    var digits = whatsappDigits(S.item);
    if (!digits) return;

    // 1. montar a mensagem
    var msg = orderMessage();

    // 2. abrir o WhatsApp com a mensagem preenchida
    var url = "https://wa.me/" + digits + "?text=" + encodeURIComponent(msg);
    window.open(url, "_blank", "noopener");

    // 3. limpar o carrinho salvo (somente a chave deste negócio)
    S.cart = [];
    persistCart();

    // 4. voltar à página principal do negócio
    leaveToBusiness();
  }

  /* ---------- Integração com a página do negócio ---------- */

  var BURGER_ICON =
    '<svg class="action__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<path d="M4.2 9.6C4.2 6.6 6.6 4.2 9.6 4.2h4.8c3 0 5.4 2.4 5.4 5.4"/>' +
    '<path d="M5.8 13.6h12.4"/>' +
    '<path d="M6.4 16.4h11.2"/>' +
    '<path d="M8.6 19.2h6.8"/>' +
    "</svg>";

  // Cria o botão principal do módulo ("Fazer pedido"). O js/app.js o coloca
  // no TOPO das ações da página, com o MESMO tamanho dos demais botões
  // (classe .action) — só o fundo em gradiente o destaca como ação principal.
  function createCta(item) {
    if (!isEnabled(item)) return null;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "action action--cta";
    // mesma estrutura dos demais botões: <span> (sem classe) envolvendo o
    // ícone + <span class="action__label"> — garante o MESMO tamanho.
    btn.innerHTML =
      "<span>" + BURGER_ICON + "</span>" +
      '<span class="action__label">Fazer pedido</span>';
    btn.addEventListener("click", function () {
      openMenu(item);
    });
    return btn;
  }

  // API pública
  window.OrbiaMenu = {
    createCta: createCta,
    isEnabled: isEnabled,
    // true quando o cardápio está aberto para este slug (o roteador usa para
    // não re-renderizar a página por baixo do módulo na mesma rota)
    isActiveFor: function (slug) {
      return !!(S && S.slug === slug);
    },
    // fecha o módulo quando o roteador troca de página
    close: function () {
      S = null;
    },
    // localiza um produto do cardápio pelo id (usado pela vitrine de ofertas)
    findProduct: productById,
    // Abre um produto DENTRO da experiência de cardápio, usado pela vitrine
    // de ofertas (módulo promotions): com opções abre o bottom sheet, sem
    // opções adiciona direto. basePrice opcional = preço promocional da
    // oferta; sem ele, usa o preço normal do produto.
    openProduct: function (item, productId, basePrice) {
      if (!isEnabled(item)) return false;
      var product = productById(item, productId);
      if (!product) return false;
      openMenu(item);
      if (product.options && product.options.length) {
        openSheet(product, null, basePrice);
      } else {
        quickAdd(product, basePrice);
      }
      return true;
    },
    debug: {
      orderMessage: function () {
        return S ? orderMessage() : "";
      },
    },
  };
})();
