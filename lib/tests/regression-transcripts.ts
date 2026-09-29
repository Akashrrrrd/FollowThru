/**
 * Regression Test Transcripts: 10+ Diverse Domains
 * 
 * Each transcript tests:
 * - Commitment extraction across different industries
 * - Owner identification (UUID + name)
 * - Date resolution ("by Friday", "by next Monday", "end of month")
 * - Clear commitment vs discussion boundaries
 * - Realistic language patterns (not scripted)
 */

export interface TestTranscript {
  domain: string;
  description: string;
  date: string; // ISO string YYYY-MM-DD
  dayOfWeek: string;
  participants: { name: string; uuid: string }[];
  transcript: string;
  expectedCommitments: {
    owner_name: string;
    owner_uuid: string;
    action: string;
    due_date_expression: string;
    expected_due_date?: string; // Will be calculated from date + expression
    is_commitment: boolean; // True if should be extracted, false if discussion
  }[];
}

// Meeting dates for testing (one per weekday)
const MEETING_DATES = {
  MONDAY_2026_09_28: "2026-09-28",
  TUESDAY_2026_09_29: "2026-09-29",
  WEDNESDAY_2026_09_30: "2026-09-30",
  THURSDAY_2026_10_01: "2026-10-01",
  FRIDAY_2026_10_02: "2026-10-02",
  SATURDAY_2026_10_03: "2026-10-03",
  SUNDAY_2026_10_04: "2026-10-04",
};

