# Kit Estoque MRP — Superprompt do projeto

> Este arquivo é lido automaticamente pelo Claude Code em toda sessão. Ele é a especificação completa e a fonte de verdade do projeto. Se algo no código contradisser este arquivo, o arquivo vence, a menos que o Gabriel diga o contrário.

---

## 1. Missão

Construir uma aplicação web que recebe uma planilha (.xlsx ou .csv) com o cadastro de materiais de uma empresa e suas movimentações de estoque (entradas e saídas) e devolve, automaticamente:

1. Curva **ABC** (valor de consumo) e classificação **XYZ** (variabilidade da demanda), cruzadas numa matriz ABC×XYZ.
2. Parâmetros de reposição por item: **estoque de segurança, ponto de pedido, lote econômico (EOQ), estoque máximo, cobertura e giro**.
3. **Sugestão de compras** pronta (o que comprar, quanto, quando, quanto custa, com prioridade).
4. **MRP em períodos (time-phased)**, semanal, com necessidade bruta, recebimentos programados, estoque projetado, necessidade líquida, recebimento planejado e liberação planejada. Se a planilha trouxer estrutura de produto (BOM) e plano mestre (MPS), faz a explosão completa de necessidades em vários níveis.
5. **Dashboard** com KPIs e gráficos interativos.
6. **Planilha Excel de saída** formatada, com todas as abas calculadas, pronta para uso por um planejador/comprador.

Público: comprador, planejador de materiais, almoxarife, analista de suprimentos e estudante de logística. A ferramenta precisa ser útil de verdade no dia a dia, não só bonita.

Objetivo do autor (Gabriel Cunha): projeto de portfólio para GitHub e, principalmente, LinkedIn. A ferramenta será gratuita e pública.

---

## 2. Restrições inegociáveis

- **100% gratuito.** Nenhum serviço pago, nenhuma chave de API, nenhum backend, nenhum banco de dados, nenhum plano trial.
- **Sem aprovação de terceiros.** Nada que dependa de revisão, verificação ou aprovação de alguém (nada de loja de apps, nada de API com cadastro aprovado).
- **Processamento 100% no navegador do usuário.** A planilha nunca sai do computador de quem usa. Isso é argumento de venda: deixe explícito na interface ("Seus dados não saem do seu computador").
- **Hospedagem:** GitHub Pages (repositório público), deploy por GitHub Actions.
- **Somente bibliotecas com licença permissiva** (MIT, Apache-2.0, ISC, BSD). Nada GPL/AGPL. Nada de CDN externa em runtime: tudo empacotado pelo build (fontes inclusive).
- **Imagens:** somente ilustrações SVG originais criadas no próprio projeto, ou fotos de Unsplash/Pexels baixadas e versionadas no repo, com crédito no README. Nunca usar logos, marcas ou imagens de empresas reais.
- **Dados de exemplo 100% sintéticos.** Nunca usar dados reais de nenhuma empresa.
- Interface inteiramente em **português do Brasil**, com formatação pt-BR (R$ 1.234,56; datas dd/mm/aaaa; separador decimal vírgula).

---

## 3. Stack

| Camada | Escolha | Observação |
|---|---|---|
| Build | **Vite** + **React** + **TypeScript** (strict) | `base` configurado para o caminho do GitHub Pages |
| Estilo | **Tailwind CSS v4** (plugin `@tailwindcss/vite`) | Tema com tokens próprios (ver seção 10) |
| Gráficos | **Apache ECharts** (`echarts`, com `echarts-for-react` ou wrapper próprio) | Importar só os módulos usados (tree-shaking) |
| Tabelas | **@tanstack/react-table** + **@tanstack/react-virtual** | Ordenar, filtrar, paginar e virtualizar listas grandes |
| Leitura CSV | **papaparse** | Detectar separador `;` ou `,` e encoding; modo `worker`/chunk para arquivos grandes |
| Leitura Excel | **SheetJS Community Edition** (`xlsx`, Apache-2.0) | Rápido e leve na leitura. **Não instalar a versão do registro npm** (parada na 0.18.5, com vulnerabilidades conhecidas): instalar o tarball oficial indicado em docs.sheetjs.com (`npm i https://cdn.sheetjs.com/xlsx-<versão>/xlsx-<versão>.tgz`), conferindo a versão atual na documentação. O download acontece só na instalação; em runtime vai empacotado. Ler dentro do worker, só as abas necessárias (opção `sheets`), com `dense: true` |
| Escrita Excel | **exceljs** | Só para gerar a planilha de saída e o modelo (tamanho proporcional ao número de itens, não de movimentações). Carregar sob demanda (`import()` dinâmico); se der erro de bundling, importar de `exceljs/dist/exceljs.min.js` |
| Estado | React Context + `useReducer` (ou **zustand**, se ficar complexo) | |
| Processamento pesado | **Web Worker** (`new Worker(new URL(...), { type: 'module' })`) | A interface não pode travar com 100 mil linhas |
| Ícones | **lucide-react** | |
| Fonte | **@fontsource-variable/inter** (self-hosted) | |
| Testes | **Vitest** | Motor de cálculo com cobertura alta |
| Qualidade | ESLint + Prettier | |
| CI/CD | GitHub Actions: lint → test → build → deploy Pages | |

Use as versões estáveis mais recentes de cada pacote no momento da instalação e confira a documentação oficial se a forma de configurar tiver mudado (especialmente Tailwind v4 e Vite).

---

## 4. Estrutura de pastas

```
kit-estoque-mrp/
├─ CLAUDE.md                  ← este arquivo
├─ README.md                  ← em inglês
├─ README.pt-BR.md            ← em português
├─ LICENSE                    ← MIT
├─ .github/workflows/deploy.yml
├─ public/
│  ├─ og-image.png            ← 1200×627 para prévia no LinkedIn
│  ├─ favicon.svg
│  └─ exemplos/               ← planilhas de demonstração geradas
├─ scripts/
│  └─ gerar-dados-demo.ts     ← gera o dataset sintético
├─ src/
│  ├─ main.tsx / App.tsx
│  ├─ engine/                 ← MOTOR DE CÁLCULO: TypeScript puro, sem React, sem DOM
│  │  ├─ tipos.ts
│  │  ├─ estatistica.ts       ← média, desvio, normInv, arredondamentos
│  │  ├─ series.ts            ← agregação de movimentos em períodos
│  │  ├─ custo.ts
│  │  ├─ abc.ts
│  │  ├─ xyz.ts               ← XYZ + padrão de demanda (Syntetos-Boylan)
│  │  ├─ previsao.ts          ← média móvel e SBA
│  │  ├─ parametros.ts        ← ES, PP, EOQ, Máx, cobertura
│  │  ├─ reposicao.ts         ← status, posição, sugestão de compra
│  │  ├─ mrp.ts               ← time-phased + explosão de BOM
│  │  ├─ kpis.ts
│  │  ├─ qualidade.ts         ← validação dos dados de entrada
│  │  └─ index.ts             ← função única `processar(entrada, params) → Resultado`
│  ├─ io/
│  │  ├─ ler-planilha.ts      ← xlsx/csv → estrutura normalizada
│  │  ├─ mapeamento.ts        ← sinônimos de colunas
│  │  ├─ gerar-modelo.ts      ← planilha-modelo para download
│  │  └─ exportar-excel.ts    ← planilha de saída
│  ├─ worker/processador.worker.ts
│  ├─ components/             ← UI reutilizável
│  ├─ pages/                  ← abas da aplicação
│  ├─ charts/                 ← um arquivo por gráfico
│  ├─ assets/bg/              ← SVGs de fundo temáticos
│  └─ styles/
└─ tests/                     ← testes do engine com casos calculados à mão
```

Regra de arquitetura: **o `engine/` não importa nada de UI**. Ele recebe dados normalizados e parâmetros e devolve um objeto `Resultado`. Isso torna o cálculo testável e reaproveitável.

---

## 5. Entrada: modelo de planilha

O app oferece um botão **"Baixar planilha-modelo"** que gera um .xlsx com as abas abaixo, cabeçalhos formatados, uma linha de exemplo, validação de dados (listas suspensas) e uma aba "Instruções".

### 5.1 Aba `Materiais` (obrigatória)

