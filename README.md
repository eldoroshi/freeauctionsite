# FreeAuctionSite - Auction Display Tool

Free, simple auction display software for schools, nonprofits, churches, and fundraisers.

## 🚀 Quick Start

1. Open `index.html` in a browser
2. Add auction items using the tool
3. Click "Launch Display" to get shareable links
4. Open display link on a TV/projector

## 📁 File Structure

```
auction-display-tool/
├── index.html                 # Homepage + working tool
├── display.html               # Fullscreen display viewer
├── css/
│   └── style.css              # All styles
├── js/
│   └── app.js                 # Tool functionality
├── pages/
│   ├── silent-auction-display.html
│   ├── school-auction-display.html
│   ├── nonprofit-auction-display.html
│   ├── church-auction-display.html
│   ├── gala-auction-display.html
│   ├── sports-booster-auction-display.html
│   ├── auction-leaderboard.html
│   └── alternatives/
│       ├── givebutter-alternative.html
│       ├── galabid-alternative.html
│       └── handbid-alternative.html
└── README.md
```

## 🎯 SEO Pages Included

### Use Case Pages (target specific audiences)
- `/school-auction-display` - PTA, sports boosters, school galas
- `/nonprofit-auction-display` - Charity events, benefit dinners
- `/church-auction-display` - Ministry fundraisers, mission trips
- `/gala-auction-display` - Black-tie events, formal fundraisers
- `/sports-booster-auction-display` - Athletic fundraisers
- `/silent-auction-display` - General silent auction
- `/auction-leaderboard` - Leaderboard-focused display

### Alternative Pages (capture competitor searches)
- `/alternatives/givebutter-alternative`
- `/alternatives/galabid-alternative`
- `/alternatives/handbid-alternative`

## 🔧 Deployment

### Option 1: Static Hosting (Recommended)
- Vercel: `vercel deploy`
- Netlify: Drag & drop folder
- Cloudflare Pages: Connect to repo
- GitHub Pages: Push to gh-pages branch

### Option 2: Any Web Server
Just upload all files to any web server. No build step required.

## 🎨 Customization

### Colors
Edit CSS variables in `css/style.css`:
```css
:root {
    --primary: #6366f1;
    --accent: #10b981;
    /* etc */
}
```

### Branding
Replace "FreeAuctionSite" with your brand name in:
- All HTML files (logo text)
- Footer powered-by text in display.html

## 📊 SEO Checklist

- [x] Unique title tags per page
- [x] Meta descriptions
- [x] Canonical URLs
- [x] Internal linking structure
- [x] Schema markup (homepage)
- [x] Mobile responsive
- [x] Fast loading (static HTML)

## 🚀 Marketing Launch Checklist

1. **Week 1**
   - [ ] Register domain
   - [ ] Deploy to hosting
   - [ ] Submit to Google Search Console
   - [ ] Submit sitemap

2. **Week 2**
   - [ ] Product Hunt launch
   - [ ] Post in r/nonprofit
   - [ ] Submit to AlternativeTo
   - [ ] Submit to Capterra

3. **Week 3+**
   - [ ] Monitor rankings
   - [ ] Add more use case pages
   - [ ] Create blog content
   - [ ] Outreach to nonprofit blogs

## 💰 Monetization

The site is set up for a freemium model:
- **Free**: 10 items, basic display (watermark)
- **Pro** ($9/mo): Unlimited, custom branding
- **Event** ($29): One-time for single event

Stripe integration not included - add when ready.

## 📝 License

MIT - Use freely for any purpose.
