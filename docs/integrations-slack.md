# Slack integration (OAuth)

Denne integration bruger Slack OAuth, sa admin ikke skal indtaste bot-token manuelt.

## Miljovariabler

I backend miljo (`apps/api/.env`):

- `SLACK_CLIENT_ID`
- `SLACK_CLIENT_SECRET`
- `SLACK_SIGNING_SECRET`
- `SLACK_REDIRECT_URI` (fx `http://localhost:3000/api/integrations/slack/oauth/callback`)
- `SLACK_MOCK` (`1` kun til lokal mock fallback)

## One-time Slack App setup

1. Gaa til [api.slack.com/apps](https://api.slack.com/apps) og opret en app.
2. Under **OAuth & Permissions**:
   - Tilfoj redirect URL: `https://<dit-domane>/api/integrations/slack/oauth/callback`
   - Tilfoj bot scopes: `chat:write`, `channels:read`, `groups:read`
3. Installer appen i workspace.
4. Sæt env vars i backend deployment og redeploy API.

## OAuth flow URL'er

- Start: `/api/integrations/slack/oauth/start` (frontend route)
- Callback: `/api/integrations/slack/oauth/callback` (frontend route)
- Backend start: `/api/v1/integrations/slack/oauth/start`
- Backend callback: `/api/v1/integrations/slack/oauth/callback`

## API endpoints

- `GET /api/v1/integrations/slack/status`
- `GET /api/v1/integrations/slack/channels`
- `PATCH /api/v1/integrations/slack/settings`
- `POST /api/v1/integrations/slack/disconnect`
- `POST /api/v1/tickets/{id}/slack-push`

## Sikkerhed

- Slack bot-token gemmes kun i backend database (`organization_integrations`).
- Bot-token returneres aldrig til browseren.
- OAuth start/disconnect/settings kraever admin.
