/** Read actions from the submitted document, not stale visual-editor state. */
export function policyActions(document: unknown): string[] {
  if (!document || typeof document !== 'object' || !('Statement' in document)) return [];
  const statements = Array.isArray(document.Statement) ? document.Statement : [document.Statement];
  return [...new Set(statements.flatMap(statement => {
    if (!statement || typeof statement !== 'object' || !('Action' in statement)) return [];
    const actions: unknown[] = Array.isArray(statement.Action) ? statement.Action : [statement.Action];
    return actions.filter((action): action is string => typeof action === 'string');
  }))];
}
