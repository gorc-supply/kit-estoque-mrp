// Geração dos dados sintéticos de demonstração (seção 12). Semente fixa: resultado reprodutível.
// Empresa fictícia "Metalúrgica Exemplo Ltda". Nenhum dado real.

export interface MaterialDemo {
  codigo: string
  descricao: string
  unidade: string
  estoque_atual: number
  custo_unitario: number | null
  lead_time_dias: number
  desvio_lead_time_dias: number | null
  lote_minimo: number | null
  multiplo_compra: number | null
  estoque_seguranca_manual: number | null
  fornecedor: string
  categoria: string
  tipo_item: 'Comprado' | 'Fabricado'
  data_cadastro: Date | null
  // ABC multicritério (seção 16-B), todos opcionais
  criticidade: string | null
  num_fornecedores: number | null
  possui_substituto: 'Sim' | 'Não' | null
  custo_parada_hora: number | null
  classe_manual: 'A' | 'B' | 'C' | null
  justificativa_classe: string | null
  crit_seguranca: number | null
}

export interface EquipamentoDemo {
  equipamento: string
  criticidade: 'Alta' | 'Média' | 'Baixa'
  setor: string
}

export interface MovimentoDemo {
  data: Date | string
  codigo: string
  tipo: string
  quantidade: number
  valor_total: number | null
  documento: string
}

export interface PedidoDemo {
  codigo: string
  data_prevista: Date
  quantidade: number
}

export interface DadosDemo {
  materiais: MaterialDemo[]
  movimentacoes: MovimentoDemo[]
  pedidos: PedidoDemo[]
  bom: { codigo_pai: string; codigo_filho: string; quantidade_por: number; perda_pct: number }[]
  mps: { codigo: string; semana_inicio: Date; quantidade: number }[]
  equipamentos: EquipamentoDemo[]
  ondeUsado: { codigo: string; equipamento: string }[]
}

/** Campos do multicritério vazios (itens sem esses dados). */
const SEM_MC = {
  criticidade: null,
  num_fornecedores: null,
  possui_substituto: null,
  custo_parada_hora: null,
  classe_manual: null,
  justificativa_classe: null,
  crit_seguranca: null,
} as const

// ---------------------------------------------------------------------------
// Aleatoriedade determinística

export function criarRng(semente: number) {
  let a = semente >>> 0
  const u = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const normal = () => {
    const u1 = Math.max(u(), 1e-12)
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u())
  }
  return {
    u,
    normal,
    entre: (a0: number, b0: number) => a0 + (b0 - a0) * u(),
    inteiro: (a0: number, b0: number) => Math.floor(a0 + (b0 - a0 + 1) * u()),
    logUniforme: (a0: number, b0: number) =>
      Math.exp(Math.log(a0) + (Math.log(b0) - Math.log(a0)) * u()),
    escolher: <T>(lista: readonly T[]): T => lista[Math.floor(u() * lista.length)],
    embaralhar: <T>(lista: T[]): T[] => {
      for (let i = lista.length - 1; i > 0; i--) {
        const j = Math.floor(u() * (i + 1))
        ;[lista[i], lista[j]] = [lista[j], lista[i]]
      }
      return lista
    },
  }
}
type Rng = ReturnType<typeof criarRng>

const DIA = 86_400_000
const utc = (a: number, m: number, d: number) => new Date(Date.UTC(a, m - 1, d))
const somarDias = (d: Date, n: number) => new Date(d.getTime() + n * DIA)
const r2 = (x: number) => Math.round(x * 100) / 100
/** Devoluções no último dia não podem passar da data-base (31/10/2026). */
const ateDataBase = (d: Date) => (d > DATA_BASE_DEMO ? DATA_BASE_DEMO : d)

const FRACIONAVEIS = new Set(['KG', 'L', 'M', 'M2'])

// ---------------------------------------------------------------------------
// Catálogo

interface Base {
  desc: string
  un: string
  custo: [number, number]
  variantes?: string[]
}

const CATALOGO: Record<
  string,
  { prefixo: string; lt: [number, number]; fornecedores: string[]; itens: Base[] }