| Coluna | Obrig. | Tipo | Observação |
|---|---|---|---|
| codigo | sim | texto | Chave do item |
| descricao | sim | texto | |
| unidade | sim | texto | UN, PC, CX, KG, L, M… |
| estoque_atual | sim | número | Saldo físico na data-base |
| custo_unitario | não* | número | *Se ausente, calcular pelas entradas (ver 6.2) |
| lead_time_dias | sim | número | Prazo de reposição em dias corridos |
| desvio_lead_time_dias | não | número | Ativa a fórmula de ES com variabilidade de prazo |
| lote_minimo | não | número | Padrão 0 |
| multiplo_compra | não | número | Padrão 1 (embalagem) |
| estoque_seguranca_manual | não | número | Se preenchido, substitui o calculado |
| fornecedor | não | texto | |
| categoria | não | texto | Família/grupo de material |
| tipo_item | não | texto | `Comprado` ou `Fabricado` (padrão Comprado) |
| data_cadastro | não | data | Início de vida do item; se preenchida, define o início da série (6.3) |

### 5.2 Aba `Movimentacoes` (obrigatória)

| Coluna | Obrig. | Tipo | Observação |
|---|---|---|---|
| data | sim | data | Aceitar data do Excel, dd/mm/aaaa e aaaa-mm-dd |
| codigo | sim | texto | |
| tipo | sim | lista | `Entrada`, `Saída`, `Ajuste +`, `Ajuste -`, `Devolução ao estoque`, `Devolução ao fornecedor` |
| quantidade | sim | número | Sempre positiva; o sinal vem do tipo |
| valor_total | não | número | Usado para custo médio das entradas |
| documento | não | texto | NF, requisição, OP… |

**Regra importante:** só `Saída` conta como **demanda/consumo**. Ajustes alteram saldo, mas não entram na série de demanda (senão um ajuste de inventário vira "consumo" e distorce ABC, XYZ e ES).

**Efeito de cada tipo:**

| Tipo | Saldo | Demanda | Custo médio |
|---|---|---|---|
| Entrada | + | — | entra no cálculo |
| Saída | − | + (é a demanda) | — |
| Ajuste + / Ajuste − | + / − | — | — |
| Devolução ao estoque (material requisitado que voltou da produção/manutenção ou devolução de cliente) | + | abate a saída do mesmo período, sem deixar o período negativo (parâmetro, padrão Sim) | — |
| Devolução ao fornecedor | − | — | abate das entradas (qtd e valor) se houver valor_total |

Se a planilha trouxer só "Devolução", sem dizer o destino, tratar como **Devolução ao estoque** e emitir aviso de qualidade pedindo para o usuário confirmar. Sinônimos: "dev. fornecedor", "devolução de compra", "estorno de entrada" → ao fornecedor; "dev. requisição", "retorno ao almoxarifado", "devolução de cliente" → ao estoque.

### 5.3 Abas opcionais

- `PedidosAbertos` (recebimentos programados): codigo, data_prevista, quantidade.
- `BOM` (estrutura de produto): codigo_pai, codigo_filho, quantidade_por, perda_pct.
- `MPS` (plano mestre / demanda independente): codigo, semana_inicio (data), quantidade.

Se `BOM` e `MPS` existirem, o MRP usa explosão de necessidades. Se não existirem, o MRP usa a previsão de consumo como necessidade bruta (planejamento baseado em consumo, como o MRP tipo VB/VV do SAP).

### 5.4 Mapeamento flexível de colunas

Empresas não usam o mesmo cabeçalho. Implementar:
1. Normalização (minúsculas, sem acento, sem espaço extra).
2. Dicionário de sinônimos, por exemplo: `codigo` ← cod, código, sku, material, item, cod_material, part number; `quantidade` ← qtd, qtde, quant; `custo_unitario` ← custo, preço unitário, valor unitário, cmm; `lead_time_dias` ← lead time, prazo, prazo entrega, lt; `tipo` ← movimento, tipo mov, natureza (e valores E/S, ENT/SAI, entrada/saida, 101/201/261 com aviso).
3. Se alguma coluna obrigatória não for encontrada, mostrar uma **tela de mapeamento** com selects para o usuário apontar qual coluna é qual. Lembrar o mapeamento no `localStorage`.

---

## 6. Motor de cálculo — fórmulas exatas

Todo número exibido precisa ser explicável. Cada item tem um painel **"Ver o cálculo"** que mostra a fórmula, os valores substituídos e o resultado, passo a passo.

### 6.1 Parâmetros globais (editáveis na interface, com valores padrão)

| Parâmetro | Padrão | Por que esse valor |
|---|---|---|
| Período de análise | Mensal (alternativa: semanal) | Mensal suaviza ruído para ABC/XYZ |
| Janela de histórico | Últimos 12 períodos completos | Um ano captura sazonalidade anual |
| Excluir mês corrente incompleto | Sim | Mês parcial subestima demanda |
| Cortes ABC (valor acumulado) | A < 80%, B < 95%, C restante | Pareto clássico 80/15/5 |
| Cortes XYZ (CV) | X ≤ 0,50; Y ≤ 1,00; Z > 1,00 | Faixas usuais para dados mensais |
| Cortes Syntetos-Boylan | ADI 1,32; CV² 0,49 | Valores publicados por Syntetos, Boylan & Croston (2005) |
| Mínimo de períodos com dados | 3 | Abaixo disso, "Histórico insuficiente" |
| Previsão – itens suaves/erráticos | Média móvel de 6 períodos | Reage a mudanças sem ser nervosa |
| Previsão – intermitentes/irregulares | SBA (Croston corrigido), α = 0,10 | Média simples erra muito com muitos zeros |
| Dias por período | 30 (mensal) / 7 (semanal) | Lead time é informado em dias corridos |
| Custo de emissão do pedido (S) | R$ 100,00 | Placeholder: o usuário deve informar o seu |
| Taxa de manutenção de estoque (i) | 25% ao ano | Faixa usual de literatura: 20–30% a.a. |
| Dias sem saída para "sem giro" | 180 | Seis meses parado = risco de obsolescência |
| Abater devoluções ao estoque da demanda | Sim | Material requisitado e devolvido não foi consumido |
| Períodos por ano | 12 (mensal) / 52 (semanal) | Usado em toda anualização (D, giro, ABC) |
| Horizonte do MRP | 12 semanas | ~1 trimestre |
| Política de lote no MRP | Lote econômico (alternativas: lote a lote, período fixo) | |
| Data-base | Data da última movimentação | Editável |

**Matriz de nível de serviço (padrão, editável em grade 3×3):**

| | X | Y | Z |
|---|---|---|---|
| **A** | 98% | 97% | 95% |
| **B** | 96% | 95% | 92% |
| **C** | 93% | 90% | 85% |

Lógica: itens A pesam no faturamento e custam caro para faltar; itens Z são imprevisíveis e proteger 98% deles exigiria estoque desproporcional.

Itens "sem demanda" e "histórico insuficiente" não recebem ES calculado: sinalizar para revisão manual.

### 6.2 Custo unitário

Prioridade: (1) `custo_unitario` do cadastro; (2) custo médio ponderado das entradas na janela = Σ valor_total ÷ Σ quantidade das entradas com valor; (3) último custo de entrada conhecido; (4) se nada existir, custo = 0 e alerta de qualidade "item sem custo" (o item fica fora do ABC por valor e vai para uma lista de pendências).

### 6.3 Séries de demanda

Para cada item, somar as quantidades de `Saída` por período (líquidas de devoluções ao estoque, ver 5.2) e **preencher períodos sem saída com zero** (esquecer os zeros é o erro mais comum e destrói o cálculo de XYZ).

**Início da série por item (itens novos):** a série de cada item começa em
início_item = max(início da janela, período de `data_cadastro`, se existir; senão, período da primeira movimentação de qualquer tipo do item no arquivo).
Os períodos antes do início_item **não** entram como zero, porque o item ainda não existia. n passa a ser o número de períodos do item, não o da janela. Se n < 3 (parâmetro "mínimo de períodos") → "Histórico insuficiente": ABC calculado normalmente (anualizado), XYZ = "Novo", ES não calculado e item marcado para revisão manual.

Limitação a explicar na Metodologia: se a extração da planilha começa numa data e um item antigo simplesmente não teve movimento no início, ele será tratado como novo. A coluna `data_cadastro` resolve isso.

