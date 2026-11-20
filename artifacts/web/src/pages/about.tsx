import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

/*
 * Copy follows the supplied About model verbatim, with one deliberate change:
 * pillar 02 originally promised "full alignment with UK fundraising regulation
 * and Gift Aid". Gift Aid is not implemented and the regulatory claim is
 * unverified, so it is replaced with an accurate transparent-giving description
 * pending the founders' confirmation.
 */
const PILLARS = [
  {
    num: "01",
    title: "Discover & follow",
    body: "Find grassroots organisations doing vital work in your diaspora communities. Follow their journey like you follow people you believe in.",
  },
  {
    num: "02",
    title: "Give directly",
    body: "Donation fees are shown clearly before you give, helping you understand how your gift supports the organisation.",
  },
  {
    num: "03",
    title: "Offer your skills",
    body: "Volunteer expertise, offer professional skills, show up in ways that go beyond a transaction. Diaspora knowledge is its own form of wealth.",
  },
  {
    num: "04",
    title: "Build capacity",
    body: "Long-term, Root ProjX is a fundraising and capacity-building arm — helping grassroots organisations grow, sustain, and thrive.",
  },
];

function SectionMark({ children }: { children: string }) {
  return <p className="rp-label !text-[10px] text-[#CA0813] pt-2">{children}</p>;
}

