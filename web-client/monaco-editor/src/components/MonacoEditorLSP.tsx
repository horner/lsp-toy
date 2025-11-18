import React, { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { SAMPLE_LSPTOY_CONTENT } from '../constants/sampleContent';

const getLSPWebSocketUrl = (): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}`;
};

interface LSPMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

export const MonacoEditorLSP: React.FC = () => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const messageIdRef = useRef(1);
  const [documentUri] = useState('file:///sample.lsptoy');
  const [documentVersion, setDocumentVersion] = useState(0);

  console.log('MonacoEditorLSP component rendering');

  useEffect(() => {
    return () => {
      // Cleanup
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const sendLSPMessage = (message: LSPMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const jsonMessage = JSON.stringify(message);
      console.log('Sending LSP message:', jsonMessage);
      const contentLength = new TextEncoder().encode(jsonMessage).length;
      wsRef.current.send(`Content-Length: ${contentLength}\r\n\r\n${jsonMessage}`);
    }
  };

  const connectToLanguageServer = () => {
    setConnectionError(null);
    
    try {
      const webSocket = new WebSocket(getLSPWebSocketUrl());
      wsRef.current = webSocket;
      
      webSocket.onopen = () => {
        console.log('WebSocket connection established');
        setIsConnected(true);

        // Send initialize request
        sendLSPMessage({
          jsonrpc: '2.0',
          id: messageIdRef.current++,
          method: 'initialize',
          params: {
            processId: null,
            clientInfo: {
              name: 'Monaco LSP Toy Client',
              version: '1.0.0',
              transport: {
                'rpc-header': false
              },            
            },
            rootUri: null,
            capabilities: {
              textDocument: {
                synchronization: {
                  dynamicRegistration: false,
                  willSave: false,
                  willSaveWaitUntil: false,
                  didSave: false
                },
                completion: {
                  dynamicRegistration: false,
                  completionItem: {
                    snippetSupport: true
                  }
                },
                hover: {
                  dynamicRegistration: false,
                  contentFormat: ['plaintext', 'markdown']
                }
              }
            }
          }
        });
      };

      webSocket.onmessage = (event) => {
        console.log('Received message:', event.data);
        
        // Parse LSP message (handle both Content-Length header format and raw JSON)
        const data = typeof event.data === 'string' ? event.data : String(event.data);
        
        try {
          let message: LSPMessage;
          
          // Check if message starts with '{' (raw JSON)
          if (data.trimStart().startsWith('{')) {
            message = JSON.parse(data);
            console.log('Parsed raw JSON message:', message);
          } else {
            // Parse Content-Length header format
            const contentMatch = data.match(/Content-Length: \d+\r\n\r\n(.*)/s);
            if (contentMatch) {
              message = JSON.parse(contentMatch[1]);
              console.log('Parsed LSP message with headers:', message);
            } else {
              console.warn('Received message in unrecognized format:', data);
              return;
            }
          }
          
          // Handle initialize response
          if (message.id === 1 && message.result) {
            console.log('Received initialize response, sending initialized notification');
            // Send initialized notification
            sendLSPMessage({
              jsonrpc: '2.0',
              method: 'initialized',
              params: {}
            });
            
            // Open the document
            if (editorRef.current) {
              console.log('Editor is ready, sending textDocument/didOpen');
              const content = editorRef.current.getValue();
              sendLSPMessage({
                jsonrpc: '2.0',
                method: 'textDocument/didOpen',
                params: {
                  textDocument: {
                    uri: documentUri,
                    languageId: 'lsptoy',
                    version: documentVersion,
                    text: content
                  }
                }
              });
            } else {
              console.warn('Editor not ready yet, cannot send textDocument/didOpen');
            }
          }
          
          // Handle diagnostics
          if (message.method === 'textDocument/publishDiagnostics' && monacoRef.current && editorRef.current) {
            const diagnostics = message.params?.diagnostics || [];
            const model = editorRef.current.getModel();
            
            if (model) {
              const markers = diagnostics.map((diag: any) => ({
                severity: diag.severity === 1 ? monacoRef.current!.MarkerSeverity.Error :
                          diag.severity === 2 ? monacoRef.current!.MarkerSeverity.Warning :
                          diag.severity === 3 ? monacoRef.current!.MarkerSeverity.Info :
                          monacoRef.current!.MarkerSeverity.Hint,
                startLineNumber: diag.range.start.line + 1,
                startColumn: diag.range.start.character + 1,
                endLineNumber: diag.range.end.line + 1,
                endColumn: diag.range.end.character + 1,
                message: diag.message,
                code: diag.code,
                source: diag.source || 'lsptoy'
              }));
              
              monacoRef.current.editor.setModelMarkers(model, 'lsptoy', markers);
              console.log('Set', markers.length, 'diagnostic markers');
            }
          }
        } catch (error) {
          console.error('Error parsing LSP message:', error);
        }
      };


      webSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('Failed to connect to language server');
        setIsConnected(false);
      };

      webSocket.onclose = () => {
        console.log('WebSocket closed');
        setIsConnected(false);
        wsRef.current = null;
      };
    } catch (error) {
      console.error('Error connecting to language server:', error);
      setConnectionError(error instanceof Error ? error.message : 'Unknown error');
      setIsConnected(false);
    }
  };

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof monaco) => {
    console.log('Editor mounted successfully');
    editorRef.current = editor;
    monacoRef.current = monacoInstance;
    
    // Register the lsptoy language if not already registered
    const languages = monacoInstance.languages.getLanguages();
    if (!languages.find((lang: any) => lang.id === 'lsptoy')) {
      monacoInstance.languages.register({ id: 'lsptoy' });
    }

    // Listen to content changes
    editor.onDidChangeModelContent(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const newVersion = documentVersion + 1;
        setDocumentVersion(newVersion);
        
        sendLSPMessage({
          jsonrpc: '2.0',
          method: 'textDocument/didChange',
          params: {
            textDocument: {
              uri: documentUri,
              version: newVersion
            },
            contentChanges: [
              {
                text: editor.getValue()
              }
            ]
          }
        });
      }
    });

    // Connect to language server after editor mounts
    connectToLanguageServer();
  };

  const disconnectFromLanguageServer = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">LSP Toy Monaco Editor</h1>
              <p className="text-sm text-gray-400 mt-1">WebSocket LSP Client</p>
            </div>
            <a
              href="/"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              ← Home
            </a>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-sm text-gray-300">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {!isConnected ? (
              <button
                onClick={connectToLanguageServer}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Connect
              </button>
            ) : (
              <button
                onClick={disconnectFromLanguageServer}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
        {connectionError && (
          <div className="mt-3 px-4 py-2 bg-red-900/50 border border-red-700 rounded-lg">
            <p className="text-sm text-red-200">Error: {connectionError}</p>
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="lsptoy"
          defaultValue={SAMPLE_LSPTOY_CONTENT}
          theme="vs-dark"
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
          }}
        />
      </div>
    </div>
  );
};
