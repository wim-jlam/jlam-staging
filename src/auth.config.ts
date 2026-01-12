import type { NextAuthConfig } from 'next-auth'
import Keycloak from 'next-auth/providers/keycloak'

export const authConfig: NextAuthConfig = {
  providers: [
    Keycloak({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER,
      // Map Keycloak profile to user fields
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name ?? profile.preferred_username,
          email: profile.email,
          image: profile.picture,
        }
      },
    }),
  ],
  callbacks: {
    // Ensure the user object includes the Keycloak sub as id
    jwt({ token, profile }) {
      if (profile?.sub) {
        token.sub = profile.sub
      }
      return token
    },
  },
}
