/**
 * Transcript Parser
 * 
 * Parses transcript files in various formats (TXT, VTT, SRT)
 * and converts them into a normalized transcript format for extraction.
 */

export interface ParseResult {
  content: string; // Normalized transcript content
  format: 'txt' | 'vtt' | 'srt';
  linesProcessed: number;
  warnings: string[];
}

/**
 * Parse SRT (SubRip) format
 * Format:
 * 1
 * 00:00:00,000 --> 00:00:05,000
 * Speaker: Text content
 */
function parseSrt(content: string): ParseResult {
  const lines = content.split('\n');
  const transcript: string[] = [];
  const warnings: string[] = [];
  let linesProcessed = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and sequence numbers
    if (!line || /^\d+$/.test(line)) {
      continue;
    }

    // Skip timestamp lines (format: HH:MM:SS,mmm --> HH:MM:SS,mmm)
    if (/^\d{2}:\d{2}:\d{2}/.test(line)) {
      continue;
    }

    // Keep non-empty, non-timestamp lines as transcript content
    if (line) {
      transcript.push(line);
      linesProcessed++;
    }
  }

  return {
    content: transcript.join('\n'),
    format: 'srt',
    linesProcessed,
    warnings,
  };
}

/**
 * Parse VTT (WebVTT) format
 * Format:
 * WEBVTT
 * 
 * 00:00:00.000 --> 00:00:05.000
 * Speaker: Text content
 */
function parseVtt(content: string): ParseResult {
  const lines = content.split('\n');
  const transcript: string[] = [];
  const warnings: string[] = [];
  let linesProcessed = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip WEBVTT header and empty lines
    if (!line || line.startsWith('WEBVTT') || line.startsWith('NOTE')) {
      continue;
    }

    // Skip timestamp lines (format: HH:MM:SS.mmm --> HH:MM:SS.mmm)
    if (/^\d{2}:\d{2}:\d{2}/.test(line) && line.includes('-->')) {
      continue;
    }

    // Keep non-empty lines as transcript content
    if (line) {
      transcript.push(line);
      linesProcessed++;
    }
  }

  return {
    content: transcript.join('\n'),
    format: 'vtt',
    linesProcessed,
    warnings,
  };
}

/**
 * Parse plain text transcript
 * Assumes already formatted as: "Speaker: Content" or just content lines
 */
function parseTxt(content: string): ParseResult {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line); // Remove empty lines

  return {
    content: lines.join('\n'),
    format: 'txt',
    linesProcessed: lines.length,
    warnings: [],
  };
}

/**
 * Detect file format based on content or filename
 */
export function detectFormat(filename: string, content: string): 'txt' | 'vtt' | 'srt' | null {
  const lowerFilename = filename.toLowerCase();

  // Try to detect from content first (more reliable than filename)
  if (content.includes('WEBVTT')) {
    return 'vtt';
  }

  // SRT detection: sequence number followed by timestamp with commas (SRT uses commas, VTT uses dots)
  if (/^\d+\s*\n\s*\d{2}:\d{2}:\d{2},\d{3}/m.test(content)) {
    return 'srt';
  }

  // VTT detection: timestamp with dots and arrow
  if (/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/m.test(content)) {
    return 'vtt';
  }

  // Fall back to filename-based detection
  if (lowerFilename.endsWith('.vtt')) {
    return 'vtt';
  }
  if (lowerFilename.endsWith('.srt')) {
    return 'srt';
  }
  if (lowerFilename.endsWith('.txt')) {
    return 'txt';
  }

  return null;
}

/**
 * Parse transcript file in any supported format
 */
export function parseTranscript(
  filename: string,
  content: string,
  format?: 'txt' | 'vtt' | 'srt',
): ParseResult {
  const detectedFormat = format || detectFormat(filename, content);

  if (!detectedFormat) {
    return {
      content: parseTxt(content).content, // Default to TXT
      format: 'txt',
      linesProcessed: 0,
      warnings: ['Could not detect format, treating as plain text'],
    };
  }

  switch (detectedFormat) {
    case 'vtt':
      return parseVtt(content);
    case 'srt':
      return parseSrt(content);
    case 'txt':
    default:
      return parseTxt(content);
  }
}

/**
 * Validate file before parsing
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  maxSizeBytes: number;
  fileSizeBytes: number;
}

export function validateTranscriptFile(
  filename: string,
  fileContent: string,
  maxSizeBytes: number = 1024 * 1024, // 1 MB default
): ValidationResult {
  const fileSizeBytes = new Blob([fileContent]).size;

  // Check file size
  if (fileSizeBytes > maxSizeBytes) {
    return {
      valid: false,
      error: `File is too large. Maximum size is ${Math.round(maxSizeBytes / 1024)} KB, but file is ${Math.round(fileSizeBytes / 1024)} KB.`,
      maxSizeBytes,
      fileSizeBytes,
    };
  }

  // Check file extension
  const lowerFilename = filename.toLowerCase();
  const supportedExtensions = ['.txt', '.vtt', '.srt'];
  const hasSupportedExtension = supportedExtensions.some((ext) => lowerFilename.endsWith(ext));

  if (!hasSupportedExtension) {
    return {
      valid: false,
      error: `File format not supported. Supported formats: TXT, VTT, SRT. Got: ${filename}`,
      maxSizeBytes,
      fileSizeBytes,
    };
  }

  // Check file is not empty
  if (fileContent.trim().length === 0) {
    return {
      valid: false,
      error: 'File is empty. Please provide a transcript file with content.',
      maxSizeBytes,
      fileSizeBytes,
    };
  }

  return {
    valid: true,
    maxSizeBytes,
    fileSizeBytes,
  };
}
