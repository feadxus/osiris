/**
 * ════════════════════════════════════════════════════════════════
 *  OSIRIS — Plugin System API
 *
 *  GET  /api/plugins            → list installed plugins (+ ?id= for one)
 *  POST /api/plugins            → action-dispatched mutations:
 *      { action: 'install',   manifest }   (admin)
 *      { action: 'enable',    id }         (admin)
 *      { action: 'disable',   id }         (admin)
 *      { action: 'uninstall', id }         (admin)
 *      { action: 'execute',   id, input? } (admin)
 *
 *  Plugins are hot-loaded: every mutation takes effect immediately on
 *  the running process. Listing is open (manifests aren't secret);
 *  all mutations and executions require the admin role.
 * ════════════════════════════════════════════════════════════════
 */

import { NextResponse } from 'next/server';
import { verifyJWT, getTokenFromRequest } from '@/lib/auth';
import {
  listPlugins, getPlugin, installPlugin, setPluginStatus, uninstallPlugin,
} from '@/lib/plugins/registry';
import { executePlugin } from '@/lib/plugins/runtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function requireAdmin(request: Request): { ok: true } | { ok: false; res: NextResponse } {
  const token = getTokenFromRequest(request);
  if (!token) return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const payload = verifyJWT(token);
  if (!payload) return { ok: false, res: NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 }) };
  if (payload.role !== 'admin') return { ok: false, res: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  return { ok: true };
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  if (id) {
    const plugin = getPlugin(id);
    if (!plugin) return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    return NextResponse.json({ plugin });
  }
  return NextResponse.json({ plugins: listPlugins() });
}

export async function POST(request: Request) {
  const gate = requireAdmin(request);
  if (!gate.ok) return gate.res;

  let body: { action?: string; manifest?: unknown; id?: string; input?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  switch (body.action) {
    case 'install': {
      const result = installPlugin(body.manifest as never);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, plugin: result.plugin, plugins: listPlugins() });
    }

    case 'enable':
    case 'disable': {
      if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
      const result = setPluginStatus(body.id, body.action === 'enable' ? 'enabled' : 'disabled');
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
      return NextResponse.json({ success: true, plugin: result.plugin, plugins: listPlugins() });
    }

    case 'uninstall': {
      if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
      const result = uninstallPlugin(body.id);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
      return NextResponse.json({ success: true, plugins: listPlugins() });
    }

    case 'execute': {
      if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
      const plugin = getPlugin(body.id);
      if (!plugin) return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
      const userKey = request.headers.get('x-deepseek-key') || undefined;
      const result = await executePlugin(plugin, { input: body.input, userKey });
      return NextResponse.json({ success: result.ok, result, plugin: getPlugin(body.id) });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${body.action ?? '(none)'}` }, { status: 400 });
  }
}
