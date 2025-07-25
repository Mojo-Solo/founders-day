# Founders Day Minnesota - Event Management System

A comprehensive event management platform for Founders Day Minnesota, consisting of two integrated applications: a public-facing event website and an administrative dashboard.

## 🚀 Quick Start

```bash
# Clone the repository
git clone [repository-url]
cd founders-day

# Start both applications
./start-founders-day.sh

# Or start individually:
./founders-day-frontend/start-frontend.sh  # Public site on http://localhost:3000
./founders-day-admin/start-backend.sh      # Admin dashboard on http://localhost:3001
```

## 📋 Project Structure

```
founders-day/
├── founders-day-admin/      # Admin dashboard & backend API
│   ├── Backend API (100% complete)
│   └── Admin Frontend (40% complete)
├── founders-day-frontend/   # Public event website (90% complete)
└── docs/                    # Centralized documentation
```

## 🎯 Project Status

| Component | Completion | Description |
|-----------|------------|-------------|
| Backend API | 100% ✅ | RESTful API with Supabase, payment processing, email service |
| Admin Frontend | 95% ✅ | Dashboard, registration management, volunteer coordination (Jan 20 sprint!) |
| Public Frontend | 90% ✅ | Event info, registration, volunteer signup, schedule |

**🚀 Major Update**: Admin Frontend jumped from 40% to 95% in a single-day implementation sprint on January 20, 2025!

## 🛠️ Technology Stack

- **Frontend**: Next.js 15.3, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase, Square Payments
- **Infrastructure**: Vercel/Node.js, PostgreSQL, Redis
- **Development**: pnpm/npm, ESLint, Prettier

## 📚 Documentation

- **ACTUAL STATUS**: See `ACTUAL-PROJECT-STATUS.md` for the real completion status
- **Sprint Planning**: See `FOUNDERS-DAY-COMPREHENSIVE-ROADMAP.md`
- **Requirements**: See `founders-day-admin/PRODUCT_REQUIREMENTS_DOCUMENT.md`
- **Documentation Guide**: See `DOCUMENTATION-GUIDE.md` for navigation help
- **Getting Started**: See `docs/DEVELOPER-GUIDE.md` (coming soon)

## 🔧 Development

### Prerequisites
- Node.js 18+ 
- npm or pnpm
- Supabase account
- Square developer account (for payments)

### Environment Setup
1. Copy `.env.example` to `.env` in both projects
2. Configure Supabase credentials
3. Add Square API keys
4. Set up email service (Resend/SendGrid)

### Current Sprint (Jan 20 - Feb 3, 2025)
- **Focus**: Complete admin dashboard frontend
- **Branch**: `dev-sprint-1`
- **Progress**: See `FOUNDERS-DAY-COMPREHENSIVE-ROADMAP.md`

## 🤝 Contributing

1. Create feature branch from `dev-sprint-1`
2. Follow existing code patterns
3. Write tests for new features
4. Submit PR with detailed description

## 📊 Key Features

### Public Website (founders-day-frontend)
- ✅ Event information and countdown
- ✅ Online registration (multi-step)
- ✅ Volunteer signup system
- ✅ Event schedule viewer
- ✅ Mobile responsive design
- ✅ Accessibility (WCAG 2.1 AA)
- 🚧 Payment integration (Square)
- 🚧 Analytics tracking

### Admin Dashboard (founders-day-admin)
- ✅ Backend API (100% complete)
- ✅ Authentication & security
- ✅ Database management
- 🚧 Real-time dashboard
- 🚧 Registration management UI
- 🚧 Volunteer coordination
- 🚧 Financial reporting
- 🚧 Email campaigns

## 🚦 Monitoring

Access system health monitoring at:
- Frontend: http://localhost:3000/monitoring
- Admin: http://localhost:3001/api/health

## 📞 Support

- **Documentation Issues**: Check `DOCUMENTATION-GUIDE.md`
- **Development Setup**: See individual project READMEs
- **Bug Reports**: Create issue with reproduction steps

## 📝 License

[License information here]

---

**Last Updated**: January 21, 2025  
**Active Development Branch**: `dev-sprint-1`