- Demanda média: d̄ = Σdₜ ÷ n
- Desvio padrão amostral: σ = √( Σ(dₜ − d̄)² ÷ (n − 1) )
- Consumo em valor na janela: Cv = Σdₜ × custo_unitario
- **Consumo anual em valor** (base da ABC, para não penalizar itens novos): Cv_anual = d̄ × custo_unitario × períodos_por_ano. Para itens com a janela completa, Cv_anual = Cv × períodos_por_ano ÷ n.

### 6.4 Curva ABC

1. Ordenar itens por Cv_anual decrescente (itens com Cv_anual = 0 vão para o fim, classe C).
2. %acumulado_anterior = soma dos Cv_anual dos itens anteriores ÷ Cv_anual total.
3. Classe A se %acumulado_anterior < 80%; B se < 95%; C caso contrário.

Usar o acumulado **anterior** garante que sempre exista ao menos um item A e que o item que cruza o corte fique na classe superior.

Oferecer alternativa de ABC por quantidade consumida e ABC por valor em estoque (seletor na aba ABC), mas o padrão para a matriz é valor de consumo.

### 6.5 XYZ e padrão de demanda

- CV = σ ÷ d̄. Se d̄ = 0 → classe **N (sem demanda)**.
- X se CV ≤ 0,50; Y se CV ≤ 1,00; Z se CV > 1,00.
- Padrão de demanda (Syntetos-Boylan), complementar ao XYZ:
  - ADI = n ÷ (número de períodos com demanda > 0)
  - CV² = (CV dos tamanhos de demanda **não nulos**)², desvio amostral
  - Suave: ADI < 1,32 e CV² < 0,49 · Errático: ADI < 1,32 e CV² ≥ 0,49 · Intermitente: ADI ≥ 1,32 e CV² < 0,49 · Irregular (lumpy): ADI ≥ 1,32 e CV² ≥ 0,49
  - Se houver só 1 período não nulo, CV² = 0.

### 6.6 Previsão de demanda por período (F)

- Suave/Errático: média dos últimos 6 períodos (ou de todos, se houver menos de 6).
- Intermitente/Irregular: SBA. Inicializar com o primeiro valor não nulo (z) e o primeiro intervalo (p). A cada período com demanda: z ← z + α(d − z); p ← p + α(q − p), onde q é o intervalo desde a última demanda. F = (1 − α/2) × z ÷ p.
- Exibir no painel de cada item qual método foi usado e por quê.

### 6.7 Parâmetros de reposição

Notação: LTₚ = lead_time_dias ÷ dias_por_período; Z = NORM.S.INV(nível de serviço).

- **Estoque de segurança (ES)**
  - Sem variabilidade de prazo: ES = Z × σ × √LTₚ
  - Com `desvio_lead_time_dias` (σ_LT, convertido para períodos): ES = Z × √( LTₚ × σ² + F² × σ_LTₚ² )
  - Se `estoque_seguranca_manual` existir, usar o manual e marcar "manual".
- **Ponto de pedido (PP)** = F × LTₚ + ES
- **Demanda anual** D = F × períodos_por_ano (12 ou 52)
- **Custo de manutenção unitário** H = i × custo_unitario
- **Lote econômico** EOQ = √( 2 × D × S ÷ H ). Se D = 0 ou H = 0 → "não se aplica".
- **Lote de compra ajustado** Q* = max(lote_minimo, ⌈EOQ ÷ múltiplo⌉ × múltiplo)
- **Estoque máximo** Máx = ES + Q*
- **Consumo diário** = F ÷ dias_por_período
- **Cobertura (dias)** = estoque_atual ÷ consumo diário (∞ se consumo = 0)

**Arredondamento:** calcular tudo em ponto flutuante; na exibição e na saída, arredondar para cima ES, PP, Máx e sugestões em unidades discretas (UN, PC, CX, PCT, PAR…) e usar 2 casas decimais em unidades fracionáveis (KG, G, L, ML, M, M2, M3).

**Inverso da normal:** implementar `normInv(p)` próprio (algoritmo de Acklam ou equivalente) em `estatistica.ts`, com testes.

### 6.8 Posição, status e sugestão de compra

- Posição de estoque = estoque_atual + Σ pedidos em aberto
- Status do item (aplicar na ordem; o primeiro que bater define o status):
  1. **Ruptura**: estoque_atual ≤ 0 e F > 0
  2. **Crítico**: estoque_atual < ES
  3. **Comprar**: posição ≤ PP
  4. **Excesso**: estoque_atual > Máx e F > 0
  5. **Sem giro**: nenhuma `Saída` há ≥ 180 dias e estoque_atual > 0
  6. **Sem demanda**: F = 0 e estoque_atual = 0
  7. **OK**
- Sugestão (quando posição ≤ PP): Qtd = max(lote_minimo, ⌈(Máx − posição) ÷ múltiplo⌉ × múltiplo); Valor = Qtd × custo
- Data de chegada estimada = data-base + lead_time_dias
- **Risco de ruptura antes da chegada** se cobertura (dias) < lead_time_dias → prioridade **Urgente**
- Prioridade: Urgente > Alta (classe A ou status Ruptura/Crítico) > Média (B) > Baixa (C)

### 6.9 Reconstrução do saldo histórico (para giro e consistência)

- Saldo no início da janela = estoque_atual − Σentradas − Σ(Ajuste +) − Σ(Devolução ao estoque) + Σsaídas + Σ(Ajuste −) + Σ(Devolução ao fornecedor), considerando os movimentos da janela (cada tipo com o sinal oposto ao da tabela de 5.2).
- Reconstruir o saldo ao fim de cada período. Estoque médio = média dos saldos de fim de período (só dos períodos do item, a partir de início_item).
- **Giro anualizado** = (consumo em valor da janela × períodos_por_ano ÷ n) ÷ (estoque médio × custo), com períodos_por_ano = 12 no mensal e 52 no semanal.
- Se algum saldo reconstruído ficar negativo → alerta "saldo inconsistente" (movimento faltando ou estoque atual errado). Não bloquear o cálculo.

### 6.10 MRP em períodos (semanal)

Horizonte H semanas, começando na semana da data-base. LT em semanas = ⌈lead_time_dias ÷ 7⌉.

Para cada item, por semana t:
- Necessidade bruta NB(t):
  - Sem BOM/MPS: F convertido para semana (F × 7 ÷ dias_por_período).
  - Com MPS: a quantidade do MPS para itens de nível 0; para os componentes, a soma das liberações planejadas dos pais × quantidade_por × (1 + perda_pct).
- Recebimentos programados RP(t): pedidos em aberto na semana.
- Estoque projetado: EP(t) = EP(t−1) + RP(t) + RecPlan(t) − NB(t), com EP(0) = estoque_atual.
- Se EP(t), antes de RecPlan(t), ficar abaixo do ES → Necessidade líquida NL(t) = ES − (EP(t−1) + RP(t) − NB(t)).
- Recebimento planejado RecPlan(t) = lote aplicado sobre NL(t):
  - Lote a lote: NL ajustado a lote mínimo e múltiplo
  - Lote econômico: max(NL, Q*) ajustado ao múltiplo
  - Período fixo (POQ, n semanas): soma das NL das próximas n semanas
- Liberação planejada LibPlan(t − LT) = RecPlan(t). Se t − LT < semana 1 → marcar **"liberação em atraso"** e lançar na semana 1.
- Com BOM: calcular **código de nível mais baixo** (low-level code) para cada item e processar nível por nível, do 0 para baixo. Detectar BOM circular e acusar erro amigável.

Saída do MRP: uma tabela "longa" (item × semana × linha do registro) e a visão clássica em grade (linhas = NB, RP, EP, NL, RecPlan, LibPlan; colunas = semanas), igual ao registro de MRP dos livros e do SAP (MD04).

### 6.11 KPIs (dashboard)

| KPI | Fórmula |
|---|---|
| Valor total em estoque | Σ estoque_atual × custo |
| SKUs ativos | itens com estoque > 0 ou demanda > 0 |
| Concentração A | % dos SKUs que são A e % do valor de consumo que representam |
| Giro anualizado | ver 6.9 (consolidado = CMV anualizado ÷ estoque médio em valor) |
| Cobertura média (dias) | valor em estoque ÷ (consumo em valor por dia) |
| Itens em ruptura | contagem e % |
| Itens críticos (abaixo do ES) | contagem |
| Itens a comprar | contagem e valor total da sugestão |
| Valor em excesso | Σ max(0, estoque − Máx) × custo |
| Valor sem giro | Σ estoque × custo dos itens "sem giro" |
| Risco de ruptura antes da chegada | contagem |
| Nível de serviço alvo médio | média ponderada pelo valor de consumo |
| Qualidade dos dados | % de linhas válidas |

