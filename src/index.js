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

// Your external cards.json URL
const CARDS_JSON_URL = "https://cards.eerieidolgames.com//cards.json";
const LIBRARY_BASE_URL = "https://library.eerieidolgames.com";

// Cache configuration
const CACHE_TTL_SECONDS = 3600; // 60 minutes

export default {
	async fetch(request, env) {
		if (request.method !== "POST") {
			return new Response("Method not allowed", { status: 405 });
		}

		const isValid = await verifyDiscordRequest(
			request,
			env.DISCORD_PUBLIC_KEY
		);
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
	const { name, options } = interaction.data;

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
		// Fetch cards data with caching
		const cards = await fetchCardsWithCache();

		// Case-insensitive partial match
		const query = searchQuery.toLowerCase();
		const matches = cards.filter((card) =>
			card.name.toLowerCase().includes(query)
		);

		let responseData;

		if (matches.length === 0) {
			// Case 1: No matches
			responseData = {
				embeds: [
					createErrorEmbed(
						`No cards found matching "${searchQuery}".`
					),
				],
			};
		} else if (matches.length === 1) {
			// Case 2: Single match - plain URL for auto-unfurl
			responseData = createSingleResult(matches[0]);
		} else {
			// Case 3: Multiple matches - plain URLs for auto-unfurl
			responseData = createMultipleResults(
				searchQuery,
				matches[0],
				matches.length
			);
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

// Embed builders
// Reference: https://discord.com/developers/docs/resources/message#embed-object
function createErrorEmbed(message) {
	return {
		title: "❌ Search Error",
		description: message,
		color: 0xff4444, // Red
	};
}

function createSingleResult(card) {
	const cardUrl = `${LIBRARY_BASE_URL}/card/${encodeURIComponent(card.id)}`;
	// Return plain URL - Discord will auto-unfurl with OG preview
	return { content: cardUrl };
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
		content: `Found ${totalCount} cards. [View all results](<${searchUrl}>)\n${cardUrl}`,
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
