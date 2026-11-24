import { proposeLaboAction } from '../services/laboActions.js';

export async function previewLaboAction(req, res, next) {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text || text.length > 500) {
    return res.status(400).json({ error: 'text is required (max 500 characters)', status: 400 });
  }
  try {
    const action = await proposeLaboAction(text);
    return res.set('Cache-Control', 'no-store').json({ status: 'ok', data: { action } });
  } catch (err) {
    if (err.code === 'GROQ_UPSTREAM' || err.code === 'META_UPSTREAM') {
      return res.status(502).json({ error: 'The AI service is busy right now. Please try again.', status: 502 });
    }
    if (err.code === 'LABO_NOT_CONFIGURED') {
      return res.status(503).json({ error: err.message, status: 503 });
    }
    return next(err);
  }
}
