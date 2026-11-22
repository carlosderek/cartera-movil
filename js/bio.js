// bio.js — Desbloqueo con huella (o el bloqueo de pantalla del móvil) mediante una llave de acceso.
//
// La llave de acceso, con la extensión PRF de WebAuthn, entrega 32 bytes secretos que solo salen
// tras verificarte con la huella. Con ellos (AES-GCM) se cifra la contraseña de la cartera y en el
// móvil solo queda la versión cifrada. Sin tu huella no se puede descifrar.
// Requiere un navegador y un gestor de llaves que admitan PRF (Chrome en Android con el gestor de
// contraseñas de Google lo admite). Si no, enable() lo dice y no cambia nada.

const b64 = (buf) => { const u = new Uint8Array(buf); let s = ''; for (const x of u) s += String.fromCharCode(x); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const rnd = (n) => crypto.getRandomValues(new Uint8Array(n));

export function supported() {
  return !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create && window.isSecureContext);
}

async function prfKey(credId, salt) {
  const a = await navigator.credentials.get({
    publicKey: {
      challenge: rnd(32),
      allowCredentials: [{ type: 'public-key', id: credId }],
      userVerification: 'required',
      timeout: 60000,
      extensions: { prf: { eval: { first: salt } } },
    },
  });
  const r = a && a.getClientExtensionResults && a.getClientExtensionResults();
  const out = r && r.prf && r.prf.results && r.prf.results.first;
  if (!out) throw new Error('noprf');
  return crypto.subtle.importKey('raw', out, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function explain(e) {
  if (e && e.message === 'noprf') return 'Este móvil o su gestor de llaves de acceso no permite guardar la contraseña con la huella.';
  if (e && e.name === 'NotAllowedError') return 'Cancelado o sin verificar la huella.';
  if (e && e.name === 'InvalidStateError') return 'Ya hay una llave de acceso para esta app en este móvil.';
  return 'No se pudo usar la huella' + (e && e.message ? ': ' + e.message : '.');
}

// Crea la llave de acceso y guarda la contraseña cifrada. Devuelve { id, salt, iv, ct }.
export async function enable(pass) {
  if (!supported()) throw new Error('Este navegador no permite llaves de acceso.');
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: rnd(32),
        rp: { name: 'Cartera' },
        user: { id: rnd(16), name: 'cartera', displayName: 'Cartera (desbloqueo)' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
        timeout: 60000,
        extensions: { prf: {} },
      },
    });
    const ext = cred.getClientExtensionResults ? cred.getClientExtensionResults() : {};
    if (!ext.prf || ext.prf.enabled === false) throw new Error('noprf');
    const salt = rnd(32), iv = rnd(12);
    const key = await prfKey(cred.rawId, salt);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(pass));
    return { id: b64(cred.rawId), salt: b64(salt), iv: b64(iv), ct: b64(ct), at: new Date().toISOString() };
  } catch (e) { throw new Error(explain(e)); }
}

// Pide la huella y devuelve la contraseña descifrada.
export async function unlock(bio) {
  try {
    const key = await prfKey(unb64(bio.id), unb64(bio.salt));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(bio.iv) }, key, unb64(bio.ct));
    return new TextDecoder().decode(pt);
  } catch (e) { throw new Error(explain(e)); }
}

// Vuelve a cifrar con la misma llave una contraseña nueva (si cambió en el escritorio).
export async function rewrap(bio, pass) {
  try {
    const key = await prfKey(unb64(bio.id), unb64(bio.salt));
    const iv = rnd(12);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(pass));
    return { ...bio, iv: b64(iv), ct: b64(ct), at: new Date().toISOString() };
  } catch (e) { throw new Error(explain(e)); }
}
