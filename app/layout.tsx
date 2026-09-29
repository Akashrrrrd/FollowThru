import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth-provider';
import { ProfileCheck } from '@/components/profile-check';
import { CurrentUserProvider } from '@/lib/current-user-context';
import { Navbar } from '@/components/navbar';

export const metadata: Metadata = {
  title: 'FollowThru',
  description:
    'Paste any meeting transcript and FollowThru uses AI to extract every commitment with owners, deadlines, and the exact quote it came from.',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <CurrentUserProvider>
            <ProfileCheck>
              <div className="min-h-screen bg-[#FAFAFA]">
                <Navbar />
                {children}
              </div>
            </ProfileCheck>
          </CurrentUserProvider>
        </AuthProvider>
      </body>
    </html>
  );
}