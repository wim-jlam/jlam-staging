# JLAM Staging - Payload CMS

Payload CMS 3.70.0 met Next.js 15.3 en PostgreSQL.

**Live URL**: `https://payload.jlam.nl`
**Admin**: `https://payload.jlam.nl/admin`
**Auth**: Keycloak SSO via `auth.jlam.nl`

---

## Quick Commands

```bash
# Lokale development
pnpm dev

# WordPress migratie
DATABASE_URL="..." npx tsx scripts/migrate-from-wordpress.ts --slug=artikel-slug

# Deploy naar production
ssh root@51.158.190.109 "cd /opt/services/jlam-staging && git pull && docker compose -f docker-compose.production.yml build && docker compose -f docker-compose.production.yml up -d"

# Media sync naar server
rsync -avz public/media/ root@51.158.190.109:/var/lib/docker/volumes/jlam-staging_media-data/_data/
```

---

## Operational Learnings

### 2026-01-13: Lexical List Structure

Bij het converteren van HTML naar Lexical rich text format:

```typescript
// FOUT - veroorzaakt Lexical error #17
{
  type: 'listitem',
  children: [{ type: 'text', text: 'Item', version: 1 }]
}

// GOED - listitem moet paragraph child bevatten
{
  type: 'listitem',
  children: [{
    type: 'paragraph',
    children: [{ type: 'text', text: 'Item', version: 1 }],
    direction: 'ltr',
    format: '',
    indent: 0,
    textFormat: 0,
    version: 1,
  }]
}
```

En `listitem` nodes moeten in een `list` parent zitten:

```typescript
{
  type: 'list',
  listType: 'bullet', // of 'number'
  start: 1,
  tag: 'ul', // of 'ol'
  children: [/* listitem nodes */],
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
}
```

### 2026-01-13: Next.js dynamicParams voor ISR

Als `generateStaticParams` een lege array returnt (bijv. database niet beschikbaar bij build), moet je `dynamicParams = true` toevoegen om nieuwe slugs toch dynamisch te kunnen renderen:

```typescript
export const dynamicParams = true  // Sta nieuwe slugs toe
export const revalidate = 600      // Cache voor 10 minuten

export async function generateStaticParams() {
  try {
    // ...
  } catch {
    return []  // OK dankzij dynamicParams
  }
}
```

---

## Database

PostgreSQL op Scaleway:
- Host: `51.158.130.103:20832`
- Database: `jlam_staging`
- User: `infrastructure_user`
