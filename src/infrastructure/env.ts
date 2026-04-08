export interface Env {
	AI: Ai;
	KIT_AGENT: DurableObjectNamespace;
	JOURNAL: R2Bucket;
}

export type AppEnv = {
	Bindings: Env;
};