> = {
  MRO: {
    prefixo: 'MRO',
    lt: [7, 30],
    fornecedores: [
      'Alfa Rolamentos e Transmissão',
      'Kappa Materiais Elétricos',
      'Lambda Ferramentas Industriais',
    ],
    itens: [
      {
        desc: 'Rolamento rígido de esferas',
        un: 'UN',
        custo: [18, 90],
        variantes: [
          '6201 2RS',
          '6202 2RS',
          '6203 2RS',
          '6204 2RS',
          '6205 2RS',
          '6206 ZZ',
          '6207 ZZ',
          '6305 ZZ',
        ],
      },
      {
        desc: 'Correia em V',
        un: 'UN',
        custo: [25, 70],
        variantes: ['A-38', 'A-42', 'A-55', 'B-50', 'B-60'],
      },
      { desc: 'Retentor NBR', un: 'UN', custo: [6, 25], variantes: ['40x62x8', '35x52x7'] },
      { desc: 'Graxa de lítio EP2', un: 'KG', custo: [28, 45] },
      { desc: 'Óleo hidráulico ISO 68', un: 'L', custo: [14, 22] },
      {
        desc: 'Disco de corte para aço',
        un: 'UN',
        custo: [4, 14],
        variantes: ['4.1/2"', '7"', '9"'],
      },
      {
        desc: 'Broca HSS',
        un: 'UN',
        custo: [6, 40],
        variantes: ['4 mm', '6 mm', '8 mm', '10 mm', '12 mm'],
      },
      { desc: 'Contator tripolar 25 A 220 V', un: 'UN', custo: [150, 260] },
      { desc: 'Relé térmico 18–25 A', un: 'UN', custo: [120, 210] },
      { desc: 'Lâmpada LED tubular 18 W', un: 'UN', custo: [9, 18] },
      { desc: 'Mangueira hidráulica 1/2"', un: 'M', custo: [22, 40] },
      { desc: 'Eletrodo revestido E6013 3,25 mm', un: 'KG', custo: [24, 36] },
      { desc: 'Abraçadeira de nylon 200 mm', un: 'PCT', custo: [12, 22] },
      { desc: 'Fusível NH 100 A', un: 'UN', custo: [18, 35] },
      { desc: 'Fita isolante 19 mm x 20 m', un: 'UN', custo: [5, 12] },
      { desc: 'Lixa para ferro grão', un: 'UN', custo: [1.5, 4], variantes: ['80', '120', '220'] },
      { desc: 'Bico de contato MIG 1,0 mm', un: 'UN', custo: [2, 5] },
      { desc: 'Cabo PP 3x2,5 mm²', un: 'M', custo: [6, 11] },
      { desc: 'Filtro de ar para compressor', un: 'UN', custo: [80, 190] },
      { desc: 'Inversor de frequência 2 cv', un: 'UN', custo: [2100, 2700] },
      { desc: 'CLP compacto 16 E/S', un: 'UN', custo: [6800, 7900] },
    ],
  },
  Embalagens: {
    prefixo: 'EMB',
    lt: [7, 21],
    fornecedores: ['Beta Embalagens', 'Teta Papéis e Filmes'],
    itens: [
      {
        desc: 'Caixa de papelão ondulado',
        un: 'UN',
        custo: [1.2, 7],
        variantes: ['20x15x10', '30x20x15', '40x30x20', '50x40x30', '60x40x40'],
      },
      { desc: 'Filme stretch 500 mm', un: 'KG', custo: [11, 17] },
      { desc: 'Fita adesiva 48 mm x 100 m', un: 'UN', custo: [4, 8] },
      { desc: 'Palete de madeira PBR', un: 'UN', custo: [45, 75] },
      { desc: 'Saco plástico 30x40', un: 'PCT', custo: [9, 16] },
      { desc: 'Etiqueta térmica 100x150', un: 'PCT', custo: [18, 32] },
      { desc: 'Cantoneira de papelão 50 mm', un: 'UN', custo: [0.5, 1.2] },
      { desc: 'Fita de arquear PP 12 mm', un: 'KG', custo: [9, 14] },
      { desc: 'Envelope plástico de segurança', un: 'PCT', custo: [25, 45] },
      { desc: 'Saco de ráfia 60x90', un: 'UN', custo: [1, 2.5] },
      { desc: 'Etiqueta adesiva 50x30', un: 'PCT', custo: [12, 24] },
      { desc: 'Plástico bolha 1,30 m', un: 'M', custo: [1.5, 3] },
    ],
  },
  'Matéria-prima': {
    prefixo: 'MP',
    lt: [20, 60],
    fornecedores: ['Gama Aços Planos', 'Épsilon Tubos e Perfis'],
    itens: [
      {
        desc: 'Chapa de aço SAE 1020',
        un: 'KG',
        custo: [7, 11],
        variantes: ['1,5 mm', '2 mm', '3 mm', '4,75 mm', '6 mm'],
      },
      {
        desc: 'Barra redonda SAE 1045',
        un: 'M',
        custo: [28, 90],
        variantes: ['3/4"', '1"', '1.1/2"'],
      },
      { desc: 'Tubo industrial parede 2 mm', un: 'M', custo: [22, 55], variantes: ['1"', '2"'] },
      { desc: 'Bobina de aço galvanizado 0,9 mm', un: 'KG', custo: [8, 12] },
      { desc: 'Perfil U 4"', un: 'M', custo: [48, 70] },
      { desc: 'Cantoneira 1.1/2" x 3/16"', un: 'M', custo: [25, 38] },
      { desc: 'Chapa de alumínio 2 mm', un: 'M2', custo: [160, 240] },
      {
        desc: 'Arame MIG ER70S-6',
        un: 'KG',
        custo: [16, 24],
        variantes: ['0,8 mm', '1,0 mm', '1,2 mm'],
      },
      { desc: 'Barra chata 2" x 1/4"', un: 'M', custo: [30, 45] },
      { desc: 'Tubo quadrado 30x30 parede 1,5 mm', un: 'M', custo: [18, 30] },
      { desc: 'Tinta em pó epóxi', un: 'KG', custo: [38, 60], variantes: ['cinza', 'preta'] },
    ],
  },
  Componentes: {
    prefixo: 'CMP',
    lt: [10, 45],
    fornecedores: ['Delta Fixadores', 'Zeta Componentes Mecânicos', 'Kappa Materiais Elétricos'],
    itens: [
      {
        desc: 'Parafuso sextavado zincado',
        un: 'UN',
        custo: [0.15, 1.4],
        variantes: ['M5x16', 'M6x20', 'M8x30', 'M8x50', 'M10x40', 'M10x60', 'M12x50'],
      },
      {
        desc: 'Porca sextavada zincada',
        un: 'UN',
        custo: [0.05, 0.5],
        variantes: ['M5', 'M6', 'M8', 'M10', 'M12'],
      },
      {
        desc: 'Arruela lisa zincada',
        un: 'UN',
        custo: [0.03, 0.2],
        variantes: ['M6', 'M8', 'M10', 'M12'],
      },
      { desc: 'Parafuso Allen cabeça cilíndrica M6x20', un: 'UN', custo: [0.3, 0.8] },
      { desc: 'Rebite pop 4,8x12', un: 'CX', custo: [28, 45] },
      { desc: 'Rodízio giratório 4" com freio', un: 'UN', custo: [28, 48] },
      { desc: 'Rodízio fixo 4"', un: 'UN', custo: [18, 30] },
      { desc: 'Mola de compressão 20 mm', un: 'UN', custo: [1.5, 4] },
      { desc: 'Pino elástico 6x40', un: 'UN', custo: [0.2, 0.6] },
      { desc: 'Bucha de nylon 10 mm', un: 'UN', custo: [0.1, 0.35] },
      { desc: 'Dobradiça de aço 3"', un: 'PAR', custo: [6, 12] },
      { desc: 'Puxador alça 128 mm', un: 'UN', custo: [5, 11] },
      { desc: 'Pé nivelador M10', un: 'UN', custo: [3, 7] },
      { desc: 'Motor elétrico trifásico 1 cv', un: 'UN', custo: [1500, 1950] },
      { desc: 'Redutor de velocidade 1:30', un: 'UN', custo: [3100, 3800] },
      { desc: 'Engate rápido pneumático 8 mm', un: 'UN', custo: [6, 14] },
      { desc: 'Válvula solenoide 5/2 vias 1/4"', un: 'UN', custo: [160, 280] },
      { desc: 'Mangueira PU 8 mm', un: 'M', custo: [3, 6] },
      { desc: 'Sensor indutivo M18', un: 'UN', custo: [70, 140] },
      { desc: 'Chave fim de curso roletada', un: 'UN', custo: [45, 90] },
      { desc: 'Cilindro pneumático 50x100', un: 'UN', custo: [380, 560] },
    ],
  },
  EPI: {
    prefixo: 'EPI',
    lt: [5, 20],
    fornecedores: ['Ômega Equipamentos de Proteção'],
    itens: [
      {
        desc: 'Luva nitrílica',
        un: 'PAR',
        custo: [3, 6],
        variantes: ['tam. P', 'tam. M', 'tam. G'],
      },
      { desc: 'Luva de vaqueta', un: 'PAR', custo: [9, 16] },
      { desc: 'Óculos de proteção incolor', un: 'UN', custo: [5, 12] },
      { desc: 'Protetor auricular tipo plug', un: 'PAR', custo: [1, 3] },
      { desc: 'Respirador PFF2', un: 'UN', custo: [2.5, 6] },
      { desc: 'Capacete de segurança classe B', un: 'UN', custo: [18, 35] },
      {
        desc: 'Botina de segurança',
        un: 'PAR',
        custo: [70, 140],
        variantes: ['nº 39', 'nº 41', 'nº 42', 'nº 43'],
      },
      { desc: 'Protetor facial incolor', un: 'UN', custo: [25, 45] },
      { desc: 'Calça de brim', un: 'UN', custo: [45, 75], variantes: ['P', 'M', 'G', 'GG'] },
      { desc: 'Cinto de segurança tipo paraquedista', un: 'UN', custo: [180, 320] },
      { desc: 'Máscara de solda automática', un: 'UN', custo: [150, 290] },
      { desc: 'Avental de raspa', un: 'UN', custo: [30, 55] },
      { desc: 'Creme de proteção para as mãos', un: 'UN', custo: [14, 25] },
    ],
  },
  Químicos: {
    prefixo: 'QUI',
    lt: [10, 30],
    fornecedores: ['Sigma Produtos Químicos'],
    itens: [
      { desc: 'Desengraxante alcalino', un: 'L', custo: [12, 22] },
      { desc: 'Thinner para limpeza', un: 'L', custo: [14, 24] },
      { desc: 'Fluido de corte solúvel', un: 'L', custo: [22, 40] },
      { desc: 'Desmoldante', un: 'L', custo: [30, 55] },
      { desc: 'Primer anticorrosivo', un: 'L', custo: [35, 60] },
      { desc: 'Removedor de ferrugem', un: 'L', custo: [25, 45] },
      { desc: 'Adesivo epóxi bicomponente', un: 'KG', custo: [90, 170] },
      { desc: 'Álcool isopropílico', un: 'L', custo: [20, 35] },
      { desc: 'Óleo desengripante spray 300 ml', un: 'UN', custo: [14, 26] },
      { desc: 'Silicone em spray 300 ml', un: 'UN', custo: [16, 28] },
      { desc: 'Detergente neutro industrial', un: 'L', custo: [6, 12] },
      { desc: 'Graxa branca grau alimentício', un: 'KG', custo: [60, 110] },
      { desc: 'Sabonete industrial', un: 'L', custo: [8, 15] },
    ],
  },
}

