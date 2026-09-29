/**
 * Unit tests for date-resolver
 * 
 * Test scenarios for meeting on Tuesday, September 29, 2026
 */

import { resolveDateExpression, isValidDateString, isDependencyExpression } from './date-resolver';

describe('Date Resolver', () => {
  // Meeting date: Tuesday, September 29, 2026
  const meetingDate = new Date(2026, 8, 29); // Month is 0-indexed (8 = September)
  
  describe('Basic relative dates', () => {
    test('tomorrow → 2026-09-30', () => {
      expect(resolveDateExpression('tomorrow', meetingDate)).toBe('2026-09-30');
    });
    
    test('day after tomorrow → 2026-10-01', () => {
      expect(resolveDateExpression('day after tomorrow', meetingDate)).toBe('2026-10-01');
    });
  });
  
  describe('Plain weekday references (next occurrence)', () => {
    test('Wednesday → 2026-09-30 (next day)', () => {
      expect(resolveDateExpression('Wednesday', meetingDate)).toBe('2026-09-30');
    });
    
    test('Thursday → 2026-10-01', () => {
      expect(resolveDateExpression('Thursday', meetingDate)).toBe('2026-10-01');
    });
    
    test('Friday → 2026-10-02', () => {
      expect(resolveDateExpression('Friday', meetingDate)).toBe('2026-10-02');
    });
    
    test('Monday → 2026-10-05 (following Monday)', () => {
      expect(resolveDateExpression('Monday', meetingDate)).toBe('2026-10-05');
    });
    
    test('Tuesday → 2026-10-06 (next week Tuesday)', () => {
      expect(resolveDateExpression('Tuesday', meetingDate)).toBe('2026-10-06');
    });
  });
  
  describe('Next weekday (following calendar week)', () => {
    test('next Monday → 2026-10-05', () => {
      expect(resolveDateExpression('next Monday', meetingDate)).toBe('2026-10-05');
    });
    
    test('next Tuesday → 2026-10-06', () => {
      expect(resolveDateExpression('next Tuesday', meetingDate)).toBe('2026-10-06');
    });
    
    test('next Wednesday → 2026-10-07', () => {
      expect(resolveDateExpression('next Wednesday', meetingDate)).toBe('2026-10-07');
    });
    
    test('next Friday → 2026-10-09', () => {
      expect(resolveDateExpression('next Friday', meetingDate)).toBe('2026-10-09');
    });
  });
  
  describe('By/Before weekday', () => {
    test('by Friday → 2026-10-02', () => {
      expect(resolveDateExpression('by Friday', meetingDate)).toBe('2026-10-02');
    });
    
    test('before Monday → 2026-10-05', () => {
      expect(resolveDateExpression('before Monday', meetingDate)).toBe('2026-10-05');
    });
  });
  
  describe('By/Before next weekday (regression test - bug fix)', () => {
    test('by next Monday → 2026-10-05', () => {
      expect(resolveDateExpression('by next Monday', meetingDate)).toBe('2026-10-05');
    });
    
    test('by next Wednesday → 2026-10-07', () => {
      expect(resolveDateExpression('by next Wednesday', meetingDate)).toBe('2026-10-07');
    });
    
    test('before next Friday → 2026-10-09', () => {
      expect(resolveDateExpression('before next Friday', meetingDate)).toBe('2026-10-09');
    });
  });
  
  describe('Relative durations', () => {
    test('in 2 days → 2026-10-01', () => {
      expect(resolveDateExpression('in 2 days', meetingDate)).toBe('2026-10-01');
    });
    
    test('in 1 day → 2026-09-30', () => {
      expect(resolveDateExpression('in 1 day', meetingDate)).toBe('2026-09-30');
    });
    
    test('in 1 week → 2026-10-06', () => {
      expect(resolveDateExpression('in 1 week', meetingDate)).toBe('2026-10-06');
    });
    
    test('in 2 weeks → 2026-10-13', () => {
      expect(resolveDateExpression('in 2 weeks', meetingDate)).toBe('2026-10-13');
    });
    
    test('in a week → 2026-10-06', () => {
      expect(resolveDateExpression('in a week', meetingDate)).toBe('2026-10-06');
    });
    
    test('in a couple of days → 2026-10-01', () => {
      expect(resolveDateExpression('in a couple of days', meetingDate)).toBe('2026-10-01');
    });
    
    test('in a couple of weeks → 2026-10-13', () => {
      expect(resolveDateExpression('in a couple of weeks', meetingDate)).toBe('2026-10-13');
    });
  });
  
  describe('End of week', () => {
    test('end of week → 2026-10-02 (Friday)', () => {
      expect(resolveDateExpression('end of week', meetingDate)).toBe('2026-10-02');
    });
    
    test('end of the week → 2026-10-02', () => {
      expect(resolveDateExpression('end of the week', meetingDate)).toBe('2026-10-02');
    });
  });
  
  describe('Explicit dates', () => {
    test('Preserves explicit date string', () => {
      expect(resolveDateExpression('2026-10-15', meetingDate)).toBe('2026-10-15');
    });
  });
  
  describe('Null/invalid expressions', () => {
    test('Empty string → null', () => {
      expect(resolveDateExpression('', meetingDate)).toBeNull();
    });
    
    test('null → null', () => {
      expect(resolveDateExpression(null, meetingDate)).toBeNull();
    });
    
    test('undefined → null', () => {
      expect(resolveDateExpression(undefined, meetingDate)).toBeNull();
    });
    
    test('Unrecognized expression → null', () => {
      expect(resolveDateExpression('someday', meetingDate)).toBeNull();
    });
  });
  
  describe('Case insensitivity', () => {
    test('TOMORROW → 2026-09-30', () => {
      expect(resolveDateExpression('TOMORROW', meetingDate)).toBe('2026-09-30');
    });
    
    test('Next MONDAY → 2026-10-05', () => {
      expect(resolveDateExpression('Next MONDAY', meetingDate)).toBe('2026-10-05');
    });
  });
  
  describe('Date validation', () => {
    test('Valid date string returns true', () => {
      expect(isValidDateString('2026-09-30')).toBe(true);
    });
    
    test('Invalid date string returns false', () => {
      expect(isValidDateString('2026-13-40')).toBe(false);
    });
    
    test('null returns false', () => {
      expect(isValidDateString(null)).toBe(false);
    });
  });
  
  describe('Dependency detection', () => {
    test('Detects "once" dependency', () => {
      expect(isDependencyExpression('once approved')).toBe(true);
    });
    
    test('Detects "after" dependency', () => {
      expect(isDependencyExpression('after review')).toBe(true);
    });
    
    test('Detects "when" dependency', () => {
      expect(isDependencyExpression('when ready')).toBe(true);
    });
    
    test('Detects "waiting for" dependency', () => {
      expect(isDependencyExpression('waiting for approval')).toBe(true);
    });
    
    test('Regular expression is not a dependency', () => {
      expect(isDependencyExpression('by Friday')).toBe(false);
    });
    
    test('null is not a dependency', () => {
      expect(isDependencyExpression(null)).toBe(false);
    });
  });
});

