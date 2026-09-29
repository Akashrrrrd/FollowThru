describe('Meeting Extraction - Owner User ID Logic', () => {
  describe('Participant matching', () => {
    it('extracts unique participant names from transcript', () => {
      const transcript = `Sarah: Alright, let's get started.
John: I'll send the report.
Sarah: Good. And Mike, can you schedule the meeting?
Mike: Sure, I'll do it.`;

      const participantRegex = /^([A-Za-z]+):\s/gm;
      const found = new Set<string>();
      let match;
      while ((match = participantRegex.exec(transcript)) !== null) {
        found.add(match[1]);
      }
      const participants = Array.from(found).sort();

      expect(participants.length).toBe(3);
      expect(participants).toContain('Sarah');
      expect(participants).toContain('John');
      expect(participants).toContain('Mike');
    });

    it('identifies commitments by participant', () => {
      const commitments = [
        {
          description: 'Send the report',
          owner: 'John',
          due_date: '2024-01-02',
        },
        {
          description: 'Schedule the meeting',
          owner: 'Mike',
          due_date: '2024-01-03',
        },
      ];

      const johnCommitments = commitments.filter((c) => c.owner === 'John');
      const mikeCommitments = commitments.filter((c) => c.owner === 'Mike');

      expect(johnCommitments.length).toBe(1);
      expect(mikeCommitments.length).toBe(1);
    });
  });

  describe('Owner User ID Assignment', () => {
    it('assigns owner_user_id when owner matches current user display_name', () => {
      const userId = 'user-123';
      const displayName = 'Akash';
      const commitments = [
        { description: 'Send report', owner: 'Akash' },
        { description: 'Schedule meeting', owner: 'Sarah' },
      ];

      const processedCommitments = commitments.map((c) => {
        let ownerUserId: string | null = null;
        if (
          displayName &&
          c.owner.toLowerCase().includes(displayName.toLowerCase())
        ) {
          ownerUserId = userId;
        }
        return { ...c, owner_user_id: ownerUserId };
      });

      expect(processedCommitments[0].owner_user_id).toBe('user-123');
      expect(processedCommitments[1].owner_user_id).toBeNull();
    });

    it('assigns owner_user_id when owner matches provided your_name', () => {
      const userId = 'user-123';
      const yourName = 'AK'; // User selected "AK" as their participant name
      const commitments = [
        { description: 'Send report', owner: 'AK' },
        { description: 'Schedule meeting', owner: 'Sarah' },
      ];

      const processedCommitments = commitments.map((c) => {
        let ownerUserId: string | null = null;
        if (yourName && c.owner.toLowerCase().includes(yourName.toLowerCase())) {
          ownerUserId = userId;
        }
        return { ...c, owner_user_id: ownerUserId };
      });

      expect(processedCommitments[0].owner_user_id).toBe('user-123');
      expect(processedCommitments[1].owner_user_id).toBeNull();
    });

    it('prefers provided your_name over display_name', () => {
      const userId = 'user-123';
      const displayName = 'Akash';
      const yourName = 'AK'; // User explicitly selected this
      const commitments = [
        { description: 'Send report', owner: 'AK' },
        { description: 'Schedule meeting', owner: 'Sarah' },
      ];

      // Use your_name if provided, else fall back to display_name
      const nameToMatch = yourName || displayName;

      const processedCommitments = commitments.map((c) => {
        let ownerUserId: string | null = null;
        if (
          nameToMatch &&
          c.owner.toLowerCase().includes(nameToMatch.toLowerCase())
        ) {
          ownerUserId = userId;
        }
        return { ...c, owner_user_id: ownerUserId };
      });

      // Since yourName is "AK", only "AK" commitment matches
      expect(processedCommitments[0].owner_user_id).toBe('user-123');
      expect(processedCommitments[1].owner_user_id).toBeNull();
    });

    it('sets owner_user_id to null for external participants', () => {
      const userId = 'user-123';
      const displayName = 'Akash';
      const commitments = [
        { description: 'Attend meeting', owner: 'Sarah' },
        { description: 'Provide feedback', owner: 'Mike' },
      ];

      const processedCommitments = commitments.map((c) => {
        let ownerUserId: string | null = null;
        if (
          displayName &&
          c.owner.toLowerCase().includes(displayName.toLowerCase())
        ) {
          ownerUserId = userId;
        }
        return { ...c, owner_user_id: ownerUserId };
      });

      expect(processedCommitments[0].owner_user_id).toBeNull();
      expect(processedCommitments[1].owner_user_id).toBeNull();
    });
  });

  describe('My Commitments Filtering', () => {
    it('filters tasks by owner_user_id when my_commitments=true', () => {
      const userId = 'user-123';
      const tasks = [
        { id: '1', description: 'Task 1', owner_user_id: userId },
        { id: '2', description: 'Task 2', owner_user_id: 'other-user' },
        { id: '3', description: 'Task 3', owner_user_id: userId },
        { id: '4', description: 'Task 4', owner_user_id: null },
      ];

      const myCommitments = tasks.filter((t) => t.owner_user_id === userId);

      expect(myCommitments.length).toBe(2);
      expect(myCommitments[0].id).toBe('1');
      expect(myCommitments[1].id).toBe('3');
    });

    it('returns empty array when user has no commitments', () => {
      const userId = 'user-123';
      const tasks = [
        { id: '1', description: 'Task 1', owner_user_id: 'other-user' },
        { id: '2', description: 'Task 2', owner_user_id: null },
      ];

      const myCommitments = tasks.filter((t) => t.owner_user_id === userId);

      expect(myCommitments.length).toBe(0);
    });

    it('combines multiple filters: my_commitments AND status', () => {
      const userId = 'user-123';
      const tasks = [
        {
          id: '1',
          description: 'Open task',
          owner_user_id: userId,
          status: 'open',
        },
        {
          id: '2',
          description: 'Done task',
          owner_user_id: userId,
          status: 'done',
        },
        {
          id: '3',
          description: 'Other task',
          owner_user_id: 'other-user',
          status: 'open',
        },
      ];

      let filtered = tasks.filter((t) => t.owner_user_id === userId);
      filtered = filtered.filter((t) => t.status === 'open');

      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('1');
    });
  });
});
