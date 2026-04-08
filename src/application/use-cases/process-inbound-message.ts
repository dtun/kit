import type { IAIService } from "@application/ports/ai-service";
import type { IJournalRepository } from "@application/ports/journal-repository";
import type { IMessageGateway } from "@application/ports/message-gateway";
import { authorizeSender } from "@domain/entities/authorization";
import type { FamilyMember } from "@domain/entities/family-member";
import type { MessageClassification } from "@domain/entities/intent";
import type { JournalPaths } from "@domain/entities/journal-path";
import type { KitMessage, KitResponse } from "@domain/entities/kit-message";
import { UnauthorizedSenderError } from "@domain/errors";
import { createDailyLog } from "./create-daily-log";

export interface ProcessInboundMessageDeps {
	journal: IJournalRepository;
	ai: IAIService;
	messenger: IMessageGateway;
	paths: JournalPaths;
	familyMembers: readonly FamilyMember[];
	kitConfig: { readonly name: string; readonly email: string };
}

export interface ProcessingResult {
	readonly intent: MessageClassification;
	readonly reply: KitResponse;
	readonly journalUpdates: string[];
}

export async function processInboundMessage(
	deps: ProcessInboundMessageDeps,
	message: KitMessage,
): Promise<ProcessingResult> {
	const { journal, ai, messenger, paths, familyMembers, kitConfig } = deps;

	// 1. Authorize sender
	const auth = authorizeSender(message.from, familyMembers);
	if (!auth.authorized) {
		throw new UnauthorizedSenderError(message.from);
	}

	// auth.authorized guarantees member is present
	if (!auth.member) throw new UnauthorizedSenderError(message.from);
	const member = auth.member;
	const now = new Date();
	const journalUpdates: string[] = [];

	// 2. Ensure today's daily log exists
	await createDailyLog({ journal, paths }, now);

	// 3. Get context for the AI (recent journal entries)
	const context = await buildContext(journal, paths, now);

	// 4. Classify intent
	const intent = await ai.classifyIntent(message.body, context);

	// 5. Take action based on intent
	const actionResult = await executeIntent(deps, intent, message, member, now);
	journalUpdates.push(...actionResult.paths);

	// 6. Generate reply
	const replyBody = await generateReply(
		ai,
		intent,
		actionResult.summary,
		context,
		member,
		kitConfig,
	);

	// 7. Send reply
	const reply: KitResponse = {
		to: message.from,
		channel: message.channel,
		subject: message.subject ? `Re: ${message.subject}` : `From ${kitConfig.name}`,
		body: replyBody,
		timestamp: new Date().toISOString(),
	};

	await messenger.send(reply);

	// 8. Log the interaction in today's daily log
	const y = now.getFullYear();
	const m = now.getMonth() + 1;
	const d = now.getDate();
	await journal.append(
		paths.dailyLog(y, m, d),
		`\n- [o] Email from ${member.name}: "${truncate(message.body, 60)}" → ${intent.intent}\n`,
		`Logged inbound email from ${member.name}`,
	);

	return { intent, reply, journalUpdates };
}

async function buildContext(
	journal: IJournalRepository,
	paths: JournalPaths,
	now: Date,
): Promise<string> {
	const y = now.getFullYear();
	const m = now.getMonth() + 1;
	const d = now.getDate();

	const parts: string[] = [];

	const today = await journal.read(paths.dailyLog(y, m, d));
	if (today) parts.push(`TODAY'S LOG:\n${today.content}`);

	const month = await journal.read(paths.monthlyLog(y, m));
	if (month) parts.push(`MONTHLY LOG:\n${month.content}`);

	const index = await journal.read(paths.index());
	if (index) parts.push(`INDEX:\n${index.content}`);

	return parts.join("\n\n---\n\n") || "No journal context available yet.";
}

interface ActionResult {
	summary: string;
	paths: string[];
}

async function executeIntent(
	deps: ProcessInboundMessageDeps,
	intent: MessageClassification,
	message: KitMessage,
	member: FamilyMember,
	now: Date,
): Promise<ActionResult> {
	const { journal, paths } = deps;
	const y = now.getFullYear();
	const m = now.getMonth() + 1;
	const d = now.getDate();
	const updatedPaths: string[] = [];

	switch (intent.intent) {
		case "remember": {
			const content = intent.extractedData.content || message.body;
			const dailyPath = paths.dailyLog(y, m, d);
			await journal.append(dailyPath, `- ${content}\n`, `${member.name} asked to remember`);
			updatedPaths.push(dailyPath);
			return { summary: `Stored: "${content}"`, paths: updatedPaths };
		}

		case "task": {
			const content = intent.extractedData.content || message.body;
			const dailyPath = paths.dailyLog(y, m, d);
			await journal.append(dailyPath, `- [ ] ${content}\n`, `${member.name} added task`);
			updatedPaths.push(dailyPath);
			return { summary: `Added task: "${content}"`, paths: updatedPaths };
		}

		case "list_add": {
			const content = intent.extractedData.content || message.body;
			const dailyPath = paths.dailyLog(y, m, d);
			await journal.append(
				dailyPath,
				`- [ ] ${content} #${intent.extractedData.category || "list"}\n`,
				`${member.name} added to list`,
			);
			updatedPaths.push(dailyPath);
			return { summary: `Added to list: "${content}"`, paths: updatedPaths };
		}

		case "recall":
		case "question":
		case "status":
		case "list_view":
		case "edit_history":
		case "greeting":
		case "list_clear":
		case "unknown":
			return { summary: intent.intent, paths: [] };
	}
}

async function generateReply(
	ai: IAIService,
	intent: MessageClassification,
	actionSummary: string,
	context: string,
	member: FamilyMember,
	kitConfig: { readonly name: string },
): Promise<string> {
	const systemPrompt = [
		`You are ${kitConfig.name}, the Kinetic Intelligence Tool — a warm, concise family assistant.`,
		`You are replying to ${member.name} via email.`,
		"",
		"Rules:",
		"- Keep replies SHORT: 2-4 sentences unless more detail is needed",
		"- Use plain text, no markdown (this is email)",
		"- If you stored something, confirm what you stored",
		"- If asked a question, answer from the journal context below",
		`- If you don't know, say so honestly`,
		`- Sign off with "— ${kitConfig.name}"`,
		"",
		`The user's intent was classified as: ${intent.intent}`,
		`Action taken: ${actionSummary}`,
		"",
		"Journal context:",
		context,
	].join("\n");

	return ai.complete(systemPrompt, `Reply to this message from ${member.name}`);
}

function truncate(s: string, max: number): string {
	return s.length > max ? `${s.slice(0, max)}...` : s;
}