Cada cartão de KPI tem tooltip com a fórmula e é clicável: leva para a tabela já filtrada pelos itens que compõem o número.

### 6.12 Análises matemáticas avançadas (vetores, matrizes, probabilidade, perda e derivadas)

Conceitos de álgebra linear, probabilidade e otimização aplicados à gestão de estoque. Cada um tem gráfico próprio (seção 9, itens 12 a 17), entra no "Ver o cálculo" do item e é explicado na aba Metodologia, numa seção "A matemática por trás", em linguagem acessível.

**a) Derivada e otimização: curva de custo total do lote (EOQ)**
- Custo total anual relevante: CT(Q) = (D ÷ Q) × S + (Q ÷ 2) × H
- Derivada: dCT/dQ = −D·S ÷ Q² + H ÷ 2. Igualando a zero → Q = √(2DS ÷ H), que é o EOQ. No ótimo, custo de pedir = custo de manter.
- Custo mínimo: CT(EOQ) = √(2·D·S·H)
- Mostrar a **penalidade do arredondamento**: (CT(Q*) − CT(EOQ)) ÷ CT(EOQ). Isso responde "quanto custa comprar em múltiplos da embalagem?".
- Não usar descida do gradiente aqui: a solução é fechada (fórmula exata). A aba Metodologia explica que a descida do gradiente faria o mesmo caminho, passo a passo, até onde a derivada vale zero.

**b) Probabilidade: distribuição da demanda durante o lead time**
- Demanda no LT ~ Normal(μ_LT = F × LTₚ, σ_LT = σ × √LTₚ) (ou a fórmula com variabilidade de prazo da seção 6.7).
- **Probabilidade de ruptura no ciclo** no ponto de pedido = 1 − nível de serviço.
- **Probabilidade de faltar antes da próxima chegada, a partir da posição atual** = 1 − Φ((posição − μ_LT) ÷ σ_LT). Implementar Φ (CDF normal) com função erro (erf) própria.
- Para itens intermitentes/irregulares, avisar que a Normal é uma aproximação fraca e marcar o resultado como "indicativo".

**c) Função de perda normal: nível de serviço por quantidade (fill rate)**
- Função de perda normal padrão: G(z) = φ(z) − z × (1 − Φ(z))
- Falta esperada por ciclo: ESC = σ_LT × G(z)
- Fill rate esperado (nível de serviço tipo 2): β = 1 − ESC ÷ Q*
- Mostrar lado a lado o nível de serviço de ciclo (tipo 1, o parâmetro) e o fill rate resultante (tipo 2). Isso explica por que "98% de ciclo" costuma virar mais de 99,9% de peças atendidas.

**d) Função de perda da previsão: backtest e métricas de erro**
- Backtest com origem móvel nos últimos 6 períodos (previsão um passo à frente, usando só dados anteriores a cada período).
- Métodos candidatos: média móvel 3, 6 e 12; suavização exponencial simples (SES) com α escolhido por busca em grade de 0,05 a 0,50 (passo 0,05), minimizando o erro quadrático médio; SBA para intermitentes.
- Métricas por item e método: MAE = média|real − prev|; RMSE = √média(real − prev)²; **WMAPE** = Σ|real − prev| ÷ Σreal (não usar MAPE, que explode com meses de consumo zero); **viés** = Σ(prev − real) ÷ Σreal (positivo = superestima).
- Parâmetro "Método de previsão": **Regra fixa** (padrão, seção 6.6) ou **Automático** (o método com menor MAE no backtest). No modo automático, o painel do item mostra a tabela de erros de todos os métodos e destaca o escolhido.
- KPI adicional no dashboard: WMAPE médio ponderado pelo valor de consumo e viés médio.

**e) Derivada da política: curva nível de serviço × custo do estoque de segurança**
- Para cada nível de serviço de 80% a 99,9%: custo anual do ES = ES(nível) × H.
- O gráfico mostra o custo marginal subindo rápido perto de 99% (sair de 95% para 99% aumenta o ES em cerca de 41%, porque Z vai de 1,645 para 2,326).
- Disponível por item e consolidado por célula ABC×XYZ, ajudando o usuário a calibrar a matriz de nível de serviço.

**f) Matrizes: a BOM como matriz de requisitos totais**
- Montar a matriz de uso direto B (B[i][j] = quantidade do item i para fazer uma unidade do item j, já com perda).
- Requisito total (sem defasagem de tempo): r = (I − B)⁻¹ × d, onde d é a demanda independente (MPS) do horizonte. Calcular por série de Neumann (I + B + B² + …) até zerar, já que a BOM é acíclica.
- Usar como **conferência**: o total de necessidades brutas do MRP no horizonte precisa bater com r para cada componente. Exibir na aba MRP uma "Visão matricial" pequena com a matriz B (heatmap) e o vetor r.

**g) Vetores e similaridade de cosseno: itens com comportamento parecido**
- Para cada item, vetor de demanda dos últimos 12 períodos normalizado pela média (perfil de forma, sem escala).
- Similaridade de cosseno entre itens: cos θ = (a · b) ÷ (‖a‖ × ‖b‖).
- No detalhe do item: "Itens com padrão de consumo parecido" (top 5, só se cos θ ≥ 0,80), útil para achar itens que respondem ao mesmo motor de demanda (mesma linha, mesma sazonalidade) e candidatos a compra conjunta no mesmo fornecedor.
- Limitar a itens com padrão suave/errático e fazer o cálculo no worker (custo n²; acima de 3.000 itens, calcular só dentro da mesma categoria).

Ficam de fora, de propósito: softmax, embeddings e descida do gradiente como algoritmo. Eles pertencem a modelos de linguagem e redes neurais e não acrescentam nada a uma ferramenta de estoque que já tem solução exata ou estatística para cada problema.

---

## 7. Qualidade dos dados

Antes de calcular, rodar validações e mostrar um relatório com contagem por tipo, gravidade (erro bloqueante, aviso) e as linhas afetadas:

- Código em movimentação sem cadastro em `Materiais` (aviso; ignora a linha)
- Data inválida ou futura em relação à data-base
- Quantidade zero, negativa ou não numérica
- Tipo de movimento desconhecido
- Item sem custo; item sem lead time (usar padrão de 30 dias com aviso)
- Códigos duplicados no cadastro (erro)
- Saldo reconstruído negativo (aviso)
- Linhas duplicadas idênticas em movimentações (aviso)

Erros bloqueantes impedem o cálculo e dizem exatamente o que corrigir e em qual linha.

---

## 8. Interface

Aplicação de página única com cabeçalho fixo e abas. Fluxo:

1. **Tela inicial (hero)** com fundo temático, título, uma frase de valor ("Suba sua planilha de estoque e receba curva ABC-XYZ, parâmetros de reposição, sugestão de compras e MRP em segundos — de graça e sem seus dados saírem do computador"), e três ações: **Enviar planilha** (área de arrastar e soltar), **Testar com dados de exemplo**, **Baixar planilha-modelo**.
2. **Mapeamento de colunas** (só aparece se necessário).
3. **Relatório de qualidade dos dados** (resumo; expansível).
4. **Painel de parâmetros** (gaveta lateral) com todos os itens da seção 6.1, cada um com ícone de ajuda explicando o efeito. Botão "Restaurar padrões". Recalcular ao mudar (com debounce), via worker.
5. **Abas de resultado:**
   - **Visão geral**: cartões de KPI + gráficos principais.
   - **ABC-XYZ**: Pareto, matriz 3×3 clicável (quantidade de itens e valor por célula), tabela com classe, CV, padrão de demanda, política recomendada por célula (ex.: AX = reposição automática com ES baixo; CZ = comprar sob demanda/revisar estoque).
   - **Reposição**: tabela completa de parâmetros por item, com filtros por classe, status, categoria e fornecedor.
   - **Compras**: sugestão de compras ordenada por prioridade, total por fornecedor, seleção de linhas para exportar só o que vai virar pedido.
   - **MRP**: seletor de item + grade time-phased + gráfico de estoque projetado vs ES vs PP; visão consolidada de liberações planejadas por semana (em quantidade e R$).
   - **Alertas**: rupturas, riscos antes da chegada, liberações em atraso, excesso, sem giro, inconsistências.
   - **Metodologia**: explicação de todas as fórmulas com notação e exemplo numérico; glossário (ES, PP, EOQ, LT, CV, ADI, MRP, MPS, BOM).
