# Loading Animations Guide for FollowThru

Professional, classic loading states that match the FollowThru brand aesthetic with gold accents and elegant design.

## Components Overview

### 1. **LoadingSpinner** (Primary Loader)
The main loading indicator with gold accent. Perfect for full-page or section loads.

**Props:**
- `size`: `'sm' | 'md' | 'lg'` (default: `'md'`)
- `message`: Optional text to display below spinner

**Usage:**
```tsx
import { LoadingSpinner } from "@/components/loading";

export function MyPage() {
  return <LoadingSpinner size="md" message="Loading..." />;
}
```

**Best for:**
- Page transitions
- Data fetching
- Initial page load

---

### 2. **LoadingPulse** (Subtle Animation)
Three pulsing dots with customizable colors. Great for non-intrusive loading states.

**Props:**
- `message`: Optional text to display
- `variant`: `'gold' | 'primary' | 'muted'` (default: `'gold'`)

**Usage:**
```tsx
import { LoadingPulse } from "@/components/loading";

export function SearchResults() {
  return <LoadingPulse message="Searching..." variant="gold" />;
}
```

**Best for:**
- Search/filter operations
- Background processing
- Subtle state indicators

---

### 3. **LoadingBar** (Progress Animation)
Animated gradient bar simulating progress. Use when operation duration is uncertain.

**Props:**
- `message`: Optional text to display

**Usage:**
```tsx
import { LoadingBar } from "@/components/loading";

export function Upload() {
  return <LoadingBar message="Processing transcript..." />;
}
```

**Best for:**
- File uploads
- Long-running operations
- Processing states

---

### 4. **LoadingMini** (Button/Inline)
Compact spinner for use inside buttons or inline with text.

**Usage:**
```tsx
import { LoadingMini } from "@/components/loading";
import { useState } from "react";

export function SubmitButton() {
  const [loading, setLoading] = useState(false);

  return (
    <button disabled={loading} className="btn btn-primary gap-2">
      {loading && <LoadingMini />}
      {loading ? "Submitting..." : "Submit"}
    </button>
  );
}
```

**Best for:**
- Button loading states
- Inline operations
- Compact spaces

---

### 5. **LoadingOverlay** (Full Screen)
Full-screen overlay with configurable loading indicator.

**Props:**
- `isLoading`: Toggle visibility (default: `true`)
- `message`: Optional text
- `variant`: `'spinner' | 'pulse' | 'bar'` (default: `'spinner'`)

**Usage:**
```tsx
import { LoadingOverlay } from "@/components/loading";
import { useState } from "react";

export function MeetingExtract() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // API call
      await extractMeeting();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <LoadingOverlay
        isLoading={loading}
        message="Extracting commitments..."
        variant="spinner"
      />
      <button onClick={handleSubmit}>Extract</button>
    </>
  );
}
```

**Best for:**
- Critical operations
- Form submissions
- Meeting extraction

---

### 6. **LoadingContent** (Skeleton Placeholders)
Placeholder skeleton for content loading.

**Usage:**
```tsx
import { LoadingContent } from "@/components/loading";

export function TaskList({ isLoading }) {
  if (isLoading) return <LoadingContent />;
  return <TaskListContent />;
}
```

**Best for:**
- Content placeholders
- List items
- Card skeletons

---

## Design Principles

### Color Scheme
- **Gold** (`bg-gold`): Primary brand color, used for emphasis
- **Primary** (`bg-primary`): Ink navy, secondary indicator
- **Muted** (`bg-muted-foreground`): Subtle, low-priority states

### Animation Timings
- **Spinner**: 1s continuous rotation
- **Pulse**: 2s ease-in-out pulse
- **Bar**: 2s shimmer effect
- **Bounce**: 1.5s subtle lift

### Accessibility
- All animations respect `prefers-reduced-motion`
- Clear messaging with optional descriptive text
- High contrast for visibility

---

## Integration Examples

### Example 1: Page Loading
```tsx
"use client";

import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/loading";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="container-classic section-classic flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" message="Loading dashboard..." />
      </div>
    );
  }

  return <Dashboard data={data} />;
}
```

### Example 2: Button Loading
```tsx
"use client";

import { LoadingMini } from "@/components/loading";
import { useState } from "react";

export function ExtractButton() {
  const [loading, setLoading] = useState(false);

  const handleExtract = async () => {
    setLoading(true);
    try {
      await api.extractMeeting();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExtract}
      disabled={loading}
      className="btn btn-gold"
    >
      {loading ? (
        <>
          <LoadingMini />
          Extracting...
        </>
      ) : (
        "Extract Commitments"
      )}
    </button>
  );
}
```

### Example 3: Overlay for Critical Operations
```tsx
"use client";

import { LoadingOverlay } from "@/components/loading";
import { useState } from "react";

export function MeetingForm() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.processMeeting();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <LoadingOverlay
        isLoading={loading}
        message="Processing your meeting..."
        variant="spinner"
      />
      <input type="file" />
      <button type="submit" disabled={loading}>
        Upload
      </button>
    </form>
  );
}
```

### Example 4: Search with Pulse
```tsx
"use client";

import { LoadingPulse } from "@/components/loading";
import { useState } from "react";

export function SearchTasks() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (q: string) => {
    setSearching(true);
    try {
      const data = await api.search(q);
      setResults(data);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Search tasks..."
        onChange={(e) => handleSearch(e.target.value)}
      />
      {searching ? (
        <LoadingPulse message="Searching..." variant="gold" />
      ) : (
        <Results results={results} />
      )}
    </div>
  );
}
```

---

## Styling & Customization

### CSS Classes
All components use Tailwind CSS and respect your theme tokens:

- `text-gold` - Brand gold color
- `animate-spin` - Rotation animation
- `animate-pulse` - Pulse effect
- `animate-shimmer` - Shimmer effect
- `animate-bounce-subtle` - Subtle bounce

### Dark Mode
All components automatically adapt to dark mode via the `dark:` prefix in Tailwind.

### Custom Variants
To create custom loading states, extend the `keyframes` in `tailwind.config.ts`:

```ts
extend: {
  keyframes: {
    'custom-load': {
      '0%': { transform: 'scale(0.95)', opacity: '0' },
      '50%': { opacity: '1' },
      '100%': { transform: 'scale(1)', opacity: '1' },
    }
  },
  animation: {
    'custom-load': 'custom-load 0.6s ease-out'
  }
}
```

---

## Performance Tips

1. **Lazy load components**: Only render loaders when needed
2. **Use `LoadingMini` for buttons**: Minimal DOM impact
3. **Set reasonable timeouts**: Prevent indefinite loading states
4. **Combine with error boundaries**: Show errors gracefully
5. **Test with reduced motion**: Ensure accessibility

---

## Browser Support
- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Full support

---

## See It Live
Visit `/loading-showcase` to see all loading animations in action and view code examples.