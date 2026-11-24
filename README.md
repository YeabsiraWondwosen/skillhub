# SkillHub

SkillHub is a full-stack freelance marketplace designed for client-freelancer collaboration, project delivery, and secure payment workflows.

## Overview

The platform supports the full lifecycle of freelance work:

- job posting and hiring
- proposal review and freelancer selection
- project and contract tracking
- milestone and escrow management
- delivery review and payment release
- messaging, reviews, and analytics

## Tech Stack

### Backend
- Node.js
- Express.js
- MongoDB + Mongoose
- JWT authentication
- Socket.IO
- Joi validation
- Cloudinary for file uploads
- AI integrations with Gemini/OpenAI providers

### Frontend
- React
- Vite
- React Router
- TanStack Query
- Tailwind CSS
- Zustand
- Framer Motion
- i18next

## Project Structure

```text
skillhub/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── validations/
│   │   ├── app.js
│   │   ├── server.js
│   │   └── ...
│   ├── package.json
│   ├── .env.example
│   └── render.yaml
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── package.json
├── PLAN.md
├── README.md
└── dev/
```

## Application Workflow

The product is structured around a clear work lifecycle:

1. Client posts a job
2. Freelancers apply
3. Client selects a freelancer
4. Contract and escrow flow begins
5. Freelancer submits work
6. Client reviews delivery
7. Funds are released on approval
8. Project is marked complete

## Setup

### 1. Install dependencies

```bash
npm install
npm install --workspace=backend
npm install --workspace=frontend
```

### 2. Configure environment variables

Create environment files based on the examples:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

At minimum, the backend requires:

- MONGODB_URI
- JWT_ACCESS_SECRET
- JWT_REFRESH_SECRET

### 3. Run the app

From the root:

```bash
npm run dev
```

This starts the backend and frontend together.

## Useful Commands

```bash
# root
npm run dev
npm run build

# backend
cd backend
npm run dev
npm run start

# frontend
cd frontend
npm run dev
npm run build
npm run preview
```

## Local URLs

- Frontend: http://localhost:5173
- Backend API: http://localhost:5001

## Notes

- Payment mode defaults to demo for local development.
- The app uses canonical project/payment state to avoid stale UI labels such as “Not Started” after a project has actually begun or completed.
- The backend should be restarted if a stale Node process keeps the API port occupied.

## License

This project is for internal development and product iteration within the current workspace. Please confirm licensing terms before public use or distribution.

## Key Application Areas

### Authentication and user management

- auth controllers, middleware, routes, JWT strategy
- profile and account settings flows

### Jobs and hiring

- posting jobs
- receiving proposals
- selecting freelancers
- managing job lifecycle states

### Contracts and payments

- escrow logic
- contract build DTOs
- project payment and milestone releases
- completed vs pending status resolution

### Messaging and collaboration

- real-time chat
- conversation management
- recent message history for contracts and jobs

### Admin and finance

- analytics dashboards
- finance reports
- commission tracking
- project and payment monitoring

### AI features

- AI provider initialization
- support assistant flows
- content generation or automation features

## Notes for Development

- The backend runs in demo payment mode by default for local development.
- Stale listeners or old Node processes can sometimes keep the port occupied; if this happens, check for the running process and restart the backend cleanly.
- Status logic should be derived from canonical project/payment data rather than raw field values alone when rendering completed states.

## License

This project is intended for internal use and product development within the current workspace. Licensing terms should be confirmed with the project owner before public release or distribution.

## Project Goal

SkillHub aims to provide a polished, reliable, and developer-friendly freelance platform that supports real-project workflows from discovery to payment completion.
