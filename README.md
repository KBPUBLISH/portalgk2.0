# GodlyKids Portal

Admin portal for managing GodlyKids content (books, playlists, lessons, games, voices, categories).

## Setup

### Prerequisites
- Node.js 18+
- Backend API running (locally or on Render)

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file with the following variables:

```env
# API Base URL - The backend API endpoint
# For local development:
VITE_API_BASE_URL=http://localhost:5001

# For production (Netlify), set this to your Render backend URL:
# VITE_API_BASE_URL=https://your-backend.onrender.com
```

### Development

```bash
npm run dev
```

The portal will be available at `http://localhost:5173`

### Production Build

```bash
npm run build
```

### Deployment (Netlify)

1. Connect your GitHub repository to Netlify
2. Set the build command: `npm run build`
3. Set the publish directory: `dist`
4. Add environment variable in Netlify dashboard:
   - `VITE_API_BASE_URL` = `https://your-render-backend-url.onrender.com`

## Architecture

### API Client (`src/services/apiClient.ts`)

All API calls use a centralized axios client that:
- Reads `VITE_API_BASE_URL` from environment
- Defaults to `http://localhost:5001` for local development
- Provides helpers for media URLs and uploads

### Backend Connection

The portal connects to:
- **Development**: Local backend at `http://localhost:5001`
- **Production**: Render backend (configured via `VITE_API_BASE_URL`)

Both environments use the same MongoDB database and Google Cloud Storage bucket when the backend is properly configured.

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- Axios for API calls
- React Router for navigation
