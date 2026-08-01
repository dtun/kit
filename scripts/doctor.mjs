#!/usr/bin/env node
/**
 * Kit doctor — verifies that a deployment is actually wired up.
 *
 * CI deploys the worker but never sets secrets, so a green deploy says nothing
 * about whether Kit can read a calendar, reach Claude, or reply to anyone. This
 * script answers "is this deployment actually wired up?" as a pass/fail
 * checklist and exits non-zero on any failure so it can gate CI later.
 *
 * Usage:
 *   npm run doctor
 *   npm run doctor -- --url https://staging.example.com
 *   npm run doctor -- --skip-remote      # config + roster checks only
 *
 * Environment:
 *   KIT_URL          target deployment (default https://kitkit.dev)
 *   FAMILY_MEMBERS   roster JSON to validate; falls back to .dev.vars
 *
 * Secret VALUES are never read or printed — only names and presence.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let DEFAULT_URL = "https://kitkit.dev";

/**
 * Secrets a fully wired deployment needs. "Required" here means required for
 * every readiness flag on /health to be true — Kit still boots without the
 * optional ones, it just degrades silently, which is the failure mode this
 * script exists to surface. Names are cross-checked against .dev.vars.example.
 */
let SECRET_POLICY = {
	FAMILY_MEMBERS: { required: true, why: "roster of who Kit talks to" },
	API_KEY: { required: true, why: "guards /agent, /journal, /admin" },
	ICLOUD_APPLE_ID: { required: true, why: "calendar sync (health: calendarConfigured)" },
	ICLOUD_APP_PASSWORD: { required: true, why: "calendar sync (health: calendarConfigured)" },
	ANTHROPIC_API_KEY: { required: true, why: "Claude brain (health: aiBrainConfigured)" },
	TWILIO_ACCOUNT_SID: { required: false, why: "outbound SMS (no-op gateway without it)" },
	TWILIO_AUTH_TOKEN: { required: false, why: "outbound SMS" },
	TWILIO_PHONE_NUMBER: { required: false, why: "outbound SMS" },
};

/** Which secret fixes which false readiness flag on /health. */
let FLAG_FIXES = {
	familyMembersValid: "FAMILY_MEMBERS",
	calendarConfigured: "ICLOUD_APPLE_ID + ICLOUD_APP_PASSWORD",
	aiBrainConfigured: "ANTHROPIC_API_KEY",
};

// ---------------------------------------------------------------- reporting

let results = [];
let SYMBOLS = { pass: "✔", fail: "✖", warn: "!", skip: "-" };

function record(status, name, detail) {
	results.push({ status, name, detail });
	let line = `  ${SYMBOLS[status]} ${name}`;
	console.log(detail ? `${line} — ${detail}` : line);
}

let pass = (name, detail) => record("pass", name, detail);
let fail = (name, detail) => record("fail", name, detail);
let warn = (name, detail) => record("warn", name, detail);
let skip = (name, detail) => record("skip", name, detail);

function section(title) {
	console.log(`\n${title}`);
}

// ------------------------------------------------------------------- jsonc

/** Strips // and /* *\/ comments and trailing commas, leaving string literals alone. */
function parseJsonc(text) {
	let out = "";
	let inString = false;
	let inLine = false;
	let inBlock = false;
	for (let i = 0; i < text.length; i++) {
		let ch = text[i];
		let next = text[i + 1];
		if (inLine) {
			if (ch === "\n") {
				inLine = false;
				out += ch;
			}
			continue;
		}
		if (inBlock) {
			if (ch === "*" && next === "/") {
				inBlock = false;
				i++;
			}
			continue;
		}
		if (inString) {
			out += ch;
			if (ch === "\\") {
				out += next ?? "";
				i++;
			} else if (ch === '"') {
				inString = false;
			}
			continue;
		}
		if (ch === '"') {
			inString = true;
			out += ch;
			continue;
		}
		if (ch === "/" && next === "/") {
			inLine = true;
			i++;
			continue;
		}
		if (ch === "/" && next === "*") {
			inBlock = true;
			i++;
			continue;
		}
		out += ch;
	}
	return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

// ------------------------------------------------------------------ checks

function checkBindings() {
	section("Bindings (wrangler.jsonc)");
	let config;
	try {
		config = parseJsonc(readFileSync(join(ROOT, "wrangler.jsonc"), "utf8"));
	} catch (err) {
		fail("wrangler.jsonc parses", String(err));
		return null;
	}
	pass("wrangler.jsonc parses");

	let r2 = (config.r2_buckets ?? []).find((b) => b.binding === "JOURNAL");
	r2
		? pass("R2 bucket JOURNAL", `bucket_name=${r2.bucket_name}`)
		: fail("R2 bucket JOURNAL", "add an r2_buckets entry with binding JOURNAL");

	let doBinding = (config.durable_objects?.bindings ?? []).find((b) => b.name === "KIT_AGENT");
	doBinding
		? pass("Durable Object KIT_AGENT", `class_name=${doBinding.class_name}`)
		: fail("Durable Object KIT_AGENT", "add a durable_objects binding named KIT_AGENT");

	let className = doBinding?.class_name ?? "KitAgent";
	let migrated = (config.migrations ?? []).some((m) =>
		[...(m.new_sqlite_classes ?? []), ...(m.new_classes ?? [])].includes(className),
	);
	migrated
		? pass("Durable Object migration", `${className} declared in migrations`)
		: fail("Durable Object migration", `no migration declares ${className}`);

	config.ai?.binding
		? pass("Workers AI binding", `binding=${config.ai.binding}`)
		: fail("Workers AI binding", "add an ai.binding entry");

	let sendEmail = (config.send_email ?? []).find((b) => b.name === "SEND_EMAIL");
	sendEmail
		? pass("Email binding SEND_EMAIL")
		: fail("Email binding SEND_EMAIL", "replies cannot be delivered without it");

	let crons = config.triggers?.crons ?? [];
	crons.length > 0
		? pass("Cron trigger", crons.join(", "))
		: fail("Cron trigger", "no triggers.crons — the morning routine never runs");

	return config;
}

function canonicalSecretNames() {
	let text = readFileSync(join(ROOT, ".dev.vars.example"), "utf8");
	return text
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith("#"))
		.map((line) => line.split("=")[0].trim())
		.filter(Boolean);
}

