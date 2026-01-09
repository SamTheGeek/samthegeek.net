# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the repository for samthegeek.net, a personal website built with Astro. The goal is to recreate the existing samthegeek.net website and deploy it via GitHub Actions to Netlify with SSL via Let's Encrypt.

## Technology Stack

- **Framework**: Astro (static site generator)
- **Node Version**: LTS (managed via NVM)
- **Deployment**: Netlify (via GitHub Actions)
- **SSL**: Let's Encrypt

## Project Goals

1. Create a relatively exact copy of the existing samthegeek.net
2. Configure automated deployment using GitHub Actions to Netlify
3. Set up SSL certificate from Let's Encrypt
4. Prepare for production deployment

## Development Setup

### Prerequisites

- NVM (Node Version Manager)
- Node LTS (installed via NVM)

### Development Commands

```bash
# Install Node LTS via NVM
nvm install --lts
nvm use --lts

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture

The project uses Astro's file-based routing system:

- `src/pages/` - Page components that map to routes
- `src/layouts/` - Layout components for consistent page structure
- `src/components/` - Reusable UI components
- `public/` - Static assets served as-is

## Deployment

Deployment is automated via GitHub Actions:

- Push to main branch triggers build
- Build artifacts are deployed to Netlify
- SSL certificates are managed by Let's Encrypt through Netlify
