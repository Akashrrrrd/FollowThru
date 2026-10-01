import { parseTranscript, detectFormat, validateTranscriptFile } from './transcript-parser';

describe('Transcript Parser', () => {
  describe('VTT Format', () => {
    test('should parse basic VTT format', () => {
      const vttContent = `WEBVTT

00:00:00.000 --> 00:00:05.000
Alice: Hello everyone

00:00:05.000 --> 00:00:10.000
Bob: Hi Alice, how are you?

00:00:10.000 --> 00:00:15.000
Alice: I'm doing well, let's get started`;

      const result = parseTranscript('meeting.vtt', vttContent, 'vtt');
      expect(result.format).toBe('vtt');
      expect(result.content).toContain('Alice: Hello everyone');
      expect(result.content).toContain('Bob: Hi Alice');
      expect(result.content).not.toContain('00:00:00.000');
      expect(result.linesProcessed).toBe(3);
    });

    test('should detect VTT format automatically', () => {
      const vttContent = `WEBVTT

00:00:00.000 --> 00:00:05.000
Speaker: Test content`;
      expect(detectFormat('meeting.vtt', vttContent)).toBe('vtt');
    });
  });

  describe('SRT Format', () => {
    test('should parse basic SRT format', () => {
      const srtContent = `1
00:00:00,000 --> 00:00:05,000
Alice: I will send the report by Friday

2
00:00:05,000 --> 00:00:10,000
Bob: Great, I can review it on Saturday

3
00:00:10,000 --> 00:00:15,000
Charlie: Thanks for the update`;

      const result = parseTranscript('meeting.srt', srtContent, 'srt');
      expect(result.format).toBe('srt');
      expect(result.content).toContain('Alice: I will send');
      expect(result.content).toContain('Bob: Great');
      expect(result.content).not.toContain('00:00:00,000');
      expect(result.content).not.toContain('1\n2\n3');
      expect(result.linesProcessed).toBe(3);
    });

    test('should detect SRT format automatically', () => {
      const srtContent = `1
00:00:00,000 --> 00:00:05,000
Speaker: Test content`;
      expect(detectFormat('meeting.srt', srtContent)).toBe('srt');
    });
  });

  describe('TXT Format', () => {
    test('should parse basic TXT format', () => {
      const txtContent = `Alice: I will send the report by Friday
Bob: Great, I can review it on Saturday
Charlie: Thanks for the update`;

      const result = parseTranscript('meeting.txt', txtContent, 'txt');
      expect(result.format).toBe('txt');
      expect(result.content).toContain('Alice: I will send');
      expect(result.content).toContain('Bob: Great');
      expect(result.linesProcessed).toBe(3);
    });

    test('should handle TXT with extra whitespace', () => {
      const txtContent = `  Alice: Hello

  Bob: Hi

  Alice: How are you?  `;

      const result = parseTranscript('meeting.txt', txtContent);
      expect(result.content).not.toContain('  ');
      expect(result.linesProcessed).toBe(3);
    });
  });

  describe('Format Detection', () => {
    test('should detect VTT by filename', () => {
      expect(detectFormat('meeting.vtt', 'Some content')).toBe('vtt');
    });

    test('should detect SRT by filename', () => {
      expect(detectFormat('meeting.srt', 'Some content')).toBe('srt');
    });

    test('should detect TXT by filename', () => {
      expect(detectFormat('meeting.txt', 'Some content')).toBe('txt');
    });

    test('should detect VTT by content', () => {
      const content = `WEBVTT

00:00:01.000 --> 00:00:05.000
Text`;
      expect(detectFormat('unknown.txt', content)).toBe('vtt');
    });

    test('should detect SRT by content', () => {
      const content = `1
00:00:01,000 --> 00:00:05,000
Text`;
      expect(detectFormat('unknown.txt', content)).toBe('srt');
    });

    test('should return null for unrecognized format', () => {
      expect(detectFormat('file.unknown', 'Some random content')).toBeNull();
    });
  });

  describe('File Validation', () => {
    test('should validate correct TXT file', () => {
      const result = validateTranscriptFile('meeting.txt', 'Alice: Hello\nBob: Hi');
      expect(result.valid).toBe(true);
    });

    test('should validate correct VTT file', () => {
      const result = validateTranscriptFile('meeting.vtt', 'WEBVTT\n\nAlice: Hello');
      expect(result.valid).toBe(true);
    });

    test('should validate correct SRT file', () => {
      const result = validateTranscriptFile('meeting.srt', '1\n00:00:00,000 --> 00:00:05,000\nAlice: Hello');
      expect(result.valid).toBe(true);
    });

    test('should reject unsupported file extension', () => {
      const result = validateTranscriptFile('meeting.mp3', 'Some content');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not supported');
    });

    test('should reject empty file', () => {
      const result = validateTranscriptFile('meeting.txt', '');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    test('should reject file exceeding size limit', () => {
      const largeContent = 'A'.repeat(2 * 1024 * 1024); // 2 MB
      const result = validateTranscriptFile('meeting.txt', largeContent, 1024 * 1024); // 1 MB limit
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too large');
    });

    test('should reject whitespace-only file', () => {
      const result = validateTranscriptFile('meeting.txt', '   \n  \t  \n  ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });
  });

  describe('Practical Examples', () => {
    test('should handle realistic VTT meeting transcript', () => {
      const vttContent = `WEBVTT

00:00:00.000 --> 00:00:10.000
Priya: Alright, let's talk about the launch timeline.

00:00:10.000 --> 00:00:20.000
Vikram: I can have the database migration ready by October 8th.

00:00:20.000 --> 00:00:30.000
Rahul: Sure, once Vikram finishes, I'll handle the API endpoints by October 11th.`;

      const result = parseTranscript('launch-planning.vtt', vttContent);
      expect(result.content).toContain('Priya: Alright');
      expect(result.content).toContain('Vikram: I can');
      expect(result.content).toContain('Rahul: Sure');
      expect(result.content).not.toContain('00:00:00.000');
    });

    test('should handle realistic SRT meeting transcript', () => {
      const srtContent = `1
00:00:00,000 --> 00:00:10,000
Priya: Alright, let's talk about the launch timeline.

2
00:00:10,000 --> 00:00:20,000
Vikram: I can have the database migration ready by October 8th.

3
00:00:20,000 --> 00:00:30,000
Rahul: Sure, once Vikram finishes, I'll handle the API endpoints.`;

      const result = parseTranscript('launch-planning.srt', srtContent);
      expect(result.content).toContain('Priya: Alright');
      expect(result.content).toContain('Vikram: I can');
      expect(result.content).toContain('Rahul: Sure');
    });
  });
});
