import "./_group.css";

// Extracted from CampaignPageView's real Story and Breakdown sections,
// before this revision. Data is the owner's saved Drum Life draft, not a
// new public campaign or a hand-drawn approximation of the existing layout.
const description = [
  "Talent is everywhere. Opportunities to nurture it aren’t. In Kingston’s developing communities, such as Parade Gardens in central Kingston, many children have limited access to recreational and cultural activities that give their energy somewhere to go and their creativity room to grow.",
  "Drum Life opens that space through “edutainment”: learning that feels like play. Led by master drummer Moustafa Reds, Life Yard’s programmes and workshops have been bringing young people together to learn Jamaican and West African rhythms, explore their cultural roots and build confidence through drumming.",
  "Alongside the workshops, we’re raising funds for an on-site social worker to support the children’s wellbeing, respond to concerns and give them someone to turn to when they need support.",
  "Working towards the JCDC competition gives the children something to practise for, a reason to keep going and an opportunity to represent their community on a national stage.",
  "Help keep the rhythm going. Your donation supports workshops, instruments, on-site wellbeing support and the children’s journey from their community to the stage.",
];
const breakdown = [
  { label: "$7500", detail: "50 drums for hands-on learning, practice and performance, including djembe, funde, kette, bass and congo drums." },
  { label: "$650", detail: "Three months of drumming tuition with master drummer Moustafa Reds." },
  { label: "$2000", detail: "Workshop spaces where children can come together to learn and rehearse." },
  { label: "$2,850 ", detail: "Transport and refreshments to help children attend and participate in the workshops." },
  { label: "$2000", detail: "An on-site social worker to support the children’s wellbeing, respond to concerns and provide a trusted person to turn to throughout the workshops." },
  { label: "$1000", detail: "Contingency fund to cover unforeseen programme costs, such as additional transport, replacement materials or changes to workshop arrangements." },
];

export function Current() {
  const wrap = "max-w-6xl mx-auto";
  const sectionPad = "px-5 md:px-10";
  const twoCol = "grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14";
  const sectionTitle = "text-[2.25rem] leading-[0.98] font-extrabold tracking-[-0.03em] text-[#1c1410] break-words md:text-[3.5rem]";
  const [lead, ...rest] = description;
  return (
    <main className="lifeyard-extraction min-h-screen">
      <section className="py-14 md:py-20 bg-white">
        <div className={`${wrap} ${sectionPad} space-y-12`}>
          <div className={twoCol}>
            <h2 className={sectionTitle}>The story</h2>
            <div data-testid="text-campaign-description" className="space-y-4 text-[1.02rem] leading-relaxed text-[#3a2f28] break-words">
              <p className="text-lg font-semibold text-[#1c1410] whitespace-pre-wrap">{lead}</p>
              {rest.map((p, i) => <p key={i} className="whitespace-pre-wrap">{p}</p>)}
            </div>
          </div>
        </div>
      </section>
      <section className="pb-14 md:pb-20 bg-white">
        <div className={`${wrap} ${sectionPad} border-t-2 border-[#1c1410] pt-10 space-y-14`}>
          <div className={twoCol} data-testid="list-campaign-breakdown">
            <div className="min-w-0"><h2 className={sectionTitle}>What your money buys</h2></div>
            <div className="min-w-0 space-y-5">
              <ul className="border-t border-[#E0D8CC]" aria-live="polite" aria-relevant="additions text" aria-label="Most recent campaign donors">
                {breakdown.map((b, i) => (
                  <li key={i} className="py-4 border-b border-[#E0D8CC]" data-testid={`row-breakdown-${i}`}>
                    <p className="text-lg font-extrabold tabular-nums break-words" style={{ color: "#B50000" }}>{b.label}</p>
                    <p className="text-sm leading-relaxed text-[#3a2f28] mt-1 break-words">{b.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
