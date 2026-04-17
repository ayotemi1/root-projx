import { db } from "./index";
import {
  usersTable,
  organisationsTable,
  updatesTable,
  helpReviewsTable,
  resourcesTable,
} from "./schema";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

async function seed() {
  logger.info("Checking if seed data exists...");

  const existingOrgs = await db
    .select()
    .from(organisationsTable)
    .limit(1);

  if (existingOrgs.length > 0) {
    logger.info("Seed data already exists, skipping.");
    return;
  }

  logger.info("Seeding database...");

  // Seed 6 organisations (mix Jamaica + UK)
  const orgs = await db
    .insert(organisationsTable)
    .values([
      {
        orgName: "Trench Town Youth Foundation",
        mission:
          "Empowering young people in Trench Town through education, sport and mentorship programmes.",
        location: "Trench Town, Kingston",
        country: "Jamaica",
        causeCategory: "Education",
        goalAmount: "15000.00",
        raisedAmount: "9240.00",
        distributedAmount: "7500.00",
        donorCount: 84,
        followerCount: 312,
        verified: true,
        helpOptedIn: true,
        helpServices: [
          "Food assistance",
          "School supplies",
          "Emergency housing",
        ],
        responseCommitment: "We respond within 24 hours on WhatsApp.",
        whatsappNumber: "+18761234567",
      },
      {
        orgName: "Westmoreland Farmers Collective",
        mission:
          "Supporting smallholder farmers in Westmoreland with seeds, equipment and market access.",
        location: "Savanna-la-Mar, Westmoreland",
        country: "Jamaica",
        causeCategory: "Agriculture",
        goalAmount: "10000.00",
        raisedAmount: "4100.00",
        distributedAmount: "3200.00",
        donorCount: 41,
        followerCount: 187,
        verified: true,
        helpOptedIn: true,
        helpServices: ["Farm inputs", "Market connections", "Training"],
        responseCommitment: "We respond within 48 hours.",
        whatsappNumber: "+18769876543",
      },
      {
        orgName: "Portland Women Rising",
        mission:
          "Building economic independence for women in rural Portland through craft, trade and digital skills.",
        location: "Port Antonio, Portland",
        country: "Jamaica",
        causeCategory: "Women Empowerment",
        goalAmount: "8000.00",
        raisedAmount: "5800.00",
        distributedAmount: "4900.00",
        donorCount: 63,
        followerCount: 224,
        verified: true,
        helpOptedIn: false,
        helpServices: [],
        responseCommitment: null,
        whatsappNumber: null,
      },
      {
        orgName: "Brixton Community Kitchen",
        mission:
          "Providing hot meals, community connection and food skills training to families in South London.",
        location: "Brixton, London",
        country: "United Kingdom",
        causeCategory: "Food Security",
        goalAmount: "20000.00",
        raisedAmount: "14300.00",
        distributedAmount: "12100.00",
        donorCount: 152,
        followerCount: 891,
        verified: true,
        helpOptedIn: true,
        helpServices: [
          "Emergency food parcels",
          "Meal delivery",
          "Cooking classes",
        ],
        responseCommitment: "We respond same day during working hours.",
        whatsappNumber: "+447700900123",
      },
      {
        orgName: "Manchester Diaspora Fund",
        mission:
          "Channelling Manchester diaspora giving directly to verified grassroots projects in Jamaica.",
        location: "Manchester, United Kingdom",
        country: "United Kingdom",
        causeCategory: "Community Development",
        goalAmount: "25000.00",
        raisedAmount: "18700.00",
        distributedAmount: "16200.00",
        donorCount: 203,
        followerCount: 1120,
        verified: true,
        helpOptedIn: true,
        helpServices: [
          "Grant applications",
          "Partnership introductions",
          "Funding advice",
        ],
        responseCommitment: "We reply within 2 working days.",
        whatsappNumber: "+447700900456",
      },
      {
        orgName: "St Elizabeth Children's Trust",
        mission:
          "Providing nutritional support, school fees and uniforms for vulnerable children in St Elizabeth.",
        location: "Black River, St Elizabeth",
        country: "Jamaica",
        causeCategory: "Child Welfare",
        goalAmount: "12000.00",
        raisedAmount: "7650.00",
        distributedAmount: "6400.00",
        donorCount: 77,
        followerCount: 443,
        verified: true,
        helpOptedIn: true,
        helpServices: [
          "School fee assistance",
          "School uniform drive",
          "Nutritional support",
          "Stationery packs",
        ],
        responseCommitment: "We respond within 24 hours.",
        whatsappNumber: "+18764561234",
      },
    ])
    .returning();

  logger.info(`Seeded ${orgs.length} organisations.`);

  // Seed 10 feed updates
  await db.insert(updatesTable).values([
    {
      orgId: orgs[0]!.id,
      title: "Summer Reading Camp — Week 1 Complete",
      body: "We wrapped up an incredible first week of our Summer Reading Camp with 48 young people from Trench Town. The energy in the room was electric. Kids who arrived saying they hated reading were sharing their favourite stories by Friday.",
      tag: "During",
      mediaUrls: [],
      sentToCount: 187,
    },
    {
      orgId: orgs[0]!.id,
      title: "New Computer Lab Opens",
      body: "Thanks to your generosity, we officially opened our brand new computer lab today — 12 refurbished machines, reliable internet, and a part-time facilitator. The first cohort of 15 young people start digital skills training next Monday.",
      tag: "After",
      mediaUrls: [],
      sentToCount: 312,
    },
    {
      orgId: orgs[1]!.id,
      title: "Seed Distribution Ready",
      body: "We have 200kg of high-yield sweet potato seedlings ready to distribute to 34 member farmers ahead of the planting season. Collection starts at the Savanna-la-Mar depot from Monday 7am.",
      tag: "Before",
      mediaUrls: [],
      sentToCount: 91,
    },
    {
      orgId: orgs[1]!.id,
      title: "Farmers Market Launch — First Weekend",
      body: "Our first Westmoreland Farmers Market drew over 600 visitors and generated JMD 1.2 million in direct sales for our members. We're doing it again next month. Thank you to every donor who made the infrastructure possible.",
      tag: "After",
      mediaUrls: [],
      sentToCount: 187,
    },
    {
      orgId: orgs[2]!.id,
      title: "Craft Export Deal Signed",
      body: "Portland Women Rising has signed a supply agreement with a UK-based craft retailer to stock our members' handwoven bags and pottery. This creates a guaranteed income stream for 18 women across our network.",
      tag: "After",
      mediaUrls: [],
      sentToCount: 224,
    },
    {
      orgId: orgs[3]!.id,
      title: "Christmas Dinner — 400 Guests Served",
      body: "This Christmas we served a hot three-course meal to 400 guests at Brixton Recreation Centre. Volunteers from 12 different countries cooked, served and washed up. This is what community looks like.",
      tag: "After",
      mediaUrls: [],
      sentToCount: 891,
    },
    {
      orgId: orgs[3]!.id,
      title: "Ramadan Night Kitchen Starting Soon",
      body: "We're preparing for our annual Ramadan Night Kitchen, providing iftar meals to 150 families across Lambeth every evening during Ramadan. Volunteer sign-ups are open now.",
      tag: "Before",
      mediaUrls: [],
      sentToCount: 540,
    },
    {
      orgId: orgs[4]!.id,
      title: "Third Cohort of Grants Disbursed",
      body: "The Manchester Diaspora Fund has disbursed the third cohort of community grants — GBP 32,000 across 7 verified grassroots projects in Jamaica and the UK. Detailed impact reports from each recipient are linked below.",
      tag: "After",
      mediaUrls: [],
      sentToCount: 1120,
    },
    {
      orgId: orgs[5]!.id,
      title: "Back to School Drive — 120 Packs Ready",
      body: "Your donations have funded 120 fully stocked back-to-school packs for children in St Elizabeth. Each pack includes exercise books, pens, rulers, and a school bag. Distribution begins Monday at Black River Primary.",
      tag: "Before",
      mediaUrls: [],
      sentToCount: 320,
    },
    {
      orgId: orgs[5]!.id,
      title: "School Fees Cleared for 42 Children",
      body: "Thanks to the generosity of our supporters, we have cleared outstanding school fees for 42 children who were at risk of exclusion. All 42 are confirmed back in class this term.",
      tag: "After",
      mediaUrls: [],
      sentToCount: 443,
    },
  ]);

  logger.info("Seeded updates.");

  // Seed 4 help reviews
  await db.insert(helpReviewsTable).values([
    {
      orgId: orgs[0]!.id,
      reviewerSession: "anon-session-001",
      reviewerName: "Anonymous",
      rating: 5,
      body: "They responded within the hour and connected us to emergency housing within 24 hours. I cannot thank them enough.",
      verifiedRecipient: true,
      flagged: false,
    },
    {
      orgId: orgs[3]!.id,
      reviewerSession: "anon-session-002",
      reviewerName: "Anonymous",
      rating: 5,
      body: "The food parcel arrived the next day. Fresh produce, tinned goods, pasta. Enough for two weeks. The team was kind and didn't make us feel judged.",
      verifiedRecipient: true,
      flagged: false,
    },
    {
      orgId: orgs[4]!.id,
      reviewerSession: "anon-session-003",
      reviewerName: "Anonymous",
      rating: 4,
      body: "Really helpful guidance on structuring our grant application. They were honest about what funders are looking for. Would recommend to any small organisation.",
      verifiedRecipient: false,
      flagged: false,
    },
    {
      orgId: orgs[5]!.id,
      reviewerSession: "anon-session-004",
      reviewerName: "Anonymous",
      rating: 5,
      body: "My daughter's school fees were about to expire. The Trust stepped in within two days. She is still in school. I don't have words.",
      verifiedRecipient: true,
      flagged: false,
    },
  ]);

  logger.info("Seeded help reviews.");

  // Seed 3 resources
  await db.insert(resourcesTable).values([
    {
      orgId: orgs[0]!.id,
      title: "Youth Programme Funding Guide",
      body: "A step-by-step guide to applying for youth development funding from UK and Jamaican government sources. Includes templates, eligibility criteria and key contacts.",
      category: "Funding",
    },
    {
      orgId: orgs[3]!.id,
      title: "Starting a Community Kitchen — What We Learned",
      body: "Our honest account of the first 18 months running Brixton Community Kitchen. Practical advice on food safety, volunteer management, funding, and partnership building.",
      category: "Operations",
    },
    {
      orgId: orgs[4]!.id,
      title: "Diaspora Giving — Tax Efficiency Guide",
      body: "How to maximise the impact of your charitable giving whether you're based in the UK, USA, Canada or the Caribbean. Covers Gift Aid, charitable status, and cross-border transfers.",
      category: "Finance",
    },
  ]);

  logger.info("Seeded resources.");
  logger.info("Database seeding complete.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  });
