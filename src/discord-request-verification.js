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

export default verifyDiscordRequest;
