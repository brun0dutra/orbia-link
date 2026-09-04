# Orbia Link 🔗

**Orbia Link — o cartão de visita digital do seu negócio.**

Cada empresa tem uma única URL que pode ser colocada no Instagram, WhatsApp,
Google, cartão de visita, QR Code etc. Essa URL abre uma página digital simples
e profissional com a identidade do negócio e todas as principais formas de
contato e acesso.

```
orbia.link/lancheria-do-ze
            │
            ▼
       [ LOGO ] Lancheria do Zé
            ▼
   Os melhores lanches da cidade
            ▼
      [ 🍔 Fazer pedido ]       ← módulo Cardápio (quando habilitado)
      🔥 OFERTAS DE HOJE         ← módulo Promoções (quando habilitado)
      [ banner da oferta em destaque + cards promocionais ]
      [ WhatsApp ] [ Instagram ] [ Como chegar ] [ Telefone ] [ Site ]
```

> Não é um clone do Linktree e nem um site institucional: é um **cartão de
> visita digital interativo**, com identidade própria e foco em negócios locais.

---

## ✨ Características

- **1 negócio → 1 URL → 1 página → principais informações e ações**
- **100% estático**: HTML + CSS + JavaScript + JSON (sem backend, sem banco,
  sem Docker, sem API)
- Hospedável em qualquer serviço estático: **Vercel**, **GitHub Pages**, Netlify etc.
- **Mobile-first e rápida**: a experiência funciona muito bem no celular
- **Temas controlados pelos dados** (`appearance.theme`) — uma única estrutura
  de página; temas alteram apenas cores, fundo, tipografia e botões
- **Dados separados da interface** em `data/businesses.json`
- **Módulos por negócio** (`modules`): o **Cardápio e Pedidos** já é funcional
  quando `modules.menu.enabled = true`:
  **Cardápio → personalização → carrinho → checkout → WhatsApp**
  (sem backend: o pedido é enviado como mensagem para o WhatsApp do negócio)
- **Vitrine de ofertas** (módulo **Promoções**) na página principal, integrada
  ao cardápio: oferta em destaque com foto vira banner com **PEDIR AGORA**;
  as demais reutilizam o próprio card do cardápio com preço promocional
  (~~preço original~~ → preço promocional) — tudo abrindo o produto real
  dentro da experiência de pedido já existente.
- **Personalização visual por negócio** (Etapa 5): **Tema + Cor + Fundo** —
  o negócio escolhe um tema (estilo geral), uma cor principal (a identidade
  de cor dos botões/acentos, com contraste calculado automaticamente) e um
  fundo (sólido ou padrão discreto) no JSON. Uma única cor alimenta todos os
  tokens derivados — sem exigir que ninguém entenda de CSS.
- Negócios sem os módulos/personalização habilitados continuam exatamente
  como antes — nada de cardápio, promoções, botões vazios, placeholders ou
  erros.

---

## 🗂️ Estrutura do Projeto

```
orbia-link/
├── index.html          # Shell único (home + página do negócio)
├── 404.html            # Igual ao index.html — fallback do GitHub Pages
├── vercel.json         # Rewrites para URLs amigáveis no Vercel
├── css/
│   ├── base.css        # Estrutura/layout da página (NUNCA muda entre temas)
│   ├── themes.css      # Todos os temas (só variáveis CSS por tema)
│   ├── menu.css        # Cardápio/carrinho/checkout (usa as variáveis dos temas)
│   ├── promotions.css  # Vitrine de ofertas (banner + preços promocionais)
│   └── appearance.css  # Camada de personalização (padrões de fundo)
├── js/
│   ├── app.js          # Lê o slug da URL, carrega o JSON e renderiza a página
│   ├── menu.js         # Módulo Cardápio e Pedidos (tela + carrinho + checkout)
│   └── promotions.js   # Módulo Promoções (vitrine na página principal)
├── data/
│   └── businesses.json # Fonte de dados dos negócios (inclui cardápios e ofertas)
├── assets/
│   ├── products/       # Imagens de demonstração dos produtos
│   └── promotions/     # Imagens de demonstração das ofertas
└── README.md
```

