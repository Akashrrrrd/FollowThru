import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * Get current authenticated user's ID
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 },
      );
    }

    return NextResponse.json({
      userId: user.userId,
      message: 'Copy your userId and run this SQL in Supabase to fix your tasks:',
      sql: `UPDATE tasks SET user_id = '${user.userId}' WHERE user_id != '${user.userId}';`
    });
  } catch (err) {
    console.error('Auth me error:', err);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
