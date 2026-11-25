import { MemoryModel } from '../models/memoryModel.js';
import { AccountModel } from '../models/accountModel.js';
import { cleanMemory, memoryEntries } from '../services/nidhiMemory.js';
import { proposeMemoryUpdate } from '../services/laboMemory.js';

const reply = (res, memory) => res.set('Cache-Control', 'no-store').json({
  status: 'ok', data: { entries: memoryEntries(memory) },
});

export async function listMemory(req, res, next) {
  try {
    return reply(res, await MemoryModel.findByUser(req.user.id));
  } catch (err) {
    return next(err);
  }
}

export async function remember(req, res, next) {
  try {
    const patch = cleanMemory(req.body?.patch);
    if (!memoryEntries(patch).length) return res.status(400).json({ error: 'Choose valid details to remember.', status: 400 });
    const accountIds = Object.values(patch.accountMap);
    if (accountIds.length) {
      const ownedIds = new Set((await AccountModel.findByUser(req.user.id)).map(({ id }) => String(id)));
      if (accountIds.some((id) => !ownedIds.has(id))) {
        return res.status(400).json({ error: 'Choose one of your accounts to remember.', status: 400 });
      }
    }
    return reply(res, await MemoryModel.merge(req.user.id, patch));
  } catch (err) {
    return next(err);
  }
}

export async function forget(req, res, next) {
  try {
    const memory = await MemoryModel.forget(req.user.id, req.params.section, req.params.key);
    if (!memory) return res.status(404).json({ error: 'Remembered item not found.', status: 404 });
    return reply(res, memory);
  } catch (err) {
    return next(err);
  }
}

export async function clearMemory(req, res, next) {
  try {
    await MemoryModel.clear(req.user.id);
    return reply(res, cleanMemory());
  } catch (err) {
    return next(err);
  }
}

export async function previewMemory(req, res, next) {
  const { question, answer } = req.body ?? {};
  if (typeof question !== 'string' || !question.trim() || question.length > 500
    || typeof answer !== 'string' || !answer.trim() || answer.length > 2000) {
    return res.status(400).json({ error: 'A chat exchange is required.', status: 400 });
  }
  try {
    const current = await MemoryModel.findByUser(req.user.id);
    const proposal = await proposeMemoryUpdate({ question, answer, current });
    return res.set('Cache-Control', 'no-store').json({ status: 'ok', data: { proposal } });
  } catch (err) {
    if (['LABO_NOT_CONFIGURED', 'GROQ_UPSTREAM', 'META_UPSTREAM'].includes(err.code)) {
      return res.status(503).json({ error: 'Memory suggestions are unavailable right now.', status: 503 });
    }
    return next(err);
  }
}
