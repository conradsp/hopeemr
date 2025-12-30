# Clinical Notes System

## Overview

This EMR application now includes a comprehensive clinical notes system built on FHIR standards, specifically using Medplum's Questionnaire and QuestionnaireResponse resources.

## Architecture

### Backend Storage

The system uses FHIR-compliant resources for storing templates and notes:

1. **Questionnaire** - Clinical note templates
   - Defines the structure of clinical notes (fields, types, requirements)
   - Stored with unique identifiers in the system
   - Can be managed by administrators

2. **QuestionnaireResponse** - Completed clinical notes
   - Stores the actual note data filled out by clinicians
   - Linked to specific encounters and patients
   - Maintains authorship and timestamp information

3. **DocumentReference** - Clinical note documents
   - Provides an additional layer for note retrieval
   - Contains the formatted note content
   - Linked to encounters for easy access

### Frontend Components

#### Admin Components

**`NoteTemplatesPage`** (`/admin/note-templates`)
- Lists all available note templates
- Allows creation, editing, and deletion of templates
- Includes an "Initialize Defaults" button to load standard templates
- Accessible via the Admin menu

**`EditNoteTemplateModal`**
- Form for creating/editing note templates
- Define template name, description, status
- Add/remove fields dynamically
- Support for various field types (text, boolean, date, etc.)

#### Clinical Components

**`CreateNoteModal`**
- Modal for creating clinical notes during encounters
- Template selection dropdown
- Uses Medplum's `QuestionnaireForm` component for rendering
- Automatically saves as QuestionnaireResponse and DocumentReference

### Default Note Templates

The system includes 6 industry-standard clinical note templates:

1. **SOAP Note**
   - Subjective
   - Objective
   - Assessment
   - Plan

2. **History & Physical**
   - Chief Complaint
   - History of Present Illness
   - Past Medical History
   - Current Medications
   - Allergies
   - Social History
   - Family History
   - Review of Systems
   - Physical Examination
   - Assessment
   - Plan

3. **Progress Note**
   - Interval History
   - Physical Exam
   - Labs/Results
   - Assessment & Plan

4. **Consultation Note**
   - Reason for Consultation
   - History of Present Illness
   - Review of Records
   - Physical Examination
   - Impression
   - Recommendations

5. **Procedure Note**
   - Procedure Name
   - Indication
   - Consent Obtained (Yes/No)
   - Anesthesia
   - Procedure Description
   - Findings
   - Complications
   - Specimens Sent
   - Post-Procedure Plan

6. **Discharge Summary**
   - Admission Date
   - Discharge Date
   - Admission Diagnosis
   - Discharge Diagnosis
   - Hospital Course
   - Procedures Performed
   - Discharge Medications
   - Discharge Instructions
   - Follow-up Plans

## Usage

### For Administrators

1. Navigate to Admin menu → Note Templates
2. Click "Initialize Default Templates" to load the standard library (first time only)
3. Create custom templates as needed:
   - Click "New Template"
   - Fill in template details
   - Add fields with appropriate types
   - Save

### For Clinicians

1. Open an encounter
2. In the "Quick Actions" section, click "Create Note"
3. Select the appropriate template from the dropdown
4. Fill out the form fields
5. Click "Save Clinical Note"

The note is automatically:
- Saved as a QuestionnaireResponse
- Converted to a DocumentReference for easy retrieval
- Linked to the current encounter and patient
- Timestamped and attributed to the current user

### Viewing Notes

Clinical notes appear in the encounter's "Notes" tab, which displays:
- Encounter notes (from the Encounter.note field)
- Clinical documents (DocumentReference resources)
- Diagnostic reports (DiagnosticReport resources)

## Technical Details

### FHIR Compliance

The implementation follows FHIR R4 standards:
- [Questionnaire Resource](https://www.hl7.org/fhir/questionnaire.html)
- [QuestionnaireResponse Resource](https://www.hl7.org/fhir/questionnaireresponse.html)
- [DocumentReference Resource](https://www.hl7.org/fhir/documentreference.html)

### Medplum Integration

Leverages Medplum's built-in features:
- [Questionnaire Builder](https://www.medplum.com/products/questionnaires)
- `QuestionnaireForm` React component
- Questionnaire search and management APIs

### Code Organization

```
examples/emr/src/
├── utils/
│   └── noteTemplates.ts          # Default templates and helper functions
├── pages/
│   └── NoteTemplatesPage.tsx     # Admin page for managing templates
├── components/
│   ├── admin/
│   │   └── EditNoteTemplateModal.tsx  # Template editor
│   └── encounter/
│       └── CreateNoteModal.tsx        # Note creation during encounters
```

## Future Enhancements

Potential improvements:
- Note signing/attestation workflow
- Template versioning
- Template categories/tags
- Smart forms with conditional logic
- Note templates with calculated fields
- Integration with voice dictation
- Note templates specific to specialties
- Collaboration/co-signing features
- Note amendment history

## References

- [Medplum Questionnaires Documentation](https://www.medplum.com/products/questionnaires)
- [FHIR Questionnaire Specification](https://www.hl7.org/fhir/questionnaire.html)
- [Medplum Questionnaire Tutorial](https://www.medplum.com/docs/tutorials/api/questionnaire)

