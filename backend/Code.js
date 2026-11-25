const SEAT_COUNT = 350;
const SHEET_NAME = "Predicciones";
const COLUMNS = ["id", "alias", "codeHash", "submittedAt", "seats"];

// Confirm the election roster before opening submissions. Keep IDs fixed once open.
const PARTIES = [
  {
    id: "es-psoe",
    name: "Partido Socialista Obrero Español",
    shortName: "PSOE",
    colour: "#EF1C27",
    position: -50,
  },
  {
    id: "es-pp",
    name: "Partido Popular",
    shortName: "PP",
    colour: "#1D84CE",
    position: 50,
  },
  {
    id: "es-vox",
    name: "VOX",
    shortName: "VOX",
    colour: "#63BE21",
    position: 100,
  },
  {
    id: "es-frente-amplio",
    name: "Frente Amplio",
    shortName: "Frente Amplio",
    colour: "#EF4B91",
    position: -75,
  },
  {
    id: "es-bildu",
    name: "Euskal Herria Bildu",
    shortName: "EH Bildu",
    colour: "#B5CF18",
    position: -75,
  },
  {
    id: "es-pnv",
    name: "Euzko Alderdi Jeltzalea-Partido Nacionalista Vasco",
    shortName: "PNV",
    colour: "#4AAE4A",
    position: 25,
  },
  {
    id: "es-erc",
    name: "Esquerra Republicana de Catalunya",
    shortName: "ERC",
    colour: "#FFB232",
    position: -50,
  },
  {
    id: "es-junts",
    name: "Junts per Catalunya",
    shortName: "Junts",
    colour: "#00C7AE",
    position: 50,
  },
  {
    id: "es-podemos",
    name: "Podemos",
    shortName: "Podemos",
    colour: "#5A205A",
    position: -75,
  },
  {
    id: "es-bng",
    name: "Bloque Nacionalista Galego",
    shortName: "BNG",
    colour: "#ADCFEF",
    position: -75,
  },
  {
    id: "es-cc",
    name: "Coalición Canaria",
    shortName: "CCA",
    colour: "#FFD700",
    position: 25,
  },
  {
    id: "es-upn",
    name: "Unión del Pueblo Navarro",
    shortName: "UPN",
    colour: "#00599B",
    position: 50,
  },
  {
    id: "es-adelante-andalucia",
    name: "Adelante Andalucía",
    shortName: "Adelante Andalucía",
    colour: "#087F5B",
    position: -75,
  },
  {
    id: "es-compromis",
    name: "Compromís: Front Valencia",
    shortName: "Compromís: Front Valencia",
    colour: "#EC8953",
    position: -50,
  },
  {
    id: "es-salf",
    name: "Se Acabó la Fiesta",
    shortName: "SALF",
    colour: "#475569",
    position: 100,
  },
];

function doGet(e) {
  return respond_(() => {
    const action = e?.parameter?.action;
    if (action !== "status" && action !== "predictions") {
      return failure_("INVALID_REQUEST");
    }

    const settings = readSettings_();
    const now = Date.now();
    const closed = now >= settings.deadline;

    if (action === "status") {
      return {
        ok: true,
        phase: closed ? "closed" : "open",
        deadline: new Date(settings.deadline).toISOString(),
        serverTime: new Date(now).toISOString(),
        parties: PARTIES,
      };
    }

    if (!closed) return failure_("NOT_CLOSED");

    // Wait for any submission accepted just before the cutoff to finish writing.
    return withLock_(() => {
      const sheet = openSheet_(settings.sheetId);
      const predictions = readRows_(sheet)
        .filter(([, , , submittedAt]) => submittedAt !== "")
        .map(([id, alias, , , rawSeats]) => {
          const seats = JSON.parse(rawSeats);
          if (!id || !alias || !areSeatsValid_(seats)) {
            throw new Error("Invalid prediction row");
          }
          return { id: String(id), alias: String(alias), seats };
        });

      return { ok: true, predictions };
    });
  });
}

