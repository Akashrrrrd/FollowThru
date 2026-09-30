import type { ExtractedCommitment } from './types';

const SYSTEM_PROMPT = `Extract ONLY genuine commitments from meeting transcripts.

A COMMITMENT is a concrete execution responsibility:
- Explicit: "I'll do X", "I will do X", "Sure, I'll do X"
- Collective: "Let's do X", "We'll do X" (where speaker commits to concrete action)
- Acceptance: "Yes, I'll do X"

NOT commitments (EXCLUDE these):
- Requests: "Can you..." (unless explicitly accepted)
- Discussions: "Let's discuss X", "We'll talk about X" (planning to discuss, not doing something concrete)
- Decisions: "Let's decide...", "We'll decide...", "Let's wait..."
- Generic responsibility statements: "Let's make sure everyone knows X", "Make sure everyone is aware", "Everyone needs to know", "We should make sure everyone knows" - THESE ARE NOT COMMITMENTS
- Future meetings: "We can discuss later"
- Go/no-go discussions: "We'll review and decide" (review + decide together)
- General future meetings: "We'll meet to discuss X"
- Suggestions: "Maybe we..."
- Questions: "Should we..."

IMPORTANT DISTINCTION:
- "Let's review the proposal" (no deadline) → likely discussion, NOT a commitment
- "We'll review the proposal by Friday" (specific deadline) → concrete scheduled commitment ✓
- "We'll discuss the proposal tomorrow" → discussion only, NOT a commitment
- "We'll finalize the launch plan next Wednesday" → concrete scheduled commitment ✓
- "We'll review the complete relaunch readiness next Wednesday" → concrete scheduled commitment ✓

KEY RULE: If "review", "finalize", "prepare", "check", "test", "update", "send", etc. has a SPECIFIC DATE/TIME with scheduled action intent, it IS a commitment. If it's vague/open-ended or explicitly "review AND decide", it's NOT.

Hint: Look for these patterns to identify concrete commitments:
- Action verb + specific deadline (date/time) = commitment
- Action verb + vague/no deadline + "discuss/decide" = NOT commitment
- Context of being a scheduled review/verification = commitment

OWNER = person who commits (NOT who requests)

DESCRIPTION = action to take (be concise)

SOURCE_QUOTE = exact sentence from transcript

CONCRETE vs DISCUSSION examples:
[YES] "I'll prepare the report by Friday" → commitment, concrete deliverable
[YES] "Let's finalize the checklist today" → commitment, concrete deliverable
[YES] "We'll review the complete relaunch readiness next Wednesday" → commitment, scheduled verification
[YES] "We'll check the mobile performance by end of week" → commitment, scheduled check
[NO] "We'll discuss the report tomorrow" → NOT a commitment, discussion only
[NO] "Let's review and decide on the proposal" → NOT a commitment, review+decide discussion
[NO] "Let's make sure everyone knows their responsibilities" → NOT a commitment, awareness only
[NO] "Let's wait until the review is done, then decide" → NOT a commitment
[NO] "We'll review and determine if we launch" → NOT a commitment, review+determine discussion

OUTPUT JSON ONLY:
[{
  "owner": "Name",
  "description": "Action (no filler words)",
  "due_date": "Expression from transcript or null",
  "source_quote": "Exact sentence",
  "confidence": "high|medium|low",
  "dependency": "text or null",
  "commitment_type": "explicit|collective|acceptance"
}]

DUE_DATE CRITICAL RULES:
1. If speaker mentions a timeframe, copy it EXACTLY AS SPOKEN - preserve temporal expressions
2. Return the PHRASE/EXPRESSION from the transcript, not a calculated date
3. NEVER return calculated dates like "2026-10-06"
4. ALWAYS return spoken phrases like "tomorrow", "next Wednesday", "in two weeks", "by Friday", "end of week"
5. Meeting is {MEETING_DATE} ({MEETING_DAY}) - use this ONLY for context, not to calculate dates
6. The application will resolve temporal expressions to actual dates using its date resolver

Examples of correct due_date values:
[YES] "tomorrow"
[YES] "Wednesday"
[YES] "next Monday"
[YES] "next Wednesday"
[YES] "by Friday"
[YES] "in 2 weeks"
[YES] "in two weeks"
[YES] "end of week"
[YES] "2026-10-05" (if explicitly stated as YYYY-MM-DD in transcript)
[NO] "2026-10-06" (calculated date - do NOT return this)
[NO] "Oct 6" (reformatted - return as spoken)

If no date mentioned → due_date: null
If date is conditional/dependent → due_date: null

CONFIDENCE:
- high: "I'll", "I will", explicit and clear
- medium: "Let's", "We'll", collective but genuine commitment
- low: "I can", "We should", ambiguous or tentative

COMMITMENT TYPES:
- explicit: Individual commits ("I'll...")
- collective: Group commits ("Let's...", "We'll...") - only if concrete deliverable
- acceptance: Accepts a request ("Sure, I'll...")

DEPENDENCY:
- Extract if conditional: "once X", "after Y", "when Z"
- Otherwise: null

Return [] if no commitments.`;


function buildSystemPrompt(meetingDate?: Date): string {
  const refDate = meetingDate || new Date();
  const dateStr = refDate.toISOString().slice(0, 10);
  const dayOfWeek = refDate.toLocaleDateString('en-US', { weekday: 'long' });
  
  return SYSTEM_PROMPT
    .replace(/{MEETING_DATE}/g, dateStr)
    .replace(/{MEETING_DAY}/g, dayOfWeek);
}

