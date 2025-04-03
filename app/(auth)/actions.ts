'use server';

import { signIn } from './auth';

// GitHub authentication action
export const githubAuth = async () => {
  try {
    return await signIn('github', { callbackUrl: '/' });
  } catch (error) {
    console.error('GitHub auth error:', error);
    return { error: 'Failed to authenticate with GitHub' };
  }
};

// Keeping these interfaces for backward compatibility
export interface LoginActionState {
  status: 'idle' | 'in_progress' | 'success' | 'failed' | 'invalid_data';
}

export interface RegisterActionState {
  status:
    | 'idle'
    | 'in_progress'
    | 'success'
    | 'failed'
    | 'user_exists'
    | 'invalid_data';
}
