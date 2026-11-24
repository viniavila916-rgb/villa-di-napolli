import Image from "next/image";
import Link from "next/link";
import { AgendaProvider } from "@/components/AgendaProvider";
import { Booking, HeroDates } from "@/components/Booking";
import { CountdownInline } from "@/components/Countdown";
import { Scarcity } from "@/components/Scarcity";
import { StickyCta } from "@/components/StickyCta";
import { campaign, development, faq } from "@/config/campaign";

const heroHighlights = [
  ...(campaign.showDecemberOffer ? ["Primeira parcela da entrada somente em dezembro"] : []),
  "Condições exclusivas reveladas no plantão",
  "Super Bônus Villa di Napoli",
  "Café da manhã e café da tarde gratuitos",
];

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="mt-1 size-4 shrink-0 text-gold" aria-hidden>
      <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Lock() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 10.5V8a4 4 0 018 0v2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** Cartão "lacrado": desperta curiosidade sem revelar nenhuma condição. */
function SealedCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="relative overflow-hidden rounded-3xl border border-gold/50 bg-gradient-to-b from-ink-3 to-ink-2 p-7 sm:p-9">
      <div className="flex items-center gap-2 text-sm text-gold-soft">
        <Lock /> Revelado somente no plantão
      </div>
      <h3 className="mt-5 text-3xl sm:text-4xl">{title}</h3>
      <p className="mt-4 text-mist">{text}</p>
      {/* Linhas "tarjadas": representam o conteúdo que só é aberto presencialmente */}
      <div className="mt-7 grid gap-2.5" aria-hidden>
        <div className="h-3 w-11/12 rounded-full bg-gold/25" />
        <div className="h-3 w-8/12 rounded-full bg-gold/20" />
        <div className="h-3 w-9/12 rounded-full bg-gold/15" />
      </div>
    </article>
  );
}

