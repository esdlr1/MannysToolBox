import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

/**
 * Auth principle: one sign-in is all the auth a user needs.
 * The session (JWT) is the single source of truth for the whole app.
 * We do not re-prompt for password, use step-up auth, or require extra
 * verification for tools or pages — the moment they sign in, they're in.
 *
 * Each tool lives on its own subdomain (estimate-comparison.mannystoolbox.com,
 * scope-check.mannystoolbox.com, ...). For one sign-in to cover all of them,
 * the session cookie must be scoped to the parent domain (.mannystoolbox.com),
 * not the single host it was set on. Otherwise every subdomain looks logged
 * out and re-prompts.
 */

/** Shared parent domain for cookies, derived from NEXTAUTH_URL (override with
 *  COOKIE_DOMAIN). Undefined for localhost/IP → default host-only cookies. */
function sharedCookieDomain(): string | undefined {
  if (process.env.COOKIE_DOMAIN) return process.env.COOKIE_DOMAIN
  const url = process.env.NEXTAUTH_URL
  if (!url) return undefined
  try {
    const host = new URL(url).hostname
    if (host === 'localhost' || /^[\d.]+$/.test(host)) return undefined
    const parts = host.split('.')
    if (parts.length < 2) return undefined
    return '.' + parts.slice(-2).join('.') // e.g. www.mannystoolbox.com → .mannystoolbox.com
  } catch {
    return undefined
  }
}

const cookieDomain = sharedCookieDomain()
const secureCookies = (process.env.NEXTAUTH_URL ?? '').startsWith('https://')

/**
 * Custom cookie config only when a shared domain applies. Note: the CSRF
 * cookie normally uses the __Host- prefix, which the spec forbids from
 * carrying a domain — so on a shared domain it becomes __Secure- instead.
 */
const sharedCookies = cookieDomain
  ? {
      sessionToken: {
        name: `${secureCookies ? '__Secure-' : ''}next-auth.session-token`,
        options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: secureCookies, domain: cookieDomain },
      },
      callbackUrl: {
        name: `${secureCookies ? '__Secure-' : ''}next-auth.callback-url`,
        options: { sameSite: 'lax' as const, path: '/', secure: secureCookies, domain: cookieDomain },
      },
      csrfToken: {
        name: `${secureCookies ? '__Secure-' : ''}next-auth.csrf-token`,
        options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: secureCookies, domain: cookieDomain },
      },
    }
  : undefined

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  ...(sharedCookies ? { cookies: sharedCookies } : {}),
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Normalize email to lowercase for case-insensitive lookup
        const normalizedEmail = credentials.email.toLowerCase().trim()

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail }
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        // Check approval status for Owner and Manager roles
        // Super Admin and Employee don't need approval
        if ((user.role === 'Owner' || user.role === 'Manager') && !user.isApproved) {
          throw new Error('PENDING_APPROVAL')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          isApproved: user.isApproved,
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign in - use user data
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.isApproved = (user as any).isApproved
      } else if (token.id) {
        // Token refresh - fetch fresh user data from database
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, isApproved: true },
          })
          if (dbUser) {
            token.role = dbUser.role
            token.isApproved = dbUser.isApproved
          }
        } catch (error) {
          console.error('Error fetching user data for JWT refresh:', error)
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string | null | undefined
        session.user.isApproved = token.isApproved as boolean | undefined
      }
      return session
    },
  },
}
