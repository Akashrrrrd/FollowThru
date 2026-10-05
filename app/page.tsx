import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  FileSearch,
  CheckSquare,
  Bell,
  Users,
  Zap,
  Shield,
  BarChart3,
  GitBranch,
  Quote,
  Link2,
  UserCheck,
  Network,
  Crown,
  Check,
  Lock,
} from 'lucide-react';

/* ----------------------------- Content ----------------------------- */

const glance = [
  { value: '4', label: 'Dashboard levels' },
  { value: '3', label: 'Confidence ratings' },
  { value: '3', label: 'Transcript formats' },
  { value: '4', label: 'Status stages' },
];

const features = [
  {
    icon: FileSearch,
    title: 'AI-powered extraction',
    description: 'Every commitment in a transcript, with the owner, deadline, and the exact quote.',
    points: ['Natural-language deadlines like “by Friday”', 'High, medium, or low confidence on each item', 'Exact source quotes for verification'],
  },
  {
    icon: CheckSquare,
    title: 'Smart commitment tracking',
    description: 'One dashboard for every commitment across every meeting.',
    points: ['Open, in progress, blocked, completed', 'Filter by owner, deadline, status, or confidence', 'Drill into meetings, teams, or people'],
  },
  {
    icon: Bell,
    title: 'Intelligent reminders',
    description: 'Nudges before deadlines slip, not after.',
    points: ['Upcoming-deadline reminders', 'Overdue alerts', 'Email updates with actionable links'],
  },
  {
    icon: Users,
    title: 'Team organization',
    description: 'Structure your company into teams with clear accountability.',
    points: ['Owner, manager, team lead, and member roles', 'Email invitations with a role attached', 'Everyone starts in a default General team'],
  },
  {
    icon: BarChart3,
    title: 'Analytics and reporting',
    description: 'See how teams and people follow through over time.',
    points: ['Completion and on-time delivery rates', 'Overdue counts per person and team', 'Organization-wide executive reports'],
  },
  {
    icon: Zap,
    title: 'Flexible transcript input',
    description: 'Bring meetings in the way that suits you today.',
    points: ['Paste a transcript directly', 'Upload TXT, VTT, or SRT files', 'Add a meeting title for context'],
  },
];

const capabilities = [
  { icon: GitBranch, title: 'Commitment continuity', description: 'Follow a commitment across meetings. Related items are linked and marked as continued, so you see its full history from creation to completion.' },
  { icon: Shield, title: 'Hallucination protection', description: 'Each extraction is checked against the meeting content. Low-confidence items go to manual review, and every item shows its source quote.' },
  { icon: Link2, title: 'Dependency management', description: 'Record which commitments depend on others, see what is blocking progress, and prioritize along dependency chains.' },
  { icon: UserCheck, title: 'Owner resolution', description: 'Participant names are matched to team members, including nicknames and variations. Ambiguous cases can be overridden by hand.' },
  { icon: Network, title: 'Team-level resolution', description: 'Commitments are assigned to the team that needs to deliver them, with commitment distribution and metrics shown per team.' },
  { icon: Crown, title: 'Team lead identification', description: 'Leaders are identified in meetings and their commitments flagged, showing the chain from individual to team to organization.' },
];

const pipeline = ['Extract', 'Verify', 'Resolve owner', 'Assign team', 'Link history', 'Track'];

const continuity = [
  { meeting: 'Meeting 1', text: 'I’ll prepare the budget by end of month.', status: 'New' },
  { meeting: 'Meeting 2', text: 'I’ll review the budget.', status: 'Continued' },
  { meeting: 'Meeting 3', text: 'Budget review is complete, let’s implement it.', status: 'Completed' },
];

const roles = [
  { title: 'Individuals', view: 'Personal dashboard', points: ['Commitments extracted from your meetings', 'Reminders and overdue alerts', 'A historical record of what you committed to'] },
  { title: 'Team leads', view: 'Team dashboard', points: ['Every team member’s commitments at a glance', 'Blocked and overdue items surfaced', 'Patterns and systemic issues'] },
  { title: 'Managers', view: 'Cross-team dashboard', points: ['Compare accountability across teams', 'Drill down to individual commitments', 'Performance trends for commitment assignments'] },
  { title: 'Executives', view: 'Organization dashboard', points: ['How well the company follows through', 'Teams and people with high delivery', 'Metrics to report to stakeholders'] },
];

