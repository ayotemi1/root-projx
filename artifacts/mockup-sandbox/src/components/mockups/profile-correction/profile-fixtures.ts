import type { FeedUpdate } from "@/lib/api";

export const PROFILE_ORG_ID = "LTMwjXVEgxNideK0XtIQudxZXjc2";

export interface Review {
  _id: string;
  orgId: string;
  authorName: string;
  rating: number;
  content: string;
  createdAt: string;
}

export interface VolunteerRole {
  _id: string;
  title: string;
  description: string;
  commitment: string;
  location: string;
  skills: string[];
}

export interface Campaign {
  _id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  amountRaised: number;
  goal: number;
  status: "active" | "completed" | "deleted";
  type: "fundraising" | "volunteer";
  volunteersNeeded: number;
  deadline: string | null;
  phases: Array<{
    id?: string;
    title: string;
    description?: string;
    completed: boolean;
    targetAmount?: number;
  }>;
  currency?: "gbp" | "usd";
  enabled?: boolean;
  publicId?: string;
  sharePath?: string | null;
  partnerFunding?: null;
  partnerFundingMatchedGbp?: number;
}

export interface ProfileOrganisation {
  _id: string;
  name: string;
  country: string;
  city: string;
  category: string;
  categories: string[];
  description: string;
  mission: string;
  verified: boolean;
  followerCount: number;
  totalRaised: number;
  impactScore: number;
  coverImage: string | null;
  logo: string | null;
  contact: { email?: string; phone?: string; website?: string };
  socialLinks: Record<string, string>;
  createdAt: string;
  lastPostAt: string | null;
  fundsUsage: {
    operations: number;
    materials: number;
    staff: number;
    events: number;
    other: number;
  };
  shortDescription: string;
  impactMetrics: {
    peopleReached?: { label: string; value: number; updatedAt: string };
    groundCovered?: { label: string; value: number; updatedAt: string };
    resourcesDelivered?: { label: string; value: number; updatedAt: string };
  };
  team: Array<{ name: string; role: string; photoUrl: string | null }>;
}

// Isolated presentation fixtures. Profile story details are drawn from the
// saved Drum Life draft; contact, review, post, and supporter entries are
// local display-only examples and are not connected to organisation records.
export const PROFILE_ORGANISATION: ProfileOrganisation = {
  _id: PROFILE_ORG_ID,
  name: "Lifeyard",
  country: "Jamaica",
  city: "Kingston",
  category: "Arts & Culture",
  categories: ["Arts & Culture", "Youth", "Community Development"],
  description: [
    "Talent is everywhere. Opportunities to nurture it aren’t. In Kingston’s developing communities, such as Parade Gardens in central Kingston, many children have limited access to recreational and cultural activities that give their energy somewhere to go and their creativity room to grow.",
    "Drum Life opens that space through “edutainment”: learning that feels like play. Led by master drummer Moustafa Reds, Life Yard’s programmes and workshops have been bringing young people together to learn Jamaican and West African rhythms, explore their cultural roots and build confidence through drumming.",
    "Alongside the workshops, we’re raising funds for an on-site social worker to support the children’s wellbeing, respond to concerns and give them someone to turn to when they need support.",
    "Working towards the JCDC competition gives the children something to practise for, a reason to keep going and an opportunity to represent their community on a national stage.",
    "Help keep the rhythm going. Your donation supports workshops, instruments, on-site wellbeing support and the children’s journey from their community to the stage.",
  ].join("\n\n"),
  mission: "Life Yard uses music, culture and community workshops to give young people space to learn, create and grow.",
  verified: true,
  followerCount: 428,
  totalRaised: 18420,
  impactScore: 86,
  coverImage: null,
  logo: null,
  contact: {
    email: "hello@lifeyard.example",
    phone: "+1 876 555 0148",
    website: "https://lifeyard.example",
  },
  socialLinks: {
    instagram: "https://instagram.example/lifeyard",
    youtube: "https://youtube.example/lifeyard",
  },
  createdAt: "2022-04-18T12:00:00.000Z",
  lastPostAt: "2026-11-16T12:00:00.000Z",
  fundsUsage: { operations: 15, materials: 25, staff: 20, events: 30, other: 10 },
  shortDescription: "Creating space for young people to learn, play and grow through music and culture.",
  impactMetrics: {
    peopleReached: { label: "Young people reached", value: 320, updatedAt: "2026-10-15T12:00:00.000Z" },
    groundCovered: { label: "Workshop sessions", value: 48, updatedAt: "2026-10-15T12:00:00.000Z" },
    resourcesDelivered: { label: "Instruments shared", value: 50, updatedAt: "2026-10-15T12:00:00.000Z" },
  },
  team: [
    { name: "Moustafa Reds", role: "Master drummer", photoUrl: null },
    { name: "Life Yard workshop team", role: "Youth programme facilitators", photoUrl: null },
    { name: "Community support team", role: "Wellbeing and family support", photoUrl: null },
  ],
};

