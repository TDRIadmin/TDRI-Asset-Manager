# Road Asset Management System

## Overview

This is a comprehensive road asset management system built with TypeScript, React, and PostgreSQL. The application provides multi-tenant support for managing road assets, maintenance projects, budget planning, and moisture monitoring across different municipalities or organizations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

**📋 Framework Reference**: See `FRAMEWORKS_AND_CONVENTIONS.md` for detailed documentation of all frameworks, libraries, and coding conventions used in this project.

### Frontend Architecture
- **Framework**: React with TypeScript
- **UI Components**: Shadcn/UI components with Tailwind CSS
- **State Management**: TanStack Query for server state, React Context for global state
- **Routing**: Wouter for client-side routing
- **Maps**: Leaflet for interactive mapping functionality
- **Charts**: Recharts for data visualization
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM with type-safe queries
- **Authentication**: Session-based auth with magic link email login
- **File Processing**: CSV import/export capabilities
- **External APIs**: OpenWeatherMap, Google Maps Street View

### Multi-Tenant System
- Tenant isolation at the database level
- Role-based access control per tenant
- System administrators can access all tenants
- User-tenant relationships with specific roles and permissions

## Key Components

### Core Data Models
1. **Road Assets**: Basic road infrastructure with condition tracking
2. **Roadway Assets**: Detailed asset inventory (signs, markings, structures)
3. **Asset Types**: Configurable asset categories with custom fields
4. **Maintenance Projects**: Planned and completed maintenance work
5. **Budget Allocations**: Financial planning and tracking
6. **Moisture Monitoring**: Environmental data collection and hotspot detection

### Authentication System
- Magic link email authentication using SendGrid
- Session management with Express sessions
- Protected routes with authentication middleware
- User roles and permissions per tenant

### Asset Management
- Interactive map view with condition visualization
- Asset inventory with custom fields and inspections
- Maintenance scheduling and tracking
- Condition rating systems with visual indicators

### Data Analysis Features
- Deterioration modeling and forecasting
- Budget optimization scenarios
- Moisture hotspot identification
- Rainfall correlation analysis
- Condition distribution analytics

## Data Flow

1. **User Authentication**: Magic link → Session creation → User context
2. **Tenant Selection**: User selects tenant → Context updates → Data filtering
3. **Asset Data**: Database → Drizzle ORM → API endpoints → React Query → UI
4. **External Data**: Weather APIs → Background jobs → Database storage
5. **Real-time Updates**: Database changes → Query invalidation → UI refresh

## External Dependencies

### Required Services
- **PostgreSQL Database**: Primary data storage (configured for Neon)
- **SendGrid**: Email service for magic link authentication
- **OpenWeatherMap API**: Weather data for rainfall analysis
- **Google Maps API**: Street view images for asset documentation

### Optional Services
- **TensorFlow.js**: Machine learning for advanced deterioration modeling
- **Cheerio**: Web scraping capabilities
- **PDF Generation**: Asset reports and documentation export

## Deployment Strategy

### Development Setup
- Vite dev server for frontend with HMR
- Express server with TypeScript compilation
- Database migrations using Drizzle Kit
- Environment variables for API keys and database connection

### Production Build
- Vite builds static frontend assets
- ESBuild bundles server code
- Database schema managed through migrations
- Docker-ready configuration

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `SENDGRID_API_KEY`: Email service authentication
- `OPENWEATHERMAP_API_KEY`: Weather data access
- `GOOGLE_MAPS_API_KEY`: Street view functionality
- `SESSION_SECRET`: Session encryption key

### Database Schema
The system uses a comprehensive schema with proper relationships:
- Multi-tenant architecture with tenant isolation
- Asset management with flexible custom fields
- Maintenance tracking with project workflows
- User management with role-based permissions
- Audit logging for all system changes

### Key Features
- Real-time data synchronization
- Responsive design for mobile and desktop
- Comprehensive data import/export
- Advanced analytics and reporting
- Integration with external weather services
- Asset visualization on interactive maps