function Founder({ img, alt, name, role, children, testId }: {
  img: string; alt: string; name: string; role: string; children: React.ReactNode; testId: string;
}) {
  return (
    <div data-testid={testId}>
      <div className="aspect-[4/5] overflow-hidden bg-[#17100F]/10">
        <img src={img} alt={alt} className="w-full h-full object-cover object-top grayscale" loading="lazy" />
      </div>
      <h3 className="rp-display text-[40px] sm:text-[48px] mt-6 text-[#17100F]">{name}</h3>
      <p className="rp-label !text-[10px] text-[#CA0813] mt-2">{role}</p>
      <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-[#17100F]/85">{children}</div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="-mb-20">
      <div className="max-w-[1180px] mx-auto px-5 sm:px-8">
        {/* Hero */}
        <section className="pt-14 sm:pt-20 pb-16 sm:pb-24 border-b border-[#17100F]/15">
          <p className="rp-label !text-[10px] text-[#CA0813]">About Root ProjX</p>
          <h1 className="rp-display rp-rise mt-5 text-[58px] sm:text-[104px] lg:text-[128px] text-[#17100F]">
            Where the diaspora<br />comes home.
          </h1>
          <p className="rp-label !normal-case !tracking-[.02em] !text-[13px] mt-8 max-w-[560px] leading-relaxed text-[#17100F]/80">
            A platform connecting diaspora communities with the grassroots organisations building futures in the places we come from — through discovery, solidarity, and meaningful support.
          </p>
        </section>

        {/* Origin */}
        <section className="py-16 sm:py-24 grid md:grid-cols-[200px_1fr] gap-6 md:gap-12 border-b border-[#17100F]/15">
          <SectionMark>01 / The origin</SectionMark>
          <div className="max-w-[680px]">
            <h2 className="rp-display text-[40px] sm:text-[60px] text-[#17100F]">Born from a moment we couldn't look away from.</h2>
            <div className="mt-8 space-y-5 text-[16px] leading-relaxed text-[#17100F]/85">
              <p>It started with footage. Hurricane Melissa tearing through Jamaica — and diaspora communities around the world watching, aching, and asking the same question: how do we actually help?</p>
              <p>For our founder, this wasn't abstract. Jamaica is a place she's returned to again and again — drawn by its music, its people, its spirit. A place that has given the world so much culturally and deserves far more in return.</p>
              <p>The problem isn't that people don't want to give. It's that the existing model has broken their trust. Huge, faceless charities absorb donations with little visibility into where the money lands. Outside organisations parachute in with solutions designed elsewhere, bypassing the communities who know their own needs best. Power stays centralised. Local voices get sidelined.</p>
              <p>Root ProjX exists to change that — to decentralise the power and give it back to the people. To put diaspora supporters in direct relationship with grassroots organisations, so they can watch their efforts reflected in real progress, made by people who are already there.</p>
            </div>
            <blockquote className="mt-12">
              <span className="rp-display block text-[#F3BF2C] text-[80px] leading-[.5] h-8" aria-hidden>&ldquo;</span>
              <p className="rp-display text-[30px] sm:text-[40px] text-[#CA0813]">The diaspora has always been a lifeline. We just needed somewhere to gather.</p>
            </blockquote>
          </div>
        </section>

        {/* What we do */}
        <section className="py-16 sm:py-24 grid md:grid-cols-[200px_1fr] gap-6 md:gap-12 border-b border-[#17100F]/15">
          <SectionMark>02 / What we do</SectionMark>
          <div>
            <h2 className="rp-display text-[40px] sm:text-[60px] text-[#17100F]">More than a giving platform.<br />A whole ecosystem of support.</h2>
            <p className="mt-6 max-w-[620px] text-[16px] leading-relaxed text-[#17100F]/85">
              Root ProjX connects diaspora communities with grassroots organisations through discovery, following, and multi-dimensional support. Because solidarity looks different to different people — and all of it matters.
            </p>
            <div className="mt-12 grid sm:grid-cols-2 gap-x-12 gap-y-12">
              {PILLARS.map(({ num, title, body }) => (
                <div key={num} className="border-t-2 border-[#17100F] pt-5" data-testid={`pillar-${num}`}>
                  <p className="rp-display text-[#CA0813] text-[64px]">{num}</p>
                  <h3 className="rp-label !text-[11px] mt-4 text-[#17100F]">{title}</h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-[#17100F]/80">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Founders */}
        <section className="py-16 sm:py-24 grid md:grid-cols-[200px_1fr] gap-6 md:gap-12">
          <SectionMark>03 / The founders</SectionMark>
          <div className="grid sm:grid-cols-2 gap-14 sm:gap-10">
            <Founder img="/visaka.jpeg" alt="Visaka, Founder & Creator of Root ProjX" name="Visaka" role="Founder & Creator of Root ProjX" testId="founder-visaka">
              <p>I'm half Sri Lankan, half Gambian, born and raised in the UK. I make music. I've spent years travelling to Jamaica, drawn by a culture that has poured so much into the world and continues to give. These aren't separate parts of me — they're all the same thread.</p>
              <p>I fell into the charity sector almost by chance, but the longer I stayed, the more I understood it was never really chance at all. Being of service has always felt like part of my calling. Ten years working in fundraising taught me one thing with real precision: how to compel people to give to causes that matter. To tell the story of a community, an organisation, a need — until someone feels it and says yes.</p>
              <p>Root ProjX was born when I asked: what if I offered that skill not to a single organisation, but to the whole ecosystem? The platform is the answer.</p>
            </Founder>
            <Founder img="/ayotemi.jpeg" alt="Ayotemi Adediwura, Co-Founder & CTO" name="Ayotemi Adediwura" role="Co-Founder & CTO" testId="founder-ayotemi">
              <p>Nigerian-American, born in Maryland. Ayotemi is a technologist and founder who believes AI and automation can decentralise power and return it to communities. He built the platform you're on — and was one of the first to believe it should exist. Co-Founder & CTO of Root ProjX.</p>
            </Founder>
          </div>
        </section>
      </div>

      {/* Closing CTA */}
      <section className="bg-[#CA0813] text-white">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <h2 className="rp-display text-[52px] sm:text-[88px] text-[#F3BF2C]">The roots are ready.<br />Come home.</h2>
          <p className="mt-6 max-w-[480px] text-[16px] text-white/90">
            Join Root ProjX and discover the grassroots organisations keeping your communities alive.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link href="/register" className="rp-btn rp-btn-yellow border-[#F3BF2C]" data-testid="button-about-join">
              Join as a supporter <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/discover" className="rp-btn border-white text-white hover:bg-white hover:text-[#CA0813]" data-testid="button-about-explore">
              Explore organisations
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
