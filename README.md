# Gladiatus Licence Server na Railway

## Konfiguracja
1. Sklonuj repozytorium.
2. `npm install`
3. Zmień nazwę `.env.example` na `.env` i uzupełnij zmienne.
4. Wykonaj migracje SQL w katalogu `migrations/`:  
   `psql $DATABASE_URL -f migrations/create_licences_table.sql`.

## Uruchomienie lokalne
```bash
npm start
```

## Deployment na Railway
1. Zaloguj się do Railway i utwórz nowy projekt Node.js.
2. Dodaj plugin PostgreSQL, skopiuj `DATABASE_URL` do zmiennych środowiskowych.
3. W ustawieniach dodaj też `RAILWAY_URL` z adresem deploya.
4. Podłącz repozytorium, uruchom deploy.

## Użycie
- **Sprawdzenie licencji**: GET `/check-licence?userId=XYZ`
- **Tworzenie/aktualizacja licencji**: POST `/licence` z body `{ userId, type, days }`

## Cron
Codziennie o północy odejmuje 1 dzień od licencji typu `timed`.
