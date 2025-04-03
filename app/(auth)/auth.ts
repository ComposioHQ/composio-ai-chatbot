import NextAuth, { type User, type Session } from 'next-auth';
import GitHubProvider from 'next-auth/providers/github';

import { getUser, createUser } from '@/lib/db/queries';

import { authConfig } from './auth.config';

interface ExtendedSession extends Session {
  user: User & {
    provider?: string;
    githubId?: string;
    githubUsername?: string;
  };
}

// Extend the User type to include GitHub fields
declare module "next-auth" {
  interface User {
    provider?: string;
    githubId?: string;
    githubUsername?: string;
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // Initial sign in
      if (account && user) {
        // Include provider info in the token
        token.provider = account.provider;
        
        if (user.id) {
          // If we have a user ID (from database), use it
          token.id = user.id;
        }
        
        // For GitHub users, add additional profile info
        if (account.provider === 'github' && profile) {
          token.githubId = profile.id as string;
          token.githubUsername = profile.login as string;
        }
      }
      return token;
    },
    async session({
      session,
      token,
    }: {
      session: ExtendedSession;
      token: any;
    }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.provider = token.provider;
        
        // Add GitHub-specific info to session if available
        if (token.provider === 'github') {
          session.user.githubId = token.githubId;
          session.user.githubUsername = token.githubUsername;
        }
      }

      return session;
    },
    async signIn({ user, account, profile }) {
      // For GitHub auth
      if (account?.provider === 'github' && profile) {
        try {
          // TypeScript safe access to profile properties
          const githubProfile = profile as {
            email?: string;
            login?: string;
            name?: string;
            avatar_url?: string;
            id?: string;
          };
          
          console.log('GitHub sign-in attempt:', {
            profileId: githubProfile.id,
            user
          });
          
          const email = githubProfile.email || `${githubProfile.login}@github.com`;
          
          // Check if user already exists
          const existingUsers = await getUser(email);
          
          if (existingUsers.length === 0) {
            // Create new user with the SAME ID as the session
            try {
              // Extract the ID that NextAuth generated
              const nextAuthUserId = user.id;
              
              // Create user with this specific ID
              const result = await createUser({
                id: nextAuthUserId, // Pass the exact same ID
                email,
                name: githubProfile.name || githubProfile.login,
                image: githubProfile.avatar_url,
                githubId: githubProfile.id,
                provider: 'github'
              });
              
              console.log('User created successfully with ID:', nextAuthUserId);
            } catch (createError) {
              console.error('Error creating user:', createError);
              return false;
            }
          } else {
            // If user exists, ensure the ID matches
            if (user.id !== existingUsers[0].id) {
              console.log('Existing user found but ID mismatch, updating session ID');
              // Update the user object ID to match DB
              user.id = existingUsers[0].id;
            }
          }
          
          return true;
        } catch (error) {
          console.error('GitHub auth error:', error);
          return false;
        }
      }
      
      return false; // Only allow GitHub authentication
    }
  },
});
