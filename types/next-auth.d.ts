import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email?: string | null
      name?: string | null
      image?: string | null
      role?: string | null
      isApproved?: boolean
    }
  }

  interface User {
    id: string
    email?: string | null
    name?: string | null
    image?: string | null
    role?: string | null
    isApproved?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role?: string | null
    isApproved?: boolean
  }
}
