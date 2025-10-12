import { Tree } from 'web-tree-sitter';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Connection } from 'vscode-languageserver/node';

export interface DocumentManager {
  documents: Map<string, TextDocument>;
  trees: Map<string, Tree>;
  get(uri: string): TextDocument | undefined;
  getTree(uri: string): Tree | undefined;
  setTree(uri: string, tree: Tree): void;
  deleteTree(uri: string): void;
  listen(connection: Connection): void;
}

export interface Glossary {
  [key: string]: string;
}
