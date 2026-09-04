/* ==========================================================================
   Orbia Link — js/promotions.js
   Vitrine de ofertas (Etapa 4) — módulo "promotions".

   Renderiza, na página principal do negócio, uma vitrine comercial de
   promoções integrada ao cardápio existente (js/menu.js):

     - promoção featured (featured: true) COM imagem própria -> banner
       grande com "PEDIR AGORA";
     - demais promoções -> o MESMO card horizontal do cardápio
       (componente .m-prod, estilos em css/menu.css), acrescentando
       preço original cortado + preço promocional;
     - cards usam os dados do PRODUTO (nome/descrição/imagem do cardápio)
       e os preços da promoção; a promoção NUNCA duplica o produto.

   Clique em uma promoção abre o produto dentro da experiência de cardápio
   (bottom sheet com opções, ou adição direta se não houver opções) e o
   carrinho/checkout/WhatsApp continuam sendo os mesmos do módulo menu.

   Regras de segurança:
     - sem modules.promotions.enabled === true (ou lista vazia) -> nada é
       renderizado (sem título, sem espaço vazio, sem botão);
     - product_id que não existe no cardápio -> a promoção é ignorada
       (nenhuma ação quebrada, nenhum erro fatal);
     - exige modules.menu.enabled === true: a ação da promoção abre o
       cardápio; sem o menu habilitado a promoção seria um botão morto.

   Dependências opcionais: js/app.js (página do negócio) e js/menu.js
   (window.OrbiaMenu.findProduct / openProduct). Se ausentes, createShowcase
   retorna null e a página fica como antes.
   ========================================================================== */

