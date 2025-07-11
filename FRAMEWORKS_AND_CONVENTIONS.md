# Frameworks and Conventions Guide

## Overview
This document outlines all frameworks, libraries, and conventions used in the TDRIPlanner road asset management system. Always reference this guide when making changes to ensure consistency and maintain architectural integrity.

## Frontend Architecture

### Core Framework
- **React 18** with **TypeScript**
  - Why: Type safety, component-based architecture, excellent ecosystem
  - Convention: Use functional components with hooks, avoid class components

### UI Framework & Styling
- **Tailwind CSS** for utility-first styling
  - Why: Rapid development, consistent design system, excellent mobile-first approach
  - Convention: Use Tailwind classes directly, avoid custom CSS unless absolutely necessary

- **Shadcn/UI** for component library
  - Why: High-quality, accessible components built on Radix UI primitives
  - Convention: Import from `@/components/ui/*`, customize through variants when needed
  - Location: All UI components in `client/src/components/ui/`

### State Management
- **TanStack Query (React Query)** for server state
  - Why: Excellent caching, background updates, optimistic updates
  - Convention: Use `useQuery` for GET requests, `useMutation` for POST/PUT/DELETE
  - Configuration: Global query client in `client/src/lib/queryClient.ts`

- **React Context** for global application state
  - Why: Built-in React solution for authentication and tenant context
  - Convention: Use for authentication state, tenant selection, and app-wide settings
  - Location: Context providers in `client/src/hooks/`

### Routing
- **Wouter** for client-side routing
  - Why: Lightweight, simple API, TypeScript support
  - Convention: Define routes in `client/src/App.tsx`, use `<Link>` for navigation
  - Protected routes: Use `ProtectedRoute` component for authentication

### Forms & Validation
- **React Hook Form** with **Zod** validation
  - Why: Excellent performance, TypeScript integration, schema validation
  - Convention: Use `useForm` hook with `zodResolver`
  - Schema location: Shared schemas in `shared/schema.ts`

### Data Visualization
- **Recharts** for charts and graphs
  - Why: React-native charts, good customization, responsive
  - Convention: Use for dashboard analytics and reporting

- **Leaflet** with **React-Leaflet** for maps
  - Why: Open-source mapping, excellent performance, extensive plugin ecosystem
  - Convention: Custom map components in `client/src/components/ui/map.tsx`

### Animation & Interactions
- **Framer Motion** for animations
  - Why: Declarative animations, excellent performance, React integration
  - Convention: Use for UI transitions, loading states, and interactive elements

## Backend Architecture

### Core Framework
- **Express.js** with **TypeScript**
  - Why: Mature ecosystem, excellent middleware support, TypeScript compatibility
  - Convention: Use async/await, proper error handling middleware

### Database & ORM
- **PostgreSQL** with **Neon** serverless driver
  - Why: Robust relational database, JSON support, excellent performance
  - Convention: Use connection pooling, prepared statements via Drizzle

- **Drizzle ORM** with **Drizzle Kit**
  - Why: Type-safe, excellent TypeScript integration, performant
  - Convention: Schema definitions in `shared/schema.ts`
  - Migrations: Use `npm run db:push` for schema changes

### Authentication & Sessions
- **Express Session** with **Connect-PG-Simple**
  - Why: Secure server-side sessions, PostgreSQL store for persistence
  - Convention: Session-based authentication, magic link email login

- **SendGrid** for email services
  - Why: Reliable email delivery, good API, professional features
  - Convention: Magic link authentication, system notifications

### External APIs
- **OpenWeatherMap** for weather data
  - Why: Comprehensive weather data, good API, reasonable pricing
  - Convention: Background job processing, data caching

- **Google Maps API** for Street View
  - Why: High-quality street imagery, extensive coverage
  - Convention: Asset documentation, visual inspection support

## Development Tools

### Build System
- **Vite** for frontend development
  - Why: Fast HMR, excellent TypeScript support, modern bundling
  - Convention: Use for development server, production builds

- **TSX** for TypeScript execution
  - Why: Direct TypeScript execution, no compilation step needed
  - Convention: Use for server development, script execution

### Code Quality
- **TypeScript** throughout the application
  - Why: Type safety, better tooling, catch errors at compile time
  - Convention: Strict mode enabled, no `any` types unless absolutely necessary

## Project Structure Conventions

