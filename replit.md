# Video Annotation App (glob)

## Overview
This is a video annotation application built with React, Vite, and Material-UI. It allows users to upload, edit, and annotate videos with various tools including player identification, timeline editing, and analyst dashboards.

## Tech Stack
- **Frontend**: React 18 with Vite
- **UI Libraries**: Material-UI, Radix UI, Tailwind CSS
- **State Management**: TanStack React Query
- **Backend/Database**: Supabase
- **External API**: Base44 API for entity management
- **Styling**: Tailwind CSS with clsx and tailwind-merge

## Project Structure
```
├── src/
│   ├── api/           # API clients (Supabase, Base44)
│   ├── Components/    # React components
│   │   ├── ui/        # Reusable UI components (Radix-based)
│   │   ├── video/     # Video-related components
│   │   └── analyst/   # Analyst dashboard components
│   ├── Pages/         # Page components
│   ├── Entities/      # Entity JSON schemas
│   ├── lib/           # Utility functions
│   └── utils/         # Helper utilities
├── index.html         # Vite entry HTML
├── vite.config.js     # Vite configuration
├── tailwind.config.js # Tailwind CSS configuration
└── package.json       # Node.js dependencies
```

## Running the Application
The app runs on port 5000 using the Vite development server:
```bash
npm run dev
```

## Pages
- **Home** (`/`) - Main landing page
- **Upload Video** (`/upload`) - Video upload interface
- **Video Editor** (`/videoeditor`) - Video editing and annotation tools
- **Analyst Dashboard** (`/analystdashboard`) - Analytics and insights
- **Admin** (`/admin`) - Administrative functions

## Environment Variables
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

## Deployment
Build for production:
```bash
npm run build
```
The built files will be in the `dist/` directory.