6. **Detalhe do item** (gaveta ao clicar em qualquer linha): histórico de consumo com média e ±σ, previsão, saldo reconstruído, parâmetros e o bloco "Ver o cálculo".
7. **Exportar**: botão principal "Baixar planilha MRP (.xlsx)"; secundários "Baixar CSV da tabela atual" e "Imprimir/Salvar relatório em PDF" (CSS de impressão, sem biblioteca paga).

Detalhes de UX obrigatórios:
- Barra de progresso real durante o processamento (o worker reporta etapas).
- Estados vazios e mensagens de erro amigáveis, em português simples.
- Modo claro e escuro (seguir o sistema, com alternância manual).
- Responsivo (o dashboard precisa funcionar no celular, porque é por lá que o pessoal do LinkedIn vai abrir).
- Acessibilidade: contraste AA, foco visível, navegação por teclado, `aria-label` nos gráficos com resumo textual.
- Números sempre em pt-BR; quantidades com unidade.
- Rodapé com "Desenvolvido por Gabriel Cunha", links para LinkedIn (linkedin.com/in/gabriel-cunha-xp) e para o repositório no GitHub, e o aviso de privacidade.
- Lembrar parâmetros no `localStorage` (envolto em try/catch). Nunca guardar a planilha do usuário.

---

## 9. Gráficos (ECharts)

1. **Pareto ABC**: barras de valor de consumo por item (ordenado) + linha de % acumulado, com faixas A/B/C sombreadas e linhas de corte.
2. **Matriz ABC×XYZ**: heatmap 3×3 com contagem e valor; alternar métrica; clique filtra a tabela.
3. **Dispersão CV × valor de consumo** (eixo X em escala log), cor por classe ABC, tooltip com o item.
4. **Status do estoque**: rosca com Ruptura/Crítico/Comprar/Excesso/Sem giro/OK (em quantidade e valor).
5. **Entradas vs saídas por mês** (valor), com linha do saldo total reconstruído.
6. **Top 10 itens em excesso** (R$) e **Top 10 risco de ruptura** (dias de cobertura vs lead time).
7. **Histograma de cobertura** (dias), com marcação do lead time médio.
8. **Valor por categoria e classe** (barras empilhadas).
9. **MRP**: estoque projetado semanal (linha) com ES e PP como linhas de referência e barras de recebimentos planejados.
10. **Liberações planejadas por semana** (R$) — o "fluxo de caixa de compras".
11. **Padrão de demanda Syntetos-Boylan**: dispersão ADI × CV² com os quatro quadrantes.
12. **Curva de custo total do lote** (6.12a): custo de pedir (decrescente), custo de manter (reta) e custo total (U), com o ponto do EOQ, o ponto de Q* e a penalidade do arredondamento anotada. Uma reta tangente horizontal no mínimo ilustra "derivada = 0".
13. **Distribuição da demanda no lead time** (6.12b): curva em sino com área sombreada à direita do ponto de pedido (risco de ruptura no ciclo) e linha vertical na posição atual, mostrando a probabilidade de faltar antes da chegada.
14. **Nível de serviço tipo 1 × fill rate** (6.12c): barras lado a lado por item ou por célula ABC×XYZ.
15. **Backtest da previsão** (6.12d): linha do real vs previsto no período de teste e barras de WMAPE por método, com o vencedor destacado.
16. **Curva nível de serviço × custo do ES** (6.12e): eixo X de 80% a 99,9%, ponto atual marcado.
17. **Similaridade de perfis** (6.12g): minigráficos sobrepostos do item e dos parecidos (normalizados) e, na aba ABC-XYZ, heatmap opcional de similaridade dos 30 itens A de maior valor.

Todos com: tooltip pt-BR, legenda, título, opção de baixar PNG (toolbox do ECharts), cores do tema (seção 10), rótulos legíveis no modo escuro.

---

## 10. Identidade visual e imagens de fundo

Tema: armazém / suprimentos / logística, com aparência profissional (ferramenta de trabalho, não site de jogo).

- **Paleta (tokens Tailwind):**
  - Azul-marinho industrial `#0B1F3A` (fundo escuro, cabeçalho)
  - Azul aço `#1E3A5F` e `#2F5D8A` (superfícies, gráficos)
  - Laranja de segurança `#F59E0B` (destaques, botões principais — referência às faixas de sinalização e empilhadeiras)
  - Cinza concreto `#E5E7EB` / `#6B7280`
  - Semânticas: OK `#16A34A`, Atenção `#F59E0B`, Crítico `#DC2626`, Excesso `#7C3AED`, Sem giro `#6B7280`
  - Classes: A = azul forte `#1D4ED8`, B = azul médio `#60A5FA`, C = cinza azulado `#94A3B8` (não usar vermelho para A: classe A não é "ruim", é importante); X/Y/Z em tons de verde → âmbar → laranja.
- **Imagens de fundo (SVG originais, criadas neste repositório, otimizadas com SVGO):**
  1. `hero-armazem.svg`: ilustração isométrica em line-art de um armazém com porta-paletes, paletes com caixas, uma empilhadeira e um contêiner, em azul aço sobre marinho, com leve gradiente. Usada no hero com sobreposição escura para garantir contraste do texto.
  2. `padrao-paletes.svg`: padrão repetível sutil (opacidade ~5%) com paletes, caixas e códigos de barras, para o fundo da área de trabalho.
  3. `faixa-seguranca.svg`: faixa diagonal amarelo/preto discreta usada como divisor de seção e na borda dos alertas críticos.
  4. Ilustrações pequenas para estados vazios: prateleira vazia (sem dados), caixa com lupa (validando), checklist (concluído).
  5. `og-image.png` 1200×627 e `favicon.svg` (ícone de caixa/palete com curva ABC estilizada).
- Fundos nunca podem prejudicar a leitura: sobreposição com gradiente, `backdrop-blur` nos cartões, contraste AA verificado.
- Opcional: se o Gabriel adicionar fotos do Unsplash/Pexels em `src/assets/fotos/`, converter para WebP < 200 KB e citar autor no README.
- Microinterações discretas: contadores animados nos KPIs, transição suave entre abas, `prefers-reduced-motion` respeitado.

---

## 11. Planilha de saída (.xlsx)

Nome do arquivo: `MRP_<nome-do-arquivo-original>_<aaaa-mm-dd>.xlsx`. Abas, nesta ordem:

1. **Leia-me**: o que é cada aba, data-base, parâmetros usados, aviso de que os valores são sugestões que dependem da qualidade dos dados, link para a ferramenta.
2. **Dashboard**: KPIs em blocos formatados + imagens PNG dos principais gráficos (exportar do ECharts com `getDataURL` e inserir com `workbook.addImage`).
3. **ABC-XYZ**: item, descrição, categoria, consumo (qtd), consumo (R$), %, % acumulado, classe ABC, d̄, σ, CV, classe XYZ, ADI, CV², padrão de demanda, classe combinada (ex.: AX).
4. **Parametros_Reposicao**: item, unidade, custo, LT, nível de serviço, Z, método de previsão, F, ES, PP, EOQ, Q*, Máx, estoque atual, posição, cobertura (dias), giro, status, custo total anual do lote, penalidade do arredondamento, probabilidade de faltar antes da chegada, fill rate esperado, WMAPE e viés da previsão.
5. **Sugestao_Compras**: prioridade, item, descrição, fornecedor, qtd sugerida, unidade, custo, valor, data de chegada estimada, motivo (texto curto gerado: "Posição 60 ≤ PP 74; cobertura 18 d > LT 15 d").
6. **MRP_Semanal**: grade time-phased por item (bloco por item com as 6 linhas e as semanas em colunas), com formatação condicional quando EP < ES.
7. **MRP_Consolidado**: liberações planejadas por semana × item (qtd e R$), com total por semana.
8. **Alertas**: tipo, gravidade, item, mensagem.
9. **Qualidade_Dados**: validações com linha de origem.
10. **Parametros_Usados**: todos os parâmetros globais e a matriz de nível de serviço.

