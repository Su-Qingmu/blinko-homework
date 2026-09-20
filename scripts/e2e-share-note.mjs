#!/usr/bin/env bun
// E2E test for teamNote batch share with member subset.
// Strategy:
//  1. Read existing accounts/teams/notes from the dev DB.
//  2. Pick an owner account (has notes), a target team (owner is member),
//     and 2 member accounts to share with.
//  3. Mint a short-lived JWT for the owner (same secret the server uses).
//  4. Call getSharableTeams → assert the team is listed & shared=false.
//  5. Call shareMulti with the 2 members → assert {shared:2,removed:0}.
//  6. Call getSharableTeams again → assert isShared=true & sharedMemberCount=2.
//  7. Call getTeamMembersForNote → assert [m1, m2].
//  8. Re-share with only m1 (remove m2) → assert {shared:1, removed:1}.
//  9. Re-share with [] (unshare everyone) → assert {shared:0, removed:1}.
// 10. Cleanup: delete teamNoteMembers + teamNotes rows we created.
//
// Exit non-zero on any mismatch.

import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const BASE = 'http://localhost:1111';

const logLine = (...a) => console.log('  ', ...a);
const fail = (msg) => { console.error('FAIL:', msg); process.exit(1); };

const call = async (path, token, body, method = 'GET') => {
  const url = `${BASE}/api/trpc/${path}?batch=1`;
  const opts = { method, headers: token ? { Authorization: `Bearer ${token}` } : {} };
  if (method === 'POST') {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify({ '0': { json: body } });
  } else {
    const q = encodeURIComponent(JSON.stringify({ '0': { json: body } }));
    opts.url = `${url}&input=${q}`;
  }
  const res = await fetch(opts.url || url, opts);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
};