---

## 🚀 Como executar localmente

A aplicação é estática — basta servir a pasta do projeto:

```bash
# Opção 1: com Node (suporta URLs amigáveis /slug)
npx serve -s .

# Opção 2: com Python
python -m http.server 8000
```

Depois abra no navegador:

- Home (lista de páginas): `http://localhost:8000/`
- Página de um negócio: `http://localhost:8000/#/lancheria-do-ze`
  (o `python -m http.server` não faz rewrite, por isso usamos o `#`)
- Com `npx serve -s .` as URLs amigáveis funcionam: `http://localhost:3000/lancheria-do-ze`

> No Vercel e no GitHub Pages as URLs amigáveis funcionam sem o `#/`
> (veja a seção "URLs e deploy" abaixo).

---

## 🌍 URLs e deploy

A aplicação identifica o slug da URL por três modos (nessa ordem):

1. **Hash** — `index.html#/lancheria-do-ze`
2. **Query** — `index.html?slug=lancheria-do-ze`
3. **Path** — `/lancheria-do-ze` (produção, com rewrite)

Não existe um HTML diferente por empresa: o `js/app.js` monta a página a partir
dos dados do JSON sempre com a **mesma estrutura única**.

### Vercel

O arquivo `vercel.json` já vem configurado com rewrite de tudo para
`index.html`. Basta importar o repositório — URLs como
`https://seuapp.vercel.app/lancheria-do-ze` funcionam direto.

### GitHub Pages

Habilite o Pages na branch `main`, pasta raiz. O `404.html` (idêntico ao
`index.html`) faz o papel de fallback: qualquer URL inexistente, como
`/lancheria-do-ze`, cai no `404.html`, e o `app.js` renderiza a página correta
a partir do pathname.

> Em um *project site* (ex.: `user.github.io/repo/`) os links internos são
> relativos e funcionam normalmente.

---

## 📦 Como adicionar uma nova empresa

Edite `data/businesses.json` e adicione um objeto no array `businesses`:

```json
{
  "slug": "lancheria-do-ze",
  "business": {
    "name": "Lancheria do Zé",
    "description": "Os melhores lanches da cidade",
    "logo": ""
  },
  "appearance": {
    "theme": "dark-modern"
  },
  "links": [
    { "type": "whatsapp", "label": "WhatsApp", "url": "https://wa.me/5548999999999" },
    { "type": "instagram", "label": "Instagram", "url": "https://instagram.com/lancheriadoze" },
    { "type": "maps", "label": "Como chegar", "url": "https://www.google.com/maps/search/?api=1&query=Lancheria+do+Ze" }
  ],
  "modules": {
    "menu": { "enabled": false }
  }
}
```

**Campos:**

| Campo                  | Obrigatório | Descrição                                                              |
| ---------------------- | ----------- | ---------------------------------------------------------------------- |
| `slug`                 | ✔️          | Identificador único da URL (letras minúsculas, números e `-`)          |
| `business.name`        | ✔️          | Nome exibido na página                                                 |
| `business.description` |             | Descrição curta sob o nome                                             |
| `business.logo`        |             | URL da logo. Vazio = monograma automático com as iniciais do nome      |
| `appearance.theme`     |             | Nome do tema (veja abaixo). Padrão: `dark-modern`                      |
| `links[].type`         | ✔️          | `whatsapp`, `instagram`, `maps`, `website`, `phone`, `booking`, `menu`, `custom` |
| `links[].label`        | ✔️          | Texto do botão                                                         |
| `links[].url`          | ✔️          | Destino do botão (URL, `tel:+55...`, `https://wa.me/...` etc.)         |
| `modules`              |             | Configuração de módulos do negócio (veja abaixo)                       |

