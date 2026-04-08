export interface Env {
	AI: Ai;
	KIT_AGENT: DurableObjectNamespace;
	JOURNAL: R2Bucket;
	SEND_EMAIL: SendEmail;
}

export type AppEnv = {
	Bindings: Env;
};
