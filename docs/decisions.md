# Product and engineering decisions

## Product identity

ClinicFlow is a calm, fast workspace for a busy clinic receptionist. The primary journey is: find a patient, inspect their details, book an appointment, confirm it, and immediately see the updated schedule.

## Assessment interpretations

- The assessment requires PERN, so PostgreSQL is used even though the job advertisement describes MERN.
- The user interface is French. Code and technical documentation are English.
- Clinic dates and times use `Africa/Casablanca`.
- Confirmed appointments for the same patient must start at least 30 minutes apart. Exactly 30 minutes is allowed.
- Pending and cancelled appointments do not reserve a time window.
- Different patients may have appointments at the same time because doctors, rooms, and clinic-wide capacity are outside the supplied domain.
- Dashboard `appointments today` uses the clinic's local calendar day. Pending and confirmed totals cover all active appointments.

## Data lifecycle

Patients are archived with `deleted_at`, rather than physically deleted. Their history and CIN remain preserved. A patient with a future pending or confirmed appointment cannot be archived until those appointments are cancelled. Users and appointments are never cascade-deleted.

## Security

The JWT is stored in an HttpOnly cookie. Production cookies use `Secure`; all state-changing requests require a matching CSRF header and cookie. Authorization is always enforced by the API. Logs exclude passwords, tokens, CIN values, notes, and request bodies.

The admin activity feed reads the append-only audit log and never records patient contact details, identifiers, notes, or appointment reasons. Patient updates store only the names of changed fields; appointment events store operational status and scheduling metadata.
