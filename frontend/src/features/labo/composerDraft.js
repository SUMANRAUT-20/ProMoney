const IMAGE_EXTENSION = /\.(?:avif|bmp|gif|heic|heif|ico|jpe?g|png|svg|tiff?|webp)$/i;
const MAX_STATEMENT_BYTES = 8 * 1024 * 1024;

export function stageChatAttachment(files) {
  if (!files.length) return null;
  if (files.length !== 1) throw new Error('Choose one file to attach.');
  const file = files[0];
  const statementFormat = /\.(csv|pdf|xlsx)$/i.exec(file.name)?.[1].toLowerCase();
  const format = statementFormat ?? (file.type.startsWith('image/') || IMAGE_EXTENSION.test(file.name) ? 'photo' : null);
  if (!format) throw new Error('Choose an image, CSV, PDF, or XLSX file. Save older XLS files as XLSX first.');
  if (!file.size) throw new Error('This file is empty.');
  if (statementFormat && file.size > MAX_STATEMENT_BYTES) throw new Error('Choose a statement no larger than 8 MB.');
  return { file, format };
}

export function sendChatDraft(text, attachment, { ask, scanPhoto, importStatement }) {
  const message = text.trim();
  if (!attachment) return ask(message);
  const { file, format } = attachment;
  return format === 'photo' ? scanPhoto(file, message) : importStatement(file, format, message);
}