> Obs.: um **link** `booking`/`menu` nas `links` é só uma ação externa.
> O **módulo** correspondente (Cardápio e Pedidos) é outra coisa: uma
> experiência própria do Orbia, ativada por `modules.menu.enabled`.

### Como alterar os dados de uma empresa

Basta editar o objeto dela no mesmo arquivo e commitar. Sem rebuild, sem
servidor: a página carrega os dados no próximo acesso. Mantenha o campo `slug`
único — ele é a "chave primária" (no futuro, a linha de uma tabela no banco).

---

## 🎨 Temas

Os temas ficam em `css/themes.css`. Cada tema é **apenas um bloco de variáveis
CSS** — a estrutura da página é única e nunca é duplicada.

Temas disponíveis (valor usado em `appearance.theme`):

| Tema              | Visual                                            |
| ----------------- | ------------------------------------------------- |
| `dark-modern`     | Fundo escuro com gradiente, estilo moderno        |
| `clinic-clean`    | Fundo verde claro, botões pill, ideal para saúde  |
| `midnight-purple` | Fundo roxo profundo, botões indigo                |
| `ocean-breeze`    | Céu azul suave, botões pill azuis                 |
| `sunset-glow`     | Gradiente roxo/rosa, botões rosados               |
| `rosa`            | Fundo escuro com acentos rosa neon                |
| `vibrant`         | Escuro e enérgico, botões pill, ideal para comida |
| `elegant`         | Claro e refinado, bordas finas, ideal para serviços |

### Como adicionar um novo tema

1. Copie um bloco `[data-theme="..."]` de `css/themes.css`.
2. Troque o nome e as cores (incluindo o token `--panel`, que define a cor das
   superfícies "sólidas" do cardápio — sheets, barras do carrinho/checkout).
3. Use esse nome em `data/businesses.json` → `appearance.theme`.

Se o tema não existir ou não for encontrado, a página usa o padrão neutro
escuro definido no `base.css` (nunca quebra). O cardápio herda automaticamente
o tema do negócio — não é preciso estilizar o módulo por tema.

### Personalização por negócio: Tema + Cor + Fundo

Cada negócio pode compor a própria identidade visual no `appearance` — sem
criar um tema novo por cor e sem interface de edição:

```json
"appearance": {
  "theme": "vibrant",
  "accent": "#E63946",
  "background": {
    "type": "pattern",
    "pattern": "fast-food"
  }
}
```

| Campo                    | Descrição                                                              |
| ------------------------ | ---------------------------------------------------------------------- |
| `theme`                  | Estilo geral da página (veja a tabela acima). Obrigatório? Não — sem ele, usa `dark-modern` |
| `accent`                 | **Uma** cor principal (hex `#RGB` ou `#RRGGBB`). O Orbia deriva sozinho: texto com contraste, hover, fundo suave e o gradiente dos botões |
| `background.type`        | `solid` (fundo do tema) ou `pattern` (textura discreta repetida)       |
| `background.pattern`     | Nome do padrão: `fast-food`, `coffee`, `pizza`, `barber`, `minimal`    |

**Como a cor é aplicada (tokens):** a cor escolhida alimenta um único sistema
de variáveis — `--accent`, `--accent-hover`, `--accent-soft`,
`--accent-contrast` e `--mono-bg` — usadas pelo botão **Fazer pedido**,
**PEDIR AGORA**, botões `+`, preço promocional, categoria ativa e elementos
selecionados. O contraste do texto é calculado automaticamente: cores claras
(amarelo, laranja…) recebem texto escuro — nunca "claro sobre claro".

**Padrões de fundo:** glifos SVG pequenos e discretos (15% de opacidade)
repetidos em ladrilho de 200px, tingidos com a cor do negócio — discretos por
design, sem atrapalhar a leitura. O cardápio e o checkout usam o mesmo fundo
da página principal, mantendo tudo coerente.