const steps = [
  { title: 'Upload', description: 'Paste a transcript or upload a TXT, VTT, or SRT file.' },
  { title: 'Extract', description: 'AI pulls out commitments, owners, deadlines, and quotes.' },
  { title: 'Review', description: 'Check owners and details, edit, and assign teams.' },
  { title: 'Track', description: 'Update status and get reminders as deadlines near.' },
  { title: 'Report', description: 'Team leads, managers, and executives see accountability.' },
];

const integrations = [
  { name: 'Transcript upload', note: 'TXT, VTT, SRT, or paste', available: true },
  { name: 'Zoom', note: 'Automatic meeting capture', available: false },
  { name: 'Microsoft Teams', note: 'Capture calls and meetings', available: false },
  { name: 'Calendar sync', note: 'Detect meetings automatically', available: false },
];

const security = [
  { title: 'Organization isolation', description: 'Only people in the same organization can see each other’s data.' },
  { title: 'Role-based access', description: 'Owner, manager, team lead, and member roles control who can view and edit.' },
  { title: 'Row-level security', description: 'Database policies enforce access on every query.' },
  { title: 'Encrypted in transit', description: 'All traffic uses TLS, with authenticated, token-based API access.' },
  { title: 'Rate-limited sign-up', description: 'Sign-up attempts are throttled to prevent abuse.' },
  { title: 'You own your data', description: 'Organizations own their commitment data; people own their profiles.' },
];

const roadmap = [
  'Real-time meeting transcription',
  'Google Calendar and Outlook sync',
  'Slack bot',
  'Multi-language support',
  'Custom commitment types',
  'Advanced reporting',
  'Public API',
  'Mobile apps',
  'Jira, Asana, and Notion sync',
  'HubSpot and Salesforce',
];

const faqs = [
  { q: 'Can I try FollowThru without signing up?', a: 'Yes. Open the demo, load the sample transcript, and extract commitments with no account. Sign in when you want to save results.' },
  { q: 'How do you keep the AI from inventing commitments?', a: 'Every extraction is checked against the meeting text and given a confidence rating. Each commitment links to its exact quote, and low-confidence items are flagged for manual review.' },
  { q: 'What transcript formats can I use?', a: 'Paste text directly, or upload TXT, VTT, or SRT files.' },
  { q: 'Who can see my commitments?', a: 'Only people in your organization, and only what their role allows. Owners, managers, team leads, and members each get different views.' },
  { q: 'Do I need to set up teams first?', a: 'No. Everyone is added to a default General team. You can create more teams and invite people by email whenever you’re ready.' },
  { q: 'What happens when someone repeats a commitment in a later meeting?', a: 'FollowThru links it to the earlier one and marks it as continued, so the history stays in one place.' },
];

/* ----------------------------- Shared UI ----------------------------- */

const primaryButton =
  'inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';
const secondaryButton =
  'inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';

function SectionHead({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="font-serif text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      {intro && <p className="mt-4 text-lg leading-8 text-slate-600">{intro}</p>}
    </div>
  );
}