function doPost(e) {
  return respond_(() => {
    const body = e?.postData?.contents;
    if (typeof body !== "string" || body.length > 8192) {
      return failure_("INVALID_REQUEST");
    }

    let submission;
    try {
      submission = JSON.parse(body);
    } catch {
      return failure_("INVALID_REQUEST");
    }

    const code =
      typeof submission?.code === "string"
        ? submission.code.trim().toLowerCase()
        : "";
    if (!/^[a-f0-9]{5,6}$/.test(code)) return failure_("INVALID_CODE");
    if (!areSeatsValid_(submission.seats)) return failure_("INVALID_SEATS");

    const settings = readSettings_();
    const codeHash = hashCode_(code);

    return withLock_(() => {
      if (Date.now() >= settings.deadline) return failure_("CLOSED");

      const sheet = openSheet_(settings.sheetId);
      const rows = readRows_(sheet);
      const index = rows.findIndex((row) => row[2] === codeHash);
      if (index === -1) return failure_("INVALID_CODE");
      if (
        rows.some((row, rowIndex) => rowIndex !== index && row[2] === codeHash)
      ) {
        throw new Error("Duplicate code hash");
      }
      const [id, alias, , submittedAt, rawSeats] = rows[index];
      if (!id || !alias) throw new Error("Invalid participant row");
      if (submittedAt !== "" || rawSeats !== "") return failure_("CODE_USED");

      const now = Date.now();
      if (now >= settings.deadline) return failure_("CLOSED");

      // Updating both cells in one write makes the prediction its own usage record.
      sheet
        .getRange(index + 2, 4, 1, 2)
        .setValues([
          [new Date(now).toISOString(), JSON.stringify(submission.seats)],
        ]);
      SpreadsheetApp.flush();
      return { ok: true };
    });
  });
}

function readSettings_() {
  const properties = PropertiesService.getScriptProperties();
  const sheetId = properties.getProperty("PORRA_SHEET_ID");
  const deadlineText = properties.getProperty("PORRA_DEADLINE");
  const deadline = Date.parse(deadlineText);
  const zonedDateTime =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

  if (
    !sheetId ||
    !zonedDateTime.test(deadlineText) ||
    !Number.isFinite(deadline)
  ) {
    throw new Error("Invalid competition configuration");
  }

  return { sheetId, deadline };
}

function openSheet_(sheetId) {
  const sheet = SpreadsheetApp.openById(sheetId).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Missing prediction sheet");

  const [header] = sheet.getRange(1, 1, 1, COLUMNS.length).getValues();
  if (!COLUMNS.every((column, index) => column === header[index])) {
    throw new Error("Invalid prediction sheet header");
  }
  return sheet;
}

function readRows_(sheet) {
  const length = sheet.getLastRow() - 1;
  return length > 0
    ? sheet.getRange(2, 1, length, COLUMNS.length).getValues()
    : [];
}

function areSeatsValid_(seats) {
  if (
    !seats ||
    typeof seats !== "object" ||
    Array.isArray(seats) ||
    Object.keys(seats).length !== PARTIES.length
  ) {
    return false;
  }

  let total = 0;
  for (const { id } of PARTIES) {
    const count = seats[id];
    if (
      !Object.prototype.hasOwnProperty.call(seats, id) ||
      !Number.isInteger(count) ||
      count < 0 ||
      count > SEAT_COUNT
    ) {
      return false;
    }
    total += count;
  }
  return total === SEAT_COUNT;
}

function hashCode_(code) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    code,
    Utilities.Charset.UTF_8,
  )
    .map((byte) => (byte & 255).toString(16).padStart(2, "0"))
    .join("");
}

function withLock_(operation) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return failure_("BUSY");

  try {
    return operation();
  } finally {
    lock.releaseLock();
  }
}

function failure_(error) {
  return { ok: false, error };
}

function respond_(operation) {
  let result;
  try {
    result = operation();
  } catch {
    result = failure_("SERVER_ERROR");
  }

  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