**Fallbacks seguros:** sem `appearance` → comportamento atual; sem `accent` →
accent do tema; sem `background`/`type` errado/`pattern` inexistente → fundo
sólido do tema; `accent` inválida → ignorada. Nenhuma configuração inválida
quebra a página.

Os negócios de demonstração mostram combinações diferentes: **Lancheria do Zé**
(`vibrant` + vermelho + `fast-food`), **Barbearia do João** (`elegant` + azul
-escuro + `barber`), **Clínica Bem Viver** (`clinic-clean` + verde +
`minimal`), **Bella Moda** (`ocean-breeze` + amarelo, fundo sólido), **Salão
da Rosa** (`rosa` + rosa, sólido) e **Estúdio Aurora** (só tema — caso
fallback).

---

## 🧩 Módulos

O produto é pensado como **página do negócio + módulos**:

```
Página do negócio
├── Identidade        (nome, descrição, logo)
├── Ação principal    (🍔 Fazer pedido — módulo Cardápio, quando habilitado)
├── Vitrine de ofertas (🔥 Ofertas de hoje — módulo Promoções, quando habilitado)
├── Links / ações     (WhatsApp, Instagram, Como chegar etc.)
└── Módulos           (funcionalidades próprias do Orbia)
    ├── Cardápio      ✅ implementado (Etapa 3)
    ├── Promoções     ✅ implementado (Etapa 4 — vitrine)
    ├── Agendamento   (configuração)
    ├── Catálogo      (configuração)
    └── etc.
```

### Módulo Cardápio e Pedidos (implementado)

Quando um negócio declara:

```json
"modules": {
  "menu": { "enabled": true }
}
```

a página do negócio ganha o botão principal **🍔 Fazer pedido** no topo das
ações (com o mesmo tamanho dos demais botões), que abre a experiência
completa dentro do próprio Orbia:

```
Página do negócio
   → Cardápio (categorias + produtos)
   → Personalizar (opções, observação, quantidade)
   → Carrinho (alterar/remover/editar itens)
   → Checkout (Entrega/Retirada → Endereço → Pagamento → Observação → Resumo)
   → WhatsApp com o pedido formatado
```

#### Estrutura de dados do módulo

```json
"modules": {
  "menu": {
    "enabled": true,
    "whatsapp": "5548999999999",
    "settings": {
      "delivery": true,
      "pickup": true,
      "payment_methods": ["pix", "cash", "card"]
    },
    "categories": [
      { "id": "lanches", "name": "Lanches", "emoji": "🍔" }
    ],
    "products": [
      {
        "id": "xis-bacon",
        "category": "lanches",
        "name": "Xis Bacon",
        "description": "Pão, carne, queijo, bacon, alface e tomate.",
        "price": 25.9,
        "image": "assets/products/xis-bacon.svg",
        "allow_note": true,
        "options": [
          {
            "name": "Adicionais",
            "min": 0,
            "max": 4,
            "items": [
              { "name": "Bacon", "price": 5.0 },
              { "name": "Queijo", "price": 3.0 },
              { "name": "Ovo", "price": 2.0 }
            ]
          }
        ]
      }
    ]
  }
}
```

**Campos do módulo:**

| Campo                    | Descrição                                                                 |
| ------------------------ | ------------------------------------------------------------------------- |
| `enabled`                | `true` renderiza o módulo; `false`/ausente não muda nada na página       |
| `whatsapp`               | Número (somente dígitos) que recebe os pedidos                            |
| `settings.delivery`      | Se oferece entrega (`true`/`false`)                                        |
| `settings.pickup`        | Se oferece retirada no local                                              |
| `settings.payment_methods` | Métodos aceitos: `pix`, `cash`, `card`                                  |
| `categories`             | `id`, `name`, `emoji` (mostrado nas abas e na mensagem do pedido)         |
| `products`               | Produtos do cardápio (veja abaixo)                                        |

