# The Corporate Desk — Premium Office Furniture Website

## Overview
The Corporate Desk project is a luxury office furniture website (`thecorporatedesk.com.au`) designed for lead generation. It features a comprehensive AI-powered business operating system with 14 specialized roles, an interactive quote builder, a finance calculator, case studies, a marketing hub, an admin dashboard, an AI lead intelligence prospecting engine, and an AI Workspace Planning Platform. The platform provides visual zone layouts, furniture recommendations, project cost estimates, lead scoring, and downloadable planning reports, targeting a project value range of $30,000 – $300,000+.

## User Preferences
I prefer iterative development with clear, modular code. Before making any major architectural changes or introducing new external dependencies, please ask for approval. I prefer detailed explanations for complex solutions. Do not make changes to the `server/db.ts` file without explicit instruction. Do not make changes to the `client/src/lib/furnitureCatalogue.ts` file without explicit instruction.

## System Architecture
The application follows a client-server architecture.
- **Frontend**: Built with React, utilizing Wouter for routing, TanStack Query for data fetching, and Shadcn UI for components.
- **Backend**: Implemented using Express.js.
- **Database**: PostgreSQL (Replit auto-provisioned) with Drizzle ORM for data persistence. The schema (`shared/schema.ts`) includes tables for users, leads, prospected leads, supplier quotes, referrals, and planning requests.
- **UI/UX Design**: The theme is dark luxury gold, featuring near-black backgrounds, rich gold accents (#C9A84C), and cream white text. Typography uses Playfair Display for headings and Inter for body text, inspired by Apple/Herman Miller's minimalist and premium aesthetic.
- **AI Integration**: OpenAI's `gpt-5-mini` model is used via Replit AI Integrations for the AI chatbot (14-role business OS), marketing content generation, and lead prospecting. AI prompts are designed to inject the TCD furniture catalogue for tailored recommendations.
- **Core Features**:
    - **Interactive Quote Builder**: A 5-step multi-form with live estimates and an AI Quoting Advisor.
    - **AI Workspace Planning Platform**: Generates detailed plans including lead scores, estimated project values, timelines, workspace zones (with specific color coding), product recommendations, and cost breakdowns.
    - **AI Lead Intelligence & Prospecting Engine**: Ingests leads from multiple sources, uses AI to extract company details, needs, and signals, and includes deduplication logic and batch processing capabilities.
    - **Marketing Hub**: Enables AI-generated content creation and direct posting to various marketing channels.
    - **Admin Dashboard**: Provides KPIs, recent lead overviews, lead type breakdown charts, and access to other admin functionalities.
    - **SEO Blog**: Client-side blog with 200 articles across 10 topic clusters, featuring search, category filters, and pagination.

## External Dependencies
- **Database**: PostgreSQL (Replit built-in)
- **ORM**: Drizzle ORM
- **Email**: Nodemailer (for SMTP email notifications)
- **AI**: OpenAI (via Replit AI Integrations)
- **Marketing Channels (API Integrations)**:
    - Telegram
    - Facebook
    - Instagram
    - X/Twitter
    - WhatsApp Business