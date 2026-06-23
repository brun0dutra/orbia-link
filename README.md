# Orbia Link 🔗

**Plataforma para criar páginas de links profissionais para empresas locais.**

O Orbia Link permite que negócios criem uma página personalizada com todos os seus canais de atendimento em um só lugar — WhatsApp, Instagram, Maps, site, telefone e muito mais. Ideal para clínicas, restaurantes, comércios locais e profissionais autônomos.

---

## ✨ Funcionalidades

- **Páginas de Links Personalizadas** — Crie páginas com logo, nome e botões de contato
- **Múltiplos Temas** — Escolha entre temas visuais (Dark Modern, Clinic Clean e mais)
- **Tipos de Botões** — WhatsApp, Instagram, Google Maps, Website, Telefone, Agendamento, Menu, Custom
- **Painel Admin (Dashboard)** — Gerencie todas as páginas em um só lugar: criar, editar, visualizar e excluir
- **Slug Automático** — URLs amigáveis geradas automaticamente a partir do nome
- **Responsivo** — Funciona perfeitamente em desktop e mobile
- **Pronto para Produção** — Dockerizado e compatível com Coolify

---

## 🚀 Stack Tecnológica

| Tecnologia   | Versão |
|-------------|--------|
| Python      | 3.12   |
| FastAPI     | 0.115  |
| Jinja2      | 3.1    |
| Uvicorn     | 0.34   |
| Docker      | ✓      |

---

## 📦 Como Usar

### Desenvolvimento Local

```bash
# Clonar o repositório
git clone https://github.com/seu-usuario/orbia-link.git
cd orbia-link

# Instalar dependências
pip install -r requirements.txt

# Iniciar servidor
uvicorn app.main:app --reload --port 3000
```

Acesse em **http://localhost:3000**

### Docker

```bash
docker compose up -d
```

### Produção (Coolify)

A configuração é feita diretamente no Coolify. Certifique-se de adicionar um **volume persistente** montado em `/app/data` para preservar os dados entre redeploys.

---

## 🗂️ Estrutura do Projeto

```
orbia-link/
├── app/
│   ├── main.py              # App FastAPI e rotas
│   ├── schemas.py            # Modelos Pydantic (Page, Button)
│   ├── routes/
│   │   ├── admin.py          # Dashboard CRUD (/dashboard)
│   │   └── public.py         # Páginas públicas (/{slug})
│   ├── services/
│   │   └── storage.py        # Persistência em JSON
│   ├── static/
│   │   ├── css/style.css
│   │   └── js/main.js
│   └── templates/
│       ├── landing.html       # Página inicial institucional
│       ├── dashboard.html     # Painel de gerenciamento
│       ├── create_page.html   # Formulário de criação
│       ├── edit_page.html     # Formulário de edição
│       └── themes/
│           ├── theme_dark_modern.html
│           └── theme_clinic_clean.html
├── data/
│   └── pages.json            # Armazenamento dos dados
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

---

## 🧭 Rotas

| Rota                 | Descrição                          |
|----------------------|------------------------------------|
| `/`                  | Landing page institucional         |
| `/dashboard`         | Painel de gerenciamento            |
| `/dashboard/create`  | Criar nova página                  |
| `/dashboard/edit/{slug}` | Editar página existente        |
| `/dashboard/delete/{slug}` | Excluir página                |
| `/{slug}`            | Página pública de links            |
| `/health`            | Health check                       |

---

## 🎨 Temas Disponíveis

- **Dark Modern** — Fundo escuro com gradiente, estilo moderno e sofisticado
- **Clinic Clean** — Fundo verde claro, ideal para clínicas e saúde

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou enviar pull requests.

---

## 📄 Licença

MIT