describe('Date Resolver - Different meeting days', () => {
  describe('Meeting on Friday (2026-10-02)', () => {
    const fridayMeeting = new Date(2026, 9, 2); // Friday, October 2, 2026
    
    test('tomorrow → 2026-10-03 (Saturday)', () => {
      expect(resolveDateExpression('tomorrow', fridayMeeting)).toBe('2026-10-03');
    });
    
    test('Monday → 2026-10-05', () => {
      expect(resolveDateExpression('Monday', fridayMeeting)).toBe('2026-10-05');
    });
    
    test('next Monday → 2026-10-12', () => {
      expect(resolveDateExpression('next Monday', fridayMeeting)).toBe('2026-10-12');
    });
    
    test('end of week → 2026-10-09 (next Friday)', () => {
      expect(resolveDateExpression('end of week', fridayMeeting)).toBe('2026-10-09');
    });
  });
  
  describe('Meeting on Monday (2026-10-05)', () => {
    const mondayMeeting = new Date(2026, 9, 5); // Monday, October 5, 2026
    
    test('Wednesday → 2026-10-07', () => {
      expect(resolveDateExpression('Wednesday', mondayMeeting)).toBe('2026-10-07');
    });
    
    test('Friday → 2026-10-09', () => {
      expect(resolveDateExpression('Friday', mondayMeeting)).toBe('2026-10-09');
    });
    
    test('next Monday → 2026-10-12', () => {
      expect(resolveDateExpression('next Monday', mondayMeeting)).toBe('2026-10-12');
    });
    
    test('end of week → 2026-10-09', () => {
      expect(resolveDateExpression('end of week', mondayMeeting)).toBe('2026-10-09');
    });
  });

  describe('Month expressions (PART 5 enhancements)', () => {
    const meetingDate = new Date(2026, 8, 29); // Tuesday, September 29, 2026

    test('end of month → 2026-09-30 (September)', () => {
      expect(resolveDateExpression('end of month', meetingDate)).toBe('2026-09-30');
    });

    test('by end of month → 2026-09-30', () => {
      expect(resolveDateExpression('by end of month', meetingDate)).toBe('2026-09-30');
    });

    test('next month → 2026-10-01 (1st of October)', () => {
      expect(resolveDateExpression('next month', meetingDate)).toBe('2026-10-01');
    });

    test('by next month → 2026-10-01', () => {
      expect(resolveDateExpression('by next month', meetingDate)).toBe('2026-10-01');
    });

    test('end of next month → 2026-10-31 (October)', () => {
      expect(resolveDateExpression('end of next month', meetingDate)).toBe('2026-10-31');
    });

    // From October meeting
    const octMeeting = new Date(2026, 9, 15); // Thursday, October 15, 2026

    test('end of month from Oct → 2026-10-31', () => {
      expect(resolveDateExpression('end of month', octMeeting)).toBe('2026-10-31');
    });

    test('next month from Oct → 2026-11-01 (November)', () => {
      expect(resolveDateExpression('next month', octMeeting)).toBe('2026-11-01');
    });

    test('end of next month from Oct → 2026-11-30 (November)', () => {
      expect(resolveDateExpression('end of next month', octMeeting)).toBe('2026-11-30');
    });
  });

  describe('Numeric date formats (PART 5 enhancements)', () => {
    const meetingDate = new Date(2026, 8, 29); // Tuesday, September 29, 2026

    // M/D format
    test('10/20 → 2026-10-20', () => {
      expect(resolveDateExpression('10/20', meetingDate)).toBe('2026-10-20');
    });

    test('by 10/20 → 2026-10-20', () => {
      expect(resolveDateExpression('by 10/20', meetingDate)).toBe('2026-10-20');
    });

    test('12/25 → 2026-12-25 (same year if not passed yet)', () => {
      expect(resolveDateExpression('12/25', meetingDate)).toBe('2026-12-25');
    });

    // MM/DD format
    test('09/30 → 2026-09-30 (tomorrow)', () => {
      expect(resolveDateExpression('09/30', meetingDate)).toBe('2026-09-30');
    });

    test('10/05 → 2026-10-05', () => {
      expect(resolveDateExpression('10/05', meetingDate)).toBe('2026-10-05');
    });

    // MM/DD/YYYY format (explicit year)
    test('10/20/2026 → 2026-10-20', () => {
      expect(resolveDateExpression('10/20/2026', meetingDate)).toBe('2026-10-20');
    });

    test('01/15/2027 → 2027-01-15', () => {
      expect(resolveDateExpression('01/15/2027', meetingDate)).toBe('2027-01-15');
    });
  });

  describe('Month name formats (PART 5 enhancements)', () => {
    const meetingDate = new Date(2026, 8, 29); // Tuesday, September 29, 2026

    test('October 15 → 2026-10-15', () => {
      expect(resolveDateExpression('October 15', meetingDate)).toBe('2026-10-15');
    });

    test('by October 15 → 2026-10-15', () => {
      expect(resolveDateExpression('by October 15', meetingDate)).toBe('2026-10-15');
    });

    test('December 25 → 2026-12-25', () => {
      expect(resolveDateExpression('December 25', meetingDate)).toBe('2026-12-25');
    });

    test('January 10 → 2027-01-10 (next year if passed)', () => {
      expect(resolveDateExpression('January 10', meetingDate)).toBe('2027-01-10');
    });

    test('September 30 → 2026-09-30 (tomorrow)', () => {
      expect(resolveDateExpression('September 30', meetingDate)).toBe('2026-09-30');
    });

    test('by December 31 → 2026-12-31', () => {
      expect(resolveDateExpression('by December 31', meetingDate)).toBe('2026-12-31');
    });
  });

  describe('Dependency expressions (should return null)', () => {
    const meetingDate = new Date(2026, 8, 29);

    test('once approved → null (dependency, not date)', () => {
      expect(resolveDateExpression('once approved', meetingDate)).toBeNull();
    });

    test('after review → null', () => {
      expect(resolveDateExpression('after review', meetingDate)).toBeNull();
    });

    test('when ready → null', () => {
      expect(resolveDateExpression('when ready', meetingDate)).toBeNull();
    });

    test('waiting for feedback → null', () => {
      expect(resolveDateExpression('waiting for feedback', meetingDate)).toBeNull();
    });
  });

  describe('Invalid/unparseable expressions (should return null)', () => {
    const meetingDate = new Date(2026, 8, 29);

    test('ASAP → null (too vague)', () => {
      expect(resolveDateExpression('ASAP', meetingDate)).toBeNull();
    });

    test('soon → null', () => {
      expect(resolveDateExpression('soon', meetingDate)).toBeNull();
    });

    test('when possible → null', () => {
      expect(resolveDateExpression('when possible', meetingDate)).toBeNull();
    });

    test('eventually → null', () => {
      expect(resolveDateExpression('eventually', meetingDate)).toBeNull();
    });

    test('13/32 → null (invalid date)', () => {
      expect(resolveDateExpression('13/32', meetingDate)).toBeNull();
    });

    test('February 30 → null (invalid date)', () => {
      expect(resolveDateExpression('February 30', meetingDate)).toBeNull();
    });
  });
});
