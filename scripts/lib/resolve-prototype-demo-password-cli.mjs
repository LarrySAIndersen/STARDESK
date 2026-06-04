#!/usr/bin/env node
/** Print prototype demo password for gate shell scripts (env / apps/api/.env only). */
import { requirePrototypeDemoPassword } from "./prototype-demo-password.mjs";

process.stdout.write(requirePrototypeDemoPassword());