(async () => {
  const prisma = new PrismaClient();

  console.log('1) Read fixtures');
  const accounts = await prisma.accounts.findMany({ select: { id: true, name: true, role: true } });
  logLine('accounts:', accounts.map(a => `${a.id}:${a.name}`).join(', '));
  const teams = await prisma.teams.findMany();
  logLine('teams:', teams.map(t => `${t.id}:${t.name}`).join(', '));
  const teamMembers = await prisma.teamMembers.findMany({
    include: { team: { select: { id: true, name: true } }, account: { select: { id: true, name: true } } },
  });
  logLine('teamMembers:', teamMembers.map(m => `team${m.teamId}/acc${m.accountId}(${m.account.name})`).join(', '));
  const notes = await prisma.notes.findMany({ select: { id: true, accountId: true }, take: 20 });
  logLine('notes:', notes.map(n => `${n.id}@acc${n.accountId}`).join(', '));

  // pick owner = a user who has at least one note
  const ownerId = notes.find(n => n.accountId !== null)?.accountId;
  if (!ownerId) fail('no note owner in DB');
  const ownerNoteId = notes.find(n => n.accountId === ownerId)?.id;
  if (!ownerNoteId) fail('no note for owner ' + ownerId);

  // pick a team the owner is a member of
  const ownerMemberships = teamMembers.filter(m => m.accountId === ownerId);
  if (ownerMemberships.length === 0) fail('owner has no team membership; seed test data first');
  const teamId = ownerMemberships[0].teamId;

  // ensure team has 2 other accounts as members (bootstrap test data)
  let teamMemberIds = teamMembers.filter(m => m.teamId === teamId).map(m => m.accountId);
  let otherAccountIds = accounts.filter(a => a.id !== ownerId && !teamMemberIds.includes(a.id)).map(a => a.id);
  // create extra test accounts if DB is sparse
  while (otherAccountIds.length + teamMemberIds.filter(id => id !== ownerId).length < 2) {
    const id = await prisma.accounts.create({ data: { name: `e2e_${Math.random().toString(36).slice(2, 8)}`, nickname: 'e2e', role: 'user' } });
    otherAccountIds.push(id.id);
    accounts.push({ id: id.id, name: id.name, role: 'user' });
    logLine(`bootstrapped: created account ${id.id}`);
  }
  for (const aid of otherAccountIds.slice(0, 2 - teamMemberIds.filter(id => id !== ownerId).length)) {
    await prisma.teamMembers.create({ data: { teamId, accountId: aid, role: 'member' } });
    logLine(`bootstrapped: added acc${aid} to team${teamId}`);
  }
  // re-read teamMembers
  const teamMembers2 = await prisma.teamMembers.findMany({ where: { teamId } });
  const otherMembers = teamMembers2.map(m => m.accountId).filter(id => id !== ownerId);
  if (otherMembers.length < 2) fail(`team ${teamId} still has <2 other members after bootstrap`);
  const m1 = otherMembers[0];
  const m2 = otherMembers[1];

  console.log(`\n2) Fixtures: owner=${ownerId}, note=${ownerNoteId}, team=${teamId}, members=[${m1},${m2}]`);

  console.log('\n3) Mint JWT for owner');
  const saved = await prisma.config.findFirst({ where: { key: 'JWT_SECRET' } });
  if (!saved?.config) fail('no JWT_SECRET in config');
  const secret = JSON.parse(saved.config).value;
  const owner = accounts.find(a => a.id === ownerId);
  const token = jwt.sign(
    {
      sub: owner.id, name: owner.name, role: owner.role || 'user',
      twoFactorVerified: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    },
    secret, { algorithm: 'HS256' },
  );
  logLine('token length:', token.length);

  // cleanup any prior state for this note+team
  await prisma.teamNoteMembers.deleteMany({ where: { teamNote: { noteId: ownerNoteId, teamId } } });
  await prisma.teamNotes.deleteMany({ where: { noteId: ownerNoteId, teamId } });

  console.log('\n4) getSharableTeams (expect isShared=false)');
  let r = await call('teamNote.getSharableTeams', token, { noteId: ownerNoteId });
  if (r.status !== 200) fail('status ' + r.status + ' body=' + JSON.stringify(r.body));
  const teamInfo = r.body[0]?.result?.data?.json?.find(t => t.teamId === teamId);
  if (!teamInfo) fail('team ' + teamId + ' not in sharable list');
  if (teamInfo.isShared !== false) fail('expected isShared=false, got ' + teamInfo.isShared);
  if (teamInfo.sharedMemberCount !== 0) fail('expected sharedMemberCount=0, got ' + teamInfo.sharedMemberCount);
  logLine('✓ initial state correct');

  console.log('\n5) shareMulti with [m1, m2]');
  r = await call('teamNote.shareMulti', token, {
    noteId: ownerNoteId,
    targets: [{ teamId, memberIds: [m1, m2] }],
  }, 'POST');
  if (r.status !== 200) fail('status ' + r.status + ' body=' + JSON.stringify(r.body));
  const sharedRes = r.body[0]?.result?.data?.json;
  if (!sharedRes || sharedRes.shared !== 2 || sharedRes.removed !== 0) {
    fail('expected {shared:2,removed:0}, got ' + JSON.stringify(sharedRes));
  }
  logLine('✓ shareMulti returned', JSON.stringify(sharedRes));

  console.log('\n6) getSharableTeams (expect isShared=true, sharedMemberCount=2)');
  r = await call('teamNote.getSharableTeams', token, { noteId: ownerNoteId });
  if (r.status !== 200) fail('status ' + r.status + ' body=' + JSON.stringify(r.body));
  const info2 = r.body[0]?.result?.data?.json?.find(t => t.teamId === teamId);
  if (!info2?.isShared || info2.sharedMemberCount !== 2) {
    fail('expected isShared=true & count=2, got ' + JSON.stringify(info2));
  }
  logLine('✓ echo correct');

  console.log('\n7) getTeamMembersForNote (expect [m1,m2])');
  r = await call('teamNote.getTeamMembersForNote', token, { noteId: ownerNoteId, teamId });
  if (r.status !== 200) fail('status ' + r.status + ' body=' + JSON.stringify(r.body));
  const echoed = r.body[0]?.result?.data?.json ?? [];
  if (!echoed.includes(m1) || !echoed.includes(m2) || echoed.length !== 2) {
    fail('expected [' + m1 + ',' + m2 + '], got ' + JSON.stringify(echoed));
  }
  logLine('✓ echoed members:', JSON.stringify(echoed));

  console.log('\n8) Re-share with only m1 (remove m2)');
  r = await call('teamNote.shareMulti', token, {
    noteId: ownerNoteId,
    targets: [{ teamId, memberIds: [m1] }],
  }, 'POST');
  const updRes = r.body[0]?.result?.data?.json;
  if (updRes.shared !== 1 || updRes.removed !== 1) {
    fail('expected {shared:1,removed:1}, got ' + JSON.stringify(updRes));
  }
  logLine('✓ re-share correct:', JSON.stringify(updRes));

  console.log('\n9) getTeamMembers (verify m2 is gone)');
  r = await call('teamNote.getTeamMembers', token, { teamId });
  const allMems = r.body[0]?.result?.data?.json ?? [];
  if (!allMems.find(m => m.id === m1)) fail('m1 missing from teamMembers');
  if (!allMems.find(m => m.id === m2)) fail('m2 missing from teamMembers');
  logLine('✓ getTeamMembers returns both:', allMems.length);

  // re-check getTeamMembersForNote
  r = await call('teamNote.getTeamMembersForNote', token, { noteId: ownerNoteId, teamId });
  const echoed2 = r.body[0]?.result?.data?.json ?? [];
  if (echoed2.length !== 1 || echoed2[0] !== m1) {
    fail('expected [' + m1 + '] after partial re-share, got ' + JSON.stringify(echoed2));
  }
  logLine('✓ partial re-share: only m1 echoed');

  console.log('\n10) Unshare everyone (empty memberIds)');
  r = await call('teamNote.shareMulti', token, {
    noteId: ownerNoteId,
    targets: [{ teamId, memberIds: [] }],
  }, 'POST');
  const unRes = r.body[0]?.result?.data?.json;
  if (unRes.shared !== 0 || unRes.removed !== 1) {
    fail('expected {shared:0,removed:1}, got ' + JSON.stringify(unRes));
  }
  logLine('✓ unshare correct:', JSON.stringify(unRes));

  console.log('\n11) Cleanup');
  await prisma.teamNoteMembers.deleteMany({ where: { teamNote: { noteId: ownerNoteId, teamId } } });
  await prisma.teamNotes.deleteMany({ where: { noteId: ownerNoteId, teamId } });
  await prisma.teamActivities.deleteMany({ where: { teamId, action: 'note.share' } });
  // remove any e2e_xxxx accounts and memberships we bootstrapped
  const e2eAccs = await prisma.accounts.findMany({ where: { name: { startsWith: 'e2e_' } }, select: { id: true } });
  if (e2eAccs.length > 0) {
    const ids = e2eAccs.map(a => a.id);
    await prisma.teamMembers.deleteMany({ where: { accountId: { in: ids } } });
    await prisma.accounts.deleteMany({ where: { id: { in: ids } } });
    logLine(`✓ cleaned ${ids.length} e2e accounts`);
  }
  // also un-bootstrap: remove teamMembers we added for acc1 (testuser) if it wasn't there originally
  const origTeamMembers = await prisma.teamMembers.findMany({ where: { teamId } });
  logLine('teamMembers remaining:', origTeamMembers.map(m => `acc${m.accountId}`).join(', '));
  logLine('✓ cleaned');

  await prisma.$disconnect();
  console.log('\nALL E2E CHECKS PASSED');
})().catch((e) => { console.error('SCRIPT ERROR:', e); process.exit(1); });