export const REGRESSION_TRANSCRIPTS: TestTranscript[] = [
  // ============================================================================
  // 1. OFFICE PLANNING - Standard Q4 Planning Session
  // ============================================================================
  {
    domain: "office-planning",
    description: "Q4 office space planning and vendor coordination",
    date: MEETING_DATES.TUESDAY_2026_09_29,
    dayOfWeek: "Tuesday",
    participants: [
      { name: "Sarah Chen", uuid: "uuid-sarah-chen-001" },
      { name: "Mike Johnson", uuid: "uuid-mike-johnson-001" },
      { name: "Lisa Park", uuid: "uuid-lisa-park-001" },
    ],
    transcript: `
Sarah: Alright everyone, thanks for joining. We need to finalize the office expansion plan by end of quarter.
Mike: I can handle the vendor coordination. I'll get quotes from three contractors by next Friday.
Sarah: Great. And Lisa, can you pull together the space requirements doc?
Lisa: Sure, I'll have that ready by Wednesday of next week. Also, we discussed maybe upgrading the kitchen, but that's still up in the air.
Mike: Should we talk about the parking situation? A lot of people have complained about it.
Sarah: Good point, but let's focus on the critical path items first. Mike, make sure those contractor quotes are solid—we need them before we can commit to a timeline.
Mike: Understood. By next Friday, you'll have three quotes with detailed breakdowns.
Lisa: And the space doc will have floor plans, capacity analysis, and cost estimates. Due by next Wednesday.
    `,
    expectedCommitments: [
      {
        owner_name: "Mike Johnson",
        owner_uuid: "uuid-mike-johnson-001",
        action: "get quotes from three contractors",
        due_date_expression: "by next Friday",
        is_commitment: true,
      },
      {
        owner_name: "Lisa Park",
        owner_uuid: "uuid-lisa-park-001",
        action: "pull together space requirements doc with floor plans and capacity analysis",
        due_date_expression: "by Wednesday of next week",
        is_commitment: true,
      },
      {
        owner_name: "everyone",
        owner_uuid: "",
        action: "upgrade the kitchen",
        due_date_expression: "unknown",
        is_commitment: false, // "still up in the air" = discussion, not commitment
      },
      {
        owner_name: "everyone",
        owner_uuid: "",
        action: "talk about parking situation",
        due_date_expression: "unknown",
        is_commitment: false, // Sarah deferred it; no owner, no date
      },
    ],
  },

  // ============================================================================
  // 2. WEBSITE MAINTENANCE - Bug fixes and feature requests
  // ============================================================================
  {
    domain: "website-maintenance",
    description: "Website maintenance sprint planning",
    date: MEETING_DATES.WEDNESDAY_2026_09_30,
    dayOfWeek: "Wednesday",
    participants: [
      { name: "Alex Rivera", uuid: "uuid-alex-rivera-001" },
      { name: "Jordan Smith", uuid: "uuid-jordan-smith-001" },
      { name: "Casey Wu", uuid: "uuid-casey-wu-001" },
    ],
    transcript: `
Alex: Let's tackle the website bugs from this week. Jordan, the contact form is down—can you fix that?
Jordan: Yeah, I saw the error logs. I'll get that patched by Friday EOD.
Casey: While we're at it, should we add SSL to the staging environment?
Alex: That would be nice, but it's not critical. Let's get the contact form working first.
Jordan: I'll also check for the XSS vulnerability on the profile page. Could be fixed by Saturday.
Alex: Good. Casey, I need you to update the privacy policy. We need that live before next month.
Casey: Okay, I'll draft the new policy and have it ready for review by next Friday. Then we'll need legal review, which could take another week.
Alex: Perfect. Let me know when it's ready and I'll coordinate with legal.
    `,
    expectedCommitments: [
      {
        owner_name: "Jordan Smith",
        owner_uuid: "uuid-jordan-smith-001",
        action: "fix contact form",
        due_date_expression: "by Friday EOD",
        is_commitment: true,
      },
      {
        owner_name: "Jordan Smith",
        owner_uuid: "uuid-jordan-smith-001",
        action: "check for XSS vulnerability on profile page",
        due_date_expression: "by Saturday",
        is_commitment: true,
      },
      {
        owner_name: "Casey Wu",
        owner_uuid: "uuid-casey-wu-001",
        action: "draft new privacy policy",
        due_date_expression: "by next Friday",
        is_commitment: true,
      },
      {
        owner_name: "everyone",
        owner_uuid: "",
        action: "add SSL to staging environment",
        due_date_expression: "unknown",
        is_commitment: false, // Alex said "not critical"; deferred
      },
    ],
  },

  // ============================================================================
  // 3. MARKETING CAMPAIGN - Launch coordination
  // ============================================================================
  {
    domain: "marketing-campaign",
    description: "Black Friday marketing campaign planning",
    date: MEETING_DATES.THURSDAY_2026_10_01,
    dayOfWeek: "Thursday",
    participants: [
      { name: "Emma Thompson", uuid: "uuid-emma-thompson-001" },
      { name: "David Lee", uuid: "uuid-david-lee-001" },
      { name: "Priya Patel", uuid: "uuid-priya-patel-001" },
    ],
    transcript: `
Emma: Alright, we're 8 weeks out from Black Friday. I need to nail down the campaign messaging.
David: I can get the creative assets finalized. I'll need the final copy by next Wednesday.
Emma: I'll have that ready by next Tuesday. All three ad variants and email subject lines.
Priya: I'll set up the landing page and promotional logic in the system. That should be done by the 15th of next month.
David: Sounds good. Once Emma gives me the copy, I can turn around the visuals in about 3 days.
Emma: We should probably coordinate with Sales on the discount tiers at some point. We've been meaning to revisit those.
Priya: True, but let's focus on the campaign first. David, once you have the assets, send them to me for QA before we go live.
Emma: Perfect. So to recap: I'll do copy by next Tuesday, David gets assets to Priya by October 15th, and Priya goes live by end of October.
    `,
    expectedCommitments: [
      {
        owner_name: "Emma Thompson",
        owner_uuid: "uuid-emma-thompson-001",
        action: "finalize campaign messaging and copy (all three ad variants and email subject lines)",
        due_date_expression: "by next Tuesday",
        is_commitment: true,
      },
      {
        owner_name: "David Lee",
        owner_uuid: "uuid-david-lee-001",
        action: "create creative assets and visuals",
        due_date_expression: "by October 15th",
        is_commitment: true,
      },
      {
        owner_name: "Priya Patel",
        owner_uuid: "uuid-priya-patel-001",
        action: "set up landing page and promotional logic; QA assets",
        due_date_expression: "by end of October",
        is_commitment: true,
      },
      {
        owner_name: "everyone",
        owner_uuid: "",
        action: "coordinate with Sales on discount tiers",
        due_date_expression: "unknown",
        is_commitment: false, // "been meaning to"; no owner, no date
      },
    ],
  },

  // ============================================================================
  // 4. NEGATIVE TEST - Requests vs Commitments (No false positives)
  // ============================================================================
  {
    domain: "negative-test-requests",
    description: "Distinguish between requests and actual commitments",
    date: MEETING_DATES.FRIDAY_2026_10_02,
    dayOfWeek: "Friday",
    participants: [
      { name: "Tom Brady", uuid: "uuid-tom-brady-001" },
      { name: "Nina Gerstenfeld", uuid: "uuid-nina-gerstenfeld-001" },
    ],
    transcript: `
Tom: Hey Nina, could you maybe look at the database performance issue when you get a chance?
Nina: Yeah, I could take a look. But I've got the authentication module due by tomorrow. Not sure when I'll get to it.
Tom: Totally understand. No rush. Maybe we could find someone else?
Nina: I mean, I'll try, but I can't promise anything. Database performance isn't really my strength anyway.
Tom: Fair enough. We should probably hire someone who specializes in database optimization.
Nina: Yeah, we've been thinking about that for a while. Would be good to have that skillset in-house.
Tom: You know, someone told me that Redis caching could solve 80% of our performance problems.
Nina: Maybe, but I'd need to actually profile the database to see what's slow. That's a whole investigation.
    `,
    expectedCommitments: [
      // This transcript should have ZERO commitments
      // "could you maybe look" + "not sure when" = no commitment
      // "I'll try but can't promise" = no commitment
      // "should probably hire" = aspirational, not committed
      // "been thinking about" = discussion, not commitment
    ],
  },

  // ============================================================================
  // 5. MOBILE APP RELEASE - Phased rollout
  // ============================================================================
  {
    domain: "mobile-app-release",
    description: "Mobile app phased rollout coordination",
    date: MEETING_DATES.MONDAY_2026_09_28,
    dayOfWeek: "Monday",
    participants: [
      { name: "Raj Patel", uuid: "uuid-raj-patel-001" },
      { name: "Sophia Martinez", uuid: "uuid-sophia-martinez-001" },
      { name: "Klaus Schmidt", uuid: "uuid-klaus-schmidt-001" },
    ],
    transcript: `
Raj: We're targeting next month for the iOS app release. Sophia, where are we on the App Store submission?
Sophia: I'm getting the final compliance checks done today. I'll submit to App Store by Monday.
Raj: Excellent. Klaus, how's the beta testing coming?
Klaus: Beta is almost wrapped. I've got about 20 bugs still to triage. I'll have the final report with prioritization by next Wednesday.
Sophia: Once I submit, it'll be about a week for Apple's review. So we're looking at mid-October for approval.
Raj: And once approved, Klaus handles the staged rollout?
Klaus: Yeah, I'll start with 1% of users on Monday, October 14th. Then scale up to 10% by Wednesday, 50% by Friday, and full rollout the following Monday.
Sophia: I'll keep monitoring crash reports. If anything critical comes up, I can push an emergency fix.
Raj: Good. So Sophia: App Store submission by next Monday. Klaus: beta report by next Wednesday, then staged rollout starting October 14th.
    `,
    expectedCommitments: [
      {
        owner_name: "Sophia Martinez",
        owner_uuid: "uuid-sophia-martinez-001",
        action: "submit iOS app to App Store",
        due_date_expression: "by Monday",
        is_commitment: true,
      },
      {
        owner_name: "Klaus Schmidt",
        owner_uuid: "uuid-klaus-schmidt-001",
        action: "finalize beta testing and provide prioritized bug report",
        due_date_expression: "by next Wednesday",
        is_commitment: true,
      },
      {
        owner_name: "Klaus Schmidt",
        owner_uuid: "uuid-klaus-schmidt-001",
        action: "execute staged rollout (1% Monday, 10% Wednesday, 50% Friday, 100% next Monday)",
        due_date_expression: "starting October 14th",
        is_commitment: true,
      },
      {
        owner_name: "Sophia Martinez",
        owner_uuid: "uuid-sophia-martinez-001",
        action: "monitor crash reports and push emergency fixes if needed",
        due_date_expression: "ongoing",
        is_commitment: true,
      },
    ],
  },

  // ============================================================================
  // 6. CONFERENCE PLANNING - Logistics and speakers
  // ============================================================================
  {
    domain: "conference-planning",
    description: "Annual tech conference planning",
    date: MEETING_DATES.TUESDAY_2026_09_29,
    dayOfWeek: "Tuesday",
    participants: [
      { name: "Andrea Chen", uuid: "uuid-andrea-chen-001" },
      { name: "Robert Wilson", uuid: "uuid-robert-wilson-001" },
      { name: "Yuki Tanaka", uuid: "uuid-yuki-tanaka-001" },
    ],
    transcript: `
Andrea: We're three months out from the conference. Robert, how are the speaker confirmations going?
Robert: I've got 70% confirmed so far. I'll have the final speaker list locked in by end of October.
Andrea: That's cutting it close for the schedule printing. We need the list by October 20th.
Robert: I can try to accelerate. I'll prioritize the remaining confirmations and have the list by October 18th.
Yuki: I'm working on the venue contract. There are a few terms we still need to negotiate with the hotel.
Andrea: When do you think you'll have that finalized?
Yuki: If we move quickly on this, I can get it signed by next Friday. Otherwise, maybe two weeks out.
Andrea: Let's aim for next Friday. We need that locked to finalize the catering numbers.
Robert: Once the venue is confirmed, I can coordinate with speakers on logistics like AV requirements.
Yuki: Alright, I'll prioritize the contract negotiations. Next Friday for signature.
Andrea: Perfect. Robert: speaker list by October 18th. Yuki: venue contract signed by next Friday. Robert, once the venue is locked, coordinate speaker logistics.
    `,
    expectedCommitments: [
      {
        owner_name: "Robert Wilson",
        owner_uuid: "uuid-robert-wilson-001",
        action: "finalize speaker list and confirmations",
        due_date_expression: "by October 18th",
        is_commitment: true,
      },
      {
        owner_name: "Yuki Tanaka",
        owner_uuid: "uuid-yuki-tanaka-001",
        action: "finalize and sign venue contract",
        due_date_expression: "by next Friday",
        is_commitment: true,
      },
      {
        owner_name: "Robert Wilson",
        owner_uuid: "uuid-robert-wilson-001",
        action: "coordinate with speakers on logistics and AV requirements (after venue confirmation)",
        due_date_expression: "after venue confirmed",
        is_commitment: true,
      },
    ],
  },

  // ============================================================================
  // 7. HOSPITAL IT - HIPAA-compliant system upgrade
  // ============================================================================
  {
    domain: "hospital-it",
    description: "Hospital IT system upgrade with compliance requirements",
    date: MEETING_DATES.WEDNESDAY_2026_09_30,
    dayOfWeek: "Wednesday",
    participants: [
      { name: "Dr. James Adams", uuid: "uuid-james-adams-001" },
      { name: "Patricia Chen", uuid: "uuid-patricia-chen-001" },
      { name: "Marcus Johnson", uuid: "uuid-marcus-johnson-001" },
    ],
    transcript: `
Dr. Adams: We need to upgrade our EHR system to be HIPAA compliant before the audit next month.
Patricia: I've been working on the infrastructure. I'll have the security assessment completed by next Wednesday.
Dr. Adams: Good. Marcus, where are we on staff training?
Marcus: I'm developing the training modules. I'll have them ready for pilot training by the 20th of next month.
Dr. Adams: We need to make sure all staff is trained before we go live. Patricia, once the security assessment is done, can you coordinate with the audit team?
Patricia: Absolutely. I'll send the assessment to the auditors by the following Monday.
Dr. Adams: And Marcus, after the pilot training, we'll do a full staff training rollout. Timeline?
Marcus: Full rollout by the 1st of November, assuming the pilot goes well.
Patricia: One more thing—we need to test data migration from the old system. I'll do that in parallel with the security assessment. Complete by October 15th.
    `,
    expectedCommitments: [
      {
        owner_name: "Patricia Chen",
        owner_uuid: "uuid-patricia-chen-001",
        action: "complete security assessment for HIPAA compliance",
        due_date_expression: "by next Wednesday",
        is_commitment: true,
      },
      {
        owner_name: "Marcus Johnson",
        owner_uuid: "uuid-marcus-johnson-001",
        action: "develop and finalize staff training modules",
        due_date_expression: "by October 20th",
        is_commitment: true,
      },
      {
        owner_name: "Patricia Chen",
        owner_uuid: "uuid-patricia-chen-001",
        action: "send security assessment to audit team",
        due_date_expression: "by the following Monday",
        is_commitment: true,
      },
      {
        owner_name: "Patricia Chen",
        owner_uuid: "uuid-patricia-chen-001",
        action: "test data migration from old system",
        due_date_expression: "by October 15th",
        is_commitment: true,
      },
      {
        owner_name: "Marcus Johnson",
        owner_uuid: "uuid-marcus-johnson-001",
        action: "conduct full staff training rollout",
        due_date_expression: "by November 1st",
        is_commitment: true,
      },
    ],
  },

  // ============================================================================
  // 8. E-COMMERCE RELAUNCH - Platform migration
  // ============================================================================
  {
    domain: "ecommerce-relaunch",
    description: "E-commerce platform migration and relaunch",
    date: MEETING_DATES.THURSDAY_2026_10_01,
    dayOfWeek: "Thursday",
    participants: [
      { name: "Aisha Williams", uuid: "uuid-aisha-williams-001" },
      { name: "Chen Liu", uuid: "uuid-chen-liu-001" },
      { name: "Emma Garcia", uuid: "uuid-emma-garcia-001" },
    ],
    transcript: `
Aisha: Alright, we're relaunching the e-commerce platform next month. Chen, how's the data migration?
Chen: I'm extracting customer data from the old system. I'll have the migration scripts ready by next week, October 8th.
Aisha: Good. Emma, product catalog?
Emma: I'm doing a full audit and cleanup of the product catalog. I'll have the updated catalog with all corrections and new products by October 10th.
Chen: Once I have the migration scripts and the product catalog, I can do a test migration in the staging environment.
Aisha: When can you have the full test migration done?
Chen: By October 12th, assuming I get the data from Emma by the 10th.
Emma: I'll make sure you get it. Also, we need to update all the product descriptions. That's going to take a while.
Aisha: How long?
Emma: At least a month if I do it solo. I'll need someone to help me parallelize it.
Aisha: I can help with that. Let's plan to have all descriptions updated by October 31st.
Chen: Once we have the test migration working, I'll coordinate with the DevOps team on the production cutover. That's scheduled for November 3rd.
Aisha: Perfect. Chen: migration scripts by October 8th, test migration by October 12th, production cutover November 3rd. Emma: product catalog by October 10th, descriptions by October 31st.
    `,
    expectedCommitments: [
      {
        owner_name: "Chen Liu",
        owner_uuid: "uuid-chen-liu-001",
        action: "prepare data migration scripts for customer data from old system",
        due_date_expression: "by October 8th",
        is_commitment: true,
      },
      {
        owner_name: "Emma Garcia",
        owner_uuid: "uuid-emma-garcia-001",
        action: "complete product catalog audit, cleanup, and corrections",
        due_date_expression: "by October 10th",
        is_commitment: true,
      },
      {
        owner_name: "Chen Liu",
        owner_uuid: "uuid-chen-liu-001",
        action: "execute test migration in staging environment",
        due_date_expression: "by October 12th",
        is_commitment: true,
      },
      {
        owner_name: "Emma Garcia",
        owner_uuid: "uuid-emma-garcia-001",
        action: "update all product descriptions",
        due_date_expression: "by October 31st",
        is_commitment: true,
      },
      {
        owner_name: "Aisha Williams",
        owner_uuid: "uuid-aisha-williams-001",
        action: "help Emma update product descriptions",
        due_date_expression: "by October 31st",
        is_commitment: true,
      },
      {
        owner_name: "Chen Liu",
        owner_uuid: "uuid-chen-liu-001",
        action: "coordinate production cutover with DevOps team",
        due_date_expression: "by November 3rd",
        is_commitment: true,
      },
    ],
  },

  // ============================================================================
  // 9. MOBILE BANKING APP - Security and features
  // ============================================================================
  {
    domain: "mobile-banking",
    description: "Mobile banking app security hardening and feature development",
    date: MEETING_DATES.FRIDAY_2026_10_02,
    dayOfWeek: "Friday",
    participants: [
      { name: "Vikram Desai", uuid: "uuid-vikram-desai-001" },
      { name: "Leah Cohen", uuid: "uuid-leah-cohen-001" },
      { name: "Mohammad Hassan", uuid: "uuid-mohammad-hassan-001" },
    ],
    transcript: `
Vikram: Security audit came back with some findings. Leah, I need you to prioritize the critical ones.
Leah: I've already started on those. The encryption implementation needs rework. I'll have that done by next Friday.
Vikram: Good. Mohammad, how's the biometric auth feature coming?
Mohammad: Making good progress. I'll have the basic implementation done by October 15th, but it'll need some polish.
Leah: Once you have the basic implementation, I'll do a security review. That'll take a few days.
Mohammad: Sure. I'll send it to you on the 16th, so you can review by the 20th?
Leah: I can do that. But I'll also need to integrate it with the backend authentication service. Vikram, who owns that?
Vikram: That's with the backend team. I'll coordinate with them to have the integration ready by October 25th.
Mohammad: And once the biometric auth is integrated, we can release it in beta by early November.
Leah: Before we do that, I want to run a penetration test on the entire flow. That'll need to happen by October 30th.
Vikram: Perfect. Leah: encryption rework by next Friday, security review of biometric auth by October 20th, penetration test by October 30th. Mohammad: biometric implementation by October 15th. I'll coordinate backend integration by October 25th.
    `,
    expectedCommitments: [
      {
        owner_name: "Leah Cohen",
        owner_uuid: "uuid-leah-cohen-001",
        action: "rework encryption implementation",
        due_date_expression: "by next Friday",
        is_commitment: true,
      },
      {
        owner_name: "Mohammad Hassan",
        owner_uuid: "uuid-mohammad-hassan-001",
        action: "implement biometric authentication feature (basic)",
        due_date_expression: "by October 15th",
        is_commitment: true,
      },
      {
        owner_name: "Leah Cohen",
        owner_uuid: "uuid-leah-cohen-001",
        action: "perform security review of biometric auth implementation",
        due_date_expression: "by October 20th",
        is_commitment: true,
      },
      {
        owner_name: "Vikram Desai",
        owner_uuid: "uuid-vikram-desai-001",
        action: "coordinate backend authentication service integration with biometric auth",
        due_date_expression: "by October 25th",
        is_commitment: true,
      },
      {
        owner_name: "Leah Cohen",
        owner_uuid: "uuid-leah-cohen-001",
        action: "run penetration test on entire biometric auth flow",
        due_date_expression: "by October 30th",
        is_commitment: true,
      },
    ],
  },

  // ============================================================================
  // 10. PRODUCT LAUNCH - Cross-functional coordination
  // ============================================================================
  {
    domain: "product-launch",
    description: "Product launch with cross-functional team coordination",
    date: MEETING_DATES.MONDAY_2026_09_28,
    dayOfWeek: "Monday",
    participants: [
      { name: "Susan Shaw", uuid: "uuid-susan-shaw-001" },
      { name: "Brian Foster", uuid: "uuid-brian-foster-001" },
      { name: "Diana Ross", uuid: "uuid-diana-ross-001" },
    ],
    transcript: `
Susan: We're launching the new analytics dashboard in two weeks. Let's lock down the timeline.
Brian: Engineering is on track. I'll have the beta build ready by next Monday. Then we need Sales and Marketing to test.
Susan: Diana, can you coordinate the go-to-market strategy?
Diana: I'm working on it. I'll have the GTM deck and sales collateral ready by October 10th.
Susan: That gives us time to brief the sales team before launch. When's the launch date?
Brian: If we stick to the plan, October 20th goes live for 10% of customers, full rollout by October 25th.
Diana: I'll coordinate the press release and media outreach. I'll send the draft press release by October 12th.
Susan: Good. And we need to prepare customer success for the inbound questions. Brian, can you document the FAQ?
Brian: Sure, I'll have that ready by October 18th, so customer success has a few days to prepare.
Diana: Once the press release is out, I'll monitor media mentions and coordinate responses with our comms team.
Susan: Perfect. So: Brian, beta build by next Monday, FAQ by October 18th. Diana, GTM deck by October 10th, press release by October 12th. And Diana, you'll monitor media coverage post-launch.
    `,
    expectedCommitments: [
      {
        owner_name: "Brian Foster",
        owner_uuid: "uuid-brian-foster-001",
        action: "prepare beta build of analytics dashboard",
        due_date_expression: "by next Monday",
        is_commitment: true,
      },
      {
        owner_name: "Diana Ross",
        owner_uuid: "uuid-diana-ross-001",
        action: "finalize go-to-market strategy and sales collateral",
        due_date_expression: "by October 10th",
        is_commitment: true,
      },
      {
        owner_name: "Diana Ross",
        owner_uuid: "uuid-diana-ross-001",
        action: "draft and finalize press release",
        due_date_expression: "by October 12th",
        is_commitment: true,
      },
      {
        owner_name: "Brian Foster",
        owner_uuid: "uuid-brian-foster-001",
        action: "document FAQ for analytics dashboard",
        due_date_expression: "by October 18th",
        is_commitment: true,
      },
      {
        owner_name: "Diana Ross",
        owner_uuid: "uuid-diana-ross-001",
        action: "monitor media coverage and coordinate responses with comms team post-launch",
        due_date_expression: "post-launch",
        is_commitment: true,
      },
    ],
  },

  // ============================================================================
  // 11. MULTI-OWNER SCENARIO - "Alice and Bob will..."
  // ============================================================================
  {
    domain: "multi-owner-coordination",
    description: "Commitment shared between multiple people",
    date: MEETING_DATES.TUESDAY_2026_09_29,
    dayOfWeek: "Tuesday",
    participants: [
      { name: "Alice Wong", uuid: "uuid-alice-wong-001" },
      { name: "Bob Martinez", uuid: "uuid-bob-martinez-001" },
      { name: "Carol Singh", uuid: "uuid-carol-singh-001" },
    ],
    transcript: `
Carol: We need to prepare for the client demo. Alice and Bob, can you both work on the demo script and walkthrough?
Alice: Sure, Bob and I can collaborate on that. We'll have a solid demo script ready by Friday.
Bob: Yeah, we'll split the work. I'll handle the technical flow, Alice will do the narrative.
Carol: Perfect. And you'll both be present at the demo next week?
Alice: Absolutely, we'll both be there to co-present.
    `,
    expectedCommitments: [
      {
        owner_name: "Alice Wong",
        owner_uuid: "uuid-alice-wong-001",
        action: "prepare demo script and walkthrough (with Bob)",
        due_date_expression: "by Friday",
        is_commitment: true,
      },
      {
        owner_name: "Bob Martinez",
        owner_uuid: "uuid-bob-martinez-001",
        action: "prepare demo script and walkthrough (with Alice)",
        due_date_expression: "by Friday",
        is_commitment: true,
      },
      {
        owner_name: "Alice Wong",
        owner_uuid: "uuid-alice-wong-001",
        action: "co-present at client demo",
        due_date_expression: "next week",
        is_commitment: true,
      },
      {
        owner_name: "Bob Martinez",
        owner_uuid: "uuid-bob-martinez-001",
        action: "co-present at client demo",
        due_date_expression: "next week",
        is_commitment: true,
      },
    ],
  },
];
