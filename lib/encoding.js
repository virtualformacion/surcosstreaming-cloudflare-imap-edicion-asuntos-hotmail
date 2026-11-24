export function jsonResponse(body, status=200) {
  return Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
}
export function decode64(value) {
  // Gmail uses Base64URL (- and _), often without = padding. GitHub uses Base64.
  let normalized = String(value).replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  normalized += '='.repeat((4 - normalized.length % 4) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(normalized), c => c.charCodeAt(0)));
}
export function encode64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary=''; for (const byte of bytes) binary+=String.fromCharCode(byte);
  return btoa(binary);
}