export function parseCommitments(text: string, meetingDate?: Date): ExtractedCommitment[] {
  let cleaned = text.trim();

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON array found in LLM response');
  }

  const jsonStr = cleaned.slice(start, end + 1);
  const parsed = JSON.parse(jsonStr);

  if (!Array.isArray(parsed)) {
    throw new Error('LLM response is not a JSON array');
  }

  const refDate = meetingDate || new Date();
  refDate.setHours(0, 0, 0, 0);

  return parsed
    .filter(
      (item) =>
        item &&
        typeof item.owner === 'string' &&
        typeof item.description === 'string' &&
        typeof item.source_quote === 'string',
    )
    .map((item) => {
      let dueDate = null;
      
      if (typeof item.due_date === 'string' && item.due_date.trim() !== '') {
        dueDate = item.due_date;
        
        // Validation: Warn about dates that seem too far in the future (>90 days)
        const parsed = new Date(dueDate);
        if (!isNaN(parsed.getTime())) {
          const diffDays = Math.ceil((parsed.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
          
          // If date is more than 90 days in future, it's likely a calculation error
          if (diffDays > 90) {
            console.warn(`Warning: Task "${item.description}" has due date ${diffDays} days in future (${dueDate}). This may be a date calculation error.`);
          }
          
          // If date is in the past by more than 30 days, likely an error
          if (diffDays < -30) {
            console.warn(`Warning: Task "${item.description}" has due date ${Math.abs(diffDays)} days in past (${dueDate}). This may be a date calculation error.`);
          }
        }
      }
      
      // Validate and normalize confidence
      const confidence = ['high', 'medium', 'low'].includes(item.confidence)
        ? item.confidence
        : 'medium'; // default to medium if not specified
      
      // Extract dependency if present
      const dependency = item.dependency && typeof item.dependency === 'string' && item.dependency.trim() !== ''
        ? item.dependency.trim()
        : null;
      
      // Validate commitment_type
      const commitment_type = ['explicit', 'collective', 'acceptance'].includes(item.commitment_type)
        ? item.commitment_type
        : 'explicit'; // default
      
      return {
        owner: item.owner,
        description: item.description,
        due_date: dueDate,
        source_quote: item.source_quote,
        confidence,
        dependency,
        commitment_type,
      };
    });
}

export async function callGroqForExtraction(
  transcript: string,
  meetingDate?: Date,
): Promise<ExtractedCommitment[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('[GROQ] GROQ_API_KEY environment variable is not set!');
    throw new Error('GROQ_API_KEY is not configured.');
  }

  console.log('[GROQ] Starting extraction with API key present');

  // [EXTRACTION DEBUG] Log the meeting date for context
  const debugMeetingDate = meetingDate || new Date();
  console.log('[EXTRACTION DEBUG] Meeting Date:', debugMeetingDate.toISOString().split('T')[0], `(${debugMeetingDate.toLocaleDateString('en-US', { weekday: 'long' })})`);

  console.log('[GROQ] Sending request to Groq API...');
  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile', // Currently supported fast model
        max_tokens: 4096,
        messages: [
          { role: 'system', content: buildSystemPrompt(meetingDate) },
          { 
            role: 'user', 
            content: `Extract commitments from this meeting transcript:\n\n${transcript}\n\nReturn ONLY valid JSON array, no explanations.`
          },
        ],
        temperature: 0.2,
      }),
    },
  );

  console.log('[GROQ] Response status:', response.status);

  if (!response.ok) {
    const errText = await response.text();
    console.error('[GROQ] API error response:', errText);
    throw new Error(`Groq API error (${response.status}): ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  console.log('[GROQ] Response received, parsing...');
  
  if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
    console.error('[EXTRACTION DEBUG] Invalid Groq response structure:', JSON.stringify(data).substring(0, 500));
    throw new Error(`Groq API returned invalid structure: ${JSON.stringify(data).substring(0, 200)}`);
  }
  
  const text: string = data.choices[0]?.message?.content;
  
  if (!text || typeof text !== 'string') {
    console.error('[EXTRACTION DEBUG] No content in Groq response. Full response:', JSON.stringify(data).substring(0, 500));
    throw new Error('Groq API returned empty or invalid content field');
  }
  
  // [EXTRACTION DEBUG] Log the raw Groq response
  console.log('[EXTRACTION DEBUG] Raw Groq Response:', text.substring(0, 1500));

  const commitments = parseCommitments(text, meetingDate);
  
  // [EXTRACTION DEBUG] Log parsed commitments with due_date values
  console.log('[EXTRACTION DEBUG] Parsed commitments count:', commitments.length);
  commitments.forEach((c, idx) => {
    console.log(`[EXTRACTION DEBUG] Commitment ${idx + 1}:`, {
      owner: c.owner,
      description: c.description,
      due_date: c.due_date,
      confidence: c.confidence,
      source_quote: c.source_quote.substring(0, 80),
    });
  });

  return commitments;
}

export async function callGroqForNudge(
  task: {
    description: string;
    owner: string;
    due_date: string | null;
  },
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured.');
  }

  const dueInfo = task.due_date
    ? `It was due on ${task.due_date}.`
    : 'No specific due date was set.';

  const prompt = `Write a short, friendly, professional follow-up nudge message (2-3 sentences max) to remind someone about a task they committed to in a meeting.

Task: ${task.description}
Person: ${task.owner}
${dueInfo}

The message should be warm but clear, ready to send via Slack or email. Do not include a subject line. Just the message body.`;

  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const text: string = data.choices?.[0]?.message?.content ?? '';

  return text.trim();
}