export default function Home() {
  return (
    <AgendaProvider>
      {/* ---------- Barra superior com o prazo real ---------- */}
      <div className="bg-ink-2 text-sm">
        <div className="tricolor" aria-hidden />
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-5 py-2.5">
          <p>Plantão presencial em 27, 28 e 29 de novembro</p>
          <p>
            <CountdownInline />
          </p>
        </div>
      </div>

      <main>
        {/* ================= 1. HERO ================= */}
        <section className="relative isolate overflow-hidden">
          <Image
            src="/images/piscina-panorama.jpg"
            alt="Perspectiva ilustrada da área de lazer com piscina do Residencial Villa di Napoli"
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover object-[60%_40%]"
          />
          <div
            className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(19,20,23,0.82)_0%,rgba(19,20,23,0.78)_45%,#131417_100%)] lg:bg-[linear-gradient(90deg,#131417_0%,rgba(19,20,23,0.9)_42%,rgba(19,20,23,0.35)_100%)]"
            aria-hidden
          />
          <div className="mx-auto max-w-6xl px-5 pb-14 pt-6 sm:pb-20 sm:pt-10">
            <Image
              src="/images/logo-villa-di-napoli-claro.png"
              alt="Villa di Napoli — Viva o melhor da Itália em SC"
              width={792}
              height={440}
              priority
              className="h-auto w-28 sm:w-44"
            />

            <div className="mt-7 max-w-2xl sm:mt-14">
              <p className="rise text-base font-semibold text-gold-soft">
                Black November Villa di Napoli, em {campaign.city}
              </p>
              <h1 className="rise rise-2 mt-3 text-[2.3rem] sm:text-6xl lg:text-[4.25rem]">
                {campaign.showDecemberOffer
                  ? "Seu primeiro imóvel pode começar a ser pago só em dezembro"
                  : "Seu primeiro imóvel merece uma oportunidade especial"}
              </h1>
              <p className="rise rise-3 mt-5 max-w-xl text-paper/90 sm:text-lg">
                O Villa di Napoli preparou uma Black November especial para quem deseja sair do
                aluguel e conquistar o primeiro lar pelo Minha Casa Minha Vida. Participe do nosso
                plantão presencial e descubra as condições preparadas para esta campanha.
              </p>
            </div>

            <div className="rise rise-3 mt-7">
              <p className="mb-3 text-sm text-mist">Escolha o seu dia, em novembro de 2026</p>
              <HeroDates />
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <a href="#agenda" className="btn-gold w-full sm:w-auto">
                Reservar meu horário
              </a>
              <p className="text-sm text-mist">Gratuito. Leva menos de um minuto.</p>
            </div>

            <ul className="mt-10 grid max-w-2xl gap-x-8 gap-y-3 sm:grid-cols-2">
              {heroHighlights.map((h) => (
                <li key={h} className="flex gap-3 text-paper/95">
                  <Check /> {h}
                </li>
              ))}
            </ul>

            <p className="mt-10 max-w-2xl text-xs leading-relaxed text-mist/80">
              {campaign.showDecemberOffer &&
                "Primeira parcela da entrada em dezembro de 2026, conforme as condições aplicáveis e as unidades participantes. "}
              Financiamento sujeito à análise de crédito e às regras do programa Minha Casa Minha
              Vida. Imagens meramente ilustrativas.
            </p>
          </div>
        </section>

        {/* ================= 2 e 3. CALENDÁRIO + FORMULÁRIO ================= */}
        <Booking />

        {/* ================= 4. IDENTIFICAÇÃO COM A DOR ================= */}
        <section className="bg-ink px-5 py-16 sm:py-28">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-[2rem] sm:text-5xl">
              Você também está cansado de pagar aluguel e continuar sem ter um lugar para chamar de
              seu?
            </h2>
            <div className="mt-8 grid gap-5 text-lg text-paper/85">
              <p>Todo mês é a mesma história.</p>
              <p>
                O aluguel chega, as contas chegam e uma parte importante da sua renda vai embora
                apenas para garantir um lugar para morar.
              </p>
              <p>
                Enquanto isso, o sonho de conquistar o primeiro imóvel acaba ficando para depois.
              </p>
              <p>
                E muitas vezes não é por falta de vontade. É porque comprar um imóvel parece exigir
                uma entrada muito alta e um planejamento financeiro complicado.
              </p>
              <p className="border-l-2 border-gold pl-5 font-display text-2xl leading-snug text-paper sm:text-3xl">
                Mas será que você já conhece todas as possibilidades de comprar seu primeiro imóvel
                pelo Minha Casa Minha Vida?
              </p>
              <p>
                Talvez esteja faltando conhecer uma oportunidade que faça sentido para a sua
                realidade financeira.
              </p>
            </div>
          </div>
        </section>

        {/* ================= 5. A OPORTUNIDADE ================= */}
        <section className="bg-ink-2 px-5 py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center">
            <figure className="relative aspect-[4/3] overflow-hidden rounded-3xl">
              <Image
                src="/images/entrada-principal.jpg"
                alt="Perspectiva ilustrada da entrada principal do Residencial Villa di Napoli"
                fill
                sizes="(min-width: 1024px) 560px, 100vw"
                className="object-cover"
              />
              <figcaption className="absolute bottom-0 left-0 bg-ink/70 px-3 py-1.5 text-xs text-paper/80">
                Entrada principal. Imagem meramente ilustrativa.
              </figcaption>
            </figure>
            <div>
              <h2 className="text-[2rem] sm:text-5xl">
                Você não precisa deixar o sonho da casa própria para depois
              </h2>
              <div className="mt-6 grid gap-4 text-paper/85">
                <p>
                  O Villa di Napoli preparou uma campanha especial de Black November para quem
                  deseja conquistar o primeiro imóvel.
                </p>
                <p>
                  {campaign.showDecemberOffer
                    ? "Além de uma condição especial para iniciar o pagamento da entrada somente em dezembro, o plantão contará com oportunidades exclusivas que serão apresentadas presencialmente."
                    : "O plantão contará com oportunidades exclusivas que serão apresentadas presencialmente."}
                </p>
                <p>
                  E existe um detalhe importante: algumas das melhores condições desta campanha não
                  serão divulgadas pela internet. Elas foram preparadas especialmente para quem
                  comparecer ao plantão.
                </p>
              </div>
              <a href="#agenda" className="btn-gold mt-8 w-full sm:w-auto">
                Escolher meu horário
              </a>
            </div>
          </div>
        </section>

        {/* ================= 6. CURIOSIDADE E EXCLUSIVIDADE ================= */}
        <section className="bg-ink px-5 py-16 sm:py-28">
          <div className="mx-auto max-w-5xl">
            <h2 className="max-w-3xl text-[2rem] sm:text-5xl">
              Preparamos algo especial para quem estiver presente no plantão
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <SealedCard
                title="Lista VIP Villa di Napoli"
                text="Uma condição especial de Black November, preparada para os participantes do evento."
              />
              <SealedCard
                title="Super Bônus Villa di Napoli"
                text="Um benefício exclusivo com condições comerciais diferenciadas, reveladas somente durante o atendimento presencial."
              />
            </div>
            <p className="mt-8 max-w-3xl text-paper/85">
              Os detalhes, valores e condições serão apresentados pela nossa equipe no plantão. Você
              precisará estar presente para conhecer as oportunidades disponíveis.
            </p>
            <p className="mt-3 max-w-3xl text-sm text-mist">
              A aplicação das condições depende de unidade participante, disponibilidade e proposta
              formal. As regras completas são explicadas no atendimento.
            </p>
            <a href="#agenda" className="btn-gold mt-8 w-full sm:w-auto">
              Quero descobrir as condições exclusivas
            </a>
          </div>
        </section>

        {/* ================= 7. EXPERIÊNCIA PRESENCIAL ================= */}
        <section className="on-paper bg-paper px-5 py-16 text-text sm:py-24">
          <div className="mx-auto max-w-5xl">
            <h2 className="max-w-3xl text-[2rem] sm:text-5xl">
              Sua conquista começa com um café. O resto podemos planejar juntos
            </h2>
            <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
              <div className="grid content-start gap-4 text-lg text-text/85">
                <p>Preparamos um encontro especial para receber você e sua família.</p>
                <p>
                  Durante o evento, você poderá conhecer o Villa di Napoli, conversar com nossa
                  equipe e entender as possibilidades de aquisição pelo Minha Casa Minha Vida.
                </p>
                <p>
                  Para deixar esse momento ainda melhor, teremos café da manhã e café da tarde
                  especiais e gratuitos.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["Café da manhã", "Para quem agenda no período da manhã.", campaign.coffeeImages.morning],
                    ["Café da tarde", "Para quem agenda no período da tarde.", campaign.coffeeImages.afternoon],
                  ] as const
                ).map(([name, text, img]) => (
                  <div key={name} className="overflow-hidden rounded-3xl bg-white">
                    {img && (
                      <div className="relative aspect-[4/3]">
                        <Image src={img} alt={name} fill sizes="(min-width: 640px) 300px, 100vw" className="object-cover" />
                      </div>
                    )}
                    <div className="p-6">
                      <p className="font-display text-3xl">{name}</p>
                      <p className="mt-2 text-muted">{text}</p>
                      <p className="mt-4 inline-block rounded-full bg-ok-wash px-3 py-1 text-sm font-semibold text-ok-deep">
                        Cortesia para participantes
                      </p>
                    </div>
                  </div>
                ))}
                <p className="text-muted sm:col-span-2">
                  Traga quem participa dessa decisão com você. Será um momento para tirar dúvidas e
                  dar o primeiro passo com mais clareza.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================= 8. O EMPREENDIMENTO ================= */}
        <section className="on-paper bg-white px-5 py-16 text-text sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-8 lg:grid-cols-2 lg:items-end">
              <h2 className="text-[2rem] sm:text-5xl">
                Conheça o lugar onde sua próxima história pode começar
              </h2>
              <p className="text-lg text-text/80">{development.intro}</p>
            </div>

            <figure className="relative mt-10 aspect-[16/10] overflow-hidden rounded-3xl sm:aspect-[21/9]">
              <Image
                src="/images/fachada.jpg"
                alt="Perspectiva ilustrada da fachada de um dos blocos do Residencial Villa di Napoli"
                fill
                sizes="(min-width: 1152px) 1152px, 100vw"
                className="object-cover object-[50%_60%]"
              />
            </figure>

            {/* Lazer: rolagem horizontal no celular, grade no computador */}
            <h3 className="mt-14 text-3xl">Lazer para toda a família</h3>
            <ul className="-mx-5 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-3 lg:mx-0 lg:grid lg:grid-cols-7 lg:overflow-visible lg:px-0">
              {development.amenities.map((a) => (
                <li key={a.name} className="w-[44%] shrink-0 snap-start sm:w-[28%] lg:w-auto">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-2xl">
                    <Image
                      src={a.image}
                      alt={`Perspectiva ilustrada: ${a.name}`}
                      fill
                      sizes="(min-width: 1024px) 160px, 44vw"
                      className="object-cover"
                    />
                  </div>
                  <p className="mt-2 text-sm font-semibold">{a.name}</p>
                </li>
              ))}
            </ul>

            {/* Plantas */}
            <h3 className="mt-14 text-3xl">Duas opções de planta</h3>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {development.plans.map((p) => (
                <article key={p.name} className="overflow-hidden rounded-3xl border border-paper-2 bg-paper">
                  <div className="relative aspect-[16/10]">
                    <Image
                      src={p.photo}
                      alt={`Perspectiva ilustrada do interior do ${p.name}`}
                      fill
                      sizes="(min-width: 768px) 560px, 100vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="p-6">
                    <p className="font-display text-3xl">{p.name}</p>
                    <p className="mt-1 text-muted">
                      {p.rooms}, {p.area}
                    </p>
                    <div className="mt-5 rounded-2xl bg-[#f7f7f7] p-3">
                      <Image
                        src={p.plan}
                        alt={`Planta do ${p.name}: ${p.rooms}, ${p.area}`}
                        width={p.planSize[0]}
                        height={p.planSize[1]}
                        sizes="(min-width: 768px) 500px, 90vw"
                        className="mx-auto h-auto max-h-80 w-auto mix-blend-multiply"
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <figure className="mt-5 overflow-hidden rounded-3xl border border-paper-2 bg-[#f7f7f7] p-3 sm:p-6">
              <Image
                src="/images/implantacao.jpg"
                alt="Implantação do condomínio, com os blocos, o estacionamento e a área de lazer"
                width={1250}
                height={630}
                sizes="(min-width: 1152px) 1100px, 100vw"
                className="h-auto w-full mix-blend-multiply"
              />
              <figcaption className="mt-3 text-sm text-muted">Implantação do condomínio.</figcaption>
            </figure>

            {/* Localização + construtora */}
            <div className="mt-14 grid gap-5 lg:grid-cols-2">
              <article className="overflow-hidden rounded-3xl border border-paper-2">
                <Image
                  src="/images/localizacao.jpg"
                  alt="Mapa de localização do Villa di Napoli, próximo à BR-101, ao Centro e à Praia de Tijucas"
                  width={1333}
                  height={755}
                  sizes="(min-width: 1024px) 560px, 100vw"
                  className="h-auto w-full"
                />
                <div className="p-6">
                  <p className="font-display text-3xl">Localização</p>
                  <p className="mt-2 text-muted">{development.address}</p>
                  <p className="mt-1 text-sm text-muted">
                    Endereço do empreendimento. O endereço do plantão é informado na confirmação do
                    agendamento.
                  </p>
                </div>
              </article>
              <article className="flex flex-col justify-between rounded-3xl bg-paper p-7 sm:p-9">
                <div>
                  <Image src="/images/logo-amc.png" alt="AMC Construções" width={440} height={180} className="h-auto w-40" />
                  <p className="mt-6 text-lg text-text/85">{development.builderAbout}</p>
                </div>
                <div className="mt-8">
                  <Image
                    src="/images/parceiros.png"
                    alt="Blue Real Empreendimentos e Minha Casa Minha Vida"
                    width={840}
                    height={224}
                    className="h-auto w-64"
                  />
                </div>
              </article>
            </div>
            <p className="mt-6 text-sm text-muted">
              Perspectivas e plantas meramente ilustrativas, retiradas do catálogo do
              empreendimento.
            </p>
          </div>
        </section>

        {/* ================= 9. ESCASSEZ E URGÊNCIA ================= */}
        <Scarcity />

        {/* ================= 10. PERGUNTAS FREQUENTES ================= */}
        <section className="on-paper bg-paper px-5 py-16 text-text sm:py-24">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-[2rem] sm:text-5xl">Perguntas frequentes</h2>
            <div className="mt-8 divide-y divide-[#d8d1bf] border-y border-[#d8d1bf]">
              {faq.map((item) => (
                <details key={item.q} name="faq" className="group">
                  <summary className="flex min-h-14 items-center justify-between gap-4 py-4 text-lg font-semibold">
                    {item.q}
                    <span className="faq-plus shrink-0 text-2xl leading-none text-gold-deep transition-transform" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="pb-5 pr-8 text-text/80">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ================= 11. CTA FINAL ================= */}
        <section className="relative isolate overflow-hidden px-5 py-20 sm:py-32">
          <Image
            src="/images/apartamento-02.jpg"
            alt=""
            fill
            sizes="100vw"
            className="-z-20 object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-ink/88" aria-hidden />
          <div className="mx-auto max-w-3xl">
            <h2 className="text-[2.25rem] sm:text-6xl">
              O próximo dezembro pode marcar o começo de uma nova história para sua família
            </h2>
            <div className="mt-7 grid gap-4 text-lg text-paper/85">
              <p>
                Você pode continuar pagando aluguel e deixando o sonho da casa própria para depois.
              </p>
              <p>
                Ou pode aproveitar a Black November Villa di Napoli, conhecer as possibilidades e
                descobrir o que é possível fazer para conquistar seu primeiro imóvel.
              </p>
              <p>
                As condições exclusivas da Lista VIP e do Super Bônus serão apresentadas no plantão
                presencial.
              </p>
              <p className="font-semibold text-paper">Escolha seu dia e reserve seu horário.</p>
            </div>
            <a href="#agenda" className="btn-gold mt-9 w-full sm:w-auto">
              Quero garantir meu horário
            </a>
          </div>
        </section>
      </main>

      <footer className="bg-ink-2 px-5 pb-28 pt-12 text-sm text-mist md:pb-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Image
              src="/images/logo-villa-di-napoli-claro.png"
              alt="Villa di Napoli"
              width={792}
              height={440}
              className="h-auto w-32"
            />
            <p className="mt-4 max-w-md">
              {campaign.development}, um empreendimento {campaign.builder}. {development.address}.
            </p>
          </div>
          <div className="sm:text-right">
            <Link href="/privacidade" className="text-paper underline underline-offset-2">
              Política de privacidade
            </Link>
            <p className="mt-2 max-w-sm">
              Condições sujeitas a disponibilidade, unidade participante e análise de crédito.
              Imagens meramente ilustrativas.
            </p>
          </div>
        </div>
      </footer>

      <StickyCta />
    </AgendaProvider>
  );
}
