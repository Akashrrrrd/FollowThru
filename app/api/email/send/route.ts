import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase-server';
import { getEmailProvider } from '@/lib/email-provider';

export async function POST(request: NextRequest) {
  try {
    const userResult = await getUserFromRequest(request);
    if (!userResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { to, subject, html } = body;

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'to, subject, and html required' },
        { status: 400 },
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Send email using configured provider (Resend or Console)
    const emailProvider = getEmailProvider();
    try {
      await emailProvider.send(to, subject, html);
      return NextResponse.json({
        success: true,
        message: 'Email sent successfully',
      });
    } catch (sendError) {
      console.error('Email provider error:', sendError);
      return NextResponse.json(
        { error: 'Failed to send email' },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('Send email error:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 },
    );
  }
}
