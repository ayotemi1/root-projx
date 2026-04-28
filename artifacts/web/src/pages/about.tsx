import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Heart, Globe, ShieldCheck } from "lucide-react";

const HOW_IT_WORKS = [
  {
    step: "1",
    icon: Globe,
    title: "Discover",
    description:
      "Browse verified grassroots organisations in Jamaica, the UK, and beyond. Every listing is manually reviewed before going live.",
  },
  {
    step: "2",
    icon: Heart,
    title: "Support",
    description:
      "Donate once or set up a monthly contribution. Follow organisations to receive their updates directly in your feed.",
  },
  {
    step: "3",
    icon: ShieldCheck,
    title: "See the impact",
    description:
      "Organisations post real updates: milestones hit, campaigns launched, stories from the community. You see exactly where your support goes.",
  },
];

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-20">

      {/* Hero */}
      <section className="text-center space-y-5">
        <p className="text-primary font-bold tracking-widest text-sm uppercase">About Root ProjX</p>
        <h1 className="text-4xl md:text-5xl font-extrabold text-foreground leading-tight">
          Restoration. Culture. Access.
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
          Root ProjX is a community giving platform connecting the diaspora to the grassroots organisations
          doing vital work back home — in Jamaica, across the Caribbean, and in the UK. We exist to make
          giving direct, transparent, and meaningful.
        </p>
      </section>

      {/* Our Story */}
      <section className="grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h2 className="text-2xl font-extrabold text-foreground mb-4">Our Story</h2>
          <div className="space-y-4 text-foreground/80 leading-relaxed">
            <p>
              Root ProjX was born out of urgency. When Hurricane Melissa struck Jamaica in 2022, dozens
              of local organisations mobilised immediately — feeding families, clearing roads, rebuilding
              rooftops. The diaspora wanted to help, but had no easy, trustworthy way to find and support
              these groups.
            </p>
            <p>
              Visaka, our founder, had spent years volunteering across London and Kingston. She saw the
              disconnect first-hand: so much willingness to give, so little infrastructure to make it
              count. Root ProjX was her answer.
            </p>
            <p>
              We launched in 2023 with seven verified organisations and a small team of volunteers.
              Today we're growing rapidly — but our mission has never changed: restore the connection
              between diaspora and community.
            </p>
          </div>
        </div>
        <div className="bg-secondary/60 rounded-2xl aspect-video flex items-center justify-center">
          <span className="text-sm text-muted-foreground italic">Founding story photo</span>
        </div>
      </section>

      {/* How It Works */}
      <section>
        <h2 className="text-2xl font-extrabold text-foreground mb-8 text-center">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {HOW_IT_WORKS.map(({ step, icon: Icon, title, description }) => (
            <div
              key={step}
              className="bg-card border border-border rounded-2xl p-6 text-center space-y-4 shadow-sm"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-primary/60 tracking-widest uppercase mb-1">Step {step}</p>
                <h3 className="font-extrabold text-foreground text-lg">{title}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Meet the Team */}
      <section>
        <h2 className="text-2xl font-extrabold text-foreground mb-8 text-center">Meet the Team</h2>
        <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
            <div className="w-20 h-20 rounded-full bg-primary/20 text-primary flex items-center justify-center text-2xl font-extrabold mx-auto mb-4">
              VF
            </div>
            <h3 className="font-extrabold text-foreground text-lg">Visaka Fernando</h3>
            <p className="text-sm text-primary font-semibold mt-0.5">Founder & CEO</p>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              Born in Kingston, raised in London. Visaka has spent 15 years bridging diaspora communities
              with grassroots organisations across Jamaica and the UK.
            </p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
            <div className="w-20 h-20 rounded-full bg-primary/20 text-primary flex items-center justify-center text-2xl font-extrabold mx-auto mb-4">
              AA
            </div>
            <h3 className="font-extrabold text-foreground text-lg">Ayotemi Adediwura</h3>
            <p className="text-sm text-primary font-semibold mt-0.5">Co-Founder & CTO</p>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              Born in Maryland to Nigerian roots, Ayotemi is a founder and technologist who believes AI
              and automation can put power back in the hands of communities. At Root ProjX he architects
              the systems that make direct giving possible at scale.
            </p>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="text-center bg-primary/5 border border-primary/15 rounded-2xl px-6 py-12 space-y-5">
        <h2 className="text-2xl font-extrabold text-foreground">Ready to make a difference?</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Join thousands of diaspora supporters connecting to the grassroots. Every contribution counts.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link href="/register">
            <Button size="lg" className="font-bold">Join Root ProjX</Button>
          </Link>
          <Link href="/discover">
            <Button size="lg" variant="outline">Explore organisations</Button>
          </Link>
        </div>
      </section>

    </div>
  );
}
