# PorraElecciones

Porra privada para pronosticar el reparto de los 350 escaños del Congreso de los Diputados. Cada participante usa un código de un solo uso. Al cierre se publican los alias y sus porras. Cualquier visitante puede introducir un resultado hipotético y consultar la clasificación, ordenada por la suma de diferencias absolutas de escaños.

## Configuración

Sigue la [guía de Apps Script y Google Sheets](backend/README.md) para preparar la hoja privada, confirmar las candidaturas, fijar el cierre y generar los códigos de participación. El frontend recibe el plazo y las candidaturas desde la API.

Para el desarrollo local, instala las dependencias con `npm ci` y crea un archivo `.env.local` con la URL pública de tu implementación.

```dotenv
VITE_COMPETITION_API_URL=https://script.google.com/macros/s/ID_DE_IMPLEMENTACION/exec
```

Inicia Vite con `npm run dev` y abre la ruta `/PorraElecciones/`. Si falta la URL, el sitio muestra que la porra aún no está disponible.

## GitHub Pages

En **Settings → Pages → Build and deployment → Source**, selecciona **GitHub Actions**. En **Settings → Secrets and variables → Actions → Variables**, crea la variable de repositorio `VITE_COMPETITION_API_URL` con la URL que termina en `/exec`. Cuando los cambios estén en `main`, el flujo **Deploy to Pages** genera el sitio bajo `/PorraElecciones/`. También puedes ejecutarlo desde **Actions → Deploy to Pages → Run workflow**. Después de cambiar la variable, vuelve a ejecutar el flujo.

La URL de la API forma parte del sitio público. Mantén los códigos, sus hashes y los datos privados en los sistemas de la organización descritos en la guía.

## Comprobaciones

```sh
npm run lint
npm run format:check
npm test -- --run
npm run build
```

Basado en [Parliament Seats](https://github.com/disfordave/parliament-seats) de disfordave. Distribuido bajo la [licencia AGPL-3.0](LICENSE).
