import { lt } from "semver";
import { VERSION } from "svelte/compiler";

export const RESTRICTED_RULES = lt(VERSION, "5.28.2");
