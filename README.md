# Medplum EMR Charting System

A complete Electronic Medical Record (EMR) charting system built with Medplum and React, featuring patient history, encounters, vital signs, and clinical notes.

## Features

### Patient Charting
- **Demographics**: View patient basic information including name, age, gender, and birth date
- **Timeline**: Complete patient timeline with all related resources (Encounters, Observations, Medications, etc.)
- **Vitals**: View and filter observations including weight, height, blood pressure, and BMI
- **Encounters**: List and view detailed encounter information
- **Clinical Notes**: Display clinical impressions and notes

### Key Components

#### Patient Demographics (`PatientDemographics.tsx`)
Displays patient basic information in a clean card layout with resource table for detailed FHIR data.

#### Patient Timeline (`PatientTimeline.tsx`)
Complete timeline visualization of all patient-related resources including:
- Communication records
- Device requests
- Diagnostic reports
- Service requests
- Tasks
- Media attachments

#### Patient Observations (`PatientObservations.tsx`)
Display and filter patient observations with:
- All observations view
- Filtered views for Height, Weight, Blood Pressure, and BMI
- Search functionality for finding specific observations

#### Patient Encounters (`PatientEncounters.tsx`)
List all patient encounters with:
- Date sorting (most recent first)
- Click to view details
- Encounter type and status

#### Clinical Impressions (`ClinicalImpressionDisplay.tsx`)
Display all clinical notes and impressions associated with the patient.

## Getting Started

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0
- Local Medplum server running (or Medplum account)

### Running with Local Medplum Server

1. **Start the Medplum server** (in the repository root):
```bash
# In a separate terminal window, from the /medplum directory

# Install dependencies (first time only)
npm ci

# Build the packages
npm run build:fast

# Start the server
cd packages/server
npm run dev
```

This will start the Medplum API server on `http://localhost:8103`

2. **Install EMR dependencies** (in the `examples/emr` directory):
```bash
cd examples/emr
npm install
```

3. **Configure for local server** (already done):
The `.env` file is already configured to use `http://localhost:8103`

4. **Start the EMR development server**:
```bash
npm run dev
```

The EMR will start on `http://localhost:3000` (or the next available port if 3000 is taken)

5. **Create a local account**:
- Open the EMR at http://localhost:3000
- Click "Register" to create a local Medplum account
- Sign in with your new credentials

### Running with Hosted Medplum Server

If you prefer to use the hosted Medplum server:

1. Edit the `.env` file:
```bash
# Comment out the local config and uncomment the hosted config:
# MEDPLUM_BASE_URL=http://localhost:8103

MEDPLUM_BASE_URL=https://api.medplum.com
GOOGLE_CLIENT_ID="921088377005-3j1sa10vr6hj86jgmdfh2l53v3mp7lfi.apps.googleusercontent.com"
```

2. Create an account at https://app.medplum.com/register

3. Start the dev server:
```bash
npm run dev
```

### Deploying Sample Data

To populate your Medplum project with sample patient data, questionnaires, and bots:

```bash
npm run build:bots
```

This will upload:
- Encounter types value sets
- Encounter note questionnaires
- Example bots for encounter processing
- Sample patient data

## Architecture

### Component Structure
```
src/
├── components/
│   ├── Header.tsx                    # Main navigation and patient search
│   ├── PatientSidebar.tsx            # Patient info and navigation menu
│   ├── PatientTopMenu.tsx            # Top-level menu tabs
│   ├── PatientMainSection.tsx        # Main content area router
│   ├── PatientDemographics.tsx       # Patient basic information
│   ├── PatientTimeline.tsx           # Complete patient timeline
│   ├── PatientObservations.tsx       # Vitals and observations
│   ├── PatientEncounters.tsx         # Encounter listing
│   ├── ClinicalImpressionDisplay.tsx # Clinical notes
│   └── EncounterPage.tsx             # Individual encounter view
├── EMRApp.tsx                        # Main application with routing
└── main.tsx                          # Application entry point
```

### Key FHIR Resources Used

- **Patient**: Patient demographic information
- **Encounter**: Medical visits and encounters
- **Observation**: Vital signs and clinical measurements
- **ClinicalImpression**: Clinical notes and assessments
- **Condition**: Diagnoses and medical conditions
- **MedicationRequest**: Prescriptions and medication orders
- **DiagnosticReport**: Lab results and diagnostic reports

### Code Systems

The application uses standard healthcare code systems:

- **LOINC**: For clinical observations and vital signs
- **SNOMED CT**: For medical concepts
- **ICD-10**: For diagnosis codes
- **CPT**: For procedure and encounter codes

## Usage

### Searching for Patients
Use the search bar in the header to find patients by name. The search supports both first and last names.

### Viewing Patient Information
Once a patient is selected, use the sidebar navigation to access different sections:
- **Demographics**: Basic patient information
- **Timeline**: Complete patient history timeline
- **Vitals**: Vital signs and measurements
- **Encounters**: Visit and encounter history
- **Clinical Notes**: Provider notes and assessments

### Viewing Encounter Details
Click on any encounter in the Encounters view to see detailed information including:
- Encounter type and class
- Date and time
- Status
- Associated resources

## Documentation

This EMR implementation follows the [Medplum Charting Documentation](https://www.medplum.com/docs/charting) and demonstrates best practices for building healthcare charting applications.

For more information, see:
- [Medplum Documentation](https://www.medplum.com/docs)
- [FHIR Resources](https://www.medplum.com/docs/api/fhir)
- [React Components](https://www.medplum.com/docs/react)

## Development

### Running Tests
```bash
npm test
```

### Building for Production
```bash
npm run build
```

### Linting
```bash
npm run lint
```

## License

Copyright © 2025 Orangebot, Inc.
