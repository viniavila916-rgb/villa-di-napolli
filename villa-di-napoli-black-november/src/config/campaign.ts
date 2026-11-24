/**
 * CONFIGURAÇÃO DA CAMPANHA
 * ------------------------------------------------------------------
 * Tudo o que é texto fixo, data ou opção da campanha fica aqui.
 * Endereço do plantão, link do WhatsApp, encerramento e contador de
 * unidades são editados pelo PAINEL (/admin), sem mexer em código.
 */

export const campaign = {
  name: "Black November Villa di Napoli",
  development: "Residencial Villa di Napoli",
  builder: "AMC Construções",
  city: "Tijucas/SC",
  timeZone: "America/Sao_Paulo",
  /** Deslocamento fixo de Brasília (o Brasil não adota horário de verão). */
  utcOffset: "-03:00",

  /** Mês exibido no calendário (1 = janeiro). */
  calendarYear: 2026,
  calendarMonth: 11,

  /** Únicos dias selecionáveis. */
  eventDates: ["2026-11-27", "2026-11-28", "2026-11-29"] as const,

  /**
   * Encerramento padrão da campanha (usado no contador enquanto o
   * painel não definir outro). PLACEHOLDER: confirme o horário real
   * de encerramento do plantão em /admin > Configurações.
   */
  defaultEndAt: "2026-11-29T23:59:59-03:00",

  /**
   * A chamada "primeira parcela da entrada só em dezembro" aparece no
   * topo da página. Se a divulgação pública não for autorizada, troque
   * para false: a página passa a usar a headline alternativa.
   */
  showDecemberOffer: true,

  /** Faixas de renda do formulário (campo opcional). Ajuste se quiser. */
  incomeRanges: [
    "Até R$ 3.000",
    "De R$ 3.001 a R$ 5.000",
    "De R$ 5.001 a R$ 8.000",
    "Acima de R$ 8.000",
    "Prefiro informar no plantão",
  ],

  /**
   * Fotos opcionais da seção do café (coloque os arquivos em
   * /public/images e informe o caminho, ex.: "/images/cafe-manha.jpg").
   * Enquanto estiverem vazias, a seção aparece sem fotos.
   */
  coffeeImages: {
    morning: "",
    afternoon: "",
  },
} as const;

export type EventDate = (typeof campaign.eventDates)[number];

/** Dados do empreendimento — todos retirados do catálogo oficial. */
export const development = {
  tagline: "Viva o melhor da Itália em SC",
  address: "Rua Manoel Furtuoso, Bairro Areias — Tijucas/SC",
  intro:
    "O Villa di Napoli é um empreendimento da AMC Construções na Itália Catarinense, em Tijucas: um lugar para criar novas memórias com a sua família e viver uma vida tranquila, rodeado de beleza e conforto.",
  amenities: [
    { name: "Piscina", image: "/images/lazer-piscina.jpg" },
    { name: "Salão de festas", image: "/images/lazer-salao-de-festas.jpg" },
    { name: "Playground", image: "/images/lazer-playground.jpg" },
    { name: "Quadra poliesportiva", image: "/images/lazer-quadra-poliesportiva.jpg" },
    { name: "Espaço pet", image: "/images/lazer-espaco-pet.jpg" },
    { name: "Academia ao ar livre", image: "/images/lazer-academia-ao-ar-livre.jpg" },
    { name: "Pista de caminhada", image: "/images/lazer-pista-de-caminhada.jpg" },
  ],
  plans: [
    {
      name: "Apartamento 01",
      rooms: "2 quartos",
      area: "52,55 m² de área privativa",
      photo: "/images/apartamento-01.jpg",
      plan: "/images/planta-01.jpg",
      planSize: [780, 480] as const,
    },
    {
      name: "Apartamento 02",
      rooms: "2 quartos com suíte",
      area: "52,12 m² de área privativa",
      photo: "/images/apartamento-02.jpg",
      plan: "/images/planta-02.jpg",
      planSize: [675, 620] as const,
    },
  ],
  builderAbout:
    "Há 29 anos, a AMC Construções é referência em qualidade no Brasil. Com sede em Londrina-PR e filial em Palhoça-SC, a empresa gera empregos, investe em tecnologia e sustentabilidade e agrega valor aos seus clientes.",
} as const;

export const faq: { q: string; a: string }[] = [
  {
    q: "Quem pode participar do evento?",
    a: "Qualquer pessoa interessada em conhecer o Villa di Napoli e as possibilidades de compra do primeiro imóvel pelo Minha Casa Minha Vida. Basta escolher um dia e reservar um horário disponível.",
  },
  {
    q: "Preciso ter financiamento aprovado?",
    a: "Não. Você pode participar sem ter feito nenhuma simulação. No plantão, a equipe explica como funciona a análise de crédito. A aprovação depende da instituição financeira e das regras do programa, e não é garantida pela construtora.",
  },
  {
    q: "A primeira parcela realmente fica para dezembro?",
    a: "Sim, a campanha prevê a primeira parcela da entrada em dezembro de 2026, no período do 13º salário, conforme as condições aplicáveis e as unidades participantes. As regras completas são apresentadas no atendimento e valem a partir da proposta formal.",
  },
  {
    q: "O que é a Lista VIP Villa di Napoli?",
    a: "É uma condição comercial especial da Black November, preparada para quem participa do plantão. Os detalhes são apresentados somente no atendimento presencial.",
  },
  {
    q: "O que é o Super Bônus Villa di Napoli?",
    a: "É um benefício exclusivo da campanha, com condições comerciais diferenciadas. Assim como a Lista VIP, é revelado apenas a quem comparece ao plantão.",
  },
  {
    q: "Preciso comparecer presencialmente para conhecer as condições?",
    a: "Sim. As condições da Lista VIP e do Super Bônus não são divulgadas pela internet nem pelo WhatsApp. A equipe apresenta as regras completas, as unidades participantes e os critérios de aplicação durante o atendimento.",
  },
  {
    q: "O café da manhã e o café da tarde são gratuitos?",
    a: "Sim. O café é uma cortesia para os participantes, servido conforme o período do seu atendimento.",
  },
  {
    q: "Posso levar meu companheiro ou minha família?",
    a: "Pode e deve. Traga quem participa dessa decisão com você.",
  },
  {
    q: "O agendamento tem algum custo?",
    a: "Não. Reservar o horário e participar do plantão é gratuito.",
  },
  {
    q: "Preciso comprar um imóvel para participar?",
    a: "Não. O agendamento não gera nenhuma obrigação de compra. Você vem, conhece as possibilidades e decide com calma.",
  },
  {
    q: "Por que aparecem horários indisponíveis no calendário?",
    a: "Porque já foram reservados por outra pessoa ou bloqueados pela organização. Eles continuam visíveis para você consultar a agenda real do plantão.",
  },
];

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