type Padrao = 'suave' | 'erratico' | 'intermitente' | 'irregular' | 'parado'

interface Especificacao {
  m: MaterialDemo
  padrao: Padrao
  mediaMensal: number
  custoReal: number
  mesInicio: number
  ruptura: boolean
  excesso: boolean
  semValor: boolean
}

// ---------------------------------------------------------------------------

/** 18 meses: mai/2025 a out/2026. Data-base = 31/10/2026. */
export const INICIO_DEMO = utc(2025, 5, 1)
export const DATA_BASE_DEMO = utc(2026, 10, 31)
const MESES = 18

function inicioMes(k: number): Date {
  return utc(2025 + Math.floor((4 + k) / 12), ((4 + k) % 12) + 1, 1)
}
function diasNoMes(k: number): number {
  const a = inicioMes(k)
  const b = inicioMes(k + 1)
  return Math.round((b.getTime() - a.getTime()) / DIA)
}

function multiploPara(
  un: string,
  custo: number,
  rng: Rng,
): { lote: number | null; mult: number | null } {
  if (FRACIONAVEIS.has(un)) {
    if (un === 'KG') return { lote: null, mult: rng.escolher([1, 5, 25]) }
    if (un === 'L') return { lote: null, mult: rng.escolher([1, 5, 20]) }
    return { lote: null, mult: 1 }
  }
  if (custo < 1) return { lote: rng.escolher([500, 1000]), mult: rng.escolher([100, 500]) }
  if (custo < 10)
    return { lote: rng.escolher([null, 50, 100]), mult: rng.escolher([10, 12, 25, 50]) }
  if (custo < 100) return { lote: null, mult: rng.escolher([1, 5, 10]) }
  return { lote: null, mult: 1 }
}

function montarCatalogo(rng: Rng): Especificacao[] {
  const specs: Especificacao[] = []
  for (const [categoria, cat] of Object.entries(CATALOGO)) {
    let seq = 1
    for (const base of cat.itens) {
      for (const v of base.variantes ?? ['']) {
        const custo = r2(rng.logUniforme(base.custo[0], base.custo[1]))
        const { lote, mult } = multiploPara(base.un, custo, rng)
        const lt = rng.inteiro(cat.lt[0], cat.lt[1])
        // Demanda mensal decresce com o custo (gera uma curva ABC realista).
        const fator = FRACIONAVEIS.has(base.un) ? 6 : 1
        const mediaMensal = Math.max(
          2,
          Math.round((rng.logUniforme(150, 2500) * fator) / Math.pow(custo, 0.75)),
        )
        specs.push({
          m: {
            codigo: `${cat.prefixo}-${String(seq++).padStart(3, '0')}`,
            descricao: v ? `${base.desc} ${v}` : base.desc,
            unidade: base.un,
            estoque_atual: 0,
            custo_unitario: custo,
            lead_time_dias: lt,
            desvio_lead_time_dias:
              rng.u() < 0.2 ? Math.max(1, Math.round(lt * rng.entre(0.15, 0.35))) : null,
            lote_minimo: lote,
            multiplo_compra: mult,
            estoque_seguranca_manual: null,
            fornecedor: rng.escolher(cat.fornecedores),
            categoria,
            tipo_item: 'Comprado',
            data_cadastro: null,
            ...SEM_MC,
          },
          padrao: 'suave',
          mediaMensal,
          custoReal: custo,
          mesInicio: 0,
          ruptura: false,
          excesso: false,
          semValor: false,
        })
      }
    }
  }
  return specs
}

function demandaMensal(s: Especificacao, rng: Rng): number[] {
  const d: number[] = []
  const m = s.mediaMensal
  for (let k = 0; k < MESES; k++) {
    let q = 0
    if (k < s.mesInicio) {
      d.push(0)
      continue
    }
    switch (s.padrao) {
      case 'suave':
        q = m * (1 + 0.22 * rng.normal())
        break
      case 'erratico':
        q = m * Math.exp(0.95 * rng.normal() - 0.45)
        break
      case 'intermitente':
        q = rng.u() < 0.35 ? (m / 0.35) * (1 + 0.25 * rng.normal()) : 0
        break
      case 'irregular':
        q = rng.u() < 0.4 ? (m / 0.4) * Math.exp(1.4 * rng.normal() - 1.0) : 0
        break
      case 'parado':
        q = k < 5 ? m * (1 + 0.3 * rng.normal()) : 0
        break
    }
    d.push(Math.max(0, FRACIONAVEIS.has(s.m.unidade) ? r2(q) : Math.round(q)))
  }
  return d
}

function ajustarMultiplo(q: number, lote: number | null, mult: number | null): number {
  const m = mult && mult > 0 ? mult : 1
  return Math.max(lote ?? 0, Math.ceil(q / m) * m)
}

