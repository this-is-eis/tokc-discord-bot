import { env } from "cloudflare:workers";
import { formatMetaDescription } from "./helper";

const { LIBRARY_BASE_URL } = env;

// Embed builders
// Reference: https://discord.com/developers/docs/resources/message#embed-object
function createErrorEmbed(message) {
	return {
		title: "❌ Search Error",
		description: message,
		color: 0xff4444, // Red
	};
}

// MARK: SINGLE RESULT
function createSingleResultEmbed(card) {
	const cardUrl = `${LIBRARY_BASE_URL}/card/${encodeURIComponent(card.id)}`;
	const embedColor = matchColorFromTags(card.tags);

	let cardText = "";

	const keys = Object.keys(card);
	for (const k of keys) {
		if (/^text(\d+)?$/i.test(k)) {
			cardText += `\n${card["k"]}`;
		} else if (k === "seasonrules") {
			cardText += normalizeSeasonRules(card["k"]);
		} else if (k === "flavour") {
			cardText += `\n\n*${card["k"]}*`;
		}
	}

	cardText = cardText.trim();
	cardText = formatMetaDescription(cardText);

	return {
		title: card.name,
		description: cardText,
		url: cardUrl,
		color: embedColor,
		image: {
			url: card.image,
		},
	};
}

const TagColors = {
	Clans: "0x007f7d",
	Uprising: "0x840c21",
	Nobility: "0x1a509b",
	Gathering: "0x6e1878",
	Aeronauts: "0x41abc2",
	Simulacrum: "0x2b2e35",
	"Whispering Tower": "0x4a32a4",
};
const DefaultColor = 0x1a292e;

function matchColorFromTags(tags) {
	const tagColorMatch = Object.keys(TagColors).find((key) =>
		tags.some((t) => t.includes(key))
	);

	console.log(`tagColorMatch: ${tagColorMatch}`);

	return tagColorMatch ? TagColors[tagColorMatch] : DefaultColor;
}

function normalizeSeasonRules(seasonrules) {
	let text = "";
	const items = Array.isArray(seasonrules) ? seasonrules : [seasonrules];

	for (const it of items) {
		// Some value includes 'numbers' like: "season": "day,2"
		const [season, rawLines] = it.season.split(",").map((s) => s.trim());
		const label = `[${season.toUpperCase()}]`;
		const rules = it.rules.trim();
		text += `\n${label}: ${rules}`;
	}
	return text;
}

// MARK: MULTIPLE RESULT
function createMultipleResultsEmbed(query, firstCard, totalCount) {
	const searchUrl = `${LIBRARY_BASE_URL}/search?q=${encodeURIComponent(
		query
	)}`;
	const cardUrl = `${LIBRARY_BASE_URL}/card/${encodeURIComponent(
		firstCard.id
	)}`;

	return {
		title: `🔍 Found ${totalCount} cards`,
		description: [
			`**[View all results](${searchUrl})**`,
			"",
			`**First match:** [${firstCard.name}](${cardUrl})`,
		].join("\n"),
		color: DefaultColor,
	};
}

export {
	createErrorEmbed,
	createSingleResultEmbed,
	createMultipleResultsEmbed,
};
