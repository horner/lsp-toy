export function resolvePort(): number | null {
  const fromArgs = parsePortFromArgs(process.argv.slice(2));
  if (fromArgs !== null) {
    return fromArgs;
  }

  const envCandidates = [process.env.LSP_PORT, process.env.PORT];
  for (const candidate of envCandidates) {
    const parsed = parsePort(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function parsePortFromArgs(args: string[]): number | null {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const equalsMatch = arg.match(/^--(?:lsp-)?port=(.+)$/);
    if (equalsMatch) {
      const parsed = parsePort(equalsMatch[1]);
      if (parsed !== null) {
        return parsed;
      }
      continue;
    }

    if (arg === '--port' || arg === '--lsp-port') {
      const next = args[i + 1];
      const parsed = parsePort(next);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  return null;
}

function parsePort(value: string | undefined | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0 || parsed >= 65536) {
    return null;
  }

  return parsed;
}