### Directory Organization
```
├── client/src/
│   ├── components/ui/     # Reusable UI components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions and configurations
│   ├── pages/            # Page components
│   └── App.tsx           # Main application component
├── server/
│   ├── routes.ts         # API route definitions
│   ├── storage.ts        # Database abstraction layer
│   ├── auth.ts           # Authentication middleware
│   └── index.ts          # Server entry point
├── shared/
│   └── schema.ts         # Shared type definitions and schemas
```

### Naming Conventions
- **Files**: kebab-case for regular files, PascalCase for React components
- **Functions**: camelCase
- **Components**: PascalCase
- **Constants**: UPPER_SNAKE_CASE
- **Database tables**: snake_case
- **API endpoints**: kebab-case

### Import Conventions
- **Absolute imports**: Use `@/` alias for client-side imports
- **Shared imports**: Use `@shared/` for shared code
- **External libraries**: Import from package names
- **Order**: External libraries first, then internal modules

## Multi-Tenant Architecture

### Data Isolation
- **Tenant-based filtering** at the database level
- **User-tenant relationships** with role-based permissions
- **Context switching** for tenant selection

### Security Conventions
- **Session-based authentication** with secure cookies
- **Role-based access control** per tenant
- **Input validation** using Zod schemas
- **SQL injection prevention** through parameterized queries

## Performance Optimization

### Database
- **Indexed queries** for frequently accessed data
- **Connection pooling** for database connections
- **Spatial filtering** for geographic queries
- **Pagination** for large datasets

### Frontend
- **Viewport-based loading** for map data
- **Memoization** for expensive calculations
- **Lazy loading** for route components
- **Optimistic updates** for user interactions

## API Design Conventions

### RESTful Endpoints
- **GET** for data retrieval
- **POST** for data creation
- **PUT** for data updates
- **DELETE** for data removal

### Response Format
- **JSON** for all API responses
- **Error handling** with proper HTTP status codes
- **Consistent response structure**

### Authentication
- **Middleware-based** authentication checks
- **Session validation** for protected routes
- **Tenant context** injection for multi-tenant operations

## Error Handling

### Frontend
- **React Error Boundaries** for component errors
- **Toast notifications** for user feedback
- **Loading states** for async operations
- **Retry mechanisms** for failed requests

### Backend
- **Centralized error handling** middleware
- **Structured logging** for debugging
- **Graceful degradation** for external API failures
- **Database transaction rollbacks** for data consistency

## Testing Conventions

### Frontend Testing
- **Unit tests** for utility functions
- **Component tests** for React components
- **Integration tests** for API interactions

### Backend Testing
- **API endpoint tests** for route handlers
- **Database integration tests** for storage operations
- **Authentication tests** for security features

## Environment Configuration

### Environment Variables
- **DATABASE_URL**: PostgreSQL connection string
- **SENDGRID_API_KEY**: Email service authentication
- **OPENWEATHERMAP_API_KEY**: Weather data access
- **GOOGLE_MAPS_API_KEY**: Street view functionality
- **SESSION_SECRET**: Session encryption key

### Development vs Production
- **Development**: Use local environment variables
- **Production**: Use secure environment variable injection
- **Staging**: Mirror production configuration

## Code Review Guidelines

### Pull Request Standards
- **Type safety**: All TypeScript errors resolved
- **Console warnings**: No unnecessary console.log statements
- **Error handling**: Proper error boundaries and try-catch blocks
- **Performance**: Consider impact on rendering and database queries

### Architecture Decisions
- **Consistency**: Follow established patterns in the codebase
- **Documentation**: Update this file when adding new frameworks
- **Testing**: Include tests for new functionality
- **Security**: Consider multi-tenant implications

## Common Patterns

### Data Fetching
```typescript
// Use TanStack Query for server state
const { data, isLoading, error } = useQuery({
  queryKey: ['/api/endpoint'],
  queryFn: getQueryFn()
});
```

### Form Handling
```typescript
// Use React Hook Form with Zod validation
const form = useForm<FormData>({
  resolver: zodResolver(formSchema),
  defaultValues: {}
});
```

### API Routes
```typescript
// Use consistent error handling
app.get('/api/endpoint', async (req, res) => {
  try {
    const result = await storage.getData();
    res.json(result);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

## Future Considerations

### Scalability
- **Database sharding** for large datasets
- **Caching layers** for frequently accessed data
- **CDN integration** for static assets
- **Microservices** for complex business logic

### Feature Additions
- **Real-time updates** using WebSockets
- **Offline support** with service workers
- **Mobile applications** using React Native
- **Advanced analytics** with machine learning

---

**Last Updated**: January 2025
**Version**: 1.0

Remember to update this document when introducing new frameworks, changing conventions, or making architectural decisions that affect the development process.