// ---------------------------------------------------------------------------
// ABC multicritério (seção 16-B): equipamentos, onde usado e colunas novas.

const EQUIPAMENTOS_DEMO: EquipamentoDemo[] = [
  { equipamento: 'Prensa hidráulica PH-01', criticidade: 'Alta', setor: 'Estamparia' },
  { equipamento: 'Prensa excêntrica PE-02', criticidade: 'Alta', setor: 'Estamparia' },
  { equipamento: 'Torno CNC TC-01', criticidade: 'Alta', setor: 'Usinagem' },
  { equipamento: 'Centro de usinagem CU-01', criticidade: 'Alta', setor: 'Usinagem' },
  { equipamento: 'Robô de solda RS-01', criticidade: 'Alta', setor: 'Solda' },
  { equipamento: 'Compressor de ar CA-01', criticidade: 'Alta', setor: 'Utilidades' },
  { equipamento: 'Cabine de pintura CP-01', criticidade: 'Alta', setor: 'Pintura' },
  { equipamento: 'Estufa de cura EC-01', criticidade: 'Alta', setor: 'Pintura' },
  { equipamento: 'Torno CNC TC-02', criticidade: 'Média', setor: 'Usinagem' },
  { equipamento: 'Fresadora FR-01', criticidade: 'Média', setor: 'Usinagem' },
  { equipamento: 'Máquina de solda MIG MS-02', criticidade: 'Média', setor: 'Solda' },
  { equipamento: 'Máquina de solda MIG MS-03', criticidade: 'Média', setor: 'Solda' },
  { equipamento: 'Guilhotina GU-01', criticidade: 'Média', setor: 'Estamparia' },
  { equipamento: 'Dobradeira DB-01', criticidade: 'Média', setor: 'Estamparia' },
  { equipamento: 'Ponte rolante PR-01', criticidade: 'Média', setor: 'Expedição' },
  { equipamento: 'Compressor de ar CA-02', criticidade: 'Média', setor: 'Utilidades' },
  { equipamento: 'Transportador de correia TR-01', criticidade: 'Média', setor: 'Expedição' },
  { equipamento: 'Empilhadeira EM-02', criticidade: 'Baixa', setor: 'Expedição' },
  { equipamento: 'Esmerilhadeira de bancada EB-01', criticidade: 'Baixa', setor: 'Manutenção' },
  { equipamento: 'Furadeira de coluna FC-01', criticidade: 'Baixa', setor: 'Manutenção' },
  { equipamento: 'Serra fita SF-01', criticidade: 'Baixa', setor: 'Usinagem' },
  { equipamento: 'Lavadora de peças LP-01', criticidade: 'Baixa', setor: 'Manutenção' },
  { equipamento: 'Seladora de caixas SC-01', criticidade: 'Baixa', setor: 'Expedição' },
  { equipamento: 'Bomba de recalque BR-01', criticidade: 'Baixa', setor: 'Utilidades' },
  { equipamento: 'Ventilador industrial VI-01', criticidade: 'Baixa', setor: 'Utilidades' },
]

/**
 * Preenche as colunas do multicritério e monta Equipamentos/OndeUsado. Montado de propósito
 * para o preset Produção/MRP mexer nas classes: ~10 itens de valor intermediário, lead time
 * longo, fonte única, sem substituto e em máquina crítica sobem; ~8 itens caros, de entrega
 * rápida, com vários fornecedores, substituto e só em máquinas secundárias descem.
 * Roda ANTES da simulação de movimentos (o lead time novo entra na reposição simulada).
 * Usa um gerador próprio para não embaralhar o restante da demo.
 */
