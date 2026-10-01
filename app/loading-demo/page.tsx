'use client';

import { useState } from 'react';
import {
  LoadingExtraction,
  LoadingSpinner,
  LoadingPulse,
  LoadingBar,
  LoadingMini,
  LoadingTaskCards,
  LoadingOverlay,
} from '@/components/loading';
import { Button } from '@/components/ui/button';

export default function LoadingDemoPage() {
  const [showOverlay, setShowOverlay] = useState(false);
  const [showExtraction, setShowExtraction] = useState(false);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-12">
        <h1 className="text-3xl font-bold mb-2">Loading Animations Demo</h1>
        <p className="text-gray-600 mb-8">
          Click buttons below to see different loading states in action
        </p>
      </div>

      {/* Controls */}
      <div className="mb-12 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="font-semibold mb-3">Full-Screen Overlays</h3>
          <div className="space-y-2">
            <Button
              onClick={() => setShowOverlay(true)}
              className="w-full bg-blue-600 text-white hover:bg-blue-700"
            >
              Show Loading Overlay
            </Button>
            <Button
              onClick={() => setShowExtraction(true)}
              className="w-full bg-green-600 text-white hover:bg-green-700"
            >
              Show Extraction Steps
            </Button>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-3">Learn More</h3>
          <p className="text-sm text-gray-600">
            These loaders appear automatically when:
            <ul className="mt-2 ml-4 list-disc space-y-1 text-sm">
              <li>Processing meeting transcripts</li>
              <li>Loading dashboard tasks</li>
              <li>Fetching meetings list</li>
              <li>Any API operation</li>
            </ul>
          </p>
        </div>
      </div>

      {/* Spinners */}
      <div className="mb-12 rounded-lg border bg-white p-8">
        <h2 className="mb-8 text-xl font-bold">Spinner (Primary)</h2>
        <div className="grid gap-12 md:grid-cols-3">
          <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 p-8">
            <LoadingSpinner size="sm" />
            <p className="mt-4 text-xs text-gray-600">Small</p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 p-8">
            <LoadingSpinner size="md" />
            <p className="mt-4 text-xs text-gray-600">Medium (Default)</p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 p-8">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-xs text-gray-600">Large</p>
          </div>
        </div>
      </div>

      {/* With Messages */}
      <div className="mb-12 rounded-lg border bg-white p-8">
        <h2 className="mb-8 text-xl font-bold">With Messages</h2>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="flex justify-center rounded-lg border border-gray-200 p-8">
            <LoadingSpinner message="Extracting commitments..." />
          </div>
          <div className="flex justify-center rounded-lg border border-gray-200 p-8">
            <LoadingPulse message="Processing data..." />
          </div>
        </div>
      </div>

      {/* Pulse Variants */}
      <div className="mb-12 rounded-lg border bg-white p-8">
        <h2 className="mb-8 text-xl font-bold">Pulse (Subtle)</h2>
        <div className="grid gap-8 md:grid-cols-3">
          <div className="flex justify-center rounded-lg border border-gray-200 p-8">
            <LoadingPulse variant="primary" />
            <p className="mt-4 text-xs text-gray-600">Primary</p>
          </div>
          <div className="flex justify-center rounded-lg border border-gray-200 p-8">
            <LoadingPulse variant="gold" />
            <p className="mt-4 text-xs text-gray-600">Gold</p>
          </div>
          <div className="flex justify-center rounded-lg border border-gray-200 p-8">
            <LoadingPulse variant="muted" />
            <p className="mt-4 text-xs text-gray-600">Muted</p>
          </div>
        </div>
      </div>

      {/* Loading Bar */}
      <div className="mb-12 rounded-lg border bg-white p-8">
        <h2 className="mb-8 text-xl font-bold">Progress Bar Animation</h2>
        <div className="flex justify-center rounded-lg border border-gray-200 p-8">
          <LoadingBar message="Processing file..." />
        </div>
      </div>

      {/* Mini Loader */}
      <div className="mb-12 rounded-lg border bg-white p-8">
        <h2 className="mb-8 text-xl font-bold">Mini (For Buttons)</h2>
        <div className="flex gap-4">
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
            <LoadingMini />
            Processing...
          </Button>
          <Button variant="outline" className="gap-2">
            <LoadingMini />
            Loading...
          </Button>
        </div>
      </div>

      {/* Task Cards Skeleton */}
      <div className="mb-12 rounded-lg border bg-white p-8">
        <h2 className="mb-8 text-xl font-bold">Task Cards Skeleton</h2>
        <p className="mb-6 text-sm text-gray-600">
          This is what users see while tasks are loading on dashboard and meetings pages:
        </p>
        <LoadingTaskCards count={4} />
      </div>

      {/* Extraction Steps */}
      <div className="mb-12 rounded-lg border bg-white p-8">
        <h2 className="mb-8 text-xl font-bold">Extraction Steps</h2>
        <p className="mb-6 text-sm text-gray-600">
          This appears during meeting transcript analysis:
        </p>
        <div className="flex justify-center">
          <LoadingExtraction />
        </div>
      </div>

      {/* Overlay Trigger */}
      {showOverlay && (
        <LoadingOverlay
          isLoading={true}
          message="Processing your request..."
          variant="spinner"
        />
      )}
      {showOverlay && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
          <div className="rounded-lg bg-white p-8 text-center">
            <p className="mb-4 font-semibold">Overlay is showing!</p>
            <Button
              onClick={() => setShowOverlay(false)}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Close Overlay
            </Button>
          </div>
        </div>
      )}

      {/* Extraction Trigger */}
      {showExtraction && (
        <LoadingOverlay
          isLoading={true}
          message="Analyzing your transcript..."
          variant="spinner"
        />
      )}
      {showExtraction && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
          <div className="rounded-lg bg-white p-8 text-center">
            <LoadingExtraction />
            <Button
              onClick={() => setShowExtraction(false)}
              className="mt-8 bg-blue-600 text-white hover:bg-blue-700"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
        <h3 className="font-semibold text-blue-900 mb-2">How these loaders work:</h3>
        <ul className="text-sm text-blue-800 space-y-1 ml-4 list-disc">
          <li><strong>LoadingExtraction</strong> → Shows during meeting analysis (4 steps)</li>
          <li><strong>LoadingTaskCards</strong> → Skeleton cards while loading tasks/meetings</li>
          <li><strong>LoadingSpinner</strong> → Classic rotating spinner with message</li>
          <li><strong>LoadingPulse</strong> → 3 pulsing dots, subtle animation</li>
          <li><strong>LoadingBar</strong> → Animated progress bar</li>
          <li><strong>LoadingMini</strong> → Small spinner for buttons and inline use</li>
        </ul>
      </div>
    </div>
  );
}
