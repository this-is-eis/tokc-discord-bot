import { decompress } from "compress-json";
import { env } from "cloudflare:workers";
import { formatMetaDescription } from "./helper";

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

const { CARDS_JSON_URL, DISCORD_PUBLIC_KEY, LIBRARY_BASE_URL } = env;

const CACHE_TTL_SECONDS = 60; // 60 minutes

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
			return handleSearchCommand(interaction);
		}

		return new Response("Unknown interaction type", { status: 400 });
	},
};

async function handleSearchCommand(interaction) {
	const { options } = interaction.data;

	// Extract the 'name' parameter from the command
	const nameOption = options?.find((opt) => opt.name === "name");
	const searchQuery = nameOption?.value?.trim();

	if (!searchQuery) {
		return jsonResponse({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				embeds: [createErrorEmbed("Please provide a search term.")],
			},
		});
	}

	try {
		const cards = await fetchCardsWithCache();

		// Case-insensitive partial match
		const query = searchQuery.toLowerCase();
		const matches = cards.filter((card) =>
			card.name.toLowerCase().includes(query)
		);

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
			// Case 2: Single match - plain URL for auto-unfurl (public)
			responseData = createSingleResultEmbed(matches[0]);
		} else {
			// Case 3: Multiple matches - plain URLs for auto-unfurl (public)
			responseData = {
				...createMultipleResults(
					searchQuery,
					matches[0],
					matches.length
				),
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

	return decompress(await response.json());
}

// Embed builders
// Reference: https://discord.com/developers/docs/resources/message#embed-object
function createErrorEmbed(message) {
	return {
		title: "❌ Search Error",
		description: message,
		color: 0xff4444, // Red
	};
}

function createSingleResultEmbed(card) {
	const cardUrl = `${LIBRARY_BASE_URL}/card/${encodeURIComponent(card.id)}`;
	console.log(card);

	let cardText = card.text ?? "";
	// Normalize Season Rules
	if (card.seasonrules) {
		const items = Array.isArray(card.seasonrules)
			? card.seasonrules
			: [card.seasonrules];
		for (const it of items) {
			const spec = String(it?.season ?? "").trim();
			if (!spec) continue;
			const [rawName, rawLines] = spec.split(",").map((s) => s.trim());
			const label = `[${rawName.toUpperCase()}]`;
			const rules = String(it?.rules ?? "").trim();
			cardText.append(`\n${label}: ${rules}`);
		}
	}
	if (card.text2) {
		cardText.append(`\n${card.text2}`);
	}

	cardText = cardText.trim();
	console.log(cardText);

	return {
		title: card.name,
		description: formatMetaDescription(cardText),
		url: cardUrl,
		color: 0x5865f2, // Discord blurple
		image: {
			url: card.image,
		},
	};
}

function createMultipleResults(query, firstCard, totalCount) {
	const searchUrl = `${LIBRARY_BASE_URL}/search?q=${encodeURIComponent(
		query
	)}`;
	const cardUrl = `${LIBRARY_BASE_URL}/card/${encodeURIComponent(
		firstCard.id
	)}`;
	// Plain URLs for auto-unfurl; first card URL will show preview
	return {
		content: `Found ${totalCount} cards. [View all results](<${searchUrl}>)\nFirst match: ${cardUrl}`,
	};
}

// Discord signature verification using Web Crypto API
// Reference: https://discord.com/developers/docs/interactions/overview#setting-up-an-endpoint-validating-security-request-headers
async function verifyDiscordRequest(request, publicKey) {
	const signature = request.headers.get("X-Signature-Ed25519");
	const timestamp = request.headers.get("X-Signature-Timestamp");
	const body = await request.clone().text();

	if (!signature || !timestamp) {
		return false;
	}

	try {
		const key = await crypto.subtle.importKey(
			"raw",
			hexToUint8Array(publicKey),
			{ name: "Ed25519" },
			false,
			["verify"]
		);

		const message = new TextEncoder().encode(timestamp + body);
		const sig = hexToUint8Array(signature);

		return await crypto.subtle.verify("Ed25519", key, sig, message);
	} catch (err) {
		console.error("Signature verification failed:", err);
		return false;
	}
}

function hexToUint8Array(hex) {
	const pairs = hex.match(/[\dA-Fa-f]{2}/g) || [];
	return new Uint8Array(pairs.map((b) => parseInt(b, 16)));
}

function jsonResponse(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}
