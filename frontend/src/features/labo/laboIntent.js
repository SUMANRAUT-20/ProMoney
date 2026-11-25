const actionVerb = /\b(?:add|create|make|set up|record|open|edit|update|change|rename|delete|remove)\b/i;
const actionObject = /\b(?:(?:account|transaction|budget|bill|subscription|goal)s?|categor(?:y|ies))\b/i;
const recordChange = /\b(?:edit|update|change|delete|remove)\b.*\brecords?\b/i;
const importVerb = /\b(?:upload(?:ing|ed)?|uplode|attach(?:ing|ed)?|import(?:ing)?)\b/i;
const statementFile = /\b(?:xlsx?|statements?)\b/i;

export function isRecordAction(question) {
  return !/^(?:how|where|can i)\b/i.test(question) &&
    ((actionVerb.test(question) && actionObject.test(question)) || recordChange.test(question));
}

export function routeLaboQuestion(question, matchesAction = isRecordAction) {
  if (importVerb.test(question) && statementFile.test(question)) {
    const convert = /\bxls\b/i.test(question) ? 'Save the old .xls file as .xlsx first. ' : '';
    return { guidance: convert + 'Use Attach statement to upload the file. Choose the accounts, review the rows, and confirm what to add.' };
  }
  return { action: matchesAction(question) };
}
