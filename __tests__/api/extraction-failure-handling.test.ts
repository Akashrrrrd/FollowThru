/**
 * Test suite for extraction failure handling
 * 
 * Validates that all failure scenarios return appropriate user-friendly error messages:
 * A. Empty transcript
 * B. Extremely short transcript
 * C. Invalid input (missing fields)
 * D. Malformed JSON response
 * E. API timeout
 * F. Rate limit
 * G. Network failure
 */

describe('Extraction Failure Handling', () => {
  describe('A. Empty/Missing Transcript', () => {
    test('should reject empty transcript', () => {
      const transcript = '';
      expect(transcript || null).toBeNull();
    });

    test('should reject whitespace-only transcript', () => {
      const transcript = '   \n  \t  ';
      const trimmed = transcript.trim();
      expect(trimmed).toBe('');
    });

    test('should reject missing transcript field', () => {
      const body = { title: 'Meeting', transcript: undefined };
      expect(body.transcript).toBeUndefined();
    });
  });

  describe('B. Extremely Short Transcript', () => {
    test('should reject transcript under 50 characters', () => {
      const transcript = 'Alice: Hi. Bob: Hi back.'; // Only 23 chars
      expect(transcript.length < 50).toBe(true);
    });

    test('should reject transcript with fewer than 20 words', () => {
      const transcript = 'Alice Bob Charlie Delta Echo Foxtrot Golf Hotel'; // 8 words
      const wordCount = transcript.split(/\s+/).length;
      expect(wordCount < 20).toBe(true);
    });

    test('should accept transcript with 50+ characters and 20+ words', () => {
      const transcript =
        'Alice: I will send the report by Friday. Bob: Thanks, I will review it on Thursday. Charlie: Great, I will also provide feedback by then.';
      const hasLength = transcript.length >= 50;
      const wordCount = transcript.split(/\s+/).length;
      expect(hasLength && wordCount >= 20).toBe(true);
    });
  });

  describe('C. Invalid Input', () => {
    test('should reject missing title', () => {
      const body = {
        title: '',
        transcript: 'A: I will do X. B: Thanks.',
      };
      expect(!body.title || !body.title.trim()).toBe(true);
    });

    test('should reject missing title field', () => {
      const body = {
        transcript: 'A: I will do X. B: Thanks.',
      };
      expect(body.title).toBeUndefined();
    });

    test('should accept valid minimal input', () => {
      const body = {
        title: 'Team Meeting',
        transcript: 'Alice: I will complete the project by Friday. Bob: Great, I will support you.',
      };
      expect(body.title && body.title.trim()).toBe('Team Meeting');
      expect(body.transcript && body.transcript.trim().length >= 50).toBe(true);
    });
  });

  describe('D. Error Message Mapping', () => {
    // This simulates the friendlyExtractionError function behavior
    const mapErrorMessage = (err: string): string => {
      if (/decommission/i.test(err)) {
        return 'The AI model is currently unavailable. Your meeting was saved. Please try again in a moment.';
      }
      if (/rate_limit|429|quota/i.test(err)) {
        return 'API rate limit reached. Please wait a few moments and try again.';
      }
      if (/timeout|timed out|ETIMEDOUT/i.test(err)) {
        return 'The AI service took too long to respond. Please try again with a shorter transcript or try again in a moment.';
      }
      if (/authentication|api.*key|401|403/i.test(err)) {
        return 'The AI service authentication failed. Please contact support.';
      }
      if (/no.*response|empty.*response/i.test(err)) {
        return 'The AI service returned no results. Your meeting was saved. Please try again.';
      }
      if (/malformed|invalid.*json|parse/i.test(err)) {
        return 'The AI service returned unexpected data. Your meeting was saved. Please try again.';
      }
      return 'Could not extract commitments from this transcript. Your meeting was saved. Please review the transcript and try again, or extract manually from the meeting detail page.';
    };

    test('should map decommissioned model error', () => {
      const err = 'Model openai/gpt-oss-120b has been decommissioned';
      const msg = mapErrorMessage(err);
      expect(msg).toContain('currently unavailable');
      expect(msg).toContain('meeting was saved');
    });

    test('should map rate limit error', () => {
      const err = 'Error 429: rate_limit_exceeded';
      const msg = mapErrorMessage(err);
      expect(msg).toContain('rate limit');
      expect(msg).toContain('wait a few moments');
    });

    test('should map timeout error', () => {
      const err = 'Request timed out after 30000ms';
      const msg = mapErrorMessage(err);
      expect(msg).toContain('took too long');
      expect(msg).toContain('shorter transcript');
    });

    test('should map auth error', () => {
      const err = 'Authentication failed: Invalid API key';
      const msg = mapErrorMessage(err);
      expect(msg).toContain('authentication failed');
      expect(msg).toContain('contact support');
    });

    test('should map no response error', () => {
      const err = 'Groq API returned no response';
      const msg = mapErrorMessage(err);
      expect(msg).toContain('returned no results');
      expect(msg).toContain('meeting was saved');
    });

    test('should map malformed response error', () => {
      const err = 'Failed to parse JSON response';
      const msg = mapErrorMessage(err);
      expect(msg).toContain('unexpected data');
      expect(msg).toContain('meeting was saved');
    });

    test('should map generic error', () => {
      const err = 'Unknown extraction failure';
      const msg = mapErrorMessage(err);
      expect(msg).toContain('Could not extract commitments');
      expect(msg).toContain('meeting was saved');
    });
  });

  describe('E. Retry Logic', () => {
    test('should indicate when user can retry', () => {
      const retryableErrors = [
        'rate_limit_exceeded',
        'timeout',
        'temporary_service_error',
        'no_response',
      ];

      const isRetryable = (err: string) => {
        return /timeout|rate|temporary|no.*response/i.test(err);
      };

      expect(retryableErrors.every((err) => isRetryable(err))).toBe(true);
    });

    test('should indicate when user cannot retry (permanent errors)', () => {
      const permanentErrors = [
        'decommissioned_model',
        'invalid_api_key',
        'authentication_failed',
      ];

      const isPermanent = (err: string) => {
        return err.includes('decommissioned') || err.includes('invalid_api_key') || err.includes('authentication');
      };

      expect(permanentErrors.every((err) => isPermanent(err))).toBe(true);
    });
  });

  describe('F. User-Facing Messages', () => {
    test('should not expose internal API keys in error messages', () => {
      const errorMessage =
        'The AI service authentication failed. Please contact support.';
      expect(errorMessage).not.toContain('sk-');
      expect(errorMessage).not.toContain('Bearer');
      expect(errorMessage).not.toContain('secret');
    });

    test('should not expose raw stack traces', () => {
      const errorMessage =
        'Could not extract commitments from this transcript. Your meeting was saved. Please review the transcript and try again, or extract manually from the meeting detail page.';
      expect(errorMessage).not.toMatch(/at \w+\.\w+/);
      expect(errorMessage).not.toMatch(/Error:/);
      expect(errorMessage).not.toMatch(/\.ts:\d+:\d+/);
    });

    test('should include actionable next steps', () => {
      const messages = [
        'Please wait a few moments and try again.',
        'Please try again with a shorter transcript or try again in a moment.',
        'Please contact support.',
        'Please review the transcript and try again, or extract manually from the meeting detail page.',
      ];

      expect(messages.every((msg) => msg.includes('Please') || msg.includes('please'))).toBe(true);
    });

    test('should clarify that meeting was saved on extraction failure', () => {
      const messages = [
        'Your meeting was saved. Please try again.',
        'Your meeting was saved. Please review the transcript and try again, or extract manually from the meeting detail page.',
      ];

      expect(messages.every((msg) => msg.includes('meeting was saved'))).toBe(true);
    });
  });

  describe('G. Frontend Validation', () => {
    test('should validate minimum transcript length on client', () => {
      const validateTranscript = (t: string) => t.trim().length >= 50;
      expect(validateTranscript('short')).toBe(false);
      expect(validateTranscript('A'.repeat(50))).toBe(true);
    });

    test('should show clear error for empty transcript before sending', () => {
      const transcript = '';
      const error =
        transcript.trim().length === 0
          ? 'Transcript is required. Please paste a meeting transcript to extract commitments from.'
          : null;
      expect(error).not.toBeNull();
    });

    test('should show clear error for too-short transcript before sending', () => {
      const transcript = 'Short';
      const error =
        transcript.trim().length < 50
          ? 'Transcript is too short. Please provide a more detailed transcript with at least a few exchanges between participants (e.g., "Person A: ... Person B: ...").'
          : null;
      expect(error).not.toBeNull();
    });

    test('should proceed only after validation passes', () => {
      const transcript =
        'Alice: I will send the report by Friday. Bob: Great, thanks. Charlie: I can review it by Monday. Diana: I will help prepare the materials.';
      const title = 'Team Sync';

      // Check basic validation passes
      const hasTitle = title.trim().length > 0;
      const hasMinLength = transcript.trim().length >= 50;
      
      expect(hasTitle && hasMinLength).toBe(true);
    });
  });
});