**Campos do produto:**

| Campo         | Descrição                                                                  |
| ------------- | -------------------------------------------------------------------------- |
| `id`          | Identificador único do produto                                             |
| `category`    | `id` da categoria a que pertence                                           |
| `name`        | Nome exibido                                                               |
| `description` | Descrição curta                                                           |
| `price`       | Preço base em reais (ponto decimal)                                        |
| `image`       | **Opcional.** URL da imagem; sem imagem o layout continua bonito só texto  |
| `allow_note`  | `true` mostra o campo "Observação" no detalhe do produto                  |
| `options`     | Lista de grupos de opções (veja abaixo)                                    |

**Grupos de opções (regras `min`/`max`):**

- `min: 0` → opcional
- `min: 1` → o usuário precisa escolher ao menos uma
- `max: 1` → seleção única (radio)
- `max: 5` → seleção múltipla, travando as demais ao atingir o limite

Um único sistema serve para **tamanhos**, **sabores**, **adicionais**,
**complementos** — sem conceitos separados:

```json
{ "name": "Escolha o tamanho", "min": 1, "max": 1, "items": [
  { "name": "Pequena", "price": 15.0 },
  { "name": "Média",   "price": 20.0 },
  { "name": "Grande",  "price": 25.0 }
]}
```

O preço do botão **ADICIONAR** atualiza em tempo real
`(preço base + opções) × quantidade`.

#### Comportamentos implementados

- Produto **sem opções**: o `+` adiciona direto ao carrinho.
- Produto **com opções**: o `+` abre um *bottom sheet* para personalizar
  (obrigatórias bloqueiam o botão até serem cumpridas, com aviso visual).
- O carrinho diferencia configurações (ex.: `Xis Bacon + Bacon` ≠
  `Xis Bacon` sem adicionais) e permite **editar**, **alterar quantidade** e
  **remover** cada item — inclusive misturando quantidades com configurações
  diferentes.
- O carrinho é persistido em **localStorage** por negócio: atualizar a página
  não perde o pedido.
- Checkout em etapas com voltar: Recebimento → Endereço (só se for entrega) →
  Pagamento (Pix/Dinheiro/Cartão, com opção de troco) → Observação → Resumo.
  Opções desabilitadas ou únicas são puladas (sem escolhas desnecessárias).
- **Enviar pedido** monta uma mensagem formatada e abre o WhatsApp
  (`https://wa.me/<número>?text=…`) com os itens, opções, endereço, pagamento,
  troco, observações e total — sem incluir seções vazias.

#### Como o mesmo código atende vários cardápios

O `menu.js` renderiza **qualquer** cardápio a partir do JSON: mais/menos
categorias, produtos com ou sem imagem, com ou sem opções, `allow_note`,
regras diferentes de `min`/`max`… Nada é codificado por empresa. Para testar,
a **Lancheria do Zé** tem um cardápio de demonstração completo (12 produtos em
4 categorias); a **Barbearia do João** tem `menu.enabled: false` e o
**Salão da Rosa** nem tem a chave `modules` — os três casos funcionam sem erro.

### Módulo Promoções — Vitrine de ofertas (implementado)

Quando um negócio declara:

```json
"modules": {
  "promotions": { "enabled": true, "items": [ … ] }
}
```

a página principal ganha a seção **🔥 Ofertas de hoje** entre a ação principal
("Fazer pedido") e os links secundários. A promoção NÃO é uma lista de links
nem uma segunda página: é uma **vitrine integrada ao cardápio**. Cada promoção
aponta para um produto real via `product_id` — o produto continua sendo a fonte
dos dados (nome, descrição, imagem) e a promoção só acrescenta os preços.

**Regra da vitrine:**

