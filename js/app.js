/* ==========================================================================
   Orbia Link — js/app.js
   Aplicação estática: identifica o slug na URL, carrega os dados do negócio
   em data/businesses.json e monta o cartão de visita digital.

   Modos de acesso a uma página:
     - URL amigável (produção):  /lancheria-do-ze     (rewrite/404 trick)
     - Hash (qualquer servidor): index.html#/lancheria-do-ze
     - Query (qualquer servidor): index.html?slug=lancheria-do-ze

   ESTRUTURA DE DADOS (data/businesses.json):
     - business        -> identidade do negócio (nome, descrição, logo)
     - appearance      -> tema visual
     - links           -> ações/links atuais (o que é renderizado hoje)
     - modules         -> configuração de módulos do negócio.
                          ETAPA 2: módulos existiam apenas como configuração
                          ({ "enabled": true|false }).
                          ETAPA 3: o módulo "menu" (Cardápio e Pedidos) é
                          renderizado quando modules.menu.enabled === true —
                          veja js/menu.js. Os demais módulos (booking,
                          catalog, promotions…) seguem como configuração.

   Hierarquia da página (conceitual):
     Identidade -> Links/ações -> Módulos (etapa futura, entre links e rodapé)
   ========================================================================== */

(function () {
  "use strict";

  var DATA_URL = "data/businesses.json"; // relativo ao documento
  var DEFAULT_THEME = "dark-modern";
  var VALID_THEMES = [
    "dark-modern",
    "clinic-clean",
    "midnight-purple",
    "ocean-breeze",
    "sunset-glow",
    "rosa",
    "vibrant",
    "elegant",
  ];

  var STOP_WORDS = new Set(["da", "de", "do", "das", "dos", "e", "&"]);

  var appEl = document.getElementById("app");
  var businesses = null;
  var dataError = false;

  /* ---------- Ícones (SVG inline, monocromáticos) ---------- */

  var ICONS = {
    whatsapp:
      '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/>',
    instagram:
      '<rect width="18" height="18" x="3" y="3" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>',
    maps: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    website:
      '<circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    booking:
      '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    menu: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    custom:
      '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  };

  /* ---------- Helpers ---------- */

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function iconSvg(name, className) {
    var paths = ICONS[name] || ICONS.custom;
    var cls = className || "icon";
    return (
      '<svg class="' +
      cls +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' +
      paths +
      "</svg>"
    );
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

  /* ---------- URL / rota ---------- */

  function decodeSafe(value) {
    try {
      return decodeURIComponent(value).toLowerCase();
    } catch (e) {
      return "";
    }
  }

  // retorna slug, "home" ou "notfound"
  function currentRoute() {
    var m = location.hash.match(/^#\/?([^/?#]+)/);
    if (m) {
      var h = decodeSafe(m[1]);
      return isSlugLike(h) ? h : "notfound";
    }

    var qs = new URLSearchParams(location.search);
    if (qs.has("slug")) {
      var s = qs.get("slug").trim().toLowerCase();
      return isSlugLike(s) ? s : "notfound";
    }

    var rawPath = location.pathname;
    // termina em "/" -> diretório (raiz da home ou subpasta de deploy)
    if (rawPath.length > 1 && rawPath.slice(-1) === "/") return "home";

    var path = decodeSafe(rawPath);
    path = path.replace(/\/+$/, ""); // remove barras finais
    if (!path) return "home";
    var segs = path.split("/").filter(Boolean);
    var last = segs[segs.length - 1] || "";
    if (last === "index.html" || last === "404.html") return "home";
    return isSlugLike(last) ? last : "notfound";
  }

  function isSlugLike(value) {
    return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
  }

  function homePath() {
    // caminho da raiz da aplicação (funciona em domínio raiz e subpasta)
    var path = location.pathname.replace(/\/+$/, "");
    if (!path) return "/";
    if (path.endsWith("index.html") || path.endsWith("404.html")) {
      return path.slice(0, path.lastIndexOf("/") + 1);
    }
    // rota de negócio: sobe um nível
    var segs = path.split("/");
    segs.pop();
    return segs.join("/") + "/";
  }

  function inHashMode() {
    return /^#\//.test(location.hash);
  }

  // link interno para uma página (slug) ou para a home (sem slug)
  function pageHref(slug) {
    if (inHashMode()) return slug ? "#/" + slug : "#/";
    return homePath() + (slug || "");
  }

  /* ---------- Aparência: Tema + Cor principal + Fundo (Etapa 5) ---------- */

  // Tokens injetados (e limpos) no <html> pela camada de personalização.
  // Uma única cor escolhida no JSON alimenta todos eles — o negócio nunca
  // precisa configurar cores secundárias, contraste ou hover.
  var STYLE_KEYS = [
    "--accent",
    "--accent-hover",
    "--accent-soft",
    "--accent-contrast",
    "--mono-bg",
    "--pattern-img",
  ];

  // Padrões de fundo (Stage 5): glifos SVG pequenos e discretos, repetidos
  // em um ladrilho de 200x200 com variações de rotação/escala. A cor vem da
  // accent do negócio (versão suave/transparente) — um único sistema de cor.
  var PATTERNS = {
    "fast-food": {
      glyph:
        '<path d="M3.5 7c0-2.2 3.8-3.6 8.5-3.6s8.5 1.4 8.5 3.6"/>' +
        '<path d="M4 8.6h16"/>' +
        '<path d="M3.5 10.6c0 4.2 3.8 7.2 8.5 7.2s8.5-3 8.5-7.2"/>' +
        '<path d="M7 5.2l.6 1.3M12 4.7l.6 1.3M17 5.2l-.6 1.3"/>',
    },
    coffee: {
      glyph:
        '<path d="M5 8.5h11v5c0 3.3-2.5 5.5-5.5 5.5S5 16.8 5 13.5z"/>' +
        '<path d="M16 10.2h1.7a2.6 2.6 0 0 1 0 5.2H16"/>' +
        '<path d="M7.6 4.6c-.8 1-.8 2 0 3M11.4 4.6c-.8 1-.8 2 0 3"/>' +
        '<path d="M4.5 20.5h11"/>',
    },
    pizza: {
      glyph:
        '<path d="M4.5 19.5L17 7"/>' +
        '<path d="M17 7l2.4 9.3c.3 1.2-.8 2.2-2 2.2z"/>' +
        '<path d="M4.5 19.5l12.9-3.2"/>' +
        '<circle cx="10" cy="14.6" r="1.4"/><circle cx="13.6" cy="10.8" r="1.4"/>',
    },
    barber: {
      glyph:
        '<circle cx="6.5" cy="6.5" r="3"/><circle cx="17.5" cy="17.5" r="3"/>' +
        '<path d="M8.3 8.3l7.4 7.4"/><path d="M15.7 8.3l-7.4 7.4"/>',
    },
    bamboo: {
      glyph:
        // duas hastes com nós (articulações) e folhas finas
        '<path d="M7 21.5c0-4.5.4-8.2 1.7-11.6"/>' +
        '<path d="M17.5 21.5c0-4.5-.4-8.2-1.7-11.6"/>' +
        '<path d="M5.3 17h3.4"/><path d="M5.7 12.6h2.6"/><path d="M6.2 8.9h2"/>' +
        '<path d="M15.3 17h3.4"/><path d="M15.7 12.6h2.6"/><path d="M16.2 8.9h2"/>' +
        '<path d="M10.4 7.6c1.3-.9 3-1.2 4.6-.7"/>' +
        '<path d="M10.8 9.3c1.3-.2 2.7.1 4 .9"/>',
    },
    minimal: {
      glyph:
        '<circle cx="12" cy="12" r="1.7"/>' +
        '<circle cx="4.5" cy="4.5" r="1"/><circle cx="19.5" cy="19.5" r="1"/>',
    },
  };

  /* cores: utilidades (hex, mix, luminância, contraste) */

  function hexToRgb(hex) {
    var s = String(hex).trim().replace(/^#/, "");
    if (/^[0-9a-f]{3}$/i.test(s)) {
      s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    }
    if (!/^[0-9a-f]{6}$/i.test(s)) return null;
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16),
    };
  }

  function mixRgb(a, b, t) {
    return {
      r: Math.round(a.r + (b.r - a.r) * t),
      g: Math.round(a.g + (b.g - a.g) * t),
      b: Math.round(a.b + (b.b - a.b) * t),
    };
  }

  function rgbToHex(c) {
    function p2(v) {
      v = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return v.length < 2 ? "0" + v : v;
    }
    return "#" + p2(c.r) + p2(c.g) + p2(c.b);
  }

  function channelLum(v) {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  function luminance(c) {
    return (
      0.2126 * channelLum(c.r) + 0.7152 * channelLum(c.g) + 0.0722 * channelLum(c.b)
    );
  }

  function contrastRatio(l1, l2) {
    var hi = Math.max(l1, l2);
    var lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  // Derivados de uma única cor: texto com contraste (branco, exceto para
  // cores claras que exigem texto escuro), hover escurecido e o segundo tom
  // do gradiente (accent -> tom mais claro) usado nos botões principais.
  function accentTokens(hex) {
    var c = hexToRgb(hex);
    var l = luminance(c);
    var white = { r: 255, g: 255, b: 255 };
    var black = { r: 17, g: 17, b: 17 };
    var cWhite = contrastRatio(l, luminance(white));
    var cBlack = contrastRatio(l, luminance(black));
    // texto branco sempre que tiver contraste aceitável; cores claras
    // (amarelo, laranja claro…) caem no texto escuro — nunca "claro sobre
    // claro".
    var contrast = cWhite >= 3 ? "#ffffff" : "#111111";
    return {
      accent: rgbToHex(c),
      hover: rgbToHex(mixRgb(c, black, 0.13)),
      accentLight: rgbToHex(mixRgb(c, white, 0.24)),
      contrast: contrast,
    };
  }

  // data URI do padrão de fundo, tingido com a cor do negócio (suave)
  function patternDataUri(name, accent) {
    var def = PATTERNS[name];
    if (!def) return "";
    var cells = [
      [50, 50, 0, 1],
      [150, 50, 90, 0.8],
      [50, 150, 180, 0.8],
      [150, 150, 270, 1],
    ];
    var inner = cells
      .map(function (c) {
        return (
          '<g transform="translate(' +
          c[0] +
          "," +
          c[1] +
          ") rotate(" +
          c[2] +
          ") scale(" +
          c[3] +
          ')"><g transform="translate(-12,-12)">' +
          def.glyph +
          "</g></g>"
        );
      })
      .join("");
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" ' +
      'viewBox="0 0 200 200"><g fill="none" stroke="' +
      accent +
      '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ' +
      'stroke-opacity="0.15">' +
      inner +
      "</g></svg>";
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }

  // accent do tema atualmente aplicado (usada no padrão quando o negócio
  // não define cor própria)
  function themeAccent() {
    try {
      var v = getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim();
      return v || "#6366f1";
    } catch (e) {
      return "#6366f1";
    }
  }

  // Página de negócio: aplica tema + personalização (cor/fundo) do JSON.
  // Configuração ausente/inválida cai no fallback seguro (tema padrão,
  // accent do tema, fundo sólido) — nunca quebra a página.
  function setAppearance(item) {
    var appearance = (item && item.appearance) || {};
    var theme = appearance.theme;
    document.documentElement.setAttribute(
      "data-theme",
      theme && VALID_THEMES.indexOf(theme) !== -1 ? theme : DEFAULT_THEME
    );
    applyPersonalization(appearance);
  }

  // Home / 404 / estados: remove tema e personalização (visual padrão)
  function clearAppearance() {
    document.documentElement.removeAttribute("data-theme");
    var style = document.documentElement.style;
    for (var i = 0; i < STYLE_KEYS.length; i++) {
      style.removeProperty(STYLE_KEYS[i]);
    }
    document.documentElement.removeAttribute("data-bg");
  }

  // Injetar/limpar os tokens derivados da cor principal e o fundo. O fallback
  // padrão (sem accent/background) simplesmente não injeta nada, preservando
  // os valores do tema.
  function applyPersonalization(appearance) {
    var style = document.documentElement.style;
    for (var i = 0; i < STYLE_KEYS.length; i++) {
      style.removeProperty(STYLE_KEYS[i]);
    }
    document.documentElement.removeAttribute("data-bg");

    var accentHex = null;
    if (appearance.accent) {
      var rgb = hexToRgb(appearance.accent);
      if (rgb) accentHex = rgbToHex(rgb);
    }
    if (accentHex) {
      var t = accentTokens(accentHex);
      style.setProperty("--accent", t.accent);
      style.setProperty("--accent-hover", t.hover);
      style.setProperty(
        "--accent-soft",
        "color-mix(in srgb, " + t.accent + " 14%, transparent)"
      );
      style.setProperty("--accent-contrast", t.contrast);
      style.setProperty(
        "--mono-bg",
        "linear-gradient(135deg, " + t.accent + ", " + t.accentLight + ")"
      );
    }

    var bg = appearance.background || {};
    if (bg.type === "pattern" && bg.pattern && PATTERNS[bg.pattern]) {
      // o padrão usa a cor do negócio; sem cor, usa o accent do tema
      var tint = accentHex || themeAccent();
      var uri = patternDataUri(bg.pattern, tint);
      if (uri) {
        style.setProperty("--pattern-img", uri);
        document.documentElement.setAttribute("data-bg", "pattern");
      }
    }
  }

  function setMeta(business) {
    var name = business ? business.business.name : "";
    var desc = business ? business.business.description : "";
    var title = name
      ? name + " — Orbia Link"
      : "Orbia Link — o cartão de visita digital do seu negócio";

    document.title = title;
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", desc || "Página digital de negócio criada com Orbia Link.");
  }

  /* ---------- Renderização ---------- */

  function renderState(text) {
    appEl.innerHTML =
      '<div class="state"><p>' + esc(text) + "</p></div>";
    clearAppearance();
  }

  function renderHome() {
    clearAppearance();
    document.title = "Orbia Link — o cartão de visita digital do seu negócio";
    setMeta(null);

    if (!businesses && dataError) {
      renderState(
        "Não foi possível carregar os dados. Verifique se o arquivo " +
          "data/businesses.json existe e abra a página por um servidor local " +
          "(ex.: python -m http.server)."
      );
      return;
    }

    var inner = document.createElement("div");
    inner.className = "home__inner";

    var brand = document.createElement("div");
    brand.className = "home__brand";
    brand.innerHTML =
      '<span class="brand__orb" aria-hidden="true"></span>' +
      '<span class="brand__name">Orbia <em>Link</em></span>';

    var title = document.createElement("h1");
    title.className = "home__title";
    title.innerHTML =
      "O cartão de visita digital <span>do seu negócio</span>.";

    var sub = document.createElement("p");
    sub.className = "home__sub";
    sub.textContent =
      "Cada empresa com uma única URL: identidade, contatos e ações em uma página simples e profissional.";

    inner.appendChild(brand);
    inner.appendChild(title);
    inner.appendChild(sub);

    if (businesses && businesses.length) {
      var dir = document.createElement("section");
      dir.className = "dir";

      var dirTitle = document.createElement("h2");
      dirTitle.className = "dir__title";
      dirTitle.textContent = "Páginas de exemplo";

      var grid = document.createElement("div");
      grid.className = "dir__grid";

      businesses.forEach(function (item) {
        var href = pageHref(item.slug);
        var link = document.createElement("a");
        link.className = "dir-card";
        link.href = href;
        link.setAttribute("data-nav", "1");

        var av = document.createElement("span");
        av.className = "dir-card__avatar";
        if (item.business.logo) {
          var img = document.createElement("img");
          img.src = item.business.logo;
          img.alt = "";
          av.appendChild(img);
        } else {
          av.textContent = initialsOf(item.business.name);
        }

        var body = document.createElement("span");
        body.className = "dir-card__body";
        var strong = document.createElement("strong");
        strong.textContent = item.business.name;
        var small = document.createElement("small");
        small.textContent = "/" + item.slug + " · tema " + item.appearance.theme;
        body.appendChild(strong);
        body.appendChild(small);

        var arrow = document.createElement("span");
        arrow.className = "dir-card__arrow";
        arrow.innerHTML = iconSvg("arrow", "icon icon--sm");

        link.appendChild(av);
        link.appendChild(body);
        link.appendChild(arrow);
        grid.appendChild(link);
      });

      dir.appendChild(dirTitle);
      dir.appendChild(grid);
      inner.appendChild(dir);
    } else {
      var empty = document.createElement("p");
      empty.className = "dir__title";
      empty.textContent = "Nenhuma página cadastrada ainda.";
      inner.appendChild(empty);
    }

    var foot = document.createElement("footer");
    foot.className = "home__foot";
    foot.textContent = "Dados em data/businesses.json";
    inner.appendChild(foot);

    var main = document.createElement("main");
    main.className = "home";
    main.appendChild(inner);

    appEl.innerHTML = "";
    appEl.appendChild(main);
  }

  function renderBusiness(item) {
    var business = item.business;

    setAppearance(item);
    setMeta(item);

    var main = document.createElement("main");
    main.className = "page";
    main.setAttribute("data-route", "page");

    var card = document.createElement("section");
    card.className = "card";

    // avatar: logo (se houver) ou monograma com as iniciais
    var head = document.createElement("header");
    head.className = "head";

    var avatar = document.createElement("div");
    avatar.className = "avatar avatar--mono";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = initialsOf(business.name);

    head.appendChild(avatar);

    if (business.logo) {
      var img = document.createElement("img");
      img.className = "avatar";
      img.alt = "Logotipo de " + business.name;
      img.src = business.logo;
      img.addEventListener("error", function () {
        // mantém o monograma caso a imagem falhe
        avatar.style.display = "flex";
        if (img.parentNode) img.parentNode.removeChild(img);
      });
      avatar.style.display = "none";
      img.addEventListener("load", function () {
        avatar.style.display = "none";
      });
      head.insertBefore(img, avatar);
    }

    var nameEl = document.createElement("h1");
    nameEl.className = "biz-name";
    nameEl.textContent = business.name;

    var descEl = null;
    if (business.description) {
      descEl = document.createElement("p");
      descEl.className = "biz-desc";
      descEl.textContent = business.description;
    }

    head.appendChild(nameEl);
    if (descEl) head.appendChild(descEl);
    card.appendChild(head);

    // links / ações — o botão principal de um módulo habilitado (ex.:
    // "Fazer pedido") entra no TOPO, com o mesmo tamanho dos demais botões.
    // Módulos desabilitados ou ausentes não mudam nada na página (nenhum
    // botão vazio, nenhum erro).
    var moduleCta = null;
    if (window.OrbiaMenu && window.OrbiaMenu.createCta) {
      moduleCta = window.OrbiaMenu.createCta(item);
    }

    // Vitrine de ofertas (módulo promotions): entra entre a ação principal
    // e os links secundários. Retorna null quando o negócio não possui
    // promoções — nesse caso a página fica exatamente como antes.
    var promoShowcase = null;
    if (window.OrbiaPromos && window.OrbiaPromos.createShowcase) {
      promoShowcase = window.OrbiaPromos.createShowcase(item);
    }

    var hasLinks = item.links && item.links.length;

    function appendLink(nav, link) {
      var a = document.createElement("a");
      a.className = "action";
      a.href = link.url;
      a.setAttribute("rel", "noopener");

      var isInline = /^(tel:|mailto:)/.test(link.url || "");
      if (!isInline) a.setAttribute("target", "_blank");

      var icon = document.createElement("span");
      icon.innerHTML = iconSvg(link.type, "action__icon");
      icon.setAttribute("aria-hidden", "true");

      var label = document.createElement("span");
      label.className = "action__label";
      label.textContent = link.label || link.type;

      a.appendChild(icon);
      a.appendChild(label);
      nav.appendChild(a);
    }

    if (hasLinks || moduleCta || promoShowcase) {
      if (promoShowcase) {
        // com vitrine: ação principal no topo, ofertas no meio, links abaixo
        if (moduleCta) {
          var navTop = document.createElement("nav");
          navTop.className = "actions";
          navTop.setAttribute("aria-label", "Ação principal");
          navTop.appendChild(moduleCta);
          card.appendChild(navTop);
        }

        card.appendChild(promoShowcase);

        if (hasLinks) {
          var navLinks = document.createElement("nav");
          navLinks.className = "actions";
          navLinks.setAttribute("aria-label", "Links e ações");
          item.links.forEach(function (link) {
            appendLink(navLinks, link);
          });
          card.appendChild(navLinks);
        }
      } else {
        // sem promoções: estrutura idêntica à versão anterior
        var nav = document.createElement("nav");
        nav.className = "actions";
        nav.setAttribute("aria-label", "Links e ações");

        if (moduleCta) nav.appendChild(moduleCta);

        if (hasLinks) {
          item.links.forEach(function (link) {
            appendLink(nav, link);
          });
        }

        card.appendChild(nav);
      }
    }

    // rodapé com link para a home da Orbia Link
    var foot = document.createElement("footer");
    foot.className = "powered";
    var homeLink = document.createElement("a");
    homeLink.className = "home-link";
    homeLink.href = pageHref();
    homeLink.setAttribute("data-nav", "1");
    homeLink.innerHTML =
      '<span class="home-link__dot" aria-hidden="true"></span> Orbia Link';
    foot.appendChild(homeLink);
    card.appendChild(foot);

    main.appendChild(card);
    appEl.innerHTML = "";
    appEl.appendChild(main);
  }

  function renderNotFound() {
    document.title = "Página não encontrada — Orbia Link";
    clearAppearance();

    var main = document.createElement("main");
    main.className = "nf";

    var code = document.createElement("p");
    code.className = "nf__code";
    code.textContent = "404";

    var title = document.createElement("h1");
    title.className = "nf__title";
    title.textContent = "Página não encontrada";

    var text = document.createElement("p");
    text.className = "nf__text";
    text.textContent =
      "Esse link não existe ou o negócio ainda não publicou sua página.";

    var homeLink = document.createElement("a");
    homeLink.className = "home-link";
    homeLink.href = pageHref();
    homeLink.setAttribute("data-nav", "1");
    homeLink.innerHTML =
      '<span class="home-link__dot" aria-hidden="true"></span> Ver páginas disponíveis';

    main.appendChild(code);
    main.appendChild(title);
    main.appendChild(text);
    main.appendChild(homeLink);

    appEl.innerHTML = "";
    appEl.appendChild(main);
  }

  /* ---------- Roteador ---------- */

  function route() {
    var slug = currentRoute();

    // Um módulo (ex.: Cardápio) pode estar aberto por cima da página do
    // negócio. Se a rota aponta para o MESMO slug, não re-renderize a página
    // por baixo do módulo (alguns navegadores disparam popstate + hashchange
    // para a mesma âncora, o que derrubaria a tela aberta). Para qualquer
    // outra rota, o módulo é fechado e a página é renderizada normalmente.
    if (window.OrbiaMenu && window.OrbiaMenu.isActiveFor) {
      if (window.OrbiaMenu.isActiveFor(slug)) return;
      window.OrbiaMenu.close();
    }

    if (slug === "home" || slug === null) {
      renderHome();
      return;
    }

    if (!businesses) {
      renderState(
        dataError
          ? "Não foi possível carregar os dados. Verifique se o arquivo " +
              "data/businesses.json existe e abra a página por um servidor local " +
              "(ex.: python -m http.server)."
          : "Carregando…"
      );
      return;
    }

    var found = businesses.find(function (b) {
      return b.slug === slug;
    });

    if (found) {
      renderBusiness(found);
    } else {
      renderNotFound();
    }
  }

  function loadData() {
    return fetch(DATA_URL, { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        businesses = Array.isArray(json) ? json : json.businesses || [];
      })
      .catch(function () {
        dataError = true;
      });
  }

  function boot() {
    window.addEventListener("hashchange", route);
    window.addEventListener("popstate", route);

    // navegação interna sem reload (URLs amigáveis em produção)
    document.addEventListener("click", function (evt) {
      var link = evt.target && evt.target.closest ? evt.target.closest("a[data-nav]") : null;
      if (!link) return;
      evt.preventDefault();
      history.pushState(null, "", link.getAttribute("href"));
      route();
    });

    loadData().then(function () {
      // dados prontos: renderiza a rota atual (inclusive home com listagem)
      route();
    });
  }

  // API mínima para os módulos (ex.: js/menu.js usa reroute() para voltar à
  // página do negócio quando o usuário fecha a experiência do módulo).
  window.OrbiaLink = {
    reroute: function () {
      route();
    },
    findBusiness: function (slug) {
      if (!businesses) return null;
      for (var i = 0; i < businesses.length; i++) {
        if (businesses[i].slug === slug) return businesses[i];
      }
      return null;
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
