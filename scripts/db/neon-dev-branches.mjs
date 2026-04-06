#!/usr/bin/env node

import process from "node:process";

const API_BASE = process.env.NEON_API_BASE_URL ?? "https://console.neon.tech/api/v2";

function parseArgs(argv) {
  const positional = [];
  const options = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "true";
    options[key] = value;
    if (value !== "true") i += 1;
  }

  return { positional, options };
}

function normalizeSlug(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function getTimestamp() {
  const date = new Date();
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}${mm}${dd}${hh}${mi}`;
}

async function apiRequest(projectId, apiKey, method, endpoint, body) {
  const response = await fetch(`${API_BASE}/projects/${projectId}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    const reason = payload?.message ?? payload?.error ?? payload?.raw ?? `HTTP ${response.status}`;
    throw new Error(`Neon API ${method} ${endpoint} failed: ${reason}`);
  }

  return payload;
}

function extractBranches(payload) {
  if (Array.isArray(payload?.branches)) return payload.branches;
  if (Array.isArray(payload?.data?.branches)) return payload.data.branches;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

function branchId(branch) {
  return branch?.id ?? branch?.branch_id ?? branch?.branchId ?? null;
}

function branchName(branch) {
  return branch?.name ?? branch?.branch_name ?? branch?.branchName ?? null;
}

function findBranchByName(branches, name) {
  return branches.find((branch) => branchName(branch) === name) ?? null;
}

async function listBranches(projectId, apiKey) {
  const payload = await apiRequest(projectId, apiKey, "GET", "/branches");
  return extractBranches(payload);
}

async function createBranch(projectId, apiKey, name, parentId) {
  const payload = await apiRequest(projectId, apiKey, "POST", "/branches", {
    branch: {
      name,
      parent_id: parentId,
      init_source: "parent-data",
    },
  });

  const created = payload?.branch ?? payload?.data?.branch ?? payload;
  return {
    id: branchId(created),
    name: branchName(created) ?? name,
  };
}

async function deleteBranch(projectId, apiKey, id) {
  await apiRequest(projectId, apiKey, "DELETE", `/branches/${id}`);
}

function requireConfig() {
  const apiKey = process.env.NEON_API_KEY;
  const projectId = process.env.NEON_PROJECT_ID;
  if (!apiKey || !projectId) {
    throw new Error("Missing NEON_API_KEY or NEON_PROJECT_ID.");
  }

  return { apiKey, projectId };
}

function resolveDevBranchName(options) {
  if (options.name && options.name !== "true") {
    return normalizeSlug(options.name);
  }

  const developer = normalizeSlug(options.developer ?? process.env.USER ?? "dev");
  const feature = normalizeSlug(options.feature ?? "work");
  const suffix = options.timestamp === "true" ? `-${getTimestamp()}` : "";
  return `dev-${developer}-${feature}${suffix}`.slice(0, 62);
}

async function resolveProdParentId(projectId, apiKey, branches) {
  if (process.env.NEON_PROD_BRANCH_ID) {
    return process.env.NEON_PROD_BRANCH_ID;
  }

  const prodName = process.env.NEON_PROD_BRANCH_NAME ?? "main";
  const prodBranch = findBranchByName(branches, prodName);
  const id = branchId(prodBranch);
  if (!id) {
    throw new Error(
      `Cannot resolve production parent branch. Set NEON_PROD_BRANCH_ID or ensure branch '${prodName}' exists.`,
    );
  }

  return id;
}

function ensureYes(options, description) {
  if (options.yes === "true") return;
  throw new Error(`Refusing to ${description} without --yes.`);
}

async function refreshTemplate(options) {
  const { apiKey, projectId } = requireConfig();
  const templateName = process.env.NEON_DEV_TEMPLATE_BRANCH_NAME ?? "dev-template";

  const branches = await listBranches(projectId, apiKey);
  const prodParentId = await resolveProdParentId(projectId, apiKey, branches);

  const existing = findBranchByName(branches, templateName);
  if (existing) {
    ensureYes(options, `replace template branch '${templateName}'`);
    const existingId = branchId(existing);
    if (!existingId) {
      throw new Error(`Template branch '${templateName}' exists but has no id.`);
    }

    if (existingId === prodParentId) {
      throw new Error("Template branch resolves to production parent id. Refusing to delete.");
    }

    await deleteBranch(projectId, apiKey, existingId);
    console.log(`Deleted existing template branch '${templateName}' (${existingId}).`);
  }

  const created = await createBranch(projectId, apiKey, templateName, prodParentId);
  console.log(`Created template branch '${created.name}' (${created.id ?? "id-unknown"}) from prod parent.`);
}

async function createDev(options) {
  const { apiKey, projectId } = requireConfig();
  const templateName = process.env.NEON_DEV_TEMPLATE_BRANCH_NAME ?? "dev-template";
  const desiredName = resolveDevBranchName(options);

  const branches = await listBranches(projectId, apiKey);
  const template = findBranchByName(branches, templateName);
  const templateId = branchId(template);
  if (!templateId) {
    throw new Error(`Template branch '${templateName}' not found. Run refresh-template first.`);
  }

  const existing = findBranchByName(branches, desiredName);
  if (existing) {
    throw new Error(`Branch '${desiredName}' already exists. Use reset-dev or choose a new name.`);
  }

  const created = await createBranch(projectId, apiKey, desiredName, templateId);
  console.log(`Created dev branch '${created.name}' (${created.id ?? "id-unknown"}) from '${templateName}'.`);
  console.log(`Next: set POSTGRES_PRISMA_URL to connection string of '${created.name}' in Neon Console.`);
}

async function resetDev(options) {
  const { apiKey, projectId } = requireConfig();
  const templateName = process.env.NEON_DEV_TEMPLATE_BRANCH_NAME ?? "dev-template";
  const targetName = resolveDevBranchName(options);

  const branches = await listBranches(projectId, apiKey);
  const template = findBranchByName(branches, templateName);
  const templateId = branchId(template);
  if (!templateId) {
    throw new Error(`Template branch '${templateName}' not found. Run refresh-template first.`);
  }

  const existing = findBranchByName(branches, targetName);
  if (existing) {
    ensureYes(options, `reset dev branch '${targetName}'`);
    const existingId = branchId(existing);
    if (!existingId) {
      throw new Error(`Branch '${targetName}' exists but has no id.`);
    }
    await deleteBranch(projectId, apiKey, existingId);
    console.log(`Deleted existing dev branch '${targetName}' (${existingId}).`);
  }

  const created = await createBranch(projectId, apiKey, targetName, templateId);
  console.log(`Recreated dev branch '${created.name}' (${created.id ?? "id-unknown"}) from '${templateName}'.`);
}

async function listAll() {
  const { apiKey, projectId } = requireConfig();
  const branches = await listBranches(projectId, apiKey);
  if (branches.length === 0) {
    console.log("No branches returned by Neon API.");
    return;
  }

  for (const branch of branches) {
    console.log(`${branchName(branch) ?? "<unknown>"}\t${branchId(branch) ?? "<id-unknown>"}`);
  }
}

async function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));
  const command = positional[0];

  if (!command || command === "help" || options.help === "true") {
    console.log(`Usage:\n  node scripts/db/neon-dev-branches.mjs <command> [options]\n\nCommands:\n  refresh-template         Recreate template branch from prod parent\n  create-dev               Create personal dev branch from template\n  reset-dev                Recreate personal dev branch from template\n  list                     List branches\n\nOptions:\n  --name <branch-name>     Explicit branch name for create/reset\n  --developer <name>       Developer slug part (default: $USER)\n  --feature <name>         Feature slug part (default: work)\n  --timestamp              Append UTC timestamp suffix to generated name\n  --yes                    Required for destructive delete operations\n\nRequired env:\n  NEON_API_KEY\n  NEON_PROJECT_ID\n\nOptional env:\n  NEON_PROD_BRANCH_ID
  NEON_PROD_BRANCH_NAME (default: main)
  NEON_DEV_TEMPLATE_BRANCH_NAME (default: dev-template)`);
    return;
  }

  if (command === "refresh-template") {
    await refreshTemplate(options);
    return;
  }

  if (command === "create-dev") {
    await createDev(options);
    return;
  }

  if (command === "reset-dev") {
    await resetDev(options);
    return;
  }

  if (command === "list") {
    await listAll();
    return;
  }

  throw new Error(`Unknown command '${command}'. Use help.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
