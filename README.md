# Manny's ToolBox

A multi-tool website with AI assistance capabilities. Each tool is accessible via its own subdomain (e.g., `tool1.mannystoolbox.com`), with the main domain (`www.mannystoolbox.com`) serving as the hub with a tool selection dropdown.

## Features

- 🔐 **User Authentication** - Sign up, sign in, and user profiles
- 🌐 **Subdomain Routing** - Each tool has its own subdomain
- 🛠️ **Categorized Tools** - Multiple AI-powered tools organized by category
- 🤖 **OpenAI Integration** - AI assistance for tools that need it
- 📁 **File Upload/Download** - Handle file processing for tools
- 💾 **Save Work** - Users can save their work and access it later
- 📊 **Usage History** - Track user activity and tool usage
- 📱 **Mobile Responsive** - Fully responsive design with mobile support
- 🎨 **Red Accent Theme** - Beautiful UI with red accent colors

## Architecture

### Subdomain Structure

- **Main Domain**: `www.mannystoolbox.com` - Tool selection hub
- **Tool Subdomains**: `{tool-subdomain}.mannystoolbox.com` - Individual tool pages

### Example URLs

- Main site: `https://www.mannystoolbox.com`
- Tool 1: `https://tool1.mannystoolbox.com`
- Tool 2: `https://tool2.mannystoolbox.com`

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **AI**: OpenAI API
- **Styling**: Tailwind CSS
- **Deployment**: Railway

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database (pgAdmin4 or local PostgreSQL)
- OpenAI API key
- Domain with wildcard DNS configured (for subdomain routing)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd MannysToolBox
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/mannys_toolbox?schema=public"

   # NextAuth
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key-here-generate-with-openssl-rand-base64-32"

   # OpenAI
   OPENAI_API_KEY="your-openai-api-key-here"
   OPENAI_MODEL="gpt-4-turbo-preview"

   # Node Environment
   NODE_ENV="development"
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database
   npm run db:push
   ```

5. **Configure local development for subdomains**

   **Option A: Using hosts file (Recommended for local dev)**
   
   Edit your hosts file:
   - Windows: `C:\Windows\System32\drivers\etc\hosts`
   - Mac/Linux: `/etc/hosts`
   
   Add entries for each tool:
   ```
   127.0.0.1 tool1.localhost
   127.0.0.1 tool2.localhost
   ```

   **Option B: Using a local DNS service**
   
   Use a service like `dnsmasq` or configure your router.

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Access the application**
   - Main site: `http://localhost:3000`
   - Tool subdomains: `http://tool1.localhost:3000` (after hosts file setup)

## Database Setup

1. Create a PostgreSQL database (using pgAdmin4 or command line)
2. Update `DATABASE_URL` in `.env`:
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/mannys_toolbox?schema=public"
   ```
3. Run migrations:
   ```bash
   npm run db:push
   ```

## Adding New Tools

1. **Create a tool component** in `/tools/[toolId]/index.tsx`

2. **Register the tool** in `/lib/tools.ts`:
   ```typescript
   import { registerTool } from '@/lib/tools'
   
   registerTool({
     id: 'your-tool-id',
     name: 'Your Tool Name',
     description: 'Tool description',
     category: 'Category Name',
     subdomain: 'yourtool', // This will be yourtool.mannystoolbox.com
     usesAI: true, // if it uses AI
     supportsFileUpload: true, // if it handles files
   })
   ```

3. **Configure DNS** for the new subdomain:
   - Add wildcard DNS record: `*.mannystoolbox.com` → Your server IP
   - Or add specific subdomain: `yourtool.mannystoolbox.com` → Your server IP

## Project Structure

```
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── profile/           # User profile
│   ├── history/           # Usage history
│   ├── saved/             # Saved work
│   └── tools/             # Tool pages (accessed via subdomain)
├── components/            # React components
├── lib/                   # Utilities and configurations
│   ├── tools.ts          # Tool registry
│   └── ai.ts             # OpenAI integration
├── middleware.ts          # Subdomain routing middleware
├── prisma/                # Database schema
├── tools/                 # Individual tool implementations
└── types/                 # TypeScript type definitions
```

## Deployment to Railway

### DNS Configuration

1. **Set up wildcard DNS** for your domain:
   - Add DNS record: `*.mannystoolbox.com` → Railway IP/domain
   - Or add specific subdomains as needed

2. **Configure Railway**:
   - Connect your repository to Railway
   - Add environment variables in Railway dashboard:
     - `DATABASE_URL` (Railway can provision PostgreSQL)
     - `NEXTAUTH_SECRET`
     - `NEXTAUTH_URL` (your Railway app URL, e.g., `https://www.mannystoolbox.com`)
     - `OPENAI_API_KEY`
     - `OPENAI_MODEL`

3. **Railway will automatically**:
   - Install dependencies
   - Run `npm run build` (which includes Prisma generate)
   - Start the app with `npm start`

### Railway Subdomain Setup

Railway supports custom domains with wildcard subdomains. Configure:
- Main domain: `www.mannystoolbox.com`
- Wildcard: `*.mannystoolbox.com`

## How Subdomain Routing Works

1. **Middleware Detection**: The middleware (`middleware.ts`) detects the subdomain from the request headers
2. **Tool Lookup**: It looks up the tool by subdomain using `getToolBySubdomain()`
3. **Route Rewriting**: If a valid tool subdomain is detected, it rewrites the route to `/tools/[toolId]`
4. **Component Rendering**: The tool component is rendered based on the tool ID

## File Storage

Files are stored locally in the `uploads/` directory. For production, consider:
- Railway Volumes (persistent storage)
- AWS S3
- Cloudinary
- Other cloud storage solutions

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_URL` - Your app URL (main domain)
- `NEXTAUTH_SECRET` - Secret for NextAuth (generate with `openssl rand -base64 32`)
- `OPENAI_API_KEY` - Your OpenAI API key
- `OPENAI_MODEL` - Model to use (default: `gpt-4-turbo-preview`)

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run db:push` - Push Prisma schema to database
- `npm run db:generate` - Generate Prisma client
- `npm run db:studio` - Open Prisma Studio (database GUI)

## Development Notes

### Local Subdomain Testing

For local development, you can:
1. Use the hosts file method (see Installation step 5)
2. Access tools via: `http://tool1.localhost:3000`
3. The middleware will detect the subdomain and route accordingly

### Production Considerations

- Ensure wildcard DNS is configured correctly
- SSL certificates should cover all subdomains (use wildcard SSL)
- Railway handles SSL automatically for custom domains
- Consider rate limiting per subdomain if needed

## License

Private project - All rights reserved