Formatação obrigatória: cabeçalho com fundo marinho e texto branco, painéis congelados, autofiltro, larguras ajustadas, formatos `R$ #.##0,00`, `0,0%`, `dd/mm/aaaa` (no código, usar os códigos de formato em inglês, `"R$" #,##0.00`, que o Excel exibe em pt-BR), e cores por status e classe.

Para evitar o aviso de reparo do Excel:
- Cores por status/classe: aplicar como **preenchimento direto na célula** (o valor já é conhecido), não como formatação condicional.
- Formatação condicional só onde ela precisa reagir a edição do usuário, e só dos tipos `cellIs` e `expression`.
- **Barras de dados: opcionais.** Só manter se o teste de exportação abaixo passar e o arquivo abrir no Excel sem aviso; se não, remover.
- Teste automatizado de exportação: gerar o .xlsx da demo, reabrir com SheetJS e com ExcelJS e conferir abas, linhas e valores-chave. A validação final é abrir no Excel desktop do Gabriel antes de dar a Fase 6 como pronta. Os números são **valores calculados** (não fórmulas), mas a aba Leia-me explica cada fórmula.

---

## 12. Dados de demonstração

Script `scripts/gerar-dados-demo.ts` (rodado com `npx tsx`) que gera `public/exemplos/demo-industria.xlsx` com semente fixa (resultado reprodutível):

- Empresa fictícia: "Metalúrgica Exemplo Ltda".
- ~150 itens em categorias realistas (MRO, embalagens, matéria-prima, componentes, EPI, químicos), unidades variadas, custos de R$ 0,50 a R$ 8.000.
- 18 meses de movimentações com mistura proposital de padrões: ~40% suaves, ~20% erráticos, ~25% intermitentes, ~10% irregulares, ~5% sem saída recente (para gerar "sem giro").
- Entradas coerentes com lead time e lote, alguns pedidos em aberto, alguns itens propositalmente em ruptura, alguns em excesso e ~1% de linhas com problemas (código inexistente, quantidade zero) para demonstrar a validação.
- Uma segunda planilha `demo-montagem.xlsx` com BOM de 3 níveis (2 produtos acabados, ~15 componentes) e MPS de 12 semanas, para demonstrar a explosão do MRP.

---

## 13. Testes (Vitest) — casos calculados à mão

Os testes do `engine/` são o contrato de correção. Incluir no mínimo:

1. **normInv**: 0,85 → 1,036433; 0,90 → 1,281552; 0,95 → 1,644854; 0,98 → 2,053749; 0,99 → 2,326348 (tolerância 1e-5).
2. **ABC**: cinco itens com consumo R$ 5.000, 3.000, 1.000, 600, 400 (total 10.000) → acumulados anteriores 0%, 50%, 80%, 90%, 96% → classes A, A, B, B, C.
3. **Série com zeros**: movimentos em só 3 de 12 meses precisam gerar série de 12 posições.
4. **Item de referência (X, suave):** demanda mensal [100, 120, 80, 110, 90, 100, 130, 70, 100, 110, 90, 100]
   - d̄ = 100; Σ(d − d̄)² = 3.000; σ = √(3.000 ÷ 11) = 16,514; CV = 0,165 → X
   - F (média dos últimos 6: 130, 70, 100, 110, 90, 100) = 100
   - LT = 15 dias → LTₚ = 0,5; nível 98% → Z = 2,053749
   - ES = 2,053749 × 16,514 × √0,5 = 23,98 → exibido 24
   - PP = 100 × 0,5 + 23,98 = 73,98 → exibido 74
   - Custo R$ 10; i = 25% → H = 2,50; D = 1.200; S = 100 → EOQ = √(2 × 1.200 × 100 ÷ 2,5) = √96.000 = 309,84
   - Múltiplo 50, lote mínimo 100 → Q* = 350; Máx = 24 + 350 = 374
   - Estoque 60, sem pedidos → posição 60 ≤ 74 → status Comprar; sugestão = ⌈(374 − 60) ÷ 50⌉ × 50 = 350; valor R$ 3.500,00
   - Consumo diário = 3,333; cobertura = 18 dias > LT 15 → prioridade não urgente
5. **Intermitente:** [0, 0, 50, 0, 0, 0, 40, 0, 0, 60, 0, 0] → ADI = 12 ÷ 3 = 4; tamanhos 50, 40, 60 → média 50, desvio 10, CV² = 0,04 → Intermitente; previsão via SBA.
6. **Sem demanda**: série toda zero → XYZ = N, ES não calculado, EOQ "não se aplica".
7. **MRP lote a lote**: caso pequeno de livro-texto com resultado conferido semana a semana, incluindo liberação em atraso.
8. **BOM**: produto P usa 2 × C1 e C1 usa 3 × C2 → liberação de 10 P na semana 4 gera necessidade de 20 C1 na semana 4 e 60 C2 na semana em que C1 é liberado.
9. **Qualidade**: cada regra da seção 7 com um caso que dispara.
10. **Leitura**: CSV com `;` e vírgula decimal; datas em três formatos; cabeçalhos com sinônimos.
11. **Custo total do lote (item de referência):** D = 1.200, S = 100, H = 2,50 → CT(EOQ = 309,84) = 387,30 + 387,30 = 774,60 = √(2 × 1.200 × 100 × 2,5) = √600.000; CT(Q* = 350) = 342,86 + 437,50 = 780,36 → penalidade do arredondamento = +0,74%.
12. **Probabilidade (item de referência):** μ_LT = 50; σ_LT = 16,514 × √0,5 = 11,677; posição 60 → z = 0,8564 → P(faltar antes da chegada) = 1 − Φ(0,8564) ≈ 19,6% (tolerância 0,1 p.p.). Conferir também Φ(0) = 0,5 e Φ(1,644854) = 0,95.
13. **Fill rate (item de referência):** z = 2,053749 → φ(z) = 0,048424; G(z) = 0,048424 − 2,053749 × 0,02 = 0,007349; ESC = 11,677 × 0,007349 = 0,0858; β = 1 − 0,0858 ÷ 350 = 99,98%.
14. **Métricas de erro:** real [10, 0, 20], previsto [12, 4, 14] → erros (prev − real) 2, 4, −6 → MAE = 4,00; RMSE = √(56 ÷ 3) = 4,32; WMAPE = 12 ÷ 30 = 40,0%; viés = 0 ÷ 30 = 0,0%.
15. **Matriz da BOM:** mesmo caso do teste 8 (P usa 2 × C1; C1 usa 3 × C2), d = 10 P → r = (I − B)⁻¹ × d = [P 10, C1 20, C2 60], igual ao total do MRP.
16. **Cosseno:** [1, 2, 3] vs [2, 4, 6] → 1,00; [1, 0] vs [0, 1] → 0,00; [1, 1] vs [1, 0] → 0,7071.
17. **Item novo:** janela de 12 meses, primeira movimentação no mês 9, saídas [30, 30, 30, 30] nos meses 9 a 12 → n = 4 (não 12), d̄ = 30, σ = 0, CV = 0 → X (e não Z). Cv_anual = 30 × custo × 12.
18. **Item com menos de 3 períodos:** primeira movimentação no mês 11 → n = 2 → "Histórico insuficiente", XYZ = "Novo", sem ES.
19. **Devoluções:** saída de 100 e devolução ao estoque de 20 no mesmo mês → demanda do mês = 80, saldo −80. Devolução ao fornecedor de 10 → saldo −10, demanda inalterada. Devolução ao estoque de 50 num mês com saída de 30 → demanda 0 (nunca negativa).
20. **Giro semanal:** mesma base de dados processada no modo semanal usa períodos_por_ano = 52; o giro anualizado deve ficar próximo (±10%, por causa das semanas que cruzam a virada do mês) do calculado no modo mensal.
21. **Volume:** gerar planilha sintética com 100 mil movimentações e 2 mil itens; o processamento no worker conclui sem travar a interface e sem erro de memória. Registrar o tempo no README.
22. **Exemplo do Gabriel (posto percentil):** M1 = R$ 120.000/ano, LT 5 d, criticidade Baixa; M2 = R$ 40.000, LT 90 d, Alta; M3 = R$ 10.000, LT 20 d, Média. Pesos valor 40%, LT 25%, criticidade 35%.
    - Normalizados: valor M1 1 · M2 0,5 · M3 0; LT M1 0 · M2 1 · M3 0,5; criticidade M1 0 · M2 1 · M3 0,5
    - Scores: M1 = 0,40; M2 = 0,20 + 0,25 + 0,35 = 0,80; M3 = 0 + 0,125 + 0,175 = 0,30
    - Ordem por valor: M1 > M2 > M3. Ordem multicritério: **M2 > M1 > M3**. O item de valor intermediário (M2) passa à frente do item caro (M1).