- Promoção com `featured: true` **e** imagem própria → vira um **banner em
  destaque** com **PEDIR AGORA**.
- Sem essa combinação (ou sem foto profissional) → todas as promoções usam o
  **mesmo card horizontal do cardápio**, com `~~preço original~~` cortado e o
  preço promocional em destaque — nada de banner vazio.
- Clicar em uma promoção **abre o produto dentro do cardápio**: com opções abre
  o *bottom sheet* de personalização; sem opções, adiciona direto ao carrinho
  — o carrinho/checkout/WhatsApp são exatamente os mesmos do módulo menu.
- O carrinho cobra o **preço promocional** (base da oferta + opções), e a
  promoção em destaque é opcional: se não existir, só os cards aparecem.

#### Estrutura de dados

```json
"modules": {
  "promotions": {
    "enabled": true,
    "items": [
      {
        "id": "combo-da-casa",
        "title": "Combo da Casa",
        "description": "Xis + batata frita + refrigerante",
        "image": "assets/promotions/combo-da-casa.svg",
        "original_price": 42.9,
        "price": 34.9,
        "product_id": "combo-xis-fritas",
        "featured": true
      },
      {
        "id": "xis-bacon-promocao",
        "title": "Xis Bacon",
        "original_price": 29.9,
        "price": 25.9,
        "product_id": "xis-bacon",
        "featured": false
      }
    ]
  }
}
```

**Campos da promoção:**

| Campo            | Descrição                                                              |
| ---------------- | ---------------------------------------------------------------------- |
| `id`             | Identificador único da promoção                                        |
| `title`          | Título (usado no banner em destaque)                                   |
| `description`    | Descrição curta (usada no banner em destaque)                          |
| `image`          | **Opcional.** Imagem própria da oferta (usada no banner)               |
| `original_price` | **Opcional.** Preço antigo (cortado). Ausente = mostra só o promocional |
| `price`          | Preço promocional cobrado (base da oferta + opções no carrinho)        |
| `product_id`     | `id` do produto real no `modules.menu.products` (obrigatório)          |
| `featured`       | `true` + imagem própria → vira o banner em destaque                    |

**Regras de segurança:**

- `enabled: false`, módulo ausente ou `items: []` → nada é renderizado
  (sem título, sem espaço vazio, sem botão) — a página fica como antes.
- `product_id` que não existe no cardápio → a promoção é **ignorada** com
  segurança (nenhuma ação quebrada, nenhum erro fatal).
- A vitrine exige o módulo menu habilitado (a ação abre o cardápio); sem ele,
  nada é renderizado.

A **Lancheria do Zé** demonstra o recurso: 1 oferta em destaque com imagem
própria e 3 cards promocionais (com/sem preço antigo, com/sem opções no
produto). Negócios sem o módulo (ex.: **Barbearia do João**, **Loja Bella
Moda**) continuam sem nenhum vestígio de promoções.

### Módulos ainda como configuração

`Agendamento` e `Catálogo` continuam existindo apenas como configuração
(`{ "enabled": true|false }`) — nenhuma interface é renderizada até serem
implementados. Eles entrarão no mesmo ponto de inserção já reservado na
página, sem reescrever o resto.

> Regra da casa: **simplicidade > abstração**, **manutenção fácil >
> arquitetura complexa**, **MVP funcional > funcionalidades desnecessárias**,
> **experiência mobile > complexidade técnica**.

---

## 🧭 O que NÃO existe (de propósito)

Painel administrativo, edição visual do cardápio, cadastro/login de clientes,
banco de dados, pagamento online, Pix automático, API do WhatsApp Business,
estoque, cupons, avaliações, delivery próprio, cálculo de distância/taxa de
entrega automática, impressão e histórico de pedidos — tudo isso pode ser
construído em etapas posteriores sobre esta base. O fluxo desta etapa termina
no **WhatsApp com o pedido preenchido**.

---

## 📄 Licença

MIT
