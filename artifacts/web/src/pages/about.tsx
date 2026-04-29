import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const PILLARS = [
  {
    num: "01",
    title: "Discover & Follow",
    body: "Find grassroots organisations doing vital work in your diaspora communities. Follow their journey like you follow people you believe in.",
  },
  {
    num: "02",
    title: "Give Directly",
    body: "Pass-through donations that reach the organisations themselves — transparently, and in full alignment with UK fundraising regulation and Gift Aid.",
  },
  {
    num: "03",
    title: "Offer Your Skills",
    body: "Volunteer expertise, offer professional skills, show up in ways that go beyond a transaction. Diaspora knowledge is its own form of wealth.",
  },
  {
    num: "04",
    title: "Build Capacity",
    body: "Long-term, Root ProjX is a fundraising and capacity-building arm — helping grassroots organisations grow, sustain, and thrive.",
  },
];

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 space-y-24">

      {/* Hero */}
      <section className="text-center space-y-6">
        <p className="text-primary font-bold tracking-widest text-xs uppercase">About Root ProjX</p>
        <h1 className="text-4xl md:text-6xl font-extrabold text-foreground leading-tight">
          Where the diaspora<br />comes home.
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
          A platform connecting diaspora communities with the grassroots organisations building futures in the places we come from — through discovery, solidarity, and meaningful support.
        </p>
      </section>

      {/* The Origin */}
      <section className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <p className="text-xs font-bold tracking-widest text-primary uppercase">The Origin</p>
          <div className="h-px flex-1 bg-border" />
        </div>

        <h2 className="text-2xl md:text-3xl font-extrabold text-foreground">
          Born from a moment we couldn't look away from.
        </h2>

        <div className="space-y-4 text-foreground/80 leading-relaxed text-base md:text-lg">
          <p>
            It started with footage. Hurricane Melissa tearing through Jamaica — and diaspora communities around the world watching, aching, and asking the same question: how do we actually help?
          </p>
          <p>
            For our founder, this wasn't abstract. Jamaica is a place she's returned to again and again — drawn by its music, its people, its spirit. A place that has given the world so much culturally and deserves far more in return.
          </p>
          <p>
            The problem isn't that people don't want to give. It's that the existing model has broken their trust. Huge, faceless charities absorb donations with little visibility into where the money lands. Outside organisations parachute in with solutions designed elsewhere, bypassing the communities who know their own needs best. Power stays centralised. Local voices get sidelined.
          </p>
          <p>
            Root ProjX exists to change that — to decentralise the power and give it back to the people. To put diaspora supporters in direct relationship with grassroots organisations, so they can watch their efforts reflected in real progress, made by people who are already there.
          </p>
        </div>

        <blockquote
          className="border-l-4 pl-6 py-1 text-lg md:text-xl italic font-medium"
          style={{ borderColor: "#F5C000", color: "#CC0000" }}
        >
          "The diaspora has always been a lifeline. We just needed somewhere to gather."
        </blockquote>
      </section>

      {/* What We Do */}
      <section className="space-y-8">
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <p className="text-xs font-bold tracking-widest text-primary uppercase">What We Do</p>
          <div className="h-px flex-1 bg-border" />
        </div>

        <h2 className="text-2xl md:text-3xl font-extrabold text-foreground">
          More than a giving platform.<br />A whole ecosystem of support.
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Root ProjX connects diaspora communities with grassroots organisations through discovery, following, and multi-dimensional support. Because solidarity looks different to different people — and all of it matters.
        </p>

        <div className="grid sm:grid-cols-2 gap-5">
          {PILLARS.map(({ num, title, body }) => (
            <div key={num} className="bg-card border border-border rounded-2xl p-6 space-y-3 shadow-sm">
              <p className="text-3xl font-extrabold" style={{ color: "#F5C000" }}>{num}</p>
              <h3 className="font-extrabold text-foreground text-base">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The Founders */}
      <section className="space-y-12">
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <p className="text-xs font-bold tracking-widest text-primary uppercase">The Founders</p>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Visaka */}
        <div className="grid md:grid-cols-2 gap-10 items-start">
          <div className="order-2 md:order-1 space-y-5">
            <div>
              <h2 className="text-2xl font-extrabold text-foreground">Visaka</h2>
              <p className="text-sm font-semibold mt-0.5" style={{ color: "#CC0000" }}>
                Founder & Creator of Root ProjX
              </p>
            </div>

            <div className="space-y-4 text-foreground/80 leading-relaxed">
              <p>
                I'm half Sri Lankan, half Gambian, born and raised in the UK. I make music. I've spent years travelling to Jamaica, drawn by a culture that has poured so much into the world and continues to give. These aren't separate parts of me — they're all the same thread.
              </p>
              <p>
                I fell into the charity sector almost by chance, but the longer I stayed, the more I understood it was never really chance at all. Being of service has always felt like part of my calling. Ten years working in fundraising taught me one thing with real precision: how to compel people to give to causes that matter. To tell the story of a community, an organisation, a need — until someone feels it and says yes.
              </p>
              <p>
                Root ProjX was born when I asked: what if I offered that skill not to a single organisation, but to the whole ecosystem? The platform is the answer.
              </p>
            </div>
          </div>

          <div className="order-1 md:order-2">
            <img
              src="/visaka.jpeg"
              alt="Visaka — Founder & Creator"
              className="w-full rounded-2xl object-cover shadow-lg"
              style={{ maxHeight: "520px", objectPosition: "top" }}
            />
          </div>
        </div>

        {/* Ayotemi */}
        <div className="grid md:grid-cols-2 gap-10 items-start">
          <div>
            <img
              src="/ayotemi.jpeg"
              alt="Ayotemi Adediwura — Co-Founder & CTO"
              className="w-full rounded-2xl object-cover shadow-lg"
              style={{ maxHeight: "520px", objectPosition: "top" }}
            />
          </div>

          <div className="space-y-5 flex flex-col justify-center">
            <div>
              <h2 className="text-2xl font-extrabold text-foreground">Ayotemi Adediwura</h2>
              <p className="text-sm font-semibold mt-0.5" style={{ color: "#CC0000" }}>
                Co-Founder & CTO
              </p>
            </div>
            <p className="text-foreground/80 leading-relaxed">
              The person who built the app and website you're experiencing now. More than that, Ayotemi spoke life into this idea at the very beginning — when it was still just a vision, he believed in it. That belief became the foundation. A technologist and founder who believes technology can decentralise power and put it back in the hands of communities.
            </p>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section
        className="text-center rounded-2xl px-6 py-14 space-y-5"
        style={{ backgroundColor: "#CC0000" }}
      >
        <h2 className="text-2xl md:text-3xl font-extrabold text-white">
          The roots are ready. Come home.
        </h2>
        <p className="text-white/75 max-w-md mx-auto">
          Join Root ProjX and discover the grassroots organisations keeping your communities alive.
        </p>
        <div className="flex gap-3 justify-center flex-wrap pt-2">
          <Link href="/register">
            <Button
              size="lg"
              className="font-bold text-black border-0"
              style={{ backgroundColor: "#F5C000" }}
            >
              Join Root ProjX
            </Button>
          </Link>
          <Link href="/discover">
            <Button
              size="lg"
              variant="outline"
              className="font-bold border-white/40 text-white hover:bg-white/10"
            >
              Explore organisations
            </Button>
          </Link>
        </div>
      </section>

    </div>
  );
}
