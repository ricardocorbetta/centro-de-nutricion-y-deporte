// Permite que las pruebas importen los módulos de lib/ tal como los escribe Next (sin extensión:
// `import ... from './session'`). Se carga con `node --import ./tests/registrar.mjs`.
import { register } from 'node:module';

register('./resolver.mjs', import.meta.url);
