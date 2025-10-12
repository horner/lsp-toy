import { Connection, SignatureHelpParams, SignatureHelp, SignatureInformation } from 'vscode-languageserver/node';
import { DocumentManager } from '../types';
import { logDebug } from '../utils/logging';

export function registerSignatureHelpProvider(connection: Connection, documentManager: DocumentManager): void {
  connection.onSignatureHelp((params: SignatureHelpParams): SignatureHelp | null => {
    logDebug('onSignatureHelp called for:', params.textDocument.uri);
    logDebug('  Position:', `line ${params.position.line}, char ${params.position.character}`);
    const document = documentManager.get(params.textDocument.uri);
    if (!document) {
      logDebug('  ✗ Document not found');
      return null;
    }

    const signature = buildSignatureHelp(document, params.position);
    if (signature) {
      logDebug('  ✓ Returning signature help with', signature.signatures.length, 'signatures');
    } else {
      logDebug('  ⊙ No signature help available at this position');
    }
    return signature;
  });
}

function buildSignatureHelp(document: any, position: any): SignatureHelp | null {
  const text = document.getText();
  const offset = document.offsetAt(position);
  const before = text.slice(0, offset);
  const callIndex = before.lastIndexOf('contact(');

  if (callIndex === -1) {
    return null;
  }

  const openParenIndex = callIndex + 'contact'.length + 1;
  const closeIndex = before.indexOf(')', openParenIndex);
  if (closeIndex !== -1 && closeIndex < before.length) {
    return null;
  }

  const argsFragment = before.slice(openParenIndex);
  const commaCount = argsFragment.split(',').length - 1;
  const activeParameter = Math.min(Math.max(commaCount, 0), 1);

  const signature: SignatureInformation = {
    label: 'contact(firstName: string, lastName: string)',
    documentation: {
      kind: 'markdown',
      value: 'Creates a contact entry with a first and last name.'
    },
    parameters: [
      {
        label: 'firstName: string',
        documentation: 'Given name to display.'
      },
      {
        label: 'lastName: string',
        documentation: 'Family name to display.'
      }
    ]
  };

  return {
    signatures: [signature],
    activeSignature: 0,
    activeParameter
  };
}
