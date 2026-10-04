import Link from 'next/link';
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
  Mail
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  {
    icon: FileSearch,
    title: 'AI-Powered Extraction',
    description: 'Automatically extract every commitment from meeting transcripts with owner, deadline, and exact quotes.',
    color: 'blue',
  },
  {
    icon: CheckSquare,
    title: 'Smart Task Tracking',
    description: 'Track all commitments on a unified dashboard with real-time status updates and progress indicators.',
    color: 'green',
  },
  {
    icon: Bell,
    title: 'Intelligent Reminders',
    description: 'Get automatic nudges for upcoming deadlines and alerts for overdue tasks before they become problems.',
    color: 'orange',
  },
  {
    icon: Users,
    title: 'Team Organization',
    description: 'Organize your company into teams, assign accountability, and track team performance metrics.',
    color: 'purple',
  },
  {
    icon: BarChart3,
    title: 'Team Dashboards',
    description: 'View team lead and manager dashboards with drill-down capabilities and performance analytics.',
    color: 'indigo',
  },
  {
    icon: Zap,
    title: 'Meeting Integrations',
    description: 'Seamlessly integrate with Zoom, Teams, and other platforms for automatic meeting capture.',
    color: 'yellow',
  },
];

const capabilities = [
  {
    icon: GitBranch,
    title: 'Commitment Continuity',
    description: 'Track how commitments evolve across meetings, detect patterns, and maintain accountability over time.',
  },
  {
    icon: Shield,
    title: 'Hallucination Protection',
    description: 'Advanced AI verification ensures extracted commitments are accurate and grounded in actual meeting content.',
  },
  {
    icon: Mail,
    title: 'Team Invitations',
    description: 'Invite team members via email, manage roles, and collaborate seamlessly across your organization.',
  },
];

const stats = [
  { label: 'Commitments Tracked', value: '10,000+' },
  { label: 'Organizations', value: '500+' },
  { label: 'Team Members', value: '5,000+' },
  { label: 'Meetings Processed', value: '2,000+' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl">
              Turn meeting talk into
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                tracked action
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600">
              FollowThru uses AI to extract every commitment from meeting transcripts — 
              with owners, deadlines, exact quotes, and team-wide accountability tracking.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/signup">
                <Button size="lg" className="bg-blue-600 text-white hover:bg-blue-700">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/new">
                <Button size="lg" variant="outline" className="border-gray-300">
                  Try Demo
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 gap-8 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold text-blue-600">{stat.value}</p>
                <p className="mt-2 text-sm text-gray-600">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="border-t border-gray-100 bg-white px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to stay accountable
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
              From AI extraction to team management, FollowThru provides a complete solution for meeting accountability.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              const colorClasses = {
                blue: 'bg-blue-50 text-blue-600',
                green: 'bg-green-50 text-green-600',
                orange: 'bg-orange-50 text-orange-600',
                purple: 'bg-purple-50 text-purple-600',
                indigo: 'bg-indigo-50 text-indigo-600',
                yellow: 'bg-yellow-50 text-yellow-600',
              };

              return (
                <div
                  key={feature.title}
                  className="rounded-lg border border-gray-100 bg-white p-8 hover:shadow-lg transition-shadow"
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-lg ${colorClasses[feature.color as keyof typeof colorClasses]}`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Advanced Capabilities */}
      <section className="bg-gray-50 px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Advanced capabilities
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
              Built for enterprise-grade accountability and team collaboration.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {capabilities.map((capability) => {
              const Icon = capability.icon;
              return (
                <div key={capability.title} className="rounded-lg bg-white p-8 border border-gray-100">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-50">
                    <Icon className="h-6 w-6 text-indigo-600" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">
                    {capability.title}
                  </h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                    {capability.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              How FollowThru works
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
            {[
              { step: '1', title: 'Upload', description: 'Paste meeting transcript or connect your calendar' },
              { step: '2', title: 'Extract', description: 'AI analyzes and extracts all commitments' },
              { step: '3', title: 'Organize', description: 'Assign owners and teams, set deadlines' },
              { step: '4', title: 'Track', description: 'Monitor progress and get reminders' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
                  {item.step}
                </div>
                <h3 className="mt-6 text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Highlight */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold text-white">
                For Teams & Organizations
              </h2>
              <p className="mt-4 text-lg text-blue-100">
                Manage multiple teams, track organizational performance, and ensure accountability across your entire company.
              </p>
              <ul className="mt-6 space-y-3 text-white">
                <li className="flex items-center">
                  <CheckSquare className="mr-3 h-5 w-5" />
                  Team management and role-based access
                </li>
                <li className="flex items-center">
                  <CheckSquare className="mr-3 h-5 w-5" />
                  Executive dashboards and analytics
                </li>
                <li className="flex items-center">
                  <CheckSquare className="mr-3 h-5 w-5" />
                  Performance tracking and reporting
                </li>
              </ul>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">
                For Individuals
              </h2>
              <p className="mt-4 text-lg text-blue-100">
                Never miss a commitment again. Track your personal tasks and stay on top of deadlines effortlessly.
              </p>
              <ul className="mt-6 space-y-3 text-white">
                <li className="flex items-center">
                  <CheckSquare className="mr-3 h-5 w-5" />
                  AI-extracted action items from meetings
                </li>
                <li className="flex items-center">
                  <CheckSquare className="mr-3 h-5 w-5" />
                  Smart reminders and overdue alerts
                </li>
                <li className="flex items-center">
                  <CheckSquare className="mr-3 h-5 w-5" />
                  Integration with your calendar
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Ready to stay accountable?
          </h2>
          <p className="mx-auto mt-6 text-lg text-gray-600">
            Start using FollowThru today and transform how your team manages commitments.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="bg-blue-600 text-white hover:bg-blue-700">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-gray-50 py-12">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 mb-8">
            <div>
              <h4 className="font-semibold text-gray-900">Product</h4>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li><Link href="/new" className="hover:text-blue-600">Try Demo</Link></li>
                <li><Link href="/signup" className="hover:text-blue-600">Sign Up</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Company</h4>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li><a href="mailto:followthruai@gmail.com" className="hover:text-blue-600">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Legal</h4>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-blue-600">Privacy</a></li>
                <li><a href="#" className="hover:text-blue-600">Terms</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Help</h4>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li><a href="mailto:followthruai@gmail.com" className="hover:text-blue-600">Support</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 text-center text-sm text-gray-600">
            <p>© 2024 FollowThru. All rights reserved. AI-powered meeting accountability.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
