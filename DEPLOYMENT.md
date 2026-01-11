# Deployment Guide

This document explains how to deploy samthegeek.net to Netlify using GitHub Actions.

## Prerequisites

1. A Netlify account (sign up at https://netlify.com)
2. This repository pushed to GitHub
3. GitHub repository secrets configured

## Setup Steps

### 1. Create a New Site on Netlify

1. Log in to Netlify
2. Click "Add new site"
3. You can skip the Git integration since we're using GitHub Actions
4. Note your **Site ID** from Site Settings > General > Site details > Site ID

### 2. Generate Netlify Personal Access Token

1. Go to User Settings > Applications > Personal Access Tokens
2. Click "New access token"
3. Give it a descriptive name (e.g., "GitHub Actions - samthegeek.net")
4. Copy the token (you won't be able to see it again)

### 3. Add GitHub Secrets

Go to your GitHub repository settings:

1. Navigate to Settings > Secrets and variables > Actions
2. Click on **"Secrets"** tab and add:
   - Name: `NETLIFY_AUTH_TOKEN` → Value: Your personal access token from step 2
3. Click on **"Variables"** tab and add:
   - Name: `NETLIFY_SITE_ID` → Value: Your site ID from step 1 (not sensitive, so it's a variable not a secret)

### 4. Configure Custom Domain (Optional)

1. In Netlify, go to Site Settings > Domain management
2. Add your custom domain: `samthegeek.net`
3. Follow Netlify's instructions to update your DNS settings
4. Netlify will automatically provision an SSL certificate from Let's Encrypt

### 5. DNS Configuration

If using a custom domain, update your DNS records:

**For root domain (samthegeek.net):**
- Type: A
- Name: @
- Value: (Netlify will provide the IP address)

**Or use ALIAS/ANAME if your DNS provider supports it:**
- Type: ALIAS or ANAME
- Name: @
- Value: (your-site-name).netlify.app

**For www subdomain:**
- Type: CNAME
- Name: www
- Value: (your-site-name).netlify.app

## SSL Certificate (Let's Encrypt)

Netlify automatically handles SSL certificates:

1. Once your custom domain is configured and DNS is propagated
2. Netlify will automatically provision a Let's Encrypt certificate
3. This happens automatically - no manual configuration needed
4. Certificates are automatically renewed before expiration
5. HTTPS is enforced by default

## Deployment Process

### Automatic Deployment

Every push to the `main` branch triggers an automatic deployment:

1. GitHub Actions runs the build process
2. The build artifact (`dist` folder) is deployed to Netlify
3. You'll receive a deployment notification

### Manual Deployment

You can also deploy manually using Netlify CLI:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod
```

## Monitoring Deployments

- **GitHub Actions**: Check the Actions tab in your GitHub repository
- **Netlify Dashboard**: View deployment logs and status in your Netlify dashboard
- **Deploy Previews**: Pull requests will generate preview deployments automatically

## Troubleshooting

### Build Fails

- Check GitHub Actions logs for error messages
- Ensure all dependencies are listed in `package.json`
- Verify Node version compatibility

### SSL Certificate Issues

- DNS propagation can take up to 48 hours
- Verify DNS records are correct in your domain provider
- Check Netlify's domain settings for any warnings

### Site Not Updating

- Clear your browser cache
- Check that the deployment succeeded in Netlify dashboard
- Verify the correct branch is being deployed

### Visible Redirect Interstitial on `/`

If users see a visible redirect message on the homepage:

1. Ensure `public/_redirects` contains a forced rule like `/ /<latest> 302!`.
2. If it still appears, remove `src/pages/index.astro` and rely on Netlify redirects only.
3. As a fallback, render the newest gallery at `/` and use `history.replaceState` to update the URL.

## Environment Variables

If you need to add environment variables:

1. In Netlify: Site Settings > Environment variables
2. Add variables as needed
3. Redeploy for changes to take effect

### Lightbox Map Embed Key (Optional)

To enable the lightbox map panel in production, add:

- Name: `PUBLIC_GOOGLE_MAPS_STATIC_API_KEY`
- Value: A Google Maps Static Maps API key restricted by HTTP referrer (e.g., `https://samthegeek.net/*`)

Optional fallback:
- Name: `PUBLIC_GOOGLE_MAPS_EMBED_API_KEY`
- Value: A Google Maps Embed API key restricted by HTTP referrer (e.g., `https://samthegeek.net/*`)

These keys are exposed in client-side HTML, so the referrer restriction and limiting enabled APIs are required.

## Support

- Netlify Docs: https://docs.netlify.com
- Astro Docs: https://docs.astro.build
- GitHub Actions Docs: https://docs.github.com/en/actions