(function () {
  "use strict";

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

  function cfgOf(item) {
    return item && item.modules && item.modules.promotions
      ? item.modules.promotions
      : null;
  }

  function isEnabled(item) {
    var c = cfgOf(item);
    return !!(c && c.enabled === true);
  }

  // A vitrine aponta para produtos reais do cardápio: sem o módulo menu
  // habilitado não há para onde abrir o produto (evita botão morto).
  function menuEnabled(item) {
    return !!(
      window.OrbiaMenu &&
      window.OrbiaMenu.isEnabled &&
      window.OrbiaMenu.isEnabled(item)
    );
  }

  function findProduct(item, productId) {
    if (window.OrbiaMenu && window.OrbiaMenu.findProduct) {
      return window.OrbiaMenu.findProduct(item, productId);
    }
    // fallback local (caso menu.js não tenha carregado)
    var cfg = item && item.modules && item.modules.menu;
    var prods = (cfg && cfg.products) || [];
    for (var i = 0; i < prods.length; i++) {
      if (prods[i].id === productId) return prods[i];
    }
    return null;
  }

  function openProduct(item, promo, product) {
    if (!window.OrbiaMenu || !window.OrbiaMenu.openProduct) return;
    var basePrice = promo.price != null ? promo.price : product.price;
    window.OrbiaMenu.openProduct(item, product.id, basePrice);
  }

  // Card horizontal promocional: MESMA estrutura do card do cardápio
  // (.m-prod) com os dados do PRODUTO e os preços da promoção.
  function promoCardMarkup(product, promo) {
    var img = product.image
      ? '<img class="m-prod__img" src="' +
        esc(product.image) +
        '" alt="" loading="lazy">'
      : "";
    var oldPrice =
      promo.original_price != null
        ? '<s class="m-old-price">' + money(promo.original_price) + "</s>"
        : "";
    var newPrice = money(promo.price != null ? promo.price : product.price);
    return (
      '<div class="m-prod" data-promo="' +
      esc(promo.id) +
      '">' +
      img +
      '<div class="m-prod__info">' +
      '<div class="m-prod__name">' +
      esc(product.name) +
      "</div>" +
      (product.description
        ? '<div class="m-prod__desc">' + esc(product.description) + "</div>"
        : "") +
      '<div class="m-prod__meta">' +
      '<span class="m-prod__price">' +
      oldPrice +
      '<span class="m-new-price">' +
      newPrice +
      "</span></span>" +
      '<button type="button" class="m-add" data-act="promo-add" aria-label="Adicionar ' +
      esc(product.name) +
      '">+</button>' +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  // Banner da promoção em destaque (featured + imagem própria)
  function featuredMarkup(promo, fallbackPrice) {
    var oldPrice =
      promo.original_price != null
        ? '<s class="m-old-price">' + money(promo.original_price) + "</s>"
        : "";
    return (
      '<img class="promo-feat__img" src="' +
      esc(promo.image) +
      '" alt="" loading="lazy">' +
      '<span class="promo-feat__body">' +
      '<span class="promo-feat__title">' +
      esc(promo.title || "") +
      "</span>" +
      (promo.description
        ? '<span class="promo-feat__desc">' + esc(promo.description) + "</span>"
        : "") +
      '<span class="promo-feat__prices">' +
      oldPrice +
      '<span class="promo-feat__price">' +
      money(promo.price != null ? promo.price : fallbackPrice) +
      "</span></span>" +
      '<span class="promo-feat__cta">PEDIR AGORA</span>' +
      "</span>"
    );
  }

  // Monta a seção "Ofertas de hoje" para a página do negócio.
  // Retorna o elemento <section> ou null (quando nada deve aparecer).
  function createShowcase(item) {
    if (!isEnabled(item)) return null;
    if (!menuEnabled(item)) return null;

    var cfg = cfgOf(item);
    var items = (cfg && cfg.items) || [];
    if (!items.length) return null;

    // resolve os produtos; promoções com product_id inválido são ignoradas
    // (nenhuma ação quebrada, nenhum erro fatal)
    var resolved = [];
    items.forEach(function (promo) {
      var product = findProduct(item, promo.product_id);
      if (!product) return;
      resolved.push({ promo: promo, product: product });
    });
    if (!resolved.length) return null;

    var section = document.createElement("section");
    section.className = "promo";

    var title = document.createElement("h2");
    title.className = "promo__title";
    title.textContent = "🔥 Ofertas de hoje";
    section.appendChild(title);

    // promoção em destaque: somente com featured: true E imagem própria
    var featuredIdx = -1;
    for (var i = 0; i < resolved.length; i++) {
      if (resolved[i].promo.featured === true && resolved[i].promo.image) {
        featuredIdx = i;
        break;
      }
    }

    if (featuredIdx !== -1) {
      var feat = resolved[featuredIdx];
      var featBtn = document.createElement("button");
      featBtn.type = "button";
      featBtn.className = "promo-feat";
      featBtn.setAttribute("aria-label", "Pedir agora: " + feat.promo.title);
      featBtn.innerHTML = featuredMarkup(feat.promo, feat.product.price);
      featBtn.addEventListener("click", function () {
        openProduct(item, feat.promo, feat.product);
      });
      var featImg = featBtn.querySelector(".promo-feat__img");
      if (featImg) {
        featImg.addEventListener("error", function () {
          if (featImg.parentNode) featImg.parentNode.removeChild(featImg);
        });
      }
      section.appendChild(featBtn);
      resolved.splice(featuredIdx, 1);
    }

    // demais promoções: cards horizontais do cardápio
    if (resolved.length) {
      if (featuredIdx !== -1) {
        var sub = document.createElement("h3");
        sub.className = "promo__sub";
        sub.textContent = "Outras ofertas";
        section.appendChild(sub);
      }

      var list = document.createElement("div");
      list.className = "promo__list";

      resolved.forEach(function (entry) {
        var card = document.createElement("div");
        card.innerHTML = promoCardMarkup(entry.product, entry.promo);

        var add = card.querySelector("[data-act='promo-add']");
        if (add) {
          add.addEventListener("click", function () {
            openProduct(item, entry.promo, entry.product);
          });
        }

        var img = card.querySelector(".m-prod__img");
        if (img) {
          img.addEventListener("error", function () {
            if (img.parentNode) img.parentNode.removeChild(img);
          });
        }

        while (card.firstChild) {
          list.appendChild(card.firstChild);
        }
      });

      section.appendChild(list);
    }

    return section;
  }

  window.OrbiaPromos = {
    createShowcase: createShowcase,
    isEnabled: isEnabled,
  };
})();