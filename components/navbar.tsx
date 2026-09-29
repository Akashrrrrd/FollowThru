'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  LayoutDashboard,
  History,
  Plus,
  BarChart3,
  LogOut,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/components/auth-provider';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/meetings', label: 'Meetings', icon: History },
  { href: '/insights', label: 'Insights', icon: BarChart3 },
  { href: '/new', label: 'New Meeting', icon: Plus },
];

function getInitials(email: string): string {
  const username = email.split('@')[0];
  return username.slice(0, 2).toUpperCase();
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-blue-600" />
          <span className="text-lg font-semibold tracking-tight text-gray-900">
            FollowThru
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-1">
            {links.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href;
              return (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant={active ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'gap-1.5 text-sm',
                      active
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:text-gray-900',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{link.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>

          {user && (
            <div className="ml-2 flex items-center gap-2 border-l border-gray-200 pl-2">
              <Link href="/profile">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'gap-2',
                    pathname === '/profile'
                      ? 'bg-gray-100'
                      : 'hover:bg-gray-100',
                  )}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-blue-600 text-xs font-semibold text-white">
                      {getInitials(user.email || '')}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-xs text-gray-700 sm:inline">
                    Profile
                  </span>
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
