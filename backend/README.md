# API de PorraElecciones

## Configurar la hoja y Apps Script

1. Crea una hoja de cálculo de Google. En **Compartir → Acceso general**, selecciona **Restringido**. Crea una pestaña `Predicciones`, aplica el formato **Texto sin formato** a las columnas A–E y escribe una cabecera por celda.

   | A1   | B1      | C1         | D1            | E1      |
   | ---- | ------- | ---------- | ------------- | ------- |
   | `id` | `alias` | `codeHash` | `submittedAt` | `seats` |

2. Abre **Extensiones → Apps Script** desde la hoja. Pega el contenido de [`Code.js`](Code.js) en `Código.gs` y confirma que esté habilitado el entorno de ejecución V8. `PARTIES` contiene las 14 candidaturas de la porra. Mantén los mismos identificadores y candidaturas una vez abierta la porra, porque serán la base de la clasificación.

3. En **Configuración del proyecto → Propiedades de la secuencia de comandos**, añade `PORRA_SHEET_ID` con el identificador de la hoja (el segmento entre `/d/` y `/edit` de su dirección) y `PORRA_DEADLINE` con la fecha de cierre en ISO 8601, incluyendo segundos y zona horaria. Por ejemplo, `2026-11-29T20:00:00+01:00` representa las 20:00 de Madrid ese día. Es un ejemplo, sustituye la fecha y hora por el cierre acordado. La publicación se activa automáticamente en ese instante, así que fija el plazo antes de abrir las inscripciones.

## Dar de alta a los participantes

La porra acepta códigos de cinco o seis caracteres hexadecimales (`0`–`9` y `a`–`f`). El siguiente comando genera códigos de seis caracteres. Ejecútalo una vez por participante con Node.js, en un entorno al que solo tenga acceso la organización.

```sh
node --input-type=module -e '
import { createHash, randomBytes, randomUUID } from "node:crypto";
const code = randomBytes(3).toString("hex");
const codeHash = createHash("sha256").update(code).digest("hex");
console.log(JSON.stringify({ id: randomUUID(), codeHash, code }, null, 2));
'
```

Antes de añadir la fila, comprueba que el `codeHash` no aparezca ya en la columna C. Si aparece, vuelve a ejecutar el comando. Introduce el `id`, el alias acordado con el participante y `codeHash` en las tres primeras columnas y deja `submittedAt` y `seats` vacías. Envía el `code` original a su participante por un canal privado y consérvalo fuera de la hoja, el repositorio y las URL. El alias y la distribución de escaños serán públicos desde el cierre. Durante el plazo de envío, conserva el orden de las filas existentes y deja que Apps Script escriba las dos últimas columnas.

Si ya repartiste códigos más largos para participantes que todavía no han enviado su porra, genera códigos nuevos, sustituye los hashes de esas filas y envía los nuevos códigos en privado.

## Publicar y verificar

1. En Apps Script, selecciona **Implementar → Nueva implementación → Aplicación web**. Configura el acceso como **Cualquier persona** y la ejecución como tu usuario. Autoriza el acceso a la hoja al desplegar. La aplicación web atiende peticiones públicas y la hoja sigue siendo privada. Después de cambiar el código, crea una versión nueva para la implementación existente.
2. Copia la URL de la implementación que termina en `/exec`. Desde una ventana privada, añade `?action=status` y comprueba que el resultado JSON incluye `phase`, `deadline`, `serverTime` y `parties`. Usa la URL base según el [README del proyecto](../README.md) para el desarrollo local y GitHub Pages.
3. Verifica la integración con una hoja y una implementación de prueba. Comprueba que una solicitud a `?action=predictions` antes del cierre devuelve `NOT_CLOSED`, que un código no guarda más de una predicción aunque se envíen dos solicitudes a la vez, y que al cierre aparecen las predicciones con sus alias. Comprueba también que los envíos con números negativos, decimales o un total distinto de 350 dejan el código disponible.
4. Prueba el envío desde el sitio de Pages. Apps Script redirige las respuestas de `ContentService`, por lo que el navegador tiene que poder leer la respuesta de la redirección. Si falla por CORS, la URL del frontend puede apuntar a un proxy que reenvíe GET y POST a `/exec`, siga las redirecciones y permita el origen de Pages. Mantén la validación de plazos y códigos en Apps Script y evita el almacenamiento en caché de las respuestas de la API.

[Aplicaciones web de Apps Script](https://developers.google.com/apps-script/guides/web) · [Redirecciones del servicio de contenido](https://developers.google.com/apps-script/guides/content#redirects)

## Contrato de la API

| Petición                                               | Respuesta correcta                                      |
| ------------------------------------------------------ | ------------------------------------------------------- |
| `GET ?action=status`                                   | `{ ok: true, phase, deadline, serverTime, parties }`    |
| `POST` con un cuerpo JSON y `Content-Type: text/plain` | `{ ok: true }`                                          |
| `GET ?action=predictions`                              | `{ ok: true, predictions }` desde el instante de cierre |

El cuerpo del `POST` es `{ code, seats }`. Tanto en la petición como en las predicciones publicadas, `seats` es un objeto que asigna un número entero de escaños a cada ID de `parties`, incluido el cero. El total debe ser 350. Cada predicción pública tiene `id`, `alias` y `seats`.

Las respuestas de error tienen la forma `{ ok: false, error }`. Los valores de `error` son `INVALID_REQUEST`, `INVALID_CODE`, `INVALID_SEATS`, `CODE_USED`, `CLOSED`, `NOT_CLOSED`, `BUSY` y `SERVER_ERROR`. Un reenvío tras un error de red recibirá `CODE_USED` si el intento anterior llegó a guardarse con ese código mientras la porra seguía abierta.
