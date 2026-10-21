<div align="center">

<img src="assets/marca/logo.png" alt="GlobalTime" width="320" />

**Hora certa sincronizada no seu fuso e ferramentas de tempo.**
Relógio, cronômetro, temporizador, calendário com eventos, fusos horários e mais — em 13 idiomas, gratuito e sem rastreadores.

</div>

---

## Sumário

- [Visão geral](#visão-geral)
- [Ferramentas](#ferramentas)
- [Idiomas e fusos](#idiomas-e-fusos)
- [Contas e eventos](#contas-e-eventos)
- [Identidade visual](#identidade-visual)
- [Como executar localmente](#como-executar-localmente)
- [Testes](#testes)
- [Publicação na Vercel](#publicação-na-vercel)
- [Como funciona a sincronização de horário](#como-funciona-a-sincronização-de-horário)
- [Limitações de precisão](#limitações-de-precisão)
- [Dados de feriados](#dados-de-feriados)
- [PWA e funcionamento offline](#pwa-e-funcionamento-offline)
- [Rotas e cabeçalhos](#rotas-e-cabeçalhos)
- [Permissões do navegador](#permissões-do-navegador)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Autores](#autores)

## Visão geral

O GlobalTime (antes Brasil Time) é um site estático — HTML, CSS e JavaScript
puro, sem framework e sem etapa de build — publicado na Vercel com três Vercel
Functions: `api/hora.js` (sincronização do relógio) e `api/conta.js` /
`api/eventos.js` (contas opcionais para guardar eventos do calendário).

Princípios:

- **Precisão com transparência:** o relógio é corrigido pelo horário do
  servidor. A página mostra só o estado ("Sincronizado"); latência, incerteza
  e fonte ficam na janela de detalhes, aberta ao clicar no estado. Quando não
  é possível sincronizar, isso é dito claramente.
- **Interface enxuta:** cada página mostra primeiro o essencial; ajustes,
  históricos e tabelas de apoio ficam em seções recolhíveis. A home mostra o
  relógio no centro, o lugar e o estado da sincronização discretos no topo,
  o próximo feriado e o acesso a todas as ferramentas.
- **Localizado desde a primeira visita:** idioma pelas preferências do
  navegador e hora no fuso do aparelho, ambos ajustáveis e salvos.
- **Sem dependências em produção:** nenhuma biblioteca de terceiros. O único
  serviço externo é opcional: um Upstash Redis (Marketplace da Vercel) para as
  contas. As fontes (Inter e Plus Jakarta Sans, licença OFL) são auto-hospedadas.
- **Privacidade:** sem rastreadores. Preferências, voltas, alarmes, históricos e
  eventos sem conta ficam no `localStorage`; com conta, o servidor guarda só
  e-mail, senha protegida (scrypt) e os eventos.

## Ferramentas

| Rota | Ferramenta |
|---|---|
| `/` | Hora certa sincronizada no fuso do aparelho (ou escolhido), digital ou analógica; horário de Brasília quando o fuso é outro; próximo feriado |
| `/relogio-mundial` | Começa com poucas cidades a partir do seu fuso; adicione as suas (salvas no navegador). Diferença em relação a você e horário comercial |
| `/conversor` | Conversão de horário entre cidades/fusos (com tratamento de horário de verão) e planejador de reuniões |
| `/tela-cheia` | Modo quiosque para TV/monitor: relógio grande, data, fusos extras, digital/analógico |
| `/cronometro` | Cronômetro com voltas, melhor/pior volta, diferenças, cópia e exportação CSV |
| `/temporizador` | Contagem regressiva com alarme, notificação, progresso e tempo no título da aba |
| `/pomodoro` | Ciclos de foco/pausa configuráveis com histórico local |
| `/despertador` | Alarmes com data, repetição semanal, fuso e som |
| `/contagem` | Contagem regressiva para datas (Natal, Ano Novo, personalizadas) com link compartilhável |
| `/feriados` | Feriados nacionais, estaduais e municipais (capitais), pontos facultativos, feriadões e exportação `.ics` |
| `/calendario` | Calendário anual (padrão), mensal e semanal com feriados, contagens e eventos pessoais (no navegador ou na conta) |
| `/sol` | Nascer e pôr do sol, meio-dia solar, crepúsculo e duração do dia |
| `/calculadoras` | Diferença entre datas, dias úteis com feriados, soma de dias, duração entre horários, conversão de unidades |
| `/timestamp` | Conversor de timestamp Unix (segundos/milissegundos) |
| `/docs` | Documentação em português e inglês (`/sobre` redireciona para cá) |

Atalhos de teclado (onde fazem sentido): <kbd>Espaço</kbd> iniciar/pausar,
<kbd>L</kbd> volta, <kbd>R</kbd> zerar/reiniciar (com confirmação quando há
risco de perder dados), <kbd>Esc</kbd> fechar janelas e sair de modos,
<kbd>?</kbd> lista de atalhos. Eles ficam desativados enquanto se digita.

## Idiomas e fusos

- 13 idiomas: pt-BR, pt-PT, en, es, fr, de, it, nl, ru, ja, zh-CN, ko e ar
  (árabe da direita para a esquerda), **cada um com o próprio endereço**:
  `/cronometro` (pt-BR, na raiz), `/en/cronometro`, `/pt-pt/cronometro`,
  `/zh-cn/cronometro`… São HTMLs já traduzidos, gerados por `npm run gerar`
  nas pastas `en/`, `es/` etc. (não edite: são sobrescritos), com `lang`,
  `dir`, título, descrição, canonical e `hreflang` próprios.
- Primeira visita: nas URLs em português, a Vercel redireciona (307) para a
  versão no primeiro idioma do `Accept-Language`, se houver. Buscadores
  rastreiam sem esse cabeçalho e veem cada URL como ela é. URLs com prefixo
  nunca são redirecionadas.
- O seletor no rodapé abre a mesma página no idioma escolhido e salva a escolha
  no cookie `gt_idioma` (lido pela Vercel, tem prioridade sobre o
  `Accept-Language`) e em `localStorage` (`gt:idioma`).
- 404 e offline respondem por qualquer endereço e são traduzidas no navegador
  (prefixo da URL, preferência salva ou idioma do navegador).
- A documentação longa existe em pt e en; nas demais línguas, `/xx/docs` mostra
  o texto em inglês e aponta (canonical) para `/en/docs`.
- Textos em `scripts/i18n/textos/`: `pt-BR.js` é a referência (com partes em
  `pt-BR/`); cada idioma tem um arquivo com as mesmas chaves —
  `testes/i18n.test.mjs` confere chaves, marcadores `{x}` e formas de plural.
  No HTML, `data-i18n` / `data-i18n-attr` são preenchidos por `npm run gerar`
  (em português na raiz e no idioma de cada pasta); nos scripts,
  `t("chave", {...})`, e `urlLocal("/docs")` para links no idioma atual.
- Nomes de feriados brasileiros ficam em português (nomes próprios). A
  documentação existe em português e inglês.
- A hora é exibida no fuso do aparelho (`Intl`), sem pedir localização; o
  usuário pode escolher outro na página inicial (`scripts/nucleo/fuso-preferido.js`).
  O fuso só muda a exibição: o instante vem sempre do relógio sincronizado.

## Contas e eventos

- Sem conta, os eventos do calendário ficam no navegador.
- Com conta (e-mail e senha), ficam no Upstash Redis e aparecem em qualquer
  aparelho. Senha com `scrypt` (N=2^16, r=8, p=2, sal por conta; contas
  antigas são recalculadas no login); sessão em cookie `HttpOnly`,
  `SameSite=Lax`, `Secure`, 30 dias, guardada como hash; limite de tentativas
  por IP e por e-mail; pedidos que mudam dados exigem JSON e mesma origem;
  cada conta só acessa a própria chave. A conta pode ser excluída com a senha.
- Não há recuperação de senha por e-mail (exigiria um serviço de e-mail).
- Sem as variáveis do Upstash, `/api/conta` responde `disponivel: false` e o
  site segue só com eventos locais. No servidor local, um armazenamento em
  memória é usado automaticamente.

## Identidade visual

A nova identidade segue os princípios do site da [LZdev](https://lzdev.com.br/):
monocromia, tipografia **Plus Jakarta Sans** (títulos) + **Inter** (texto e
números, com algarismos tabulares), cantos generosos, bordas discretas,
botões em pílula e a curva de animação `cubic-bezier(.22, 1, .36, 1)`. Como a
LZdev é escura, a paleta foi invertida para fundo branco: a cor da marca é a
tinta quase preta (`#0a0a0b`) e o azul (`#1d5bd8`, versão mais escura do azul
da LZdev, para contraste AA) é o acento funcional. Há tema escuro opcional.

**Marca:** o símbolo é um globo com um relógio — a hora certa em qualquer
lugar. Os originais (preto e branco, 1254 px, fundo transparente) ficam em
`logos/`; deles saem os arquivos de `assets/marca/` e `assets/icones/`:

- `simbolo-preto.png` / `simbolo-branco.png` — símbolo do cabeçalho (tema claro / escuro);
- `logo.png` / `logo-fundo-escuro.png` — símbolo + nome, para fundo claro e escuro;
- `og.png` — imagem de compartilhamento (1200×630);
- `assets/icones/` — logo branca em quadrado escuro: PNGs 96/192/512, versão *maskable* (dentro da zona segura) e `apple-touch-icon`; `favicon.ico` (16/32/48) na raiz.

Todos os tokens (cores, tipografia, espaçamentos, raios, sombra, transições)
estão no início de `estilos/app.css`. O sistema evita gradientes e usa uma
única sombra, reservada a menus e diálogos.

## Como executar localmente

Requisito: **Node.js 20 ou superior** (nenhum pacote para instalar).

```bash
git clone https://github.com/LZdevelopers/Global-Time.git
cd Global-Time
npm run dev
```

Acesse `http://localhost:3000`. O servidor de desenvolvimento
(`dev/servidor.mjs`) imita a Vercel: URLs limpas, `404.html`,
redirecionamentos e cabeçalhos do `vercel.json`, e executa `api/hora.js`.

> Abrir os arquivos HTML direto pelo `file://` **não funciona**: as páginas
> usam módulos JavaScript e caminhos absolutos (`/estilos/...`).

Em `localhost` o service worker só é registrado se você acessar uma vez com
`?sw=1` (para não atrapalhar a edição dos arquivos).

### Cabeçalho, rodapé, SEO e sitemap

Os blocos repetidos das páginas (metadados do `<head>`, cabeçalho, rodapé,
atalhos da home), as versões traduzidas, o `sitemap.xml`, o `robots.txt`, os
redirecionamentos de idioma do `vercel.json` e a lista de pré-cache do service
worker são mantidos a partir de **`dev/site.mjs`**:

```bash
npm run gerar    # atualiza os arquivos
npm run checar   # falha se algo estiver desatualizado (útil em CI)
```

Não é um build: o resultado fica nos próprios arquivos, versionados. Edite o
conteúdo das páginas fora dos marcadores `<!-- @head -->`, `<!-- @cabecalho -->`
e `<!-- @rodape -->`.

## Testes

```bash
npm test                # testes unitários (node:test), sem dependências
npm run test:navegador  # todas as páginas em Chrome/Edge headless
npm run test:pwa        # service worker, pré-cache, offline e exclusão da API do cache
```

- **Unitários** (`testes/`): fusos e horário de verão, conversões de hora
  ambígua/inexistente, cálculo de offset e escolha da menor latência,
  fallback para cabeçalho `Date` e relógio local, descarte de respostas
  antigas, detecção de salto de relógio, cronômetro e contagem regressiva
  (incluindo recarga da página), feriados (datas fixas, móveis, estaduais,
  municipais, feriadões, `.ics`), calculadoras e a função `api/hora.js`.
- **Navegador** (`dev/testar-navegador.mjs`): abre cada página em desktop
  (1366×900) e celular (390×844) via DevTools Protocol; falha com exceções,
  erros de console (inclusive violações de CSP), requisições quebradas,
  rolagem horizontal, `<h1>` ausente/duplicado, botões sem nome acessível e
  campos sem rótulo, e executa as verificações por página de
  `dev/verificacoes-navegador.mjs`. Capturas de tela vão para a pasta
  temporária do sistema (`brasil-time-capturas`).
  Use `SO=/cronometro npm run test:navegador` para uma página só (no Git
  Bash do Windows, prefixe `MSYS_NO_PATHCONV=1`). Defina `CHROME=` se o
  navegador não for encontrado. `FUSO=Europe/Lisbon` simula um aparelho em
  outro fuso, `TEMA=dark` abre as páginas no tema escuro e `INTEIRA=1`
  captura a página inteira.

## Publicação na Vercel

1. **Antes do primeiro deploy**, defina o domínio público em `dev/site.mjs`
   (`SITE_URL`) — ou rode `SITE_URL=https://seu-dominio npm run gerar` — e
   faça commit. Ele é usado em `canonical`, Open Graph, `sitemap.xml` e
   `robots.txt`.
2. Na Vercel: **Add New → Project →** importe o repositório.
   - Framework Preset: **Other**
   - Build Command: *(vazio)*
   - Output Directory: *(vazio — raiz do repositório)*
3. Deploy. Os arquivos de `api/` viram as Functions `/api/hora`,
   `/api/conta` e `/api/eventos` (`api/_lib/` não vira rota); o
   `vercel.json` configura URLs limpas, redirecionamentos e cabeçalhos.
   `dev/` e `testes/` não são publicados (`.vercelignore`).
4. **Contas (opcional):** em *Storage* / *Marketplace*, crie um **Upstash
   Redis** (plano gratuito) e conecte ao projeto. A Vercel injeta
   `KV_REST_API_URL` e `KV_REST_API_TOKEN` (também aceitamos
   `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`). Faça um novo deploy.
   Sem isso, tudo funciona e os eventos ficam só no navegador.

Para atualizar: rode `npm test` e `npm run checar`, faça commit e push — a
Vercel publica a cada push na branch de produção. Com a CLI: `vercel` (prévia)
e `vercel --prod`.

Depois do deploy, confira:

```bash
curl -i https://SEU-DOMINIO/api/hora           # 200, {"timestamp":...}, Cache-Control: no-store
curl -i -X POST https://SEU-DOMINIO/api/hora   # 405
curl -I https://SEU-DOMINIO/cronometro         # 200 (URL limpa)
curl -I https://SEU-DOMINIO/paginas/cronometro.html   # 308 → /cronometro
curl -I https://SEU-DOMINIO/nao-existe         # 404 com a página personalizada
curl -s https://SEU-DOMINIO/api/conta          # {"disponivel":true|false,"conta":null}
curl -I https://brasil-time.vercel.app/feriados  # 308 → https://global-time.lzdev.com.br/feriados
curl -I https://SEU-DOMINIO/ | grep -i robots  # nada (o domínio oficial é indexável)
```

## Como funciona a sincronização de horário

Implementação em `scripts/nucleo/sincronizacao.js` e `api/hora.js`.

1. `GET /api/hora` devolve `{"timestamp": <ms Unix do servidor>}` com
   `Cache-Control: no-store`.
2. O navegador anota `performance.now()` no envio (p0) e no recebimento (p1).
   Supõe-se que o servidor leu o relógio no meio da viagem, então em p1 a hora
   do servidor é estimada como `timestamp + (p1 − p0) / 2`.
3. São feitas **5 medições** na abertura (3 nas seguintes); vale a de **menor
   latência**, a menos afetada por filas e assimetria da rede.
4. Entre sincronizações, a hora avança por `performance.now()` (monotônico):
   ajustes no relógio do sistema não afetam a exibição.
5. Ressincroniza a cada 10 minutos, quando a aba volta a ficar visível (se a
   última sincronização tiver mais de 1 minuto), quando a rede volta e quando
   detecta um salto entre o relógio monotônico e o civil (suspensão do
   computador, ajuste manual do relógio).
6. Cada rodada tem um número de sequência: uma resposta antiga que chegue
   depois de uma mais nova é descartada.
7. A tela atualiza com `setTimeout` recalculado para logo após cada virada de
   segundo (não `setInterval`), sem acumular atraso.

**Hierarquia de fontes:** (1) `/api/hora`; (2) cabeçalho HTTP `Date` de um
arquivo estático (resolução de 1 s — estado "Precisão limitada"); (3) relógio
do aparelho, sem correção ("Usando relógio do aparelho"). Sem rede, a última
correção válida continua sendo aplicada ("Offline · última sincronização").

## Limitações de precisão

- A **incerteza exibida** é metade do tempo de ida e volta da medição
  escolhida: o limite do erro *causado pela rede*, supondo que o servidor
  esteja certo. Não é garantia de precisão absoluta.
- O relógio do servidor da Vercel é disciplinado por NTP, mas **não é uma
  fonte oficial de hora atômica**. Para a Hora Legal Brasileira oficial, a
  referência é o Observatório Nacional.
- A rede pode ser assimétrica (ida mais lenta que a volta); isso gera um erro
  que nenhuma medição de ida e volta consegue detectar.
- A tela só pode mudar quando o navegador pinta um quadro (tipicamente a cada
  ~16 ms); abas em segundo plano têm temporizadores reduzidos pelo navegador.

## Dados de feriados

Arquivos em `scripts/dados/` (módulos JavaScript estáticos), calculados por
`scripts/nucleo/feriados.js`:

- `feriados-nacionais.js` — feriados nacionais (Lei nº 662/1949 com redação
  da Lei nº 10.607/2002, Lei nº 6.802/1980, Lei nº 14.759/2023), Sexta-feira
  da Paixão, **pontos facultativos federais** (que *não* são feriados) e datas
  comemorativas. `EXTRAS_POR_ANO` guarda as emendas específicas de cada
  portaria (2026: Portaria MGI nº 11.460/2025).
- `feriados-estaduais.js` — 24 UFs verificadas; MG, MT e PR não têm feriado
  estadual próprio além dos nacionais.
- `feriados-municipais.js` — **somente capitais** com lei encontrada (21).
  Não é uma base municipal completa, e a interface diz isso.

Datas móveis são calculadas a partir da Páscoa (algoritmo de Meeus/Jones/
Butcher): Carnaval (−48/−47 dias), Quarta-feira de Cinzas (−46), Sexta-feira
Santa (−2) e Corpus Christi (+60). Regras suportadas: `fixa`, `pascoa`,
`nesimo` (ex.: 2º domingo de maio) e `domingoSeguinte` (ex.: data magna de SC).

**Como atualizar:** a cada nova portaria anual do MGI (dezembro/janeiro),
adicione o ano em `EXTRAS_POR_ANO` (datas extras, transferências, horários dos
pontos parciais) e ajuste `fonte`. Para leis estaduais/municipais novas,
inclua uma entrada com `base_legal`, `fonte`, `desde`/`ate` e rode `npm test`.
Cada item exibe sua base legal e fonte na página.

## PWA e funcionamento offline

- `manifest.webmanifest` + ícones em `assets/icones/` permitem instalar o site.
- `sw.js` pré-carrega todas as páginas e arquivos estáticos. Páginas: rede
  primeiro (com limite de 3,5 s), depois cache, depois `/offline`. Arquivos
  estáticos: cache primeiro com atualização em segundo plano.
- **`/api/*` nunca passa pelo service worker nem entra no cache.**
- A versão do cache é um hash do conteúdo, gerado por `npm run gerar`.
  Quando há versão nova, a página mostra "Nova versão disponível —
  Atualizar"; se ninguém clicar, ela assume quando todas as abas forem
  fechadas. Caches antigos são apagados na ativação.
- Offline, todas as ferramentas que não dependem de rede funcionam; o relógio
  informa que não está sincronizado.

## Rotas e cabeçalhos

`vercel.json`:

- `cleanUrls: true` — `/cronometro.html` responde em `/cronometro`.
- Redirecionamentos permanentes das URLs antigas (`/paginas/*.html`) e do
  endereço antigo `brasil-time.vercel.app` para `global-time.lzdev.com.br`
  (exceto `/api/*` e `/sw.js`, para que PWAs instaladas no endereço antigo
  continuem atualizando).
- `X-Robots-Tag: noindex` em qualquer host `*.vercel.app` (prévias): só o
  domínio oficial é indexado.
- Segurança em todas as rotas: CSP restritiva (`script-src 'self'`, sem
  scripts ou estilos inline), `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, HSTS.
- `/api/*`: `no-store` também no CDN. `/sw.js`: `no-cache`.
  `/assets/fontes/*`: cache imutável de 1 ano. HTML, CSS e JS usam o padrão
  da Vercel (revalidação a cada acesso), para atualizações imediatas.

Validação: `npm run test:navegador` (todas as rotas) e os comandos `curl` da
seção de publicação.

## Permissões do navegador

| Recurso | Usado em | Observação |
|---|---|---|
| Áudio | Temporizador, Pomodoro, Despertador | Navegadores só liberam som após um clique na página |
| Notificações | Temporizador, Pomodoro, Despertador | Pedidas apenas ao clicar em "Ativar notificações" |
| Wake Lock (tela ligada) | Temporizador, Tela cheia, Despertador | Opcional; não disponível em todos os navegadores |
| Tela cheia | Tela cheia | Só por ação do usuário; no iPhone usa o modo quiosque sem a API |
| Geolocalização | Nascer e pôr do sol | Apenas ao clicar em "Usar minha localização" |

**Segundo plano:** temporizadores, Pomodoro e alarmes só funcionam com a
página aberta (pode estar em outra aba). Com o navegador fechado ou o
aparelho suspenso, nada toca — isso é uma limitação da plataforma web, avisada
nas próprias páginas. Ao reabrir, o temporizador informa quando terminou e o
despertador informa alarmes perdidos.

## Estrutura do repositório

```
Global-Time/
├── *.html                 # uma página por ferramenta, em pt-BR (URLs limpas na Vercel)
├── en/, es/, pt-pt/, …    # versões traduzidas, geradas por npm run gerar
├── 404.html, offline.html
├── api/hora.js            # Vercel Function: timestamp do servidor (no-store)
├── api/conta.js           # contas: cadastro, login, sessão, exclusão
├── api/eventos.js         # eventos pessoais da conta
├── api/_lib/              # HTTP, Upstash/memória, senhas e sessões (não é rota)
├── estilos/app.css        # design system + estilos de todas as páginas
├── scripts/
│   ├── tema-inicial.js    # aplica o tema antes da pintura (script clássico)
│   ├── nucleo/            # módulos compartilhados (sincronização, fusos, medidores,
│   │                      #   alertas, atalhos, feriados, UI, layout comum)
│   ├── paginas/           # lógica de cada página
│   ├── i18n/              # idiomas, t(), dicionários (textos/)
│   └── dados/             # feriados, UFs e cidades
├── assets/
│   ├── marca/             # logo, símbolo, imagem Open Graph
│   ├── icones/            # ícones PNG do PWA
│   ├── icones.svg         # sprite de ícones da interface
│   └── fontes/            # Inter e Plus Jakarta Sans (woff2, OFL)
├── sw.js, manifest.webmanifest, favicon.ico, robots.txt, sitemap.xml
├── vercel.json, .vercelignore, package.json
├── dev/                   # servidor local, gerador de layout, testes de navegador/PWA
└── testes/                # testes unitários (node:test)
```

## Autores

**Enzinxz, Luizeh** — com a identidade visual e a reestruturação
da nova versão alinhadas ao padrão da [LZdev](https://lzdev.com.br/).

[@destypc](https://github.com/destypc) ·
[@luizeh](https://github.com/luizeh)

Licença MIT.
