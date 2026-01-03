// Format example:
/* 
    Raw:
    {{b2}}Strength:{{/b2}} 10
    {{b2}}Archetype:{{/b2}} [h] Heir
    {{b2}}Traits:{{/b2}} {{lg}}[P]{{/lg}} Pathfinder, [R] Resilient
    {{b2}}Commands:{{/b2}} [6] Rally (Self)
    {{b2}}Votes:{{/b2}} [v]
    {{b2}}Lore:{{/b2}} [p]
    [DIVIDER]
    {{center}}<i>A wild eye, all sea, all sky. Prow, ring, kith, and kin. The brightest unbowed thing.</i>{{/center}}

    Result:
    Strength: 10
    Archetype:  Heir
    Traits:  Pathfinder,  Resilient
    Commands: [6] Rally (Self)
    Votes: 1
    Lore: 1
    
    A wild eye, all sea, all sky. Prow, ring, kith, and kin. The brightest unbowed thing.
  */
export function formatMetaDescription(text) {
	//   Remove all occurences of {{}}. e.g. {{b2}}
	text = text.replace(/\{\{([^}]+)\}\}/g, "**");

	//   Remove all occurences of <>. e.g. <i>
	text = text.replace(/<([^>]+)>/g, "");

	//   Remove all occurences of [DIVIDER]
	text = text.replace(/\[DIVIDER\]/g, "");

	//   Remove all occurences of &#8288; (Found in Grand Tourney somehow)
	text = text.replace(/&#8288;/g, "");

	// Remove all [] if line starts with Archetype|Traits|Lore Cost
	text = text.replace(/^(Archetype|Traits|Lore Cost):.*$/gm, (line) =>
		line.replace(/\[[^\]]*\]/g, "")
	);

	// Change Votes and Lore symbols into numbers.
	// e.g. Lore: [p][p] => Lore: 2
	text = text.replace(/^(Votes|Lore|Fog Placed):.*$/gm, (line) => {
		// Count all square bracket pairs
		const brackets = line.match(/\[[^\]]*\]/g);
		const count = brackets ? brackets.length : 0;

		if (count === 0) {
			return line; // No brackets, return as-is
		}

		// Remove all brackets and replace with count
		return line.replace(/\s*\[[^\]]*\]/g, "").trim() + " " + count;
	});

	return text;
}
