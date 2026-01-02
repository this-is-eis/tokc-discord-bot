# tokc-discord-bot
Creates a discord bot that's activated via commands. Current working commands are:
1. `/card` (args: `name`)

## Setup Guide

### Step 1: Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** → name it → **Create**
3. Note down these values from the application page:
   - **Application ID** (under General Information)
   - **Public Key** (under General Information)
4. Go to **Bot** section → **Reset Token** → copy the **Bot Token**
5. Under **Bot** → disable **Public Bot** if you want it private

### Step 2: Configure Environments

Update `wrangler.toml`:
- Replace `CARDS_JSON_URL` with your cards.json URL
- Replace `LIBRARY_BASE_URL` with your library domain

### Step 3: Deploy to Cloudflare
Simply setup the github deploy to Cloudflare Worker

Also add the following secret in the Settings tab:
- `DISCORD_PUBLIC_KEY `

### Step 4: Configure Discord Interactions Endpoint

1. Back in Discord Developer Portal → your application
2. Go to **General Information**
3. Set **Interactions Endpoint URL** to your Worker URL
4. Click **Save Changes**
   - Discord will send a PING to verify; your worker handles this automatically

### Step 5: Register Slash Commands

```bash
# Set environment variables and run registration script
DISCORD_APPLICATION_ID=your_app_id \
DISCORD_BOT_TOKEN=your_bot_token \
node scripts/register-commands.js

# For faster testing, add your test server's guild ID:
DISCORD_APPLICATION_ID=your_app_id \
DISCORD_BOT_TOKEN=your_bot_token \
DISCORD_GUILD_ID=your_guild_id \
node scripts/register-commands.js
```

### Step 6: Invite Bot to Server

1. Go to **OAuth2** → **URL Generator**
2. Select scopes: `applications.commands`
3. Copy the generated URL and open it in browser
4. Select your server and authorize

### Testing

In Discord, type `/card name:test` to search for cards.