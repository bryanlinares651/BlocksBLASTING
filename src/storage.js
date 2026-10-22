// El acceso al objeto localStorage tambien puede lanzar SecurityError.
// Las preferencias siguen vivas en su consumidor aunque el navegador no guarde.
export function leer(clave) {
  try { return globalThis.localStorage?.getItem(clave) ?? null; }
  catch { return null; }
}

export function escribir(clave, valor) {
  try {
    if (!globalThis.localStorage) return false;
    globalThis.localStorage.setItem(clave, valor);
    return true;
  } catch { return false; }
}
