// Every failure is one of two kinds (ТЗ, section 4):
//   temporary — try again later (timeout, 5xx/429 from core-api, database down);
//   permanent — trying again cannot help (QR does not parse, 4xx from core-api).
class TemporaryError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.temporary = true;
  }
}

class PermanentError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.temporary = false;
  }
}

// Anything unexpected (a dropped connection, a pg error) is treated as temporary: a retry is cheap,
// losing a receipt is not.
function classify(err) {
  if (err instanceof TemporaryError || err instanceof PermanentError) return err;
  return new TemporaryError("internal", err.message);
}

module.exports = { TemporaryError, PermanentError, classify };