function checkSecrets() {
	section("Secrets on the deployed worker");

	let canonical;
	try {
		canonical = canonicalSecretNames();
	} catch (err) {
		fail(".dev.vars.example readable", String(err));
		return;
	}

	for (let name of canonical) {
		if (!SECRET_POLICY[name]) {
			warn(`${name} unclassified`, "present in .dev.vars.example but unknown to doctor");
		}
	}

	let output;
	try {
		// Names and types only — `secret list` never returns values.
		output = execFileSync("npx", ["wrangler", "secret", "list", "--format", "json"], {
			cwd: ROOT,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
	} catch (err) {
		let cause = firstLine(err.stderr || err.message);
		warn(
			"wrangler secret list",
			`could not query Cloudflare (${cause}). Run \`wrangler login\` or set CLOUDFLARE_API_TOKEN, or pass --skip-remote.`,
		);
		return;
	}

	let names;
	try {
		let start = output.indexOf("[");
		let end = output.lastIndexOf("]");
		names = JSON.parse(output.slice(start, end + 1)).map((s) => s.name);
	} catch {
		warn("wrangler secret list", "unrecognized output format — skipping secret checks");
		return;
	}

	for (let [name, policy] of Object.entries(SECRET_POLICY)) {
		if (names.includes(name)) {
			pass(name, policy.why);
		} else if (policy.required) {
			fail(name, `not set — ${policy.why}. Fix: wrangler secret put ${name}`);
		} else {
			warn(name, `not set — ${policy.why}`);
		}
	}

	for (let name of names) {
		if (!canonical.includes(name)) {
			warn(`${name} undocumented`, "set on the worker but missing from .dev.vars.example");
		}
	}
}

async function checkHealth(url) {
	section(`Deployed health (${url})`);

	let body;
	try {
		let res = await fetch(`${url}/health`, { headers: { Accept: "application/json" } });
		if (!res.ok) {
			fail("GET /health", `HTTP ${res.status}`);
			return;
		}
		body = await res.json();
	} catch (err) {
		fail("GET /health", `unreachable — ${firstLine(String(err))}`);
		return;
	}

	body.status === "ok"
		? pass("status", `${body.status} (${body.name} ${body.version})`)
		: fail("status", `expected "ok", got "${body.status}"`);

	let flags = Object.entries(body).filter(([, value]) => typeof value === "boolean");
	if (flags.length === 0) {
		fail("readiness flags", "no boolean flags in the payload — is this an old deployment?");
	}
	for (let [flag, value] of flags) {
		if (value) {
			pass(flag);
		} else {
			let fix = FLAG_FIXES[flag];
			fail(flag, fix ? `false — set ${fix}` : "false");
		}
	}

	if (typeof body.aiBrainModel === "string") {
		pass("aiBrainModel", body.aiBrainModel);
	}

	if (!("lastCron" in body)) {
		warn("lastCron", "not reported — deployment predates last-cron tracking");
	} else if (body.lastCron === null) {
		fail("lastCron", "the scheduled routine has never completed on this deployment");
	} else if (body.lastCron.ok) {
		pass("lastCron", `ok at ${body.lastCron.at}`);
	} else {
		fail("lastCron", `failed at ${body.lastCron.at} — ${body.lastCron.reason ?? "no reason"}`);
	}
}

function loadFamilyMembersRaw() {
	if (process.env.FAMILY_MEMBERS) return { raw: process.env.FAMILY_MEMBERS, source: "env" };
	try {
		let text = readFileSync(join(ROOT, ".dev.vars"), "utf8");
		let line = text.split("\n").find((l) => l.trim().startsWith("FAMILY_MEMBERS="));
		if (line) return { raw: line.slice(line.indexOf("=") + 1).trim(), source: ".dev.vars" };
	} catch {
		// no .dev.vars — fall through
	}
	return null;
}

function checkReplyDestinations() {
	section("Reply destinations");

	let found = loadFamilyMembersRaw();
	if (!found) {
		skip(
			"FAMILY_MEMBERS roster",
			"no local copy to validate (production secret values are write-only). Set FAMILY_MEMBERS in the environment or .dev.vars to check it.",
		);
		return;
	}

	let members;
	try {
		members = JSON.parse(found.raw);
	} catch (err) {
		fail("FAMILY_MEMBERS parses", `${found.source}: ${firstLine(String(err))}`);
		return;
	}
	if (!Array.isArray(members) || members.length === 0) {
		fail("FAMILY_MEMBERS parses", `${found.source}: expected a non-empty JSON array`);
		return;
	}
	pass("FAMILY_MEMBERS parses", `${members.length} member(s) from ${found.source}`);

	for (let [i, member] of members.entries()) {
		let label = member?.name || `member[${i}]`;
		if (!member?.name) {
			fail(label, "missing name");
			continue;
		}
		if (member.channel !== "email" && member.channel !== "sms") {
			fail(label, `channel must be "email" or "sms", got ${JSON.stringify(member.channel)}`);
			continue;
		}
		let contact = typeof member.contact === "string" ? member.contact.trim() : "";
		if (!contact) {
			fail(label, "no reply destination — contact is empty");
			continue;
		}
		if (member.channel === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact)) {
			fail(label, `email channel but contact is not an address: ${contact}`);
			continue;
		}
		if (member.channel === "sms" && !/^\+[1-9]\d{6,14}$/.test(contact)) {
			fail(label, `sms channel but contact is not E.164: ${contact}`);
			continue;
		}
		pass(label, `${member.channel} -> ${contact}`);
	}
}

// -------------------------------------------------------------------- main

// Wrangler colourizes its errors; strip the escapes so the checklist stays
// readable. Built at runtime because a literal ESC in a regex is a lint error.
let ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

function firstLine(text) {
	let plain = String(text).replace(ANSI, "");
	return (
		plain
			.split("\n")
			.find((line) => line.trim())
			?.trim() ?? ""
	);
}

function parseArgs(argv) {
	let url = process.env.KIT_URL || DEFAULT_URL;
	let skipRemote = false;
	for (let i = 0; i < argv.length; i++) {
		let arg = argv[i];
		if (arg === "--help" || arg === "-h") return { help: true };
		if (arg === "--skip-remote") skipRemote = true;
		else if (arg === "--url") url = argv[++i];
		else if (arg.startsWith("--url=")) url = arg.slice("--url=".length);
		else return { error: `unknown argument: ${arg}` };
	}
	if (!url) return { error: "--url requires a value" };
	return { url: url.replace(/\/+$/, ""), skipRemote };
}

let USAGE = `Kit doctor — verify a deployment is actually wired up.

Usage: npm run doctor [-- options]

Options:
  --url <url>     deployment to check (default ${DEFAULT_URL}, or $KIT_URL)
  --skip-remote   skip wrangler + /health checks (config and roster only)
  -h, --help      show this help

Exits non-zero if any check fails.`;

async function main() {
	let args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log(USAGE);
		return 0;
	}
	if (args.error) {
		console.error(`${args.error}\n\n${USAGE}`);
		return 2;
	}

	console.log(`Kit doctor — target ${args.url}${args.skipRemote ? " (local checks only)" : ""}`);

	checkBindings();
	if (args.skipRemote) {
		section("Secrets on the deployed worker");
		skip("wrangler secret list", "--skip-remote");
		section(`Deployed health (${args.url})`);
		skip("GET /health", "--skip-remote");
	} else {
		checkSecrets();
		await checkHealth(args.url);
	}
	checkReplyDestinations();

	let counts = { pass: 0, fail: 0, warn: 0, skip: 0 };
	for (let r of results) counts[r.status]++;
	console.log(
		`\n${counts.pass} passed, ${counts.fail} failed, ${counts.warn} warnings, ${counts.skip} skipped`,
	);

	if (counts.fail > 0) {
		console.log("\nFailures:");
		for (let r of results.filter((x) => x.status === "fail")) {
			console.log(`  ${SYMBOLS.fail} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
		}
		return 1;
	}
	console.log(
		counts.skip > 0
			? "\nNo failures, but some checks were skipped — this is not a full verification."
			: "\nDeployment looks wired up.",
	);
	return 0;
}

process.exitCode = await main();
