# Database design

```mermaid
erDiagram
    USERS ||--o{ APPOINTMENTS : creates
    PATIENTS ||--o{ APPOINTMENTS : has

    USERS {
      uuid id PK
      citext email UK
      text password_hash
      text role
      timestamptz created_at
    }
    PATIENTS {
      uuid id PK
      text full_name
      text cin UK
      text phone
      date birth_date
      text address
      timestamptz created_at
      timestamptz updated_at
      timestamptz deleted_at
    }
    APPOINTMENTS {
      uuid id PK
      uuid patient_id FK
      timestamptz appointment_date
      text status
      text reason
      text notes
      uuid created_by FK
      timestamptz created_at
      timestamptz updated_at
    }
```

One patient can have many appointments, while every appointment belongs to exactly one patient. One user can create many appointments, while every appointment has one creator. The supplied domain has no natural one-to-one or many-to-many relationship, so neither is invented.

Foreign keys use restrictive deletion to preserve clinical and audit history. Search indexes follow the API queries: normalized patient name/CIN, appointment date and status, and patient appointment history.