23. **Mesmo exemplo com mín-máx:** valor M1 1 · M2 (40 − 10) ÷ 110 = 0,2727 · M3 0; LT M1 0 · M2 1 · M3 15 ÷ 85 = 0,1765 → scores M1 0,4000; M2 0,1091 + 0,25 + 0,35 = 0,7091; M3 0,0441 + 0,175 = 0,2191 → ordem M2 > M1 > M3.
24. **Empate no posto percentil:** valores [10, 20, 20, 40] → postos 0; 0,5; 0,5; 1.
25. **AHP consistente:** pesos-alvo 0,5 / 0,3 / 0,2 → matriz com aᵢⱼ = wᵢ ÷ wⱼ → média geométrica recupera exatamente 0,5 / 0,3 / 0,2 e CR = 0.
26. **Matriz VED:** item B por valor e Vital → A; C e Desejável → C.
27. **Dado faltando:** item sem criticidade recebe 0,5 e gera aviso; item com `classe_manual` mantém a classe manual independentemente do score.
28. **OndeUsado:** item usado nos equipamentos E1 (Baixa) e E2 (Alta) → criticidade Alta.

---

## 14. Publicação, README e SEO

- `vite.config.ts` com `base: '/kit-estoque-mrp/'` (ajustar se o nome do repo mudar).
- Workflow `.github/workflows/deploy.yml`: em push na `main` → `npm ci` → `npm run lint` → `npm test` → `npm run build` → publicar `dist/` com as actions oficiais do GitHub Pages.
- `index.html` com `<title>`, `meta description`, Open Graph (`og:title`, `og:description`, `og:image` absoluto apontando para a URL do Pages, `og:type`), Twitter card e `lang="pt-BR"`. A prévia do link no LinkedIn depende disso.
- **README.md** em inglês e **README.pt-BR.md** em português, com a mesma estrutura e os mesmos números; qualquer mudança em um vai para o outro. Os dois com: banner, badges (build, licença), GIF/screenshot, "Experimente agora" com o link, o problema que resolve, funcionalidades, metodologia resumida com as fórmulas, formato da planilha de entrada, privacidade, stack, como rodar localmente, roadmap, autor com LinkedIn, licença MIT.
- Sem rastreadores e sem cookies.

---

## 15. Fases de execução e definição de pronto

Trabalhar **uma fase por vez**. Ao fim de cada fase: rodar lint, testes e build; mostrar o que foi feito; fazer um commit com mensagem clara em português; esperar o "ok" do Gabriel antes de seguir.

| Fase | Entrega | Pronto quando |
|---|---|---|
| 0 | Scaffold Vite + React + TS + Tailwind + ESLint/Prettier + Vitest + estrutura de pastas + Git | `npm run dev` abre página com o tema aplicado |
| 1 | `engine/` completo (seções 6 e 7, incluindo 6.12) + testes da seção 13 | Todos os testes passam |
| 2 | Leitura de xlsx/csv, mapeamento de colunas, planilha-modelo, gerador de dados demo, worker | Demo carrega e processa sem travar a UI |
| 3 | UI: hero, upload, parâmetros, abas, tabelas, gaveta de item, "Ver o cálculo" | Fluxo completo navegável com a demo |
| 4 | Gráficos da seção 9 + KPIs clicáveis | Todos os gráficos renderizam nos dois temas |
| 5 | MRP time-phased + BOM + aba MRP | Testes 7 e 8 passam e a demo-montagem funciona |
| 6 | Exportação Excel (seção 11) + CSV + impressão | Planilha abre no Excel sem aviso de reparo |
| 7 | Identidade visual, SVGs de fundo, responsividade, acessibilidade, modo escuro, polimento | Lighthouse ≥ 90 em Acessibilidade e Boas práticas |
| 8 | README, og-image, workflow de deploy, LICENSE | Site no ar no GitHub Pages e prévia do link correta |
| 9 | ABC multicritério (seção 16-B): critérios, normalização, pontuação ponderada, matriz VED, pesos (presets, sliders, AHP), Equipamentos/OndeUsado, Sankey, "Quem mudou de classe", estabilidade, aba ABC_Multicriterio, modelo e demo atualizados | Testes 22 a 28 passam e a demo mostra itens subindo e descendo de classe |

---

## 16. Regras de trabalho para o Claude Code

- Responda e comente o código em **português**. Nomes de variáveis podem ser em português (preferido no engine, para casar com a planilha) ou inglês, mas de forma consistente.
- Antes de cada fase, apresente um plano curto e só então implemente.
- Não invente requisitos fora deste arquivo sem perguntar; sugestões são bem-vindas, mas separadas.
- Toda fórmula nova precisa de teste e de entrada na aba Metodologia.
- Nunca adicione dependência paga, serviço externo, chave de API, telemetria ou CDN.
- O ambiente é **Windows** (PowerShell no terminal do VS Code). Use comandos compatíveis; se precisar de script, prefira scripts npm/Node a bash.
- Se um comando falhar, leia o erro, explique em uma frase e corrija. Não repita o mesmo comando às cegas.
- Mantenha o bundle inicial leve: ExcelJS e ECharts carregados sob demanda quando possível.
- Ao terminar cada fase, atualize a seção "Status" abaixo.

## 16-B. Classificação ABC multicritério (criticidade, lead time e pesos da empresa) — Fase 9

### Por que existe
O ABC clássico olha só para valor de consumo. Na prática, um item de valor intermediário que demora 90 dias para chegar e alimenta uma máquina crítica merece mais proteção do que um item caro que chega em 5 dias e serve a um equipamento secundário. Muitas empresas já têm seus próprios pesos para isso. Este módulo deixa o usuário montar essa régua, ver quem mudou de classe e por quê, e usar a classe resultante em todo o resto da ferramenta.

É **opcional**: com o módulo desligado, tudo funciona como antes (ABC por valor).

### Entradas novas (todas opcionais)
Na aba `Materiais`:

| Coluna | Tipo | Direção | Observação |
|---|---|---|---|
| criticidade | texto ou número | maior = mais crítico | Aceitar Alta/Média/Baixa, A/B/C, V/E/D (Vital/Essencial/Desejável) ou escala 1–5 |
| num_fornecedores | número | menor = mais crítico | 1 = fonte única |
| possui_substituto | Sim/Não | Não = mais crítico | |
| custo_parada_hora | número (R$/h) | maior = mais crítico | Custo de a máquina parar por falta do item |
| classe_manual | A/B/C | — | Substitui o resultado; exige `justificativa_classe` |
| justificativa_classe | texto | — | Aparece na planilha de saída |
| crit_<nome> | número | escolhida na tela | Qualquer critério próprio da empresa (ex.: `crit_seguranca`, `crit_qualidade`) |

Abas novas:
- `Equipamentos`: equipamento, criticidade (mesmos formatos acima), setor.
- `OndeUsado`: codigo, equipamento (um item pode servir a várias máquinas).

**Regra:** se o item estiver em `OndeUsado`, a criticidade dele é a **maior** entre os equipamentos que atende, a menos que a coluna `criticidade` do próprio item esteja preenchida (o cadastro do item prevalece). Também fica disponível o critério automático "nº de equipamentos atendidos".

### Critérios disponíveis
Automáticos (calculados pelo motor): valor de consumo anual (Cv_anual), lead time (`lead_time_dias`), variabilidade (CV) e nº de equipamentos atendidos.
Do cadastro: criticidade, nº de fornecedores, substituto, custo de parada e qualquer `crit_*`.

O critério CV vem com **peso padrão 0**, com um aviso: a variabilidade já é o outro eixo da matriz (XYZ), e colocá-la no score contaria duas vezes.

### Dois modos de classificação

