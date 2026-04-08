import type { IAIService } from "@application/ports/ai-service";
import type { IConversationStore } from "@application/ports/conversation-store";
import type { IJournalRepository } from "@application/ports/journal-repository";
import type { IMessageGateway } from "@application/ports/message-gateway";
import { authorizeSender } from "@domain/entities/authorization";
import type { ConversationTurn } from "@domain/entities/conversation-turn";
import { createDateContext } from "@domain/entities/date-context";
import type { Channel, FamilyMember } from "@domain/entities/family-member";
import type { MessageClassification } from "@domain/entities/intent";
import type { JournalPaths } from "@domain/entities/journal-path";
import type { KitMessage, KitResponse } from "@domain/entities/kit-message";
import { CHANNEL_TONE, KIT_PERSONA } from "@domain/entities/persona";
import { UnauthorizedSenderError } from "@domain/errors";
import { answerQuestion } from "./answer-question";
import { compileStatus } from "./compile-status";
import { createDailyLog } from "./create-daily-log";
import { recallFromJournal } from "./recall-from-journal";

export interface ProcessInboundMessageDeps {
	journal: IJournalRepository;
	ai: IAIService;
	messenger: IMessageGateway;
	paths: JournalPaths;
	familyMembers: readonly FamilyMember[];
	kitConfig: { readonly name: string; readonly email: string };
	conversationStore?: IConversationStore;
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

	// 6. Generate reply (skip if use case already produced a complete response)
	let replyBody: string;
	if (actionResult.directReply) {
		replyBody = actionResult.directReply;
	} else {
		replyBody = await generateReply(ai, intent, actionResult.summary, context, member, message.channel);
	}

	// 7. Send reply
	const reply: KitResponse = {
		to: message.from,
		channel: message.channel,
		subject: message.subject ? `Re: ${message.subject}` : `From ${kitConfig.name}`,
		body: replyBody,
		timestamp: now.toISOString(),
	};

	await messenger.send(reply);

	// 8. Store conversation turns if conversation store is available
	if (deps.conversationStore) {
		const userTurn: ConversationTurn = {
			role: "user",
			content: message.body,
			memberName: member.name,
			intent: intent.intent,
			timestamp: message.timestamp,
		};
		const kitTurn: ConversationTurn = {
			role: "kit",
			content: replyBody,
			memberName: "Kit",
			timestamp: reply.timestamp,
		};
		await deps.conversationStore.addTurn(message.from, userTurn);
		await deps.conversationStore.addTurn(message.from, kitTurn);
	}

	// 9. Log the interaction in today's daily log
	const y = now.getFullYear();
	const m = now.getMonth() + 1;
	const d = now.getDate();
	const channelLabel = message.channel === "sms" ? "SMS" : "Email";
	await journal.append(
		paths.dailyLog(y, m, d),
		`\n- [o] ${channelLabel} from ${member.name}: "${truncate(message.body, 60)}" → ${intent.intent}\n`,
		`Logged inbound ${channelLabel.toLowerCase()} from ${member.name}`,
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
	directReply?: string;
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

		case "recall": {
			const query = intent.extractedData.content || message.body;
			const replyBody = await recallFromJournal(
				{ journal: deps.journal, ai: deps.ai },
				query,
				member.name,
			);
			return { summary: replyBody, paths: [], directReply: replyBody };
		}

		case "status": {
			const dateCtx = createDateContext(now);
			const replyBody = await compileStatus(
				{ journal: deps.journal, ai: deps.ai, paths: deps.paths },
				dateCtx,
				member.name,
			);
			return { summary: "Status compiled", paths: [], directReply: replyBody };
		}

		case "question": {
			const dateCtx = createDateContext(now);
			const replyBody = await answerQuestion(
				{ journal: deps.journal, ai: deps.ai, paths: deps.paths },
				message.body,
				member.name,
				dateCtx,
			);
			return { summary: "Question answered", paths: [], directReply: replyBody };
		}

		case "edit_history": {
			const editLog = await deps.journal.getEditLog(
				now.getFullYear(),
				now.getMonth() + 1,
				now.getDate(),
			);
			const replyBody = editLog
				? `Here's what I changed today:\n\n${editLog}\n\n${KIT_PERSONA.signOff}`
				: `No changes today yet. ${KIT_PERSONA.signOff}`;
			return { summary: "Edit history returned", paths: [], directReply: replyBody };
		}

		case "list_view":
		case "list_clear":
		case "greeting":
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
	channel: Channel,
): Promise<string> {
	const systemPrompt = [
		`You are ${KIT_PERSONA.name} (${KIT_PERSONA.fullName}).`,
		"",
		"Personality:",
		...KIT_PERSONA.traits.map((t) => `- ${t}`),
		"",
		"Rules:",
		...KIT_PERSONA.rules.map((r) => `- ${r}`),
		"",
		`Tone: ${CHANNEL_TONE[channel]}`,
		"",
		`You are replying to ${member.name}.`,
		`Intent: ${intent.intent} (confidence: ${intent.confidence})`,
		`Action taken: ${actionSummary}`,
		"",
		"Journal context:",
		context,
	].join("\n");

	return ai.complete(systemPrompt, `Reply to ${member.name}'s message.`);
}

function truncate(s: string, max: number): string {
	return s.length > max ? `${s.slice(0, max)}...` : s;
}
