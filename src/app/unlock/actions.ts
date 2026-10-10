'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { matchesViewPassword, VIEW_COOKIE, viewToken } from '@/data/activities';

export async function unlock(formData: FormData) {
  const password = formData.get('password');
  const token = viewToken(typeof password === 'string' ? password : '');
  if (!matchesViewPassword(token)) redirect('/unlock?error=1');

  (await cookies()).set(VIEW_COOKIE, token.toString('hex'), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect('/');
}
