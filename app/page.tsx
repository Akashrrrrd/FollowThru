import Link from 'next/link';
import { ArrowRight, FileSearch, CheckSquare, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  {
    icon: FileSearch,
    title: 'Extract',
    description: 'AI reads your transcript and pulls out every commitment automatically.',
  },
  {
    icon: CheckSquare,
    title: 'Track',
    description: 'See all action items on one dashboard with owners and due dates.',
  },
  {
    icon: Bell,
    title: 'Remind',
    description: 'Overdue tasks are flagged automatically so nothing slips through.',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-24 pb-20 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Turn meeting talk into
          <br />
          <span className="text-blue-600">tracked action.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-500">
          Paste any meeting transcript and FollowThru uses AI to extract every
          commitment — with owners, deadlines, and the exact quote it came from.
        </p>
        <div className="mt-10">
          <Link href="/new">
            <Button size="lg" className="bg-blue-600 text-white hover:bg-blue-700">
              Try it now
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-100 bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid grid-cols-1 gap-12 sm:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
                    <Icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-gray-400">
          FollowThru — AI-powered meeting accountability
        </div>
      </footer>
    </div>
  );
}