function aplicarMulticriterio(
  specs: Especificacao[],
  excluidos: ReadonlySet<number>,
  semente: number,
): Pick<DadosDemo, 'equipamentos' | 'ondeUsado'> {
  const rng = criarRng(semente)
  const porCrit = (c: EquipamentoDemo['criticidade']) =>
    EQUIPAMENTOS_DEMO.filter((e) => e.criticidade === c).map((e) => e.equipamento)
  const alta = porCrit('Alta')
  const media = porCrit('Média')
  const baixa = porCrit('Baixa')
  const critDe = new Map(EQUIPAMENTOS_DEMO.map((e) => [e.equipamento, e.criticidade]))

  const elegivel = (i: number) => {
    const s = specs[i]
    return (
      !excluidos.has(i) &&
      !s.ruptura &&
      !s.excesso &&
      !s.semValor &&
      s.mesInicio === 0 &&
      s.padrao !== 'parado' &&
      s.m.custo_unitario !== null &&
      Number.isFinite(s.m.lead_time_dias)
    )
  }
  // Classe manual: item de segurança de máquina (NR-12).
  const manual = specs.findIndex((s) => s.m.descricao.startsWith('Chave fim de curso'))

  // Ranking pelo valor anual esperado (demanda média × custo × 12).
  const valor = (i: number) => specs[i].mediaMensal * specs[i].custoReal * 12
  const ranking = specs.map((_, i) => i).sort((a, b) => valor(b) - valor(a))
  const n = specs.length
  const descem = ranking.filter((i) => elegivel(i) && i !== manual).slice(0, 8)
  // Sobem: peças de máquina em que prazo longo e fonte única são plausíveis (importadas,
  // específicas do equipamento), com valor no meio do ranking.
  const pecaDeMaquina =
    /^(Rolamento|Retentor|Correia|Contator|Relé|Filtro|Mangueira hidráulica|Sensor|Válvula|Cilindro|Motor|Redutor|Inversor|CLP|Engate|Mola)/
  const candidatosSobe = ranking.filter(
    (i, pos) =>
      pos >= 0.25 * n &&
      pos < 0.8 * n &&
      elegivel(i) &&
      i !== manual &&
      pecaDeMaquina.test(specs[i].m.descricao),
  )
  const sobem: number[] = []
  for (let k = 0; k < 10 && candidatosSobe.length; k++)
    sobem.push(candidatosSobe[Math.floor((k * candidatosSobe.length) / 10)])
  const setSobe = new Set(sobem)
  const setDesce = new Set(descem)

  const ondeUsado: DadosDemo['ondeUsado'] = []
  const vincular = (i: number, lista: string[]) => {
    for (const e of new Set(lista)) ondeUsado.push({ codigo: specs[i].m.codigo, equipamento: e })
  }
  const ajustarLT = (s: Especificacao, lt: number) => {
    s.m.lead_time_dias = lt
    if (s.m.desvio_lead_time_dias !== null)
      s.m.desvio_lead_time_dias = Math.max(1, Math.round(lt * 0.2))
  }

  const commodity =
    /^(Parafuso|Porca|Arruela|Pino|Bucha|Rebite|Lixa|Disco|Broca|Abraçadeira|Fita isolante|Lâmpada|Pé nivelador|Cabo PP|Bico de contato)/
  const semCriticidade: number[] = []
  specs.forEach((s, i) => {
    const m = s.m
    const cat = m.categoria
    m.num_fornecedores = rng.inteiro(1, 4)
    const sub = rng.u()
    m.possui_substituto = sub < 0.12 ? null : sub < 0.56 ? 'Sim' : 'Não'

    let links: string[] = []
    if (setSobe.has(i)) {
      ajustarLT(s, rng.inteiro(60, 90))
      m.num_fornecedores = 1
      m.possui_substituto = 'Não'
      links = [rng.escolher(alta)]
      if (rng.u() < 0.5) links.push(rng.escolher(media))
    } else if (setDesce.has(i)) {
      ajustarLT(s, rng.inteiro(5, 10))
      m.num_fornecedores = rng.inteiro(3, 4)
      m.possui_substituto = 'Sim'
      links = [rng.escolher(baixa)]
      if (rng.u() < 0.5) links.push(rng.escolher(baixa))
    } else if (commodity.test(m.descricao)) {
      // Itens de prateleira: vários fornecedores, com substituto, sem máquina crítica.
      m.num_fornecedores = rng.inteiro(3, 4)
      m.possui_substituto = 'Sim'
      links = [rng.escolher(rng.u() < 0.4 ? media : baixa)]
    } else if (cat === 'MRO' || cat === 'Componentes') {
      // Itens comuns: a maioria serve a máquinas de criticidade Média ou Baixa.
      const qtd = rng.u() < 0.6 ? 1 : rng.u() < 0.75 ? 2 : 3
      for (let k = 0; k < qtd; k++) {
        const x = rng.u()
        links.push(rng.escolher(x < 0.2 ? alta : x < 0.6 ? media : baixa))
      }
    } else if (cat === 'Químicos' && rng.u() < 0.4) {
      links = [rng.escolher(rng.u() < 0.5 ? media : baixa)]
    }
    vincular(i, links)

    if (links.length) {
      // Custo de parada só para itens que atendem máquina Alta ou Média.
      const crits = links.map((e) => critDe.get(e))
      if (crits.includes('Alta'))
        m.custo_parada_hora = Math.round(rng.logUniforme(1500, 5000) / 10) * 10
      else if (crits.includes('Média'))
        m.custo_parada_hora = Math.round(rng.logUniforme(200, 1500) / 10) * 10
    } else if (cat === 'EPI') m.criticidade = rng.u() < 0.3 ? 'Alta' : 'Média'
    else if (cat === 'Matéria-prima') m.criticidade = 'Média'
    else if (cat === 'Embalagens' || cat === 'Químicos') {
      m.criticidade = cat === 'Químicos' && rng.u() < 0.5 ? 'Média' : 'Baixa'
      if (i !== manual) semCriticidade.push(i)
    }

    if (cat === 'EPI') m.crit_seguranca = rng.inteiro(3, 5)
    else if (cat === 'Químicos') m.crit_seguranca = rng.inteiro(1, 5)
  })

  // ~5 itens sem criticidade em lugar nenhum: demonstram o aviso de valor neutro (0,5).
  for (const i of rng.embaralhar(semCriticidade).slice(0, 5)) specs[i].m.criticidade = null

  if (manual >= 0) {
    specs[manual].m.classe_manual = 'A'
    specs[manual].m.justificativa_classe = 'Item exigido pela NR-12 para liberar a linha'
  }

  return {
    equipamentos: EQUIPAMENTOS_DEMO.map((e) => ({ ...e })),
    ondeUsado,
  }
}

