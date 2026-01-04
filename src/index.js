import {
	createErrorEmbed,
	createMultipleResultsEmbed,
	createSingleResultEmbed,
} from "./response-builder";

import { env } from "cloudflare:workers";
import verifyDiscordRequest from "./discord-request-verification";

// Discord interaction types and response types
// Reference: https://discord.com/developers/docs/interactions/receiving-and-responding
const InteractionType = {
	PING: 1,
	APPLICATION_COMMAND: 2,
};

const InteractionResponseType = {
	PONG: 1,
	CHANNEL_MESSAGE_WITH_SOURCE: 4,
};

// Discord message flags
// Reference: https://discord.com/developers/docs/resources/message#message-object-message-flags
const MessageFlags = {
	EPHEMERAL: 64,
};

const { CARDS_JSON_URL, DISCORD_PUBLIC_KEY } = env;

const CACHE_TTL_SECONDS = 3600; // 60 minutes

export default {
	async fetch(request) {
		if (request.method !== "POST") {
			return new Response("Method not allowed", { status: 405 });
		}

		const isValid = await verifyDiscordRequest(request, DISCORD_PUBLIC_KEY);
		if (!isValid) {
			return new Response("Invalid request signature", { status: 401 });
		}

		const interaction = await request.json();

		// Handle Discord PING (required for endpoint verification)
		if (interaction.type === InteractionType.PING) {
			return jsonResponse({ type: InteractionResponseType.PONG });
		}

		// Handle slash command
		if (interaction.type === InteractionType.APPLICATION_COMMAND) {
			return await handleSearchCommand(interaction);
		}

		return new Response("Unknown interaction type", { status: 400 });
	},
};

async function handleSearchCommand(interaction) {
	const { name: interactionName, options } = interaction.data;
	console.log("🚀 ~ handleSearchCommand ~ options:", JSON.stringify(options));
	let nameOption, strengthOption, tagOption;

	// Handle /card interaction
	if (interactionName === "card") {
		nameOption = options?.find((opt) => opt.name === "name");

		// Handle /advanced interaction
	} else if (interactionName === "advanced") {
		nameOption = advancedSearch.options?.find((opt) => opt.name === "name");
		strengthOption = advancedSearch.options?.find(
			(opt) => opt.name === "strength"
		);
		tagOption = advancedSearch.options?.filter(
			(opt) => opt.name !== "name" && opt.name !== "strength"
		);
	}

	if (!nameOption && !strengthOption && !tagOption) {
		return jsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				embeds: [createErrorEmbed("Please provide a search term.")],
			},
		});
	}

	const name = nameOption?.value.toLowerCase().trim();
	const strength = strengthOption?.value;
	const tags = tagOption?.map((opt) => opt.value.trim());

	const searchQuery = queryBuilder(name, strength, tags);
	console.log("🚀 ~ handleSearchCommand ~ searchQuery:", searchQuery);

	try {
		const cards = await fetchCardsWithCache();

		const matches = cards.filter((card) => {
			if (name && !card.name.toLowerCase().includes(name)) return false;
			if (strength && card.meta.strength !== strength) return false;
			if (tags && !tags.every((tag) => card.tags.includes(tag)))
				return false;
			return true;
		});

		let responseData;

		if (matches.length === 0) {
			// Case 1: No matches - ephemeral
			responseData = {
				embeds: [
					createErrorEmbed(
						`No cards found matching "${searchQuery}".`
					),
				],
				flags: MessageFlags.EPHEMERAL,
			};
		} else if (matches.length === 1) {
			// Case 2: Single match
			responseData = { embeds: [createSingleResultEmbed(matches[0])] };
		} else {
			// Case 3: Multiple matches
			responseData = {
				embeds: [
					createMultipleResultsEmbed(
						searchQuery,
						matches[0],
						matches.length
					),
					createSingleResultEmbed(matches[0]),
				],
			};
		}

		return jsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: responseData,
		});
	} catch (error) {
		console.error("Error processing search:", error);
		return jsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				embeds: [
					createErrorEmbed(
						"An error occurred while searching. Please try again later."
					),
				],
				flags: MessageFlags.EPHEMERAL,
			},
		});
	}
}

// Fetch cards.json with Cache API
async function fetchCardsWithCache() {
	const cache = caches.default;
	const cacheKey = new Request(CARDS_JSON_URL, { method: "GET" });

	// Check cache first
	let response = await cache.match(cacheKey);

	if (!response) {
		// Cache miss - fetch from origin
		console.log("Cache miss, fetching from origin");
		response = await fetch(CARDS_JSON_URL);

		if (!response.ok) {
			throw new Error(`Failed to fetch cards: ${response.status}`);
		}

		// Clone response and add cache headers
		const responseToCache = new Response(response.clone().body, {
			status: response.status,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
			},
		});

		// Store in cache (non-blocking)
		await cache.put(cacheKey, responseToCache);
	} else {
		console.log("Cache hit");
	}

	return response.json();
}

// returns something like:
// q=name:"a" tag:"Faction Card" strength:=0
function queryBuilder(name, strength, tags) {
	let searchQuery = "";
	if (name) searchQuery += `name:"${name}" `;
	if (strength) searchQuery += `strength:=${strength} `;
	if (tags) searchQuery += `tag:"${tags.join(",")}" `;
	return searchQuery.trim();
}

function jsonResponse(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}
