# logging-middleware

Service ini dipakai sebagai **log collector**. Backend (misalnya .NET) mengirim data request/response ke endpoint log.

## Run Full Docker (tanpa install Node di VPS)

Jalankan semua service (app + loki + promtail + grafana):

```bash
docker compose up -d --build
```

Akses service:
- App logger: `http://localhost:4000`
- Loki: `http://localhost:3100`
- Grafana: `http://localhost:3001`

Stop semua service:

```bash
docker compose down
```

Kalau ingin Promtail membaca ulang semua isi `logs/api.log` dari awal, hapus state posisi lalu jalankan ulang:

```bash
docker compose down -v
docker compose up -d --build
```

Ini penting kalau log lama sudah pernah terbaca oleh Promtail, karena Loki hanya menampilkan data yang sudah diingest.

## Run

```bash
npm install
npm run dev
```

Service jalan di:
- `http://localhost:4000`

Server → menulis log
Promtail → mengirim log
Loki → menyimpan log
Grafana → menampilkan log

Health check:
- `GET /health`

## Endpoint Log

Gunakan endpoint utama:
- `POST /api/log`

Alias yang juga tersedia:
- `POST /log`

## Contoh Payload

Kirim payload seperti ini ke `/api/log`:

```json
{
  "phase": "response",
  "correlationId": "guid-unik",
  "service": "my-dotnet-api",
  "method": "POST",
  "clientRoute": "/api/login",
  "clientQuery": "?source=mobile",
  "backendUrlHit": "https://devportal.indolife.co.id/api/login",
  "requestHeaders": { "x-request-id": "..." },
  "requestBody": { "username": "u" },
  "statusCode": 200,
  "responseHeaders": { "content-type": "application/json" },
  "responseBody": { "token": "***" },
  "durationMs": 123,
  "timestamp": "2026-03-06T08:00:00Z"
}
```

## Contoh Request (curl)

```bash
curl -X POST "http://localhost:4000/api/log" \
  -H "Content-Type: application/json" \
  -d '{
    "phase": "response",
    "correlationId": "guid-unik",
    "service": "my-dotnet-api",
    "method": "POST",
    "clientRoute": "/api/login",
    "clientQuery": "?source=mobile",
    "backendUrlHit": "https://devportal.indolife.co.id/api/login",
    "requestHeaders": { "x-request-id": "..." },
    "requestBody": { "username": "u" },
    "statusCode": 200,
    "responseHeaders": { "content-type": "application/json" },
    "responseBody": { "token": "***" },
    "durationMs": 123,
    "timestamp": "2026-03-06T08:00:00Z"
  }'
```

## Output Log

Semua payload ditulis ke file:
- `logs/api.log`

Format per baris adalah JSON (newline-delimited JSON).

## Catatan

- `correlationId` dipakai untuk menghubungkan log request/response dalam satu alur transaksi.
- Hindari kirim data sensitif mentah (misalnya password/token asli) ke log.