export function gerarDemoIndustria(semente = 20261031): DadosDemo {
  const rng = criarRng(semente)
  const specs = montarCatalogo(rng)

  // Mistura de padrões: ~40% suaves, ~20% erráticos, ~25% intermitentes, ~10% irregulares, ~5% parados.
  const ordem = rng.embaralhar(specs.map((_, i) => i))
  const n = specs.length
  const cortes: [number, Padrao][] = [
    [0.4, 'suave'],
    [0.6, 'erratico'],
    [0.85, 'intermitente'],
    [0.95, 'irregular'],
    [1.01, 'parado'],
  ]
  ordem.forEach((idx, pos) => {
    const f = pos / n
    specs[idx].padrao = cortes.find(([c]) => f < c)![1]
  })
  const suaves = ordem.filter((i) => specs[i].padrao === 'suave')
  // Itens novos (data_cadastro recente): dois com 4 meses de histórico, dois com 2.
  suaves.slice(0, 4).forEach((i, k) => {
    specs[i].mesInicio = k < 2 ? 14 : 16
    specs[i].m.data_cadastro = inicioMes(specs[i].mesInicio)
  })
  // Itens em ruptura e em excesso de propósito.
  suaves.slice(4, 8).forEach((i) => (specs[i].ruptura = true))
  ordem
    .filter((i) => specs[i].padrao === 'erratico')
    .slice(0, 2)
    .forEach((i) => (specs[i].ruptura = true))
  suaves.slice(8, 13).forEach((i) => (specs[i].excesso = true))
  ordem
    .filter((i) => specs[i].padrao === 'intermitente')
    .slice(0, 2)
    .forEach((i) => (specs[i].excesso = true))
  // Custo ausente no cadastro: calculado pelas entradas; um item sem nenhum custo.
  ordem.slice(20, 34).forEach((i) => (specs[i].m.custo_unitario = null))
  const semCusto = ordem.find(
    (i) => specs[i].padrao === 'suave' && specs[i].m.custo_unitario === null,
  )!
  specs[semCusto].semValor = true
  // Dois itens com ES manual e um sem lead time.
  specs[ordem[40]].m.estoque_seguranca_manual = Math.round(specs[ordem[40]].mediaMensal * 0.8)
  specs[ordem[41]].m.estoque_seguranca_manual = Math.round(specs[ordem[41]].mediaMensal * 0.5)
  specs[ordem[42]].m.lead_time_dias = Number.NaN
  // Multicritério: antes da simulação, porque muda o lead time de alguns itens.
  const mc = aplicarMulticriterio(
    specs,
    new Set([...ordem.slice(20, 34), ordem[40], ordem[41], ordem[42]]),
    semente + 16,
  )

  const movimentacoes: MovimentoDemo[] = []
  const pedidos: PedidoDemo[] = []
  const totalDias = Math.round((DATA_BASE_DEMO.getTime() - INICIO_DEMO.getTime()) / DIA) + 1
  let numReq = 1
  let numNF = 1

  for (const s of specs) {
    const fracionavel = FRACIONAVEIS.has(s.m.unidade)
    const arred = (x: number) => (fracionavel ? r2(x) : Math.round(x))
    const custoReal = s.custoReal
    const lt = Number.isFinite(s.m.lead_time_dias) ? s.m.lead_time_dias : 30
    const demanda = demandaMensal(s, rng)

    // Requisições diárias: cada mês dividido em 1 a 5 saídas.
    const reqPorDia = new Map<number, number>()
    for (let k = 0; k < MESES; k++) {
      if (demanda[k] <= 0) continue
      const partes = Math.min(
        5,
        Math.max(1, Math.round(demanda[k] / Math.max(1, s.mediaMensal / 4))),
      )
      let resto = demanda[k]
      const offset = Math.round((inicioMes(k).getTime() - INICIO_DEMO.getTime()) / DIA)
      for (let p = 0; p < partes; p++) {
        const q = p === partes - 1 ? resto : arred((demanda[k] / partes) * rng.entre(0.6, 1.4))
        const qq = Math.min(resto, Math.max(0, q))
        if (qq <= 0) continue
        resto = arred(resto - qq)
        const dia = offset + rng.inteiro(0, diasNoMes(k) - 1)
        reqPorDia.set(dia, arred((reqPorDia.get(dia) ?? 0) + qq))
      }
    }

    const mDia = s.mediaMensal / 30
    const rop = mDia * lt + 0.6 * s.mediaMensal
    const lote = ajustarMultiplo(
      s.mediaMensal * rng.entre(0.6, 1.4),
      s.m.lote_minimo,
      s.m.multiplo_compra,
    )
    let estoque = s.mesInicio > 0 ? 0 : arred(rop + lote * rng.entre(0.3, 0.8))
    if (s.padrao === 'parado') estoque = arred(estoque + s.mediaMensal * 3)
    const chegadas = new Map<number, number>()
    let emPedido = 0
    const fimPedidos = s.ruptura ? totalDias - lt - 100 : Infinity

    for (let dia = 0; dia < totalDias; dia++) {
      const data = somarDias(INICIO_DEMO, dia)
      const chega = chegadas.get(dia)
      if (chega) {
        estoque = arred(estoque + chega)
        emPedido = arred(emPedido - chega)
        const valor = s.semValor ? null : r2(chega * custoReal * rng.entre(0.97, 1.03))
        movimentacoes.push({
          data,
          codigo: s.m.codigo,
          tipo: 'Entrada',
          quantidade: chega,
          valor_total: valor,
          documento: `NF-${String(numNF++).padStart(6, '0')}`,
        })
        // Algumas devoluções ao fornecedor (material fora de especificação).
        if (rng.u() < 0.03 && chega > 1) {
          const dev = fracionavel ? r2(chega * 0.1) : Math.max(1, Math.round(chega * 0.1))
          estoque = arred(estoque - dev)
          movimentacoes.push({
            data: ateDataBase(somarDias(data, 2)),
            codigo: s.m.codigo,
            tipo: 'Devolução ao fornecedor',
            quantidade: dev,
            valor_total: valor === null ? null : r2(dev * custoReal),
            documento: `DEV-${numNF}`,
          })
        }
      }
      // Excesso proposital: compra grande ~2 meses antes da data-base.
      if (s.excesso && dia === totalDias - 60) {
        const q = ajustarMultiplo(lote * 3, s.m.lote_minimo, s.m.multiplo_compra)
        estoque = arred(estoque + q)
        movimentacoes.push({
          data,
          codigo: s.m.codigo,
          tipo: 'Entrada',
          quantidade: q,
          valor_total: s.semValor ? null : r2(q * custoReal),
          documento: `NF-${String(numNF++).padStart(6, '0')}`,
        })
      }
      const pedido = reqPorDia.get(dia)
      if (pedido && pedido > estoque && !s.ruptura) {
        // Compra emergencial: preserva a demanda real (sem truncar picos pelo estoque).
        const q = ajustarMultiplo(pedido - estoque + lote, s.m.lote_minimo, s.m.multiplo_compra)
        estoque = arred(estoque + q)
        movimentacoes.push({
          data,
          codigo: s.m.codigo,
          tipo: 'Entrada',
          quantidade: q,
          valor_total: s.semValor ? null : r2(q * custoReal * 1.08),
          documento: `NF-${String(numNF++).padStart(6, '0')}`,
        })
      }
      if (pedido) {
        const q = arred(Math.min(pedido, estoque))
        if (q > 0) {
          estoque = arred(estoque - q)
          movimentacoes.push({
            data,
            codigo: s.m.codigo,
            tipo: 'Saída',
            quantidade: q,
            valor_total: null,
            documento: `REQ-${String(numReq++).padStart(6, '0')}`,
          })
          if (rng.u() < 0.02) {
            const dv = fracionavel ? r2(q * 0.2) : Math.max(1, Math.round(q * 0.2))
            if (dv < q) {
              estoque = arred(estoque + dv)
              movimentacoes.push({
                data: ateDataBase(somarDias(data, 1)),
                codigo: s.m.codigo,
                tipo: 'Devolução ao estoque',
                quantidade: dv,
                valor_total: null,
                documento: `DEVREQ-${numReq}`,
              })
            }
          }
        }
      }
      if (rng.u() < 0.002 && estoque > 5) {
        const aj = fracionavel ? r2(rng.entre(0.5, 3)) : rng.inteiro(1, 3)
        const mais = rng.u() < 0.5
        estoque = arred(estoque + (mais ? aj : -aj))
        movimentacoes.push({
          data,
          codigo: s.m.codigo,
          tipo: mais ? 'Ajuste +' : 'Ajuste -',
          quantidade: aj,
          valor_total: null,
          documento: 'INVENTÁRIO',
        })
      }
      // Reposição (ponto de pedido simulado).
      const ativo = s.padrao !== 'parado' || dia < 140
      if (
        ativo &&
        dia >= (s.mesInicio > 0 ? s.mesInicio * 30 - lt : 0) &&
        dia < fimPedidos &&
        estoque + emPedido <= rop
      ) {
        const desvio = s.m.desvio_lead_time_dias ?? Math.max(1, lt * 0.08)
        const chegada = dia + Math.max(1, Math.round(lt + desvio * rng.normal()))
        chegadas.set(chegada, arred((chegadas.get(chegada) ?? 0) + lote))
        emPedido = arred(emPedido + lote)
      }
    }
    // Pedidos que ainda não chegaram viram pedidos em aberto.
    for (const [dia, q] of chegadas) {
      if (dia >= totalDias)
        pedidos.push({
          codigo: s.m.codigo,
          data_prevista: somarDias(INICIO_DEMO, dia),
          quantidade: q,
        })
    }
    s.m.estoque_atual = arred(Math.max(0, estoque))
  }

  // Ordena por data e injeta ~0,5% de linhas com problema para demonstrar a validação.
  movimentacoes.sort((a, b) => (a.data as Date).getTime() - (b.data as Date).getTime())
  const problemas: MovimentoDemo[] = []
  for (let i = 0; i < 15; i++)
    problemas.push({
      data: somarDias(INICIO_DEMO, rng.inteiro(30, 500)),
      codigo: `XYZ-${900 + i}`,
      tipo: 'Saída',
      quantidade: rng.inteiro(1, 20),
      valor_total: null,
      documento: `REQ-X${i}`,
    })
  for (let i = 0; i < 12; i++)
    problemas.push({
      data: somarDias(INICIO_DEMO, rng.inteiro(30, 500)),
      codigo: rng.escolher(specs).m.codigo,
      tipo: 'Saída',
      quantidade: 0,
      valor_total: null,
      documento: `REQ-Z${i}`,
    })
  for (let i = 0; i < 3; i++)
    problemas.push({
      data: '31/02/2026',
      codigo: rng.escolher(specs).m.codigo,
      tipo: 'Saída',
      quantidade: 2,
      valor_total: null,
      documento: `REQ-D${i}`,
    })
  for (let i = 0; i < 4; i++) {
    const s = rng.escolher(specs.filter((x) => x.padrao === 'suave'))
    problemas.push({
      data: somarDias(INICIO_DEMO, rng.inteiro(300, 520)),
      codigo: s.m.codigo,
      tipo: 'Devolução',
      quantidade: 1,
      valor_total: null,
      documento: `DEV-A${i}`,
    })
  }
  const saidas = movimentacoes.filter((m) => m.tipo === 'Saída')
  for (let i = 0; i < 3; i++) problemas.push({ ...rng.escolher(saidas) })
  for (const p of problemas) movimentacoes.splice(rng.inteiro(0, movimentacoes.length), 0, p)

  return {
    materiais: specs.map((s) => s.m),
    movimentacoes,
    pedidos,
    bom: [],
    mps: [],
    equipamentos: mc.equipamentos,
    ondeUsado: mc.ondeUsado,
  }
}

