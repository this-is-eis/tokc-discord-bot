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
		description: "Search card(s) by name",
		options: [
			{
				name: "name",
				description:
					"The card name to search for (partial name allowed)",
				type: 3, // STRING type
				required: true,
			},
		],
	},
	{
		name: "advanced",
		description: "Search card(s) by advanced filters",
		options: [
			{
				name: "name",
				description:
					"The card name to search for (partial name allowed)",
				type: 3, // STRING type
			},
			{
				name: "faction",
				description: "Filter the results by faction",
				type: 3, // STRING type
				choices: [
					{ name: "Nobility", value: "Nobility" },
					{ name: "Uprising", value: "Uprising" },
					{ name: "Clans", value: "Clans" },
					{ name: "Gathering", value: "Gathering" },
				],
			},
			{
				name: "strength",
				description: "Filter the results by strength",
				type: 4, // INTEGER type
			},
			{
				name: "archetype",
				description: "Filter the results by archetype",
				type: 3, // STRING type
				choices: [
					{ name: "Ruse", value: "Ruse" },
					{ name: "Trader", value: "Trader" },
					{ name: "Follower", value: "Follower" },
					{ name: "Agent", value: "Agent" },
					{ name: "Cavalry", value: "Cavalry" },
					{ name: "War Machine", value: "War Machine" },
					{ name: "Captain", value: "Captain" },
					{ name: "Heir", value: "Heir" },
					{ name: "Champion", value: "Champion" },
				],
			},
			{
				name: "trait",
				description: "Filter the results by trait",
				type: 3, // STRING type
				choices: [
					{ name: "Resilient", value: "Resilient" },
					{ name: "Invulnerable", value: "Invulnerable" },
					{ name: "Pathfinder", value: "Pathfinder" },
				],
			},
			{
				name: "command",
				description: "Filter the results by command",
				type: 3, // STRING type
				choices: [
					{ name: "Ambush", value: "Ambush" },
					{ name: "Retreat", value: "Retreat" },
					{ name: "Flank", value: "Flank" },
					{ name: "Rally", value: "Rally" },
					{ name: "Deploy", value: "Deploy" },
					{ name: "Deadly", value: "Deadly" },
				],
			},
			{
				name: "action_step",
				description: "Filter the results by action step",
				type: 3, // STRING type
				choices: [
					{ name: "Spring", value: "Spring" },
					{ name: "Summer", value: "Summer" },
					{ name: "Autumn", value: "Autumn" },
					{ name: "Winter", value: "Winter" },
				],
			},
			{
				name: "tags",
				description:
					"Filter the results by tags. ex: 'Wild Kingdom,Intrigue Suit'",
				type: 3, // STRING type
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
