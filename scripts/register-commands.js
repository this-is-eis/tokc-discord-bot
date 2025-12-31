/**
 * Script to register Discord slash commands
 * Run with: node scripts/register-commands.js
 *
 * Reference: https://discord.com/developers/docs/interactions/application-commands#create-global-application-command
 */

const DISCORD_API_BASE = "https://discord.com/api/v10";

// Set these environment variables before running
const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// Optional: Set GUILD_ID for faster testing (guild commands update instantly)
// Global commands can take up to 1 hour to propagate
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const commands = [
	{
		name: "card",
		description: "Search for a card by name",
		options: [
			{
				name: "name",
				description: "The card name to search for",
				type: 3, // STRING type
				required: true,
			},
		],
	},
];

async function registerCommands() {
	if (!APPLICATION_ID || !BOT_TOKEN) {
		console.error(
			"Error: DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN must be set"
		);
		console.error("");
		console.error("Usage:");
		console.error(
			"  DISCORD_APPLICATION_ID=xxx DISCORD_BOT_TOKEN=xxx node scripts/register-commands.js"
		);
		process.exit(1);
	}

	// Use guild endpoint for testing, global endpoint for production
	const url = GUILD_ID
		? `${DISCORD_API_BASE}/applications/${APPLICATION_ID}/guilds/${GUILD_ID}/commands`
		: `${DISCORD_API_BASE}/applications/${APPLICATION_ID}/commands`;

	console.log(`Registering ${commands.length} command(s)...`);
	console.log(`Endpoint: ${GUILD_ID ? "Guild-specific" : "Global"}`);

	try {
		const response = await fetch(url, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bot ${BOT_TOKEN}`,
			},
			body: JSON.stringify(commands),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Discord API error: ${response.status} - ${error}`);
		}

		const data = await response.json();
		console.log("✅ Commands registered successfully!");
		console.log(
			"Registered commands:",
			data.map((c) => `/${c.name}`).join(", ")
		);

		if (!GUILD_ID) {
			console.log("");
			console.log(
				"Note: Global commands may take up to 1 hour to appear in Discord."
			);
			console.log(
				"For instant updates during development, set DISCORD_GUILD_ID."
			);
		}
	} catch (error) {
		console.error("❌ Failed to register commands:", error.message);
		process.exit(1);
	}
}

registerCommands();