export const PROFILE_POSTS: FeedUpdate[] = [
  {
    _id: "profile-post-workshop",
    orgId: PROFILE_ORG_ID,
    orgName: "Lifeyard",
    type: "update",
    title: "Finding the rhythm together",
    content: "Young people are learning Jamaican and West African rhythms through hands-on drumming workshops.",
    mediaUrls: [],
    imageUrl: null,
    likes: 24,
    createdAt: "2026-11-16T12:00:00.000Z",
  },
  {
    _id: "profile-post-community",
    orgId: PROFILE_ORG_ID,
    orgName: "Lifeyard",
    type: "milestone",
    title: "A place to practise and create",
    content: "The workshop space gives children room to rehearse, explore their cultural roots and build confidence.",
    mediaUrls: [],
    imageUrl: null,
    likes: 17,
    createdAt: "2026-11-07T12:00:00.000Z",
  },
  {
    _id: "profile-post-drum-life",
    orgId: PROFILE_ORG_ID,
    orgName: "Lifeyard",
    type: "update",
    title: "The Drum Life programme",
    content: "Learning feels like play: music, movement and time together help young people find their voice.",
    mediaUrls: [],
    imageUrl: null,
    likes: 31,
    createdAt: "2026-10-29T12:00:00.000Z",
  },
];

export const PROFILE_CAMPAIGNS: Campaign[] = [
  {
    _id: "9d5e9d29323a434f8706",
    name: "Drum Life",
    description: "Support music workshops, instruments and a welcoming place for young people to learn and rehearse.",
    imageUrl: null,
    amountRaised: 0,
    goal: 18000,
    status: "active",
    type: "fundraising",
    volunteersNeeded: 0,
    deadline: "2026-12-31T00:00:00.000Z",
    phases: [
      { id: "drums", title: "Provide drums for hands-on learning", description: "A range of drums for practice and performance.", completed: false, targetAmount: 7500 },
      { id: "workshops", title: "Run community workshops", description: "Music sessions led by an experienced drummer.", completed: false, targetAmount: 650 },
    ],
    currency: "usd",
    enabled: false,
    publicId: "drum-life",
    partnerFunding: null,
  },
  {
    _id: "profile-volunteer-workshops",
    name: "Help at a community workshop",
    description: "Support setup and welcome young people to a music session.",
    imageUrl: null,
    amountRaised: 0,
    goal: 0,
    status: "active",
    type: "volunteer",
    volunteersNeeded: 4,
    deadline: "2026-09-30T00:00:00.000Z",
    phases: [],
    enabled: true,
    publicId: "community-workshop-volunteers",
  },
];

export const PROFILE_VOLUNTEER_ROLES: VolunteerRole[] = [
  {
    _id: "role-workshop",
    title: "Workshop helper",
    description: "Help prepare instruments and welcome participants.",
    commitment: "A few hours",
    location: "Kingston",
    skills: ["Community", "Music"],
  },
  {
    _id: "role-remote",
    title: "Remote communications volunteer",
    description: "Help share programme updates with supporters.",
    commitment: "Flexible",
    location: "Remote",
    skills: ["Writing", "Communications"],
  },
];

export const PROFILE_REVIEWS: Review[] = [
  {
    _id: "profile-review-1",
    orgId: PROFILE_ORG_ID,
    authorName: "Community supporter",
    rating: 5,
    content: "A welcoming programme that gives young people a positive place to learn and make music together.",
    createdAt: "2026-11-12T12:00:00.000Z",
  },
];

export const PROFILE_SUPPORTERS = {
  supporters: [
    { displayName: "A community friend" },
    { displayName: "Music for All" },
    { displayName: "A local supporter" },
  ],
  totalCount: 8,
};
