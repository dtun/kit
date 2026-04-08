import { LANDING_PAGE_HTML } from "@adapters/http/landing-page";
import type { AppEnv } from "@infrastructure/env";
import { Hono } from "hono";

export let landingRoute = new Hono<AppEnv>();

landingRoute.get("/", (c) => {
	return c.html(LANDING_PAGE_HTML);
});