// ---------------------------------------------------------------------------
// Demo de montagem: BOM de 3 níveis e MPS de 12 semanas.

export function gerarDemoMontagem(semente = 20261101): DadosDemo {
  const rng = criarRng(semente)
  const forn = 'Fornecedor Exemplo Componentes'
  const mat = (
    codigo: string,
    descricao: string,
    unidade: string,
    estoque: number,
    custo: number,
    lt: number,
    tipo: 'Comprado' | 'Fabricado',
    categoria: string,
    mult: number | null = null,
  ): MaterialDemo => ({
    codigo,
    descricao,
    unidade,
    estoque_atual: estoque,
    custo_unitario: custo,
    lead_time_dias: lt,
    desvio_lead_time_dias: null,
    lote_minimo: null,
    multiplo_compra: mult,
    estoque_seguranca_manual: null,
    fornecedor: tipo === 'Fabricado' ? 'Produção interna' : forn,
    categoria,
    tipo_item: tipo,
    data_cadastro: null,
    ...SEM_MC,
  })
  const materiais: MaterialDemo[] = [
    mat('PA-100', 'Carrinho de carga 300 kg', 'UN', 35, 890, 7, 'Fabricado', 'Produto acabado'),
    mat('PA-200', 'Carrinho plataforma 500 kg', 'UN', 12, 1450, 7, 'Fabricado', 'Produto acabado'),
    mat(
      'SM-110',
      'Chassi soldado do carrinho de carga',
      'UN',
      20,
      310,
      7,
      'Fabricado',
      'Submontagem',
    ),
    mat('SM-120', 'Conjunto de rodas 300 kg', 'UN', 25, 160, 7, 'Fabricado', 'Submontagem'),
    mat('SM-210', 'Plataforma soldada 500 kg', 'UN', 8, 540, 14, 'Fabricado', 'Submontagem'),
    mat('SM-220', 'Conjunto de rodas 500 kg', 'UN', 10, 240, 7, 'Fabricado', 'Submontagem'),
    mat('SM-300', 'Alça tubular com manoplas', 'UN', 30, 95, 7, 'Fabricado', 'Submontagem'),
    mat(
      'MP-01',
      'Tubo industrial 1" parede 2 mm',
      'M',
      180,
      31.5,
      21,
      'Comprado',
      'Matéria-prima',
      6,
    ),
    mat('MP-02', 'Chapa de aço SAE 1020 3 mm', 'KG', 900, 8.9, 28, 'Comprado', 'Matéria-prima', 50),
    mat(
      'CP-01',
      'Rodízio giratório 5" com freio',
      'UN',
      120,
      54,
      21,
      'Comprado',
      'Componentes',
      10,
    ),
    mat('CP-02', 'Rodízio fixo 5"', 'UN', 140, 36, 21, 'Comprado', 'Componentes', 10),
    mat('CP-03', 'Parafuso sextavado M10x60', 'UN', 2500, 0.95, 14, 'Comprado', 'Componentes', 100),
    mat('CP-04', 'Porca autotravante M10', 'UN', 2600, 0.42, 14, 'Comprado', 'Componentes', 100),
    mat('CP-05', 'Tinta em pó epóxi azul', 'KG', 140, 46, 14, 'Comprado', 'Matéria-prima', 20),
    mat('CP-06', 'Manopla de borracha 25 mm', 'UN', 160, 4.8, 14, 'Comprado', 'Componentes', 50),
    mat('CP-07', 'Eixo trefilado 20 mm', 'M', 60, 22, 21, 'Comprado', 'Matéria-prima', 3),
    mat(
      'CP-08',
      'Etiqueta de capacidade de carga',
      'UN',
      400,
      1.1,
      7,
      'Comprado',
      'Embalagens',
      100,
    ),
  ]
  const bom: DadosDemo['bom'] = [
    { codigo_pai: 'PA-100', codigo_filho: 'SM-110', quantidade_por: 1, perda_pct: 0 },
    { codigo_pai: 'PA-100', codigo_filho: 'SM-120', quantidade_por: 1, perda_pct: 0 },
    { codigo_pai: 'PA-100', codigo_filho: 'SM-300', quantidade_por: 1, perda_pct: 0 },
    { codigo_pai: 'PA-100', codigo_filho: 'CP-03', quantidade_por: 8, perda_pct: 2 },
    { codigo_pai: 'PA-100', codigo_filho: 'CP-04', quantidade_por: 8, perda_pct: 2 },
    { codigo_pai: 'PA-100', codigo_filho: 'CP-08', quantidade_por: 1, perda_pct: 0 },
    { codigo_pai: 'PA-200', codigo_filho: 'SM-210', quantidade_por: 1, perda_pct: 0 },
    { codigo_pai: 'PA-200', codigo_filho: 'SM-220', quantidade_por: 1, perda_pct: 0 },
    { codigo_pai: 'PA-200', codigo_filho: 'SM-300', quantidade_por: 2, perda_pct: 0 },
    { codigo_pai: 'PA-200', codigo_filho: 'CP-03', quantidade_por: 12, perda_pct: 2 },
    { codigo_pai: 'PA-200', codigo_filho: 'CP-04', quantidade_por: 12, perda_pct: 2 },
    { codigo_pai: 'PA-200', codigo_filho: 'CP-08', quantidade_por: 1, perda_pct: 0 },
    { codigo_pai: 'SM-110', codigo_filho: 'MP-01', quantidade_por: 4.2, perda_pct: 5 },
    { codigo_pai: 'SM-110', codigo_filho: 'MP-02', quantidade_por: 6.5, perda_pct: 8 },
    { codigo_pai: 'SM-110', codigo_filho: 'CP-05', quantidade_por: 0.35, perda_pct: 10 },
    { codigo_pai: 'SM-120', codigo_filho: 'CP-01', quantidade_por: 2, perda_pct: 0 },
    { codigo_pai: 'SM-120', codigo_filho: 'CP-02', quantidade_por: 2, perda_pct: 0 },
    { codigo_pai: 'SM-120', codigo_filho: 'CP-07', quantidade_por: 0.6, perda_pct: 3 },
    { codigo_pai: 'SM-210', codigo_filho: 'MP-01', quantidade_por: 6, perda_pct: 5 },
    { codigo_pai: 'SM-210', codigo_filho: 'MP-02', quantidade_por: 14, perda_pct: 8 },
    { codigo_pai: 'SM-210', codigo_filho: 'CP-05', quantidade_por: 0.6, perda_pct: 10 },
    { codigo_pai: 'SM-220', codigo_filho: 'CP-01', quantidade_por: 2, perda_pct: 0 },
    { codigo_pai: 'SM-220', codigo_filho: 'CP-02', quantidade_por: 2, perda_pct: 0 },
    { codigo_pai: 'SM-220', codigo_filho: 'CP-07', quantidade_por: 0.8, perda_pct: 3 },
    { codigo_pai: 'SM-300', codigo_filho: 'MP-01', quantidade_por: 1.6, perda_pct: 5 },
    { codigo_pai: 'SM-300', codigo_filho: 'CP-06', quantidade_por: 2, perda_pct: 0 },
  ]
  // MPS de 12 semanas a partir da segunda-feira da semana da data-base (26/10/2026).
  const semana1 = utc(2026, 10, 26)
  const mps: DadosDemo['mps'] = []
  for (let k = 0; k < 12; k++) {
    mps.push({
      codigo: 'PA-100',
      semana_inicio: somarDias(semana1, 7 * k),
      quantidade: 20 + 5 * rng.inteiro(0, 4),
    })
    if (k % 2 === 0 || k > 5)
      mps.push({
        codigo: 'PA-200',
        semana_inicio: somarDias(semana1, 7 * k),
        quantidade: 8 + 2 * rng.inteiro(0, 4),
      })
  }
  // Histórico de 26 semanas: produção dos acabados explodida pela BOM.
  // Fabricados: entrada da OP e saída para o nível de cima. Comprados: saída para a produção
  // e reposição a cada 4 semanas.
  const movimentacoes: MovimentoDemo[] = []
  const inicioHist = utc(2026, 5, 4)
  const porCodigo = new Map(materiais.map((m) => [m.codigo, m]))
  const consumoAcumulado = new Map<string, number>()
  let op = 1
  for (let s = 0; s < 26; s++) {
    const dia = somarDias(inicioHist, 7 * s + rng.inteiro(0, 4))
    const producao = new Map<string, number>([
      ['PA-100', Math.max(5, Math.round(28 * (1 + 0.15 * rng.normal())))],
      ['PA-200', Math.max(2, Math.round(12 * (1 + 0.2 * rng.normal())))],
    ])
    // Explode nível a nível (pais antes dos filhos).
    const fila = ['PA-100', 'PA-200', 'SM-110', 'SM-120', 'SM-210', 'SM-220', 'SM-300']
    for (const pai of fila) {
      const q = producao.get(pai) ?? 0
      if (q <= 0) continue
      movimentacoes.push({
        data: dia,
        codigo: pai,
        tipo: 'Entrada',
        quantidade: q,
        valor_total: r2(q * (porCodigo.get(pai)!.custo_unitario ?? 0)),
        documento: `OP-${String(op++).padStart(5, '0')}`,
      })
      for (const l of bom.filter((b) => b.codigo_pai === pai)) {
        const filho = porCodigo.get(l.codigo_filho)!
        const bruto = q * l.quantidade_por * (1 + l.perda_pct / 100)
        const qf = FRACIONAVEIS.has(filho.unidade) ? r2(bruto) : Math.ceil(bruto)
        if (filho.tipo_item === 'Fabricado')
          producao.set(filho.codigo, (producao.get(filho.codigo) ?? 0) + qf)
        else consumoAcumulado.set(filho.codigo, (consumoAcumulado.get(filho.codigo) ?? 0) + qf)
        movimentacoes.push({
          data: dia,
          codigo: filho.codigo,
          tipo: 'Saída',
          quantidade: qf,
          valor_total: null,
          documento: `REQ-OP-${op - 1}`,
        })
      }
    }
    // Vendas dos acabados.
    for (const pa of ['PA-100', 'PA-200']) {
      const q = Math.max(1, Math.round((producao.get(pa) ?? 0) * (1 + 0.1 * rng.normal())))
      movimentacoes.push({
        data: somarDias(dia, 1),
        codigo: pa,
        tipo: 'Saída',
        quantidade: q,
        valor_total: null,
        documento: `PV-${s}`,
      })
    }
    // Reposição dos comprados a cada 4 semanas.
    if (s % 4 === 3) {
      for (const [codigo, q] of consumoAcumulado) {
        const m = porCodigo.get(codigo)!
        const mult = m.multiplo_compra ?? 1
        const qq = Math.ceil(q / mult) * mult
        movimentacoes.push({
          data: somarDias(dia, 2),
          codigo,
          tipo: 'Entrada',
          quantidade: qq,
          valor_total: r2(qq * (m.custo_unitario ?? 0)),
          documento: `NF-M${s}`,
        })
      }
      consumoAcumulado.clear()
    }
  }
  const pedidos: PedidoDemo[] = [
    { codigo: 'CP-01', data_prevista: utc(2026, 11, 9), quantidade: 100 },
    { codigo: 'MP-02', data_prevista: utc(2026, 11, 16), quantidade: 1000 },
    { codigo: 'CP-05', data_prevista: utc(2026, 10, 20), quantidade: 60 },
  ]
  // Venda no último dia: a data-base fica em 31/10/2026 (outubro completo).
  movimentacoes.push({
    data: DATA_BASE_DEMO,
    codigo: 'PA-100',
    tipo: 'Saída',
    quantidade: 6,
    valor_total: null,
    documento: 'PV-FINAL',
  })
  movimentacoes.sort((a, b) => (a.data as Date).getTime() - (b.data as Date).getTime())
  return { materiais, movimentacoes, pedidos, bom, mps, equipamentos: [], ondeUsado: [] }
}
