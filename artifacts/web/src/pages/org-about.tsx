import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Target, Eye, Heart, Globe, Mail, Phone, MapPin, ArrowLeft } from "lucide-react";
import * as api from "@/lib/api";
import type { Org } from "@/lib/api";

const RED = "#B50000";

// ── Placeholder content used when Firestore fields are absent ─────────────────

const DEFAULTS = {
  aboutText:
    "Cornerstone Youth Foundation was established in 2016 to address youth unemployment and lack of opportunity in Kingston's inner-city communities.",
  mission: "Empowering young people through skills, mentorship, and community.",
  vision:  "A future where every young person has the tools to build a better life.",
  values:  ["Empowerment", "Integrity", "Inclusion", "Growth"],
  website: "www.cornerstoneyouth.org",
  email:   "info@cornerstoneyouth.org",
  phone:   "(876) 555-0198",
  address: "123 Eastwood Park Road, Kingston, Jamaica",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function or<T>(val: T | null | undefined, fallback: T): T {
  return val !== null && val !== undefined && val !== ("" as unknown as T) ? val : fallback;
}

function orArr(val: unknown, fallback: string[]): string[] {
  if (Array.isArray(val) && val.length > 0) return val as string[];
  return fallback;
}

// Extend Org with about-specific fields not in the base Org type
interface OrgAbout extends Org {
  aboutText?: string | null;
  featuredImageUrl?: string | null;
  vision?: string | null;
  values?: string[] | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

// ── Info card ─────────────────────────────────────────────────────────────────

function InfoCard({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mt-0.5"
        style={{ background: "#FFE4E4" }}
      >
        <Icon size={18} color={RED} />
      </div>
      <div>
        <p className="font-bold text-[#1A1A1A] leading-tight">{label}</p>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}

// ── Contact item ──────────────────────────────────────────────────────────────

function ContactItem({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  href?: string;
}) {
  const text = href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-[#444] hover:underline break-all"
    >
      {value}
    </a>
  ) : (
    <p className="text-sm text-[#444] break-all">{value}</p>
  );

  return (
    <div className="flex items-start gap-3">
      <div
        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5"
        style={{ background: "#FFE4E4" }}
      >
        <Icon size={16} color={RED} />
      </div>
      <div>
        <p className="text-xs font-semibold text-[#888] uppercase tracking-wide mb-0.5">{label}</p>
        {text}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrgAboutPage() {
  const params = useParams<{ id: string }>();
  const orgId = params.id!;

  const { data: org, isLoading } = useQuery<OrgAbout>({
    queryKey: ["org", orgId],
    queryFn: () => api.getOrganisation(orgId),
  });

  const name         = org?.name ?? "Organisation";
  const aboutText    = or(org?.aboutText,        DEFAULTS.aboutText);
  const featuredImg  = or(org?.featuredImageUrl ?? org?.coverImage, null);
  const mission      = or(org?.mission,          DEFAULTS.mission);
  const vision       = or(org?.vision,           DEFAULTS.vision);
  const values       = orArr(org?.values,        DEFAULTS.values);
  const website      = or(org?.website,          DEFAULTS.website);
  const email        = or(org?.email,            null);
  const phone        = or(org?.phone,            null);
  const address      = or(org?.address,          DEFAULTS.address);

  // Derive email from contact object if available
  const contactEmail =
    email ??
    (typeof org?.contact === "object" && org?.contact !== null
      ? (org.contact as Record<string, unknown>).email as string | undefined
      : undefined) ??
    DEFAULTS.email;

  const contactPhone =
    phone ??
    (typeof org?.contact === "object" && org?.contact !== null
      ? (org.contact as Record<string, unknown>).phone as string | undefined
      : undefined) ??
    DEFAULTS.phone;

  const contactWebsite =
    website ??
    (typeof org?.contact === "object" && org?.contact !== null
      ? (org.contact as Record<string, unknown>).website as string | undefined
      : undefined) ??
    DEFAULTS.website;

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="h-8 w-64 rounded-xl bg-[#F2EDE4] animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div className="aspect-[4/3] rounded-2xl bg-[#F2EDE4] animate-pulse" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-xl bg-[#F2EDE4] animate-pulse" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        href={`/organisations/${orgId}`}
        className="inline-flex items-center gap-1.5 text-sm text-[#666] hover:text-[#333] mb-6"
      >
        <ArrowLeft size={16} />
        {name}
      </Link>

      {/* Page heading */}
      <h1 className="text-3xl font-bold text-[#1A1A1A] mb-7">About {name}</h1>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
        {/* Left — featured image */}
        <div className="rounded-2xl overflow-hidden bg-[#EDE8E0] aspect-[4/3]">
          {featuredImg ? (
            <img
              src={featuredImg}
              alt={name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #C1181E 0%, #7A0000 100%)" }}
            >
              <span
                className="text-6xl font-black select-none"
                style={{ color: "rgba(255,255,255,0.18)" }}
              >
                {name[0]}
              </span>
            </div>
          )}
        </div>

        {/* Right — about text + info cards */}
        <div className="flex flex-col gap-5">
          {/* Background paragraph */}
          <p className="text-[#444] leading-relaxed text-sm">{aboutText}</p>

          {/* Mission */}
          <InfoCard icon={Target} label="Our Mission">
            <p className="text-sm text-[#555]">{mission}</p>
          </InfoCard>

          {/* Vision */}
          <InfoCard icon={Eye} label="Our Vision">
            <p className="text-sm text-[#555]">{vision}</p>
          </InfoCard>

          {/* Values */}
          <InfoCard icon={Heart} label="Our Values">
            <div className="flex flex-wrap gap-1.5 mt-1">
              {values.map((v) => (
                <span
                  key={v}
                  className="px-3 py-0.5 rounded-full text-xs font-semibold border"
                  style={{ color: RED, borderColor: RED }}
                >
                  {v}
                </span>
              ))}
            </div>
          </InfoCard>
        </div>
      </div>

      {/* Contact strip */}
      <div className="border border-[#E0D8CC] rounded-2xl bg-[#F9F6F0] px-6 py-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          {contactWebsite && (
            <ContactItem
              icon={Globe}
              label="Website"
              value={contactWebsite.replace(/^https?:\/\//, "")}
              href={contactWebsite.startsWith("http") ? contactWebsite : `https://${contactWebsite}`}
            />
          )}
          {contactEmail && (
            <ContactItem
              icon={Mail}
              label="Email"
              value={contactEmail}
              href={`mailto:${contactEmail}`}
            />
          )}
          {contactPhone && (
            <ContactItem
              icon={Phone}
              label="Phone"
              value={contactPhone}
              href={`tel:${contactPhone.replace(/\s/g, "")}`}
            />
          )}
          {address && (
            <ContactItem
              icon={MapPin}
              label="Address"
              value={address}
            />
          )}
        </div>
      </div>
    </div>
  );
}
