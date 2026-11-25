import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const script = readFileSync(new URL("./Code.js", import.meta.url), "utf8");
const deadline = "2026-11-29T19:00:00.000Z";
const deadlineTime = Date.parse(deadline);
const code = "0abcde";

function createBackend(issuedCode = code) {
  const digest = (value) => createHash("sha256").update(value).digest();
  const rows = [
    ["id", "alias", "codeHash", "submittedAt", "seats"],
    ["participant-1", "Alias", digest(issuedCode).toString("hex"), "", ""],
  ];
  const properties = {
    PORRA_SHEET_ID: "private-sheet",
    PORRA_DEADLINE: "2026-11-29T20:00:00+01:00",
  };
  let now = deadlineTime - 1;
  let lockAvailable = true;
  let lockHeld = false;
  let writePending = false;
  let writeCount = 0;

  class ScriptDate extends Date {
    static now() {
      return now;
    }
  }

  const sheet = {
    getLastRow: () => rows.length,
    getRange(firstRow, firstColumn, rowCount, columnCount) {
      expect(lockHeld).toBe(true);
      return {
        getValues() {
          return rows
            .slice(firstRow - 1, firstRow - 1 + rowCount)
            .map((row) =>
              row.slice(firstColumn - 1, firstColumn - 1 + columnCount),
            );
        },
        setValues([values]) {
          expect([firstRow, firstColumn, rowCount, columnCount]).toEqual([
            2, 4, 1, 2,
          ]);
          rows[firstRow - 1].splice(firstColumn - 1, columnCount, ...values);
          writePending = true;
          writeCount += 1;
        },
      };
    },
  };

  const context = {
    Date: ScriptDate,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => properties[key] ?? null,
      }),
    },
    LockService: {
      getScriptLock: () => ({
        tryLock() {
          if (!lockAvailable || lockHeld) return false;
          lockHeld = true;
          return true;
        },
        releaseLock() {
          expect(writePending).toBe(false);
          lockHeld = false;
        },
      }),
    },
    SpreadsheetApp: {
      openById(id) {
        expect(id).toBe(properties.PORRA_SHEET_ID);
        return {
          getSheetByName: (name) => (name === "Predicciones" ? sheet : null),
        };
      },
      flush() {
        expect(lockHeld).toBe(true);
        expect(writePending).toBe(true);
        writePending = false;
      },
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: "SHA_256" },
      Charset: { UTF_8: "UTF_8" },
      computeDigest: (_algorithm, value) => [...new Int8Array(digest(value))],
    },
    ContentService: {
      MimeType: { JSON: "JSON" },
      createTextOutput: (body) => ({ setMimeType: () => JSON.parse(body) }),
    },
  };
  runInNewContext(script, context);

  const get = (action) => context.doGet({ parameter: { action } });
  const parties = get("status").parties;
  const seats = Object.fromEntries(
    parties.map(({ id }) => [id, id === "es-pp" ? 350 : 0]),
  );
  return {
    get,
    seats,
    writeCount: () => writeCount,
    setTime: (time) => (now = time),
    setLockAvailable: (available) => (lockAvailable = available),
    submit: (value = issuedCode, seatCounts = seats) =>
      context.doPost({
        postData: {
          contents: JSON.stringify({ code: value, seats: seatCounts }),
        },
      }),
  };
}

describe("Apps Script competition API", () => {
  it("accepts a five-character code with a leading zero", () => {
    const backend = createBackend("0abcd");
    expect(backend.submit("0ABCD")).toEqual({ ok: true });
  });

  it("accepts a code only once and only publishes its prediction from the exact cutoff", () => {
    const backend = createBackend();
    expect(backend.get("status")).toMatchObject({
      ok: true,
      phase: "open",
      deadline,
    });
    expect(backend.submit(` ${code.toUpperCase()} `)).toEqual({ ok: true });
    expect(backend.submit()).toEqual({ ok: false, error: "CODE_USED" });
    expect(backend.writeCount()).toBe(1);
    expect(backend.get("predictions")).toEqual({
      ok: false,
      error: "NOT_CLOSED",
    });

    backend.setTime(deadlineTime);
    expect(backend.get("status")).toMatchObject({
      ok: true,
      phase: "closed",
      deadline,
      serverTime: deadline,
    });
    expect(backend.submit()).toEqual({ ok: false, error: "CLOSED" });
    expect(backend.get("predictions")).toEqual({
      ok: true,
      predictions: [
        { id: "participant-1", alias: "Alias", seats: backend.seats },
      ],
    });
  });

  it("rejects unknown codes and invalid distributions without consuming the issued code", () => {
    const backend = createBackend();
    expect(backend.submit("abcdef")).toEqual({
      ok: false,
      error: "INVALID_CODE",
    });
    for (const invalidCode of ["ab12", "abcdef0", "abcdeg"]) {
      expect(createBackend(invalidCode).submit()).toEqual({
        ok: false,
        error: "INVALID_CODE",
      });
    }

    const { "es-pp": pp, ...otherSeats } = backend.seats;
    const invalidDistributions = [
      { ...otherSeats, missingParty: pp },
      { ...backend.seats, "es-pp": pp - 1 },
      { ...backend.seats, "es-pp": pp - 0.5, "es-psoe": 0.5 },
      { ...backend.seats, "es-psoe": -1, "es-vox": 1 },
      { ...backend.seats, "es-pp": String(pp) },
    ];
    for (const seats of invalidDistributions) {
      expect(backend.submit(code, seats)).toEqual({
        ok: false,
        error: "INVALID_SEATS",
      });
    }
    expect(backend.writeCount()).toBe(0);
    expect(backend.submit()).toEqual({ ok: true });
  });

  it("leaves the row available after lock contention and gates published reads on the same lock", () => {
    const backend = createBackend();
    backend.setLockAvailable(false);
    expect(backend.submit()).toEqual({ ok: false, error: "BUSY" });
    expect(backend.writeCount()).toBe(0);
    backend.setLockAvailable(true);
    expect(backend.submit()).toEqual({ ok: true });

    backend.setTime(deadlineTime);
    backend.setLockAvailable(false);
    expect(backend.get("predictions")).toEqual({ ok: false, error: "BUSY" });
  });
});
