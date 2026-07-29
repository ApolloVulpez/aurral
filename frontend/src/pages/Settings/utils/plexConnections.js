function normalizePort(value) {
  const port = Number.parseInt(value, 10);
  return Number.isFinite(port) && port > 0 ? String(port) : "";
}

function normalizeHost(value) {
  const host = String(value || "").trim();
  if (!host) return "";
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}

function isLocalConnection(connection) {
  return connection?.local === true || connection?.local === 1 || connection?.local === "1";
}

export function resolvePlexConnectionUrl(connection) {
  const uri = String(connection?.uri || "").trim();
  const host = normalizeHost(connection?.address);
  const port = normalizePort(connection?.port);

  if (isLocalConnection(connection) && host && port) {
    return `http://${host}:${port}`;
  }

  return uri;
}

export function pickBestPlexConnection(server) {
  const connections = Array.isArray(server?.connections) ? server.connections : [];
  return (
    connections.find((connection) => isLocalConnection(connection) && resolvePlexConnectionUrl(connection)) ||
    connections.find((connection) => resolvePlexConnectionUrl(connection)) ||
    null
  );
}
