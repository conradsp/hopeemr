# Local Development Setup for Medplum EMR

## Quick Start Guide

### Step 1: Start the Medplum Server

In one terminal window, start the main Medplum server from the repository root:

```bash
# From /medplum directory

# Install dependencies (first time only)
npm ci

# Build the packages
npm run build:fast

# Start the API server
cd packages/server
npm run dev
```

This starts the **API Server** on http://localhost:8103

Wait until you see:
```
Server started
http://localhost:8103/
```

### Step 2: Install EMR Dependencies

In a **new terminal window**:

```bash
cd examples/emr
npm install
```

### Step 3: Verify Configuration

The `.env` file should already be configured for local development:

```bash
cat .env
```

Should show:
```
MEDPLUM_BASE_URL=http://localhost:8103
```

### Step 4: Start the EMR Application

```bash
npm run dev
```

The EMR will start on **http://localhost:3000**

### Step 5: Create Account & Add Test Data

1. **Register a new account**:
   - Open http://localhost:3000 (or the port shown in terminal)
   - Click "Register" or "Sign in"
   - Create a new local account
   - Create a project when prompted

2. **Add sample patients** (optional):
   
   **Option A**: Create patients manually via API/scripts
   - Use the Medplum CLI or direct API calls to create test patients
   - See Medplum documentation for creating resources
   
   **Option B**: Upload sample data
   ```bash
   npm run build:bots
   ```
   
   **Option C**: Use curl to create a test patient
   ```bash
   curl -X POST http://localhost:8103/fhir/R4/Patient \
     -H "Content-Type: application/fhir+json" \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -d '{
       "resourceType": "Patient",
       "name": [{"family": "Doe", "given": ["John"]}],
       "gender": "male",
       "birthDate": "1990-01-01"
     }'
   ```

### Step 6: Test the EMR

1. In the EMR (should be on a different port than Medplum App)
2. Use the search bar to find your patient
3. Click on the patient to view their chart
4. Explore the sections:
   - Demographics
   - Timeline
   - Vitals
   - Encounters
   - Clinical Notes

## Port Configuration

By default:
- **Medplum API**: Port 8103
- **EMR App**: Port 3000

If you need to change the EMR port, edit `vite.config.ts`:

```typescript
server: {
  host: 'localhost',
  port: 3001, // Change this
}
```

## Troubleshooting

### "Failed to fetch" or connection errors
- Make sure the Medplum server is running on port 8103
- Check that `.env` has `MEDPLUM_BASE_URL=http://localhost:8103`

### Port already in use
- The EMR will automatically use the next available port (3001, 3002, etc.)
- Check the terminal output for the actual URL

### Can't find patients
- Make sure you've created patients in your local Medplum instance
- Try refreshing the page after creating patients

### Authentication issues
- Make sure you're using the same Medplum server (check the URL)
- Try clearing browser cache/cookies
- Make sure you registered on the local server, not the hosted one

## Creating Test Data

### Using Medplum CLI (Recommended)

```bash
# Install Medplum CLI globally
npm install -g @medplum/cli

# Login to your local server
medplum login http://localhost:8103

# Create a test patient
medplum post Patient '{
  "resourceType": "Patient",
  "name": [{"family": "Doe", "given": ["John"]}],
  "gender": "male",
  "birthDate": "1990-01-01"
}'
```

### Using curl

```bash
# First, get an access token by signing in through the EMR
# Then use it to create resources

curl -X POST http://localhost:8103/fhir/R4/Patient \
  -H "Content-Type: application/fhir+json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "resourceType": "Patient",
    "name": [{"family": "Smith", "given": ["Jane"]}],
    "gender": "female",
    "birthDate": "1985-05-15"
  }'
```

### Creating an Encounter

```bash
medplum post Encounter '{
  "resourceType": "Encounter",
  "status": "finished",
  "class": {
    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
    "code": "AMB",
    "display": "ambulatory"
  },
  "subject": {"reference": "Patient/YOUR_PATIENT_ID"},
  "period": {
    "start": "2024-01-15T10:00:00Z",
    "end": "2024-01-15T11:00:00Z"
  }
}'
```

### Creating Observations (Vitals)

```bash
# Weight
medplum post Observation '{
  "resourceType": "Observation",
  "status": "final",
  "category": [{
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/observation-category",
      "code": "vital-signs"
    }]
  }],
  "code": {
    "coding": [{
      "system": "http://loinc.org",
      "code": "29463-7",
      "display": "Body Weight"
    }]
  },
  "subject": {"reference": "Patient/YOUR_PATIENT_ID"},
  "effectiveDateTime": "2024-01-15T10:00:00Z",
  "valueQuantity": {
    "value": 70,
    "unit": "kg",
    "system": "http://unitsofmeasure.org",
    "code": "kg"
  }
}'
```

## Useful Commands

```bash
# Start EMR dev server
npm run dev

# Run linter
npm run lint

# Run tests
npm test

# Build for production
npm run build

# Upload sample data
npm run build:bots
```

## Multiple Terminal Setup

For best experience, use 3 terminal windows:

**Terminal 1**: Medplum Server
```bash
# From /medplum root
npm ci                    # First time only
npm run build:fast
cd packages/server
npm run dev
```

**Terminal 2**: EMR Dev Server
```bash
cd examples/emr
npm install              # First time only
npm run dev
```

**Terminal 3**: Commands (testing, linting, etc.)
```bash
cd examples/emr
npm run lint
```