function Tick({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${light ? 'text-blue-300' : 'text-blue-600'}`} aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

/* ------------------------------- Page ------------------------------- */

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Hero */}
      <section className="border-b border-slate-200 bg-slate-50 px-4 pb-16 pt-20 sm:pt-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <h1 className="font-serif text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.5rem]">
                Turn meeting talk into tracked action
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
                FollowThru uses AI to extract every commitment from your meeting transcripts, assign owners and
                deadlines, and track accountability across teams and over time.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link href="/signup" className={primaryButton}>
                  Get started
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/new" className={secondaryButton}>
                  Try demo, no sign-in
                </Link>
              </div>
            </div>

            <figure
              aria-label="Example of a commitment extracted from a meeting transcript"
              className="mx-auto w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_32px_-12px_rgba(16,24,40,0.12)]"
            >
              <div className="border-b border-slate-200 px-5 py-3">
                <p className="text-sm font-medium">Q3 planning sync</p>
                <p className="text-xs text-slate-500">Transcript, 42 minutes</p>
              </div>
              <div className="px-5 py-5">
                <p className="text-xs font-medium text-slate-500">From the transcript</p>
                <blockquote className="mt-2 border-l-2 border-blue-600 pl-4 text-sm leading-relaxed text-slate-700">
                  “I’ll send the revised pricing deck to Priya by Friday, once finance signs off.”
                </blockquote>
                <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">Send revised pricing deck to Priya</p>
                    <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      Open
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
                    {[['Owner', 'Maya'], ['Due', 'Friday'], ['Confidence', 'High']].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-slate-500">{k}</dt>
                        <dd className="mt-0.5 font-medium text-slate-800">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                    <Quote className="h-3 w-3" aria-hidden="true" />
                    Linked to the exact quote
                  </p>
                </div>
              </div>
            </figure>
          </div>

          <dl className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-4">
            {glance.map((s) => (
              <div key={s.label} className="bg-white px-6 py-6 text-center">
                <dd className="font-serif text-3xl font-semibold">{s.value}</dd>
                <dt className="mt-1 text-sm text-slate-600">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Problem and solution */}
      <section className="px-4 py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2 md:gap-16">
          <div>
            <h2 className="font-serif text-2xl font-semibold sm:text-3xl">The problem</h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Commitments made in meetings get lost. Follow-ups are missed, and accountability fades once the call ends.
            </p>
          </div>
          <div className="md:border-l md:border-slate-200 md:pl-16">
            <h2 className="font-serif text-2xl font-semibold sm:text-3xl">What FollowThru does</h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              It captures every commitment, assigns an owner, tracks progress, and keeps accountability visible across
              your team, so there are fewer meetings about meetings.
            </p>
          </div>
        </div>
      </section>

      {/* Core features */}
      <section id="features" className="scroll-mt-20 border-t border-slate-200 px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            title="Everything you need to stay accountable"
            intro="From extraction to executive reporting, one place to follow up on what was agreed."
          />
          <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="bg-white p-8">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-100 bg-blue-50">
                    <Icon className="h-5 w-5 text-blue-600" strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-base font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.description}</p>
                  <ul className="mt-4 space-y-2 text-sm text-slate-600">
                    {f.points.map((p) => (
                      <Tick key={p}>{p}</Tick>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-slate-200 bg-slate-50 px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHead title="How FollowThru works" />
          <ol className="relative mt-14 grid gap-10 md:grid-cols-5">
            <div className="absolute left-0 right-0 top-5 hidden h-px bg-slate-300 md:block" aria-hidden="true" />
            {steps.map((s, i) => (
              <li key={s.title} className="relative">
                <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-blue-600 bg-slate-50 text-sm font-semibold text-blue-600">
                  {i + 1}
                </div>
                <h3 className="mt-5 text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Advanced capabilities */}
      <section id="capabilities" className="scroll-mt-20 px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            title="Built for accountability that holds up"
            intro="Every commitment passes through the same checks before it reaches a dashboard."
          />

          <ol className="mt-10 flex flex-wrap gap-y-3 text-sm">
            {pipeline.map((p, i) => (
              <li key={p} className="flex items-center">
                <span className="rounded-full border border-slate-300 bg-white px-3.5 py-1.5 font-medium text-slate-800">{p}</span>
                {i < pipeline.length - 1 && <ArrowRight className="mx-2 h-4 w-4 text-slate-400" aria-hidden="true" />}
              </li>
            ))}
          </ol>

          <div className="mt-14 grid gap-10 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.title} className="border-t-2 border-blue-600 pt-6">
                  <Icon className="h-6 w-6 text-blue-600" strokeWidth={1.75} aria-hidden="true" />
                  <h3 className="mt-4 text-base font-semibold">{c.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.description}</p>
                </div>
              );
            })}
          </div>

          {/* Continuity example */}
          <div className="mt-16 rounded-lg border border-slate-200 bg-slate-50 p-6 sm:p-8">
            <h3 className="text-base font-semibold">Continuity in practice</h3>
            <p className="mt-1 text-sm text-slate-600">One commitment, followed across three meetings.</p>
            <ol className="mt-6 space-y-5 border-l border-slate-300 pl-6">
              {continuity.map((c) => (
                <li key={c.meeting} className="relative">
                  <span className="absolute -left-[1.9rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-blue-600 bg-slate-50" aria-hidden="true" />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-xs font-medium text-slate-500">{c.meeting}</span>
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">{c.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-800">“{c.text}”</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="scroll-mt-20 bg-[#1F3A5F] px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-2xl font-serif text-3xl font-semibold text-white sm:text-4xl">A view for every level</h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
            From a single contributor to the whole company, each role gets the dashboard it needs.
          </p>
          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-white/15">
            {roles.map((r) => (
              <div key={r.title} className="lg:px-8 lg:first:pl-0 lg:last:pr-0">
                <h3 className="font-serif text-xl font-semibold text-white">{r.title}</h3>
                <p className="mt-1 text-sm text-blue-200">{r.view}</p>
                <ul className="mt-5 space-y-3 text-sm text-white">
                  {r.points.map((p) => (
                    <Tick key={p} light>
                      {p}
                    </Tick>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="scroll-mt-20 px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            title="Bring meetings in your way"
            intro="Start with a transcript today. Platform and calendar connections are on the way."
          />
          <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            {integrations.map((i) => (
              <div key={i.name} className="bg-white p-6">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                    i.available ? 'border-green-200 bg-green-50 text-green-700' : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {i.available ? 'Available' : 'Coming soon'}
                </span>
                <h3 className="mt-4 text-base font-semibold">{i.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{i.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="scroll-mt-20 border-y border-slate-200 bg-slate-50 px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            title="Private by design"
            intro="Access follows your organization and your role, enforced at the database level."
          />
          <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {security.map((s) => (
              <div key={s.title} className="flex gap-4">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" strokeWidth={1.75} aria-hidden="true" />
                <div>
                  <h3 className="text-base font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section id="roadmap" className="scroll-mt-20 px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHead title="What’s next" intro="Planned features, not yet available." />
          <ul className="mt-10 flex flex-wrap gap-3">
            {roadmap.map((r) => (
              <li key={r} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700">
                {r}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-slate-200 bg-slate-50 px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl">
          <SectionHead title="Frequently asked questions" />
          <div className="mt-10 border-t border-slate-200">
            {faqs.map((f) => (
              <details key={f.q} className="group border-b border-slate-200 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="text-xl leading-none text-slate-400 transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Ready to stay accountable?</h2>
          <p className="mx-auto mt-5 text-lg leading-8 text-slate-600">
            Create an account in minutes, or try the demo first with no sign-in.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/signup" className={primaryButton}>
              Get started
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/new" className={secondaryButton}>
              Try demo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-12">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-10 grid grid-cols-2 gap-8 sm:grid-cols-4">
            {[
              { h: 'Product', links: [['Features', '#features'], ['How it works', '#how-it-works'], ['Try demo', '/new'], ['Sign up', '/signup']] },
              { h: 'Learn', links: [['Security', '#security'], ['Roadmap', '#roadmap'], ['FAQ', '#faq']] },
              { h: 'Legal', links: [['Privacy', '#'], ['Terms', '#']] },
              { h: 'Contact', links: [['Support', 'mailto:followthruai@gmail.com'], ['Feedback', 'mailto:followthruai@gmail.com']] },
            ].map((col) => (
              <div key={col.h}>
                <h4 className="text-sm font-semibold">{col.h}</h4>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  {col.links.map(([label, href]) => (
                    <li key={label}>
                      {href.startsWith('/') ? (
                        <Link href={href} className="hover:text-blue-600">{label}</Link>
                      ) : (
                        <a href={href} className="hover:text-blue-600">{label}</a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-200 pt-8 text-center text-sm text-slate-600">
            <p>© {new Date().getFullYear()} FollowThru. Helping teams and individuals follow through on what they commit to.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}