**Modo 1 — Pontuação ponderada (padrão quando o módulo é ligado)**
1. **Normalizar** cada critério para 0–1, onde 1 = mais crítico:
   - Numéricos: **posto percentil** (padrão) = (posição no ranking crescente − 1) ÷ (n − 1), com empates recebendo a média dos postos. É robusto a valores extremos (um item de R$ 1 milhão não achata todos os outros). Alternativa: mín-máx = (x − mín) ÷ (máx − mín).
   - Critérios "menor = mais crítico" (nº de fornecedores): usar 1 − valor normalizado.
   - Categóricos: Alta/A/V/5 = 1; Média/B/E/3 = 0,5; Baixa/C/D/1 = 0; escala 1–5 → (x − 1) ÷ 4. Substituto: Não = 1, Sim = 0.
   - **Dado faltando** para um item: valor neutro 0,5 e aviso de qualidade (não excluir o item, não redistribuir pesos).
2. **Score** do item: S = Σ (pesoₖ × nₖ), com Σ pesos = 100%.
3. **Classes:** ordenar por S decrescente. Padrão: **mesma quantidade de itens em A, B e C que o ABC por valor gerou**, o que torna a comparação justa ("quem trocou de lugar com quem"). Alternativas: percentual de itens definido pelo usuário (ex.: 20/30/50) ou cortes de score (ex.: A ≥ 0,60; B ≥ 0,35).
4. **Regras de piso (opcionais, editáveis):** ex.: "criticidade Alta, sem substituto e lead time > 60 dias → nunca abaixo de B". Mostrar quando uma regra foi aplicada.
5. **Classe manual** prevalece sobre tudo e fica marcada.

**Modo 2 — Matriz bicritério ABC × Criticidade (VED)** (inspirada em Flores & Whybark)
Grade 3×3 editável que cruza a classe por valor com a criticidade e devolve a classe final. Padrão:

| | Crítico (V) | Essencial (E) | Desejável (D) |
|---|---|---|---|
| **A (valor)** | A | A | B |
| **B (valor)** | A | B | C |
| **C (valor)** | B | C | C |

Mais simples de explicar para a diretoria; o modo 1 é mais completo.

### Pesos
- **Presets** (são pontos de partida, não normas; a tela precisa dizer isso):
  - Clássico: valor 100%
  - Produção/MRP: valor 40%, lead time 25%, criticidade 25%, nº de fornecedores 10%
  - Manutenção (MRO): criticidade 35%, lead time 25%, valor 20%, substituto 10%, nº de fornecedores 10%
  - Personalizado
- **Sliders** por critério, com rebalanceamento automático para somar 100%.
- **Assistente AHP (opcional):** o usuário compara os critérios dois a dois na escala de Saaty (1 a 9: "lead time é quantas vezes mais importante que valor?"). Pesos pela média geométrica das linhas da matriz, normalizada. Consistência: λmáx ≈ média de (A·w)ᵢ ÷ wᵢ; CI = (λmáx − n) ÷ (n − 1); CR = CI ÷ RI, com RI = 0,58 (n=3), 0,90 (4), 1,12 (5), 1,24 (6), 1,32 (7), 1,41 (8), 1,45 (9). Se CR > 0,10, avisar que as comparações estão incoerentes e mostrar o par mais contraditório.
- Salvar e carregar a configuração de pesos como arquivo .json (para a empresa reaproveitar mês a mês) e lembrar no `localStorage`.

### Efeito no resto da ferramenta
Com o módulo ligado, a **classe final** substitui a classe por valor na matriz ABC×XYZ, no nível de serviço, nas prioridades de compra, nos KPIs e na planilha. A classe por valor continua visível ao lado, para comparação.

### Interface (dentro da aba ABC-XYZ, alternância "Classificar por: Valor | Multicritério")
- Painel de pesos (presets, sliders, botão do assistente AHP, regras de piso).
- **Pré-visualização ao vivo:** "Com esses pesos, 14 itens sobem de classe e 11 descem."
- Gráfico **Sankey** "ABC por valor → classe final".
- Tabela **"Quem mudou de classe"** com motivo em texto gerado a partir das maiores contribuições. Ex.: "Subiu de B para A: criticidade Alta (+0,35) e lead time de 90 dias (+0,25) compensam o valor intermediário (+0,11)".
- No detalhe do item: barra empilhada da contribuição de cada critério para o score e radar com os critérios normalizados.
- **Estabilidade da classe:** 500 simulações perturbando cada peso em até ±10 p.p. (renormalizando para 100%) e contando em quantas a classe do item se mantém. Mostrar "classe estável em 92% das simulações" e destacar itens instáveis (< 70%), que são os que merecem discussão.

### Saída Excel
Nova aba **ABC_Multicriterio**: item, cada critério (valor bruto, normalizado, peso, contribuição), score, posição, classe por valor, classe final, regra aplicada, classe manual e justificativa, mudou? (↑/↓), motivo, estabilidade (%). A aba Parametros_Usados registra o modo, os pesos, a normalização, as regras de piso e, se usado, a matriz AHP com o CR.

### Planilha-modelo e dados de demonstração
- A planilha-modelo ganha as colunas novas (com listas suspensas para criticidade e substituto) e as abas `Equipamentos` e `OndeUsado`.
- A demo `demo-industria.xlsx` ganha ~25 equipamentos com criticidade variada, a relação OndeUsado e as colunas novas preenchidas, montadas de propósito para que alguns itens de valor médio, lead time longo e máquina crítica subam para A, e alguns itens caros, de entrega rápida e máquina secundária desçam. Assim o Sankey e a tabela "Quem mudou de classe" já impressionam no primeiro clique.

### Testes
Casos 22 a 28 da seção 13.

## 17. Decisões registradas

| # | Dúvida | Decisão |
|---|---|---|
| 1 | "Devolução" ambígua | Dois tipos: ao estoque (+ saldo, abate demanda) e ao fornecedor (− saldo, não mexe na demanda). Ver 5.2 |
| 2 | Itens novos inflando CV com zeros | Série começa em início_item (6.3); ABC sobre consumo anualizado; n < 3 → "Histórico insuficiente" |
| 3 | Giro no modo semanal | Anualizar sempre com períodos_por_ano (12 ou 52) |
| 4 | Peso e memória do ExcelJS | Ler com SheetJS CE no worker; ExcelJS só para escrever, carregado sob demanda; cores como preenchimento direto; barras de dados opcionais; teste de reabertura do arquivo |
| 5 | Versões (Tailwind v4, Vite, Node) | Conferir a documentação oficial na instalação. Ambiente do Gabriel: Node 26.13, npm 11.20, Git 2.56, Windows/PowerShell |

## Status

- [x] Fase 0 — Scaffold (TypeScript fixado em ~6.0: o typescript-eslint 8.73 ainda não suporta TS 7; o template do Vite traz oxlint, trocado por ESLint conforme a seção 3)
- [x] Fase 1 — Motor de cálculo (73 testes; φ(2,053749) exato = 0,048418, não 0,048424 — ver tests/estatistica.test.ts)
- [x] Fase 2 — Entrada de dados (SheetJS CE 0.20.3 via tarball oficial; overrides de uuid ^11 para o ExcelJS)
- [x] Fase 3 — Interface (TanStack Table v9 + Virtual; ?demo=industria|montagem e ?aba=… abrem direto um exemplo/aba)
- [x] Fase 4 — Gráficos e KPIs (17 gráficos + histórico, saldo e matriz B; conferidos nos dois temas)
- [x] Fase 5 — MRP (testes 7 e 8 passam; demo-montagem explode 3 níveis)
- [ ] Fase 6 — Exportação (pronta e testada com SheetJS/ExcelJS; falta abrir no Excel desktop do Gabriel sem aviso de reparo)
- [ ] Fase 7 — Visual e polimento (feito; falta medir Lighthouse ≥ 90 — o npx lighthouse foi bloqueado pela permissão do ambiente)
- [ ] Fase 8 — Publicação (README, LICENSE, og-image, metatags e workflow prontos; repositório https://github.com/gorc-supply/kit-estoque-mrp; site em https://gorc-supply.github.io/kit-estoque-mrp/)
- [x] Fase 9 — ABC multicritério (motor em src/engine/multicriterio.ts; testes 22 a 28 + extras; demo-industria com 25 equipamentos: 28 itens sobem e 25 descem no preset Produção/MRP)
