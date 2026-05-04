#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const errors = [];

function readFile(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function fail(message) {
  errors.push(message);
}

function walkRouteFiles(dir, result = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkRouteFiles(fullPath, result);
      continue;
    }
    if (entry.isFile() && entry.name === "route.ts") {
      result.push(fullPath);
    }
  }
  return result;
}

function asRepoRelative(filePath) {
  return path.relative(process.cwd(), filePath).split(path.sep).join("/");
}

const middlewareSource = readFile("middleware.ts");
if (middlewareSource.includes("(?!api|")) {
  fail("middleware matcher excludes /api, so API guardrails are bypassed.");
}
if (!/isStagingHost\(/.test(middlewareSource) || !/getStagingAllowedEmailsFromEnv\(/.test(middlewareSource)) {
  fail("staging gate checks are missing in middleware.ts.");
}

const envAccessSource = readFile("src/lib/environment-access.ts");
if (!/return isLocalHost\(normalized\);/.test(envAccessSource)) {
  fail("Auth bypass is no longer restricted to local host in environment-access.ts.");
}

const matrixSource = readFile("src/lib/access-matrix.ts");
const requiredMatrixPrefixes = [
  "/admin",
  "/api/admin",
  "/api/internal",
  "/api/ostrovy/guide",
  "/api/ostrovy/my-children",
  "/api/reports",
  "/api/m01",
  "/api/coda",
  "/api/support",
];
for (const prefix of requiredMatrixPrefixes) {
  if (!matrixSource.includes(`prefix: "${prefix}"`)) {
    fail(`Role matrix is missing required prefix: ${prefix}`);
  }
}

const guideRolesMatch = matrixSource.match(/const GUIDE_ACCESS_ROLES = new Set\(\[([\s\S]*?)\]\);/);
if (!guideRolesMatch) {
  fail("GUIDE_ACCESS_ROLES declaration not found in access matrix.");
} else if (guideRolesMatch[1].includes("\"admin\"")) {
  fail("GUIDE_ACCESS_ROLES must not include admin (admin should not auto-access personal data).");
}

const childRolesMatch = matrixSource.match(/const CHILD_ACCESS_ROLES = new Set\(\[([\s\S]*?)\]\);/);
if (!childRolesMatch) {
  fail("CHILD_ACCESS_ROLES declaration not found in access matrix.");
} else if (childRolesMatch[1].includes("\"admin\"")) {
  fail("CHILD_ACCESS_ROLES must not include admin (admin should not auto-access personal data).");
}

const guardPatterns = [
  /getApiSessionContext\(req\)/,
  /auth\(/,
  /checkKioskKey\(/,
  /isAuthorized\(/,
  /isDevAuthBypassEnabled\(/,
];

const explicitPublicRoutes = new Set([
  "app/api/auth/[...nextauth]/route.ts",
  "app/api/ostrovy/images/[eventId]/route.ts",
]);

const routeFiles = walkRouteFiles(path.join(process.cwd(), "app", "api"));
for (const filePath of routeFiles) {
  const relativePath = asRepoRelative(filePath);
  const source = fs.readFileSync(filePath, "utf8");
  const guarded = guardPatterns.some((pattern) => pattern.test(source));

  if (!guarded && !explicitPublicRoutes.has(relativePath)) {
    fail(`API route missing auth/role guard token: ${relativePath}`);
  }

  if (/getApiSessionContext\(/.test(source) && !/getApiSessionContext\(req\)/.test(source)) {
    fail(`API route must pass request host to getApiSessionContext(req): ${relativePath}`);
  }
}

if (errors.length > 0) {
  console.error("Security guardrail checks failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Security guardrail checks passed.");
