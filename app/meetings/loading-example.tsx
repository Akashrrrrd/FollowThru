"use client";

import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/loading";
import { Card } from "@/components/ui/card";

interface Meeting {
  id: string;
  title: string;
  date: string;
  commitmentCount: number;
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate API call
    const timer = setTimeout(() => {
      setMeetings([
        {
          id: "1",
          title: "Q4 Planning Meeting",
          date: "Oct 1, 2026",
          commitmentCount: 8,
        },
        {
          id: "2",
          title: "Product Roadmap Review",
          date: "Oct 2, 2026",
          commitmentCount: 5,
        },
      ]);
      setLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="container-classic section-classic flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" message="Loading your meetings..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-classic section-classic">
        <div className="alert-classic" data-tone="danger">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container-classic section-classic">
      <h1 className="mb-8">Meetings</h1>
      <div className="grid gap-4">
        {meetings.map((meeting) => (
          <Card
            key={meeting.id}
            className="p-6 hover:shadow-lg transition-shadow"
          >
            <h3 className="font-semibold mb-2">{meeting.title}</h3>
            <p className="text-sm text-muted-foreground">{meeting.date}</p>
            <p className="text-sm mt-2">
              {meeting.commitmentCount} commitments
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}