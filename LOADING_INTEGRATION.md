# Loading Animation Integration Guide

This guide shows how to integrate the loading animations throughout your FollowThru application.

## Quick Start

### 1. Import the component you need
```tsx
import { LoadingSpinner, LoadingMini, LoadingOverlay } from "@/components/loading";
```

### 2. Choose the right loader for your use case:
- **Page/Section loading** → `LoadingSpinner`
- **Button/inline** → `LoadingMini`
- **Critical operations** → `LoadingOverlay`
- **Search/filter** → `LoadingPulse`
- **File upload** → `LoadingBar`

### 3. Implement in your component

---

## Real-World Integration Examples

### Meeting Extraction (Most Important)
**File**: `app/api/meetings/extract/route.ts`

```tsx
"use client";

import { LoadingOverlay, LoadingSpinner } from "@/components/loading";
import { useState } from "react";

export function MeetingExtractForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (transcript: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/meetings/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });

      if (!response.ok) throw new Error("Extraction failed");
      const data = await response.json();
      // Handle success
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <LoadingOverlay
        isLoading={loading}
        message="Extracting commitments from your meeting..."
        variant="spinner"
      />
      <form onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        handleSubmit(formData.get("transcript") as string);
      }}>
        <textarea name="transcript" placeholder="Paste meeting transcript..." />
        <button type="submit" disabled={loading}>
          Extract Commitments
        </button>
      </form>
      {error && <div className="alert-classic" data-tone="danger">{error}</div>}
    </>
  );
}
```

---

### Dashboard Page Load
**File**: `app/dashboard/page.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/loading";
import { PageError } from "@/components/page-loading";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await fetch("/api/dashboard");
        if (!response.ok) throw new Error("Failed to load dashboard");
        const data = await response.json();
        setData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  // Show spinner during initial load
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" message="Loading your dashboard..." />
      </div>
    );
  }

  // Show error state
  if (error) {
    return <PageError message={error} />;
  }

  // Render dashboard content
  return (
    <div className="container-classic section-classic">
      <h1>Dashboard</h1>
      {/* Your dashboard content */}
    </div>
  );
}
```

---

### Tasks Page with Loading
**File**: `app/new/page.tsx`

```tsx
"use client";

import { LoadingPulse, LoadingMini } from "@/components/loading";
import { useState } from "react";

export default function NewTaskPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAddTask = async (task: { title: string; dueDate: string }) => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
      });
      const newTask = await response.json();
      setTasks([...tasks, newTask]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-classic section-classic">
      <h1 className="mb-8">New Task</h1>

      <form onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        handleAddTask({
          title: formData.get("title") as string,
          dueDate: formData.get("dueDate") as string,
        });
      }}>
        <input type="text" name="title" placeholder="Task title" />
        <input type="date" name="dueDate" />

        <button type="submit" disabled={submitting} className="btn btn-primary">
          {submitting ? (
            <>
              <LoadingMini />
              Creating...
            </>
          ) : (
            "Create Task"
          )}
        </button>
      </form>
    </div>
  );
}
```

---

### Meetings List with Loading
**File**: `app/meetings/page.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { LoadingSpinner, LoadingPulse } from "@/components/loading";
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
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const response = await fetch("/api/meetings");
        const data = await response.json();
        setMeetings(data);
      } finally {
        setLoading(false);
      }
    };

    fetchMeetings();
  }, []);

  const handleSearch = async (query: string) => {
    setSearching(true);
    try {
      const response = await fetch(`/api/meetings/search?q=${query}`);
      const data = await response.json();
      setMeetings(data);
    } finally {
      setSearching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner message="Loading your meetings..." />
      </div>
    );
  }

  return (
    <div className="container-classic section-classic">
      <h1 className="mb-8">Meetings</h1>

      <div className="mb-8">
        <input
          type="search"
          placeholder="Search meetings..."
          onChange={(e) => handleSearch(e.target.value)}
          className="field"
        />
        {searching && <LoadingPulse message="Searching..." variant="gold" />}
      </div>

      <div className="grid gap-4">
        {meetings.map((meeting) => (
          <Card key={meeting.id} className="p-6">
            <h3 className="font-semibold">{meeting.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{meeting.date}</p>
            <p className="text-sm mt-2">{meeting.commitmentCount} commitments</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

---

### Profile/Settings Update
**File**: `app/profile/page.tsx`

```tsx
"use client";

import { LoadingMini } from "@/components/loading";
import { useState } from "react";

export default function ProfilePage() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async (formData: FormData) => {
    setSaving(true);
    setSaved(false);

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        body: formData,
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000); // Hide after 3s
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-classic section-classic">
      <h1 className="mb-8">Profile Settings</h1>

      <form onSubmit={(e) => {
        e.preventDefault();
        handleSave(new FormData(e.currentTarget));
      }}>
        <div className="space-y-6">
          <div>
            <label className="label-classic">Full Name</label>
            <input type="text" name="fullName" className="field" />
          </div>

          <div>
            <label className="label-classic">Email</label>
            <input type="email" name="email" className="field" />
          </div>

          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? (
              <>
                <LoadingMini />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>

          {saved && (
            <div className="alert-classic" data-tone="success">
              Profile updated successfully!
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
```

---

### Insights/Analytics Page
**File**: `app/insights/page.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/loading";

export default function InsightsPage() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const response = await fetch("/api/insights");
        const data = await response.json();
        setInsights(data);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" message="Analyzing your commitments..." />
      </div>
    );
  }

  return (
    <div className="container-classic section-classic">
      <h1 className="mb-8">Insights</h1>
      {/* Render insights */}
    </div>
  );
}
```

---

## Best Practices

### 1. Always provide context
```tsx
// ❌ Don't
<LoadingSpinner />

// ✅ Do
<LoadingSpinner message="Extracting commitments..." />
```

### 2. Handle errors gracefully
```tsx
const [error, setError] = useState<string | null>(null);

if (error) return <PageError message={error} />;
if (loading) return <LoadingSpinner />;
return <Content />;
```

### 3. Set reasonable timeouts
```tsx
// Prevent indefinite loading
const timeout = setTimeout(() => {
  setError("Request timed out");
  setLoading(false);
}, 30000); // 30 seconds
```

### 4. Disable interactions during loading
```tsx
<button disabled={loading || submitting}>
  {loading ? "Loading..." : "Submit"}
</button>
```

### 5. Test with reduced motion
Users with `prefers-reduced-motion` should see reduced animation. This is built-in via `globals.css`.

---

## Accessibility Checklist

- ✅ All animations respect `prefers-reduced-motion`
- ✅ Loading messages are clear and descriptive
- ✅ Buttons are disabled during loading (prevents double-submit)
- ✅ Error states are clearly communicated
- ✅ Color is not the only indicator (includes text)
- ✅ Sufficient contrast for visibility

---

## Customization

Want to match a specific brand color? Update the variant prop:

```tsx
// Use brand gold
<LoadingSpinner variant="gold" />

// Use primary ink color
<LoadingSpinner variant="primary" />

// Use muted color
<LoadingSpinner variant="muted" />
```

Or extend in `tailwind.config.ts` for custom animations.

---

## Testing

Test loading states with Cypress or React Testing Library:

```tsx
// Check loading state appears
render(<MyComponent />);
expect(screen.getByText(/loading/i)).toBeInTheDocument();

// Check loading state disappears
await waitFor(() => {
  expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
});
```

---

**Next Steps**: Visit `/loading-showcase` to see all animations live!