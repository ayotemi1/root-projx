import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Palette, Users, Calendar, Smartphone, Heart, Briefcase,
  ChevronRight, ArrowLeft, X,
} from "lucide-react";
import * as api from "@/lib/api";
import type { Org } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const RED = "#B50000";
const GOLD = "#F5B800";

// ── Types ─────────────────────────────────────────────────────────────────────

interface VolunteerRole {
  _id: string;
  title: string;
  locationType: "remote" | "local" | "either";
  frequency: string;
  term: "short" | "long";
  iconType: string;
  description?: string;
}

// ── Icon mapping ──────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  palette: Palette,
  users: Users,
  calendar: Calendar,
  smartphone: Smartphone,
  heart: Heart,
  briefcase: Briefcase,
};

const ICON_COLORS = [
  { bg: "#FFF3CD", fg: "#7A5800" },
  { bg: "#FFE4E4", fg: RED },
  { bg: "#E8F4E8", fg: "#2D7A2D" },
  { bg: "#E4EEFF", fg: "#1A4FA0" },
  { bg: "#F0E4FF", fg: "#6B2DA0" },
  { bg: "#FFF3CD", fg: "#7A5800" },
];

// ── Filter chip ───────────────────────────────────────────────────────────────

type Filter = "all" | "local" | "remote" | "short" | "long";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",    label: "All"        },
  { key: "local",  label: "Local"      },
  { key: "remote", label: "Remote"     },
  { key: "short",  label: "Short Term" },
  { key: "long",   label: "Long Term"  },
];

function matches(role: VolunteerRole, filter: Filter) {
  if (filter === "all")    return true;
  if (filter === "local")  return role.locationType === "local" || role.locationType === "either";
  if (filter === "remote") return role.locationType === "remote" || role.locationType === "either";
  if (filter === "short")  return role.term === "short";
  if (filter === "long")   return role.term === "long";
  return true;
}

// ── Apply modal ───────────────────────────────────────────────────────────────

function ApplyModal({
  role, orgId, token,
  onClose, onSuccess,
}: {
  role: VolunteerRole;
  orgId: string;
  token: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [motivation, setMotivation] = useState("");
  const [experience, setExperience] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.apiFetch(`/organisations/${orgId}/volunteerApplications`, {
        method: "POST",
        body: JSON.stringify({ roleId: role._id, roleTitle: role.title, motivation, experience }),
        token,
      }),
    onSuccess,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#E0D8CC]">
          <div>
            <h2 className="font-bold text-lg text-[#1A1A1A]">Apply to Volunteer</h2>
            <p className="text-sm text-[#666] mt-0.5">{role.title}</p>
          </div>
          <button onClick={onClose} className="text-[#888] hover:text-[#333]"><X size={20} /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-[#333] mb-1.5">
              Why do you want to volunteer for this role?
            </label>
            <textarea
              rows={3}
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              placeholder="Tell us what motivates you…"
              className="w-full border border-[#E0D8CC] rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#333] mb-1.5">
              Relevant experience or skills
            </label>
            <textarea
              rows={3}
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="Share any relevant background…"
              className="w-full border border-[#E0D8CC] rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>
          {mutation.isError && (
            <p className="text-sm text-red-600">We couldn’t load the volunteer information. Check your connection and reload this page. If it continues, contact Root ProjX.</p>
          )}
        </div>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-[#555] border border-[#E0D8CC] hover:bg-[#F9F6F0] transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!motivation.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: RED }}
          >
            {mutation.isPending ? "Submitting…" : "Submit Application"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Suggest skills modal ──────────────────────────────────────────────────────

function SuggestModal({
  orgId, token,
  onClose, onSuccess,
}: {
  orgId: string;
  token: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [skill, setSkill] = useState("");
  const [availability, setAvailability] = useState("flexible");
  const [locationPreference, setLocationPreference] = useState("remote");

  const mutation = useMutation({
    mutationFn: () =>
      api.apiFetch(`/organisations/${orgId}/skillSuggestions`, {
        method: "POST",
        body: JSON.stringify({ skill, availability, locationPreference }),
        token,
      }),
    onSuccess,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#E0D8CC]">
          <h2 className="font-bold text-lg text-[#1A1A1A]">Suggest a Skill</h2>
          <button onClick={onClose} className="text-[#888] hover:text-[#333]"><X size={20} /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-[#333] mb-1.5">
              What skill can you offer?
            </label>
            <input
              type="text"
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              placeholder="e.g. Photography, Web Development…"
              className="w-full border border-[#E0D8CC] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#333] mb-1.5">Availability</label>
            <select
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              className="w-full border border-[#E0D8CC] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white"
            >
              <option value="flexible">Flexible</option>
              <option value="weekly">Weekly</option>
              <option value="occasional">Occasional</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#333] mb-1.5">Location preference</label>
            <select
              value={locationPreference}
              onChange={(e) => setLocationPreference(e.target.value)}
              className="w-full border border-[#E0D8CC] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white"
            >
              <option value="remote">Remote</option>
              <option value="local">Local</option>
              <option value="either">Either</option>
            </select>
          </div>
          {mutation.isError && (
            <p className="text-sm text-red-600">We couldn’t confirm your volunteer request. Keep a copy of your message, check your connection and try again. If it continues, contact Root ProjX.</p>
          )}
        </div>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-[#555] border border-[#E0D8CC] hover:bg-[#F9F6F0] transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!skill.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: RED }}
          >
            {mutation.isPending ? "Sending…" : "Send Suggestion"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Success toast ─────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1A1A1A] text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg flex items-center gap-3">
      <span>{message}</span>
      <button onClick={onDismiss} className="text-white/60 hover:text-white"><X size={14} /></button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrgVolunteerPage() {
  const params = useParams<{ id: string }>();
  const orgId = params.id!;
  const { isAuthenticated, token } = useAuth();

  const [filter, setFilter] = useState<Filter>("all");
  const [applyRole, setApplyRole] = useState<VolunteerRole | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { data: org } = useQuery<Org>({
    queryKey: ["org", orgId],
    queryFn: () => api.getOrganisation(orgId),
  });

  const { data: roles = [], isLoading } = useQuery<VolunteerRole[]>({
    queryKey: ["volunteerRoles", orgId],
    queryFn: () => api.apiFetch(`/organisations/${orgId}/volunteerRoles`),
  });

  const filtered = roles.filter((r) => matches(r, filter));

  function handleApply(role: VolunteerRole) {
    if (!isAuthenticated) { setShowLoginPrompt(true); return; }
    setApplyRole(role);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        href={`/organisations/${orgId}`}
        className="inline-flex items-center gap-1.5 text-sm text-[#666] hover:text-[#333] mb-6"
      >
        <ArrowLeft size={16} />
        {org?.name ?? "Organisation profile"}
      </Link>

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-3xl font-bold text-[#1A1A1A]">Ways to Volunteer</h1>
        <p className="text-[#666] mt-1 text-sm">
          Your time and skills can make a real difference in the lives of young people.
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-7">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
            style={
              filter === key
                ? { background: RED, color: "#fff" }
                : { background: "transparent", color: "#666", border: "1.5px solid #CCC" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Roles list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-[#F2EDE4] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-[#999] text-sm">
          No roles match this filter.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((role, i) => {
            const Icon = ICON_MAP[role.iconType] ?? Users;
            const { bg, fg } = ICON_COLORS[i % ICON_COLORS.length]!;
            return (
              <div
                key={role._id}
                className="bg-[#F9F6F0] border border-[#E0D8CC] rounded-2xl px-4 py-3 flex items-center gap-4"
              >
                {/* Coloured icon circle */}
                <div
                  className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center"
                  style={{ background: bg }}
                >
                  <Icon size={20} color={fg} />
                </div>

                {/* Title + meta */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#1A1A1A] text-sm leading-tight">{role.title}</p>
                  <p className="text-xs text-[#888] mt-0.5">
                    {role.locationType.charAt(0).toUpperCase() + role.locationType.slice(1)}
                    {" · "}
                    {role.frequency}
                  </p>
                </div>

                {/* Chevron */}
                <ChevronRight size={16} className="text-[#BBB] flex-shrink-0" />

                {/* Apply button */}
                <button
                  onClick={() => handleApply(role)}
                  className="flex-shrink-0 px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: RED }}
                >
                  Apply
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Have a skill not listed? */}
      <div className="mt-8 bg-[#F9F6F0] border border-[#E0D8CC] rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="font-bold text-[#1A1A1A]">Have a skill not listed?</p>
          <p className="text-sm text-[#888] mt-0.5">Tell us how you'd like to help.</p>
        </div>
        <button
          onClick={() => {
            if (!isAuthenticated) { setShowLoginPrompt(true); return; }
            setShowSuggest(true);
          }}
          className="flex-shrink-0 px-5 py-2 rounded-lg text-sm font-semibold border transition-colors hover:bg-red-50"
          style={{ color: RED, borderColor: RED }}
        >
          Suggest Your Skills
        </button>
      </div>

      {/* Login prompt */}
      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 text-center">
            <p className="font-bold text-lg text-[#1A1A1A] mb-2">Sign in to continue</p>
            <p className="text-sm text-[#666] mb-5">
              Create an account or log in to apply for volunteer roles.
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/register"
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: RED }}
                onClick={() => setShowLoginPrompt(false)}
              >
                Sign Up
              </Link>
              <Link
                href="/login"
                className="px-5 py-2 rounded-lg text-sm font-semibold border text-[#333] border-[#DDD] hover:bg-[#F9F6F0]"
                onClick={() => setShowLoginPrompt(false)}
              >
                Log In
              </Link>
            </div>
            <button
              onClick={() => setShowLoginPrompt(false)}
              className="mt-4 text-sm text-[#999] hover:text-[#555]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Apply modal */}
      {applyRole && (
        <ApplyModal
          role={applyRole}
          orgId={orgId}
          token={token}
          onClose={() => setApplyRole(null)}
          onSuccess={() => {
            setApplyRole(null);
            setToast("Application submitted! We'll be in touch soon.");
          }}
        />
      )}

      {/* Suggest modal */}
      {showSuggest && (
        <SuggestModal
          orgId={orgId}
          token={token}
          onClose={() => setShowSuggest(false)}
          onSuccess={() => {
            setShowSuggest(false);
            setToast("Thanks! Your skill suggestion has been sent.");
          }}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
