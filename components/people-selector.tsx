'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, X, Check } from 'lucide-react';
import { useUserSearch, type UserSearchResult } from '@/hooks/use-user-search';

interface PeopleSelectorProps {
  onSelect: (user: UserSearchResult, role?: 'team_lead' | 'member') => void;
  defaultRole?: 'team_lead' | 'member';
  showRoleSelector?: boolean;
  allowedRoles?: ('team_lead' | 'member')[];
  disabled?: boolean;
  placeholder?: string;
}

export function PeopleSelector({
  onSelect,
  defaultRole = 'member',
  showRoleSelector = false,
  allowedRoles = ['team_lead', 'member'],
  disabled = false,
  placeholder = 'Search by email or name...',
}: PeopleSelectorProps) {
  const [query, setQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [selectedRole, setSelectedRole] = useState<'team_lead' | 'member'>(defaultRole);
  const [showDropdown, setShowDropdown] = useState(false);
  const { results, loading, error, search, clear } = useUserSearch();
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle input change
  const handleInputChange = (value: string) => {
    setQuery(value);
    setSelectedUser(null);
    if (value.length >= 2) {
      search(value);
      setShowDropdown(true);
    } else if (value.length === 0) {
      clear();
      setShowDropdown(false);
    }
  };

  // Handle user selection
  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setQuery(user.displayName || user.fullName || user.email);
    setShowDropdown(false);
  };

  // Handle add button click
  const handleAdd = () => {
    if (selectedUser) {
      onSelect(selectedUser, showRoleSelector ? selectedRole : defaultRole);
      setQuery('');
      setSelectedUser(null);
      setSelectedRole(defaultRole);
    }
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            placeholder={placeholder}
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            disabled={disabled}
            className="pr-10"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          )}
          {query && !loading && (
            <button
              onClick={() => handleInputChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Dropdown results */}
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
              {error ? (
                <div className="p-3 text-sm text-red-600">{error}</div>
              ) : results.length === 0 && query.length >= 2 ? (
                <div className="p-3 text-sm text-gray-500">
                  No users found. Make sure they have a FollowThru account in your organization.
                </div>
              ) : (
                results.map((user) => (
                  <button
                    key={user.userId}
                    onClick={() => handleSelectUser(user)}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors ${
                      selectedUser?.userId === user.userId ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">
                          {user.displayName || user.fullName}
                        </div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                        {user.jobTitle && (
                          <div className="text-xs text-gray-500">{user.jobTitle}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded capitalize">
                          {user.orgRole.replace('_', ' ')}
                        </span>
                        {selectedUser?.userId === user.userId && (
                          <Check className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {showRoleSelector && selectedUser && allowedRoles.length > 1 && (
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as 'team_lead' | 'member')}
            className="px-3 py-2 border border-gray-200 rounded-md text-sm"
          >
            {allowedRoles.map((role) => (
              <option key={role} value={role}>
                {role === 'team_lead' ? 'Lead' : 'Employee'}
              </option>
            ))}
          </select>
        )}

        <Button
          onClick={handleAdd}
          disabled={!selectedUser || disabled}
        >
          Add
        </Button>
      </div>

      {/* Selected user display */}
      {selectedUser && (
        <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
          <div className="font-medium text-gray-900">
            {selectedUser.displayName || selectedUser.fullName}
          </div>
          <div className="text-xs text-gray-600">{selectedUser.email}</div>
          {showRoleSelector && (
            <div className="text-xs text-gray-600 mt-1">
              Role: <span className="font-medium capitalize">{selectedRole.replace('_', ' ')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
