// Hook de resolución para las pruebas: si un import sin extensión no se encuentra, prueba con ".js".
// Cubre los imports relativos de lib/ (`./session`) y los de Next 14 (`next/headers`, `next/server`),
// que no declaran "exports" compatibles con ESM.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' && !/\.[cm]?js$/.test(specifier)) {
      return nextResolve(specifier + '.js', context);
    }
    throw err;
  }
}
