const { neon } = require("@neondatabase/serverless");

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json"
};

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (!process.env.DATABASE_URL) {
    return json(500, { error: "DATABASE_URL nao configurada no ambiente." });
  }

  const sql = neon(process.env.DATABASE_URL);
  await ensureSchema(sql);

  if (event.httpMethod === "GET") {
    const playerName = cleanName(event.queryStringParameters?.player);
    if (!playerName) return json(400, { error: "player obrigatorio." });

    const rows = await sql`
      select u.display_name, p.progress
      from voxel_users u
      left join voxel_progress p on p.user_id = u.id
      where u.display_name = ${playerName}
      limit 1
    `;

    return json(200, {
      playerName,
      progress: rows[0]?.progress || null
    });
  }

  if (event.httpMethod === "POST") {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (error) {
      return json(400, { error: "JSON invalido." });
    }

    const playerName = cleanName(body.playerName);
    if (!playerName) return json(400, { error: "playerName obrigatorio." });

    const progress = sanitizeProgress(body.progress);
    const users = await sql`
      insert into voxel_users (display_name)
      values (${playerName})
      on conflict (display_name) do update set updated_at = now()
      returning id, display_name
    `;

    await sql`
      insert into voxel_progress (user_id, progress)
      values (${users[0].id}, ${JSON.stringify(progress)}::jsonb)
      on conflict (user_id) do update
      set progress = excluded.progress, updated_at = now()
    `;

    return json(200, { ok: true, playerName });
  }

  return json(405, { error: "Metodo nao permitido." });
};

async function ensureSchema(sql) {
  await sql`
    create table if not exists voxel_users (
      id uuid primary key default gen_random_uuid(),
      display_name text not null unique,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists voxel_progress (
      user_id uuid primary key references voxel_users(id) on delete cascade,
      progress jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `;
}

function cleanName(value) {
  return String(value || "")
    .trim()
    .replace(/[^\w -]/g, "")
    .slice(0, 18);
}

function sanitizeProgress(progress) {
  const safe = progress && typeof progress === "object" ? progress : {};
  return {
    version: 1,
    player: sanitizeVector(safe.player),
    creative: Boolean(safe.creative),
    selectedBlock: Number.isInteger(safe.selectedBlock) ? safe.selectedBlock : 0,
    edits: Array.isArray(safe.edits) ? safe.edits.slice(0, 6000) : [],
    inventory: sanitizeInventory(safe.inventory),
    survival: sanitizeSurvival(safe.survival),
    updatedAt: new Date().toISOString()
  };
}

function sanitizeInventory(inventory) {
  if (!Array.isArray(inventory)) return [];
  return inventory.slice(0, 36).map((stack) => {
    if (!stack || typeof stack !== "object") return null;
    const id = String(stack.id || "").slice(0, 40);
    const count = Math.max(1, Math.min(64, Number(stack.count) || 1));
    return id ? { id, count } : null;
  });
}

function sanitizeSurvival(survival) {
  const source = survival && typeof survival === "object" ? survival : {};
  return {
    health: Math.max(0, Math.min(20, finiteNumber(source.health, 20))),
    hunger: Math.max(0, Math.min(20, finiteNumber(source.hunger, 20)))
  };
}

function sanitizeVector(vector) {
  const source = vector && typeof vector === "object" ? vector : {};
  return {
    x: finiteNumber(source.x, 0.5),
    y: finiteNumber(source.y, 32),
    z: finiteNumber(source.z, 0.5)
  };
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body)
